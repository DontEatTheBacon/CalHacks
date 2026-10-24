import json
import logging
import os
import time
from collections.abc import Callable, Iterator
from datetime import date
from typing import Any, NamedTuple

import anthropic
import httpx

from pydantic import ValidationError

from sqlmodel import SQLModel

import open_data
import schedule
import scorecard
import tool_models as tm
from models import Plan, Plans, PlansEvent, Step, ToolCallEvent, ToolResultEvent

log = logging.getLogger(__name__)

MODEL = os.getenv("CLAUDE_MODEL", "claude-opus-5-5")
EFFORT = os.getenv("CLAUDE_EFFORT", "medium")  # agent turns; tool lookups run at "low"
MAX_TOKENS = 16000
MAX_STEPS = 10
PLAN_COUNT = 1
RETRIES = 3
PARSE_RETRIES = 2  # extra attempts at a valid final plan
CLAUDE_TIMEOUT_SECONDS = float(os.getenv("CLAUDE_TIMEOUT_SECONDS", "120"))  # per Claude call
MAX_RUN_SECONDS = float(os.getenv("MAX_RUN_SECONDS", "600"))  # whole agent run
RATE_LIMIT_BACKOFF = 5  # seconds to pause after a 429 without a retry-after header; doubles each attempt
MAX_RATE_LIMIT_WAIT = 60  # longer waits aren't worth holding a request open for, so give up instead
# On a safety refusal, the API re-runs the request on a fallback model it picks (server-side, beta).
FALLBACK_BETA = "server-side-fallback-2026-07-01"

# Retries are ours (below) so 429s can pause every call and be logged; the SDK's own retries are off.
client = anthropic.Anthropic(api_key=os.environ["CLAUDE_KEY"], timeout=CLAUDE_TIMEOUT_SECONDS, max_retries=0)

# After a 429, every later Claude call (agent turns and tools alike) waits until this time.
_resume_at = 0.0


def _start_cooldown(seconds: float) -> None:
    global _resume_at
    _resume_at = max(_resume_at, time.monotonic() + seconds)


def _wait_for_cooldown() -> None:
    wait = _resume_at - time.monotonic()
    if wait > 0:
        log.info("Waiting %.1fs for the Claude rate limit to clear", wait)
        time.sleep(wait)


def _retry_after(error: anthropic.APIStatusError) -> float | None:
    """The wait Claude asks for in a 429's retry-after header, if any."""
    try:
        return float(error.response.headers.get("retry-after", ""))
    except ValueError:
        return None


def call_claude[T](request: Callable[[], T]) -> T:
    """Makes a Claude request, retrying rate limits (429), overload (5xx, 529) and timeouts."""
    for attempt in range(RETRIES + 1):
        _wait_for_cooldown()
        try:
            return request()
        except anthropic.RateLimitError as e:
            if attempt == RETRIES:
                raise
            delay = _retry_after(e) or RATE_LIMIT_BACKOFF * 2 ** attempt
            if delay > MAX_RATE_LIMIT_WAIT:
                log.error("Claude rate limit asks to wait %.0fs; giving up", delay)
                raise
            log.warning("Claude rate limited (429); pausing calls for %.1fs (retry %d of %d)", delay, attempt + 1, RETRIES)
            _start_cooldown(delay)
        except anthropic.APIStatusError as e:
            if e.status_code < 500 or attempt == RETRIES:
                raise
            log.warning("Claude unavailable (%d); retrying in %ds (retry %d of %d)", e.status_code, 2 ** attempt, attempt + 1, RETRIES)
            time.sleep(2 ** attempt)
        except anthropic.APIConnectionError as e:  # includes timeouts
            if attempt == RETRIES:
                raise
            log.warning("Claude call failed (%s); retrying (retry %d of %d)", type(e).__name__, attempt + 1, RETRIES)


def generate(**kwargs):
    """One agent turn: the Messages API with refusal fallbacks and prompt caching."""
    return call_claude(lambda: client.beta.messages.create(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        betas=[FALLBACK_BETA],
        fallbacks="default",
        output_config={"effort": EFFORT},
        cache_control={"type": "ephemeral"},  # the system prompt and tools repeat every turn
        **kwargs,
    ))


def generate_structured(schema: type[SQLModel], **kwargs):
    """A single lookup whose answer is validated against the SQLModel (structured outputs)."""
    return call_claude(lambda: client.messages.parse(
        model=MODEL, max_tokens=MAX_TOKENS, output_config={"effort": "low"}, output_format=schema, **kwargs,
    ))


SYSTEM_PROMPT = f"""You help international students plan studying abroad.
Don't settle on a college straight away. Narrow down a small shortlist first:
1. Shortlist 3 to 4 colleges that fit the student's major, level and grades.
2. For each, call get_university_cost and get_application_deadlines before anything else.
3. Drop colleges whose cost per year is over the student's budget or whose deadline has passed for the start
   term. If every college is over budget, keep the cheapest and say so in its fit_reason.
4. Research the best {PLAN_COUNT} remaining college(s) in full: GPA, visa, travel, scholarships, housing,
   language, cost, insurance, standardized tests, course transfer and work.
List every shortlisted college in "considered", with its cost per year, whether it was chosen, and why.
Call independent tools together in one turn.
For travel, call get_flights first, then get_ground_route from its arrival airport to the college.
Call get_exchange_rate once with the currency of the student's citizenship country.
When the research is done, call schedule_steps last with the start term and every rigid deadline you found
(application round, scholarship, housing and insurance deadlines); use its start_date and end_date for each step.
Copy each tool result's link into the matching step; links must go to the page that states the cost or details.
Fill in metrics for every plan: match_rate (0 to 100) for how well the college fits the student's grades, budget
and goals; program_years; cost_per_year_usd from get_university_cost; work_pay_per_year_usd from get_work_options
(hourly pay times the allowed hours over the academic year); and post_study_salary_usd.
Then reply with ONLY a JSON object with one plan per college, best fit first, matching this schema:
{json.dumps(Plans.model_json_schema())}"""


def ask_structured[T: SQLModel](prompt: str, schema: type[T]) -> T:
    # One Claude lookup with the SQLModel as the output schema; swap in search-backed lookups later.
    for _ in range(3):
        response = generate_structured(schema, messages=[{"role": "user", "content": f"Today's date is {date.today()}. {prompt}"}])
        if response.parsed_output is not None:
            return response.parsed_output
        log.warning("Claude gave no valid %s (stop reason %s); asking again", schema.__name__, response.stop_reason)
    raise RuntimeError(f"could not get a valid {schema.__name__}")


class Tool(NamedTuple):
    args: type[SQLModel]
    result: type[SQLModel]
    description: str
    prompt: str  # formatted with the validated args
    run: Callable[[Any], SQLModel] | None = None  # custom lookup instead of asking Claude with the prompt


COST_PROMPT ="What are yearly tuition and living costs in USD for an international {level} student at {college}?"


def university_cost(args: tm.CollegeLevelArgs) -> tm.UniversityCost:
    # College Scorecard has exact figures for US schools; Claude fills in whatever it doesn't cover.
    try:
        school = scorecard.find_school(args.college)
    except httpx.HTTPError as e:  # Scorecard down or rate limited (DEMO_KEY allows few requests)
        log.warning("College Scorecard unavailable for %s: %s", args.college, e)
        school = None
    if school is None:  # not a US school, or Scorecard unavailable
        estimate = ask_structured(COST_PROMPT.format(**args.model_dump()), tm.UniversityCost)
        return estimate.model_copy(update={"source": "Claude estimate"})

    living = scorecard.living_cost(school)
    details = {
        "room_board_usd_per_year": school["latest.cost.roomboard.oncampus"],
        "books_usd_per_year": school["latest.cost.booksupply"],
        "link": tm.ResourceLink(url=scorecard.page_url(school), label="College Scorecard"),
    }
    tuition = school["latest.cost.tuition.out_of_state"]  # international students pay out-of-state rates
    if args.level == "undergraduate" and tuition is not None and living is not None:
        return tm.UniversityCost(tuition_usd_per_year=tuition, living_usd_per_year=living, source="College Scorecard", **details)

    # Scorecard tuition is undergraduate only, so estimate graduate tuition but keep its living costs.
    estimate = ask_structured(COST_PROMPT.format(**args.model_dump()), tm.UniversityCost)
    return tm.UniversityCost(
        tuition_usd_per_year=estimate.tuition_usd_per_year,
        living_usd_per_year=living if living is not None else estimate.living_usd_per_year,
        fees_usd_per_year=estimate.fees_usd_per_year,
        source="College Scorecard (living costs), Claude estimate (graduate tuition)",
        **details,
    )


TOOLS = {
    "convert_gpa": Tool(
        tm.ConvertGpaArgs, tm.GpaConversion,
        "Convert a GPA from the student's home grading system to the US 4.0 scale.",
        "Convert a GPA of {gpa} from {from_school} in {from_location} to the US 4.0 scale.",
    ),
    "get_visa_requirements": Tool(
        tm.CountryArgs, tm.VisaRequirements,
        "Look up the student visa, key documents and processing time.",
        "What student visa does a citizen of {citizenship} need to study in {study_country}? "
        "List only the key documents.",
    ),
    "get_flights": Tool(
        tm.TravelArgs, tm.FlightInfo,
        "Air travel only: departure and arrival airports, flight time and layovers.",
        "A student from {from_location} is flying to attend {college}. Which airport should they leave from, "
        "which international airport is closest to the college, how long is the trip including layovers, "
        "and where do flights usually connect?",
    ),
    "get_ground_route": Tool(
        tm.GroundRouteArgs, tm.RouteOptions,
        "Ways to get from a place (usually the arrival airport) to the college: for each option, every leg's "
        "transport type, line name, duration and where it ends.",
        "Give 2 to 4 different ways to get from {origin} to {college}, such as public transport, taxi or rideshare, "
        "and an airport shuttle, fastest first. For each, name it and list its legs in order: the transport type, "
        "the line name if any, the duration in hours, and where each leg ends, plus the total fare in USD. "
        "Also list any forms of transport that are banned or not allowed.",
    ),
    "find_scholarships": Tool(
        tm.CollegeCitizenshipArgs, tm.Scholarships,
        "Find scholarships an international student can apply to.",
        "List up to 5 scholarships at or for {college} that a citizen of {citizenship} can apply to.",
    ),
    "get_housing_options": Tool(
        tm.CollegeArgs, tm.HousingInfo,
        "Look up on- and off-campus housing costs.",
        "What are typical monthly housing costs in USD at {college}, on and off campus, "
        "and is first-year housing guaranteed?",
    ),
    "get_language_requirements": Tool(
        tm.CollegeCitizenshipArgs, tm.LanguageRequirements,
        "Look up accepted English tests, minimum scores and waivers.",
        "Which English proficiency tests and minimum scores does {college} accept, "
        "and can a citizen of {citizenship} get a waiver?",
    ),
    "get_application_deadlines": Tool(
        tm.CollegeLevelArgs, tm.ApplicationDeadlines,
        "Look up application deadlines and the application fee.",
        "What are the {level} application deadlines and application fee at {college}?",
    ),
    "get_university_cost": Tool(
        tm.CollegeLevelArgs, tm.UniversityCost,
        "Look up yearly tuition and living costs.",
        COST_PROMPT,
        university_cost,
    ),
    "get_insurance_requirements": Tool(
        tm.CollegeArgs, tm.InsuranceRequirements,
        "Look up health insurance requirements for international students.",
        "What health insurance must international students have at {college}?",
    ),
    "get_standardized_tests": Tool(
        tm.CollegeLevelArgs, tm.TestRequirements,
        "Look up required and recommended standardized tests (SAT, ACT, GRE, ...).",
        "Which standardized tests (e.g. SAT, ACT, GRE, GMAT) does {college} require or recommend "
        "for international {level} applicants? Exclude English proficiency tests.",
    ),
    "check_course_transfer": Tool(
        tm.TransferArgs, tm.CourseTransfer,
        "Check whether course credit can transfer between schools.",
        "Can a student transfer course credit from {from_school} to {college}? "
        "Include the credit limit and any credential evaluation needed.",
    ),
    "get_work_options": Tool(
        tm.WorkArgs, tm.WorkOptions,
        "Look up work rights and pay during and after studies.",
        "What can a citizen of {citizenship} studying {major} at {college} in {study_country} do for work during "
        "and after studies? Include the typical hourly pay for on-campus student jobs there and the typical "
        "starting salary for {major} graduates.",
    ),
}

# Claude is told to call this last: dates come from code, counting back from the start term and the rigid deadlines.
TOOLS["schedule_steps"] = Tool(
    tm.ScheduleArgs, tm.Schedule,
    "Call last. Sets every step's start_date and end_date from the start term and the rigid deadlines found earlier.",
    "",
    schedule.schedule_steps,
)
TOOLS["get_exchange_rate"] = Tool(
    tm.ExchangeArgs, tm.ExchangeRate,
    "Get the official USD exchange rate (European Central Bank) for the student's home currency.",
    "",
    open_data.exchange_rate,
)
SCHEDULE_NUDGE ="Before giving the plans, call schedule_steps with the start term and the rigid deadlines you found."

TOOL_DEFINITIONS = [
    {"name": name, "description": tool.description, "input_schema": tool.args.model_json_schema()}
    for name, tool in TOOLS.items()
]


def run_tool(name: str, args: dict) -> dict:
    started = time.monotonic()
    try:
        tool = TOOLS[name]
        validated = tool.args.model_validate(args)
        if tool.run:
            result = tool.run(validated)
        else:
            result = ask_structured(tool.prompt.format(**validated.model_dump()), tool.result)
        data = result.model_dump(mode="json")  # JSON mode turns dates into strings
        if college := getattr(validated, "college", None):
            open_data.mark_official_links(data, open_data.college_domains(college))
        log.info("Tool %s finished in %.1fs", name, time.monotonic() - started)
        return data
    except Exception as e:
        # Report failures back to the agent so one bad tool doesn't end the run.
        log.warning("Tool %s failed after %.1fs: %s", name, time.monotonic() - started, e, exc_info=not isinstance(e, anthropic.APIError))
        return {"error": str(e)}


def run_agent(profile: dict) -> Plans:
    for event in agent_events(profile):
        if isinstance(event, PlansEvent):
            return Plans(plans=event.plans, considered=event.considered)


def _strip_fences(text: str) -> str:
    return text.strip().removeprefix("```json").removeprefix("```").removesuffix("```")


def _text(response) -> str:
    return "".join(block.text for block in response.content if block.type == "text")


def final_plans(messages: list, system: str, response) -> Plans:
    """Validates the agent's final answer; if it's invalid, asks again (tools off) with the errors.

    The Plans schema is too large for structured outputs, so this relies on the schema in the system prompt.
    """
    for attempt in range(PARSE_RETRIES + 1):
        try:
            return Plans.model_validate_json(_strip_fences(_text(response)))
        except ValidationError as e:
            problems = "\n".join(f"{'.'.join(map(str, error['loc']))}: {error['msg']}" for error in e.errors()[:10])
            if attempt == PARSE_RETRIES:
                log.error("Final plan still invalid after %d retries:\n%s", PARSE_RETRIES, problems)
                raise
            log.warning("Final plan invalid; asking again (retry %d of %d):\n%s", attempt + 1, PARSE_RETRIES, problems)
            messages = [
                *messages,
                {"role": "assistant", "content": response.content},
                {"role": "user", "content": f"That reply did not match the schema:\n{problems}\nReply with ONLY the corrected JSON object."},
            ]
            response = generate(system=system, tools=TOOL_DEFINITIONS, tool_choice={"type": "none"}, messages=messages)


def apply_schedules(plans: list[Plan], schedules: dict[str, tm.Schedule]) -> None:
    """Sets each step's start_date and end_date from schedule_steps, so the dates come from code, not Claude."""
    for plan in plans:
        found = schedules.get(plan.school) or (next(iter(schedules.values())) if len(schedules) == 1 else None)
        if found is None:
            continue
        windows = {step.step_type: step for step in found.steps}
        for step in plan.steps:
            if window := windows.get(step.type):
                step.start_date, step.end_date = window.start_date, window.end_date


SHORTLIST_TOOLS = {"get_university_cost", "get_application_deadlines"}  # used to narrow down candidates
NOT_AI_TOOLS ={"get_exchange_rate", "schedule_steps"}  # an API and our own code


def is_ai_generated(name: str, result: dict) -> bool:
    """Whether a tool result came from Claude (true) rather than an API or our own code."""
    if name in NOT_AI_TOOLS:
        return "error" in result
    if name == "get_university_cost":  # College Scorecard alone, or partly a Claude estimate
        return result.get("source") != "College Scorecard"
    return True


def mark_ai_generated(plans: list[Plan], api_costs: dict[str, bool]) -> None:
    """Flags steps whose facts came from Claude; only cost steps backed purely by College Scorecard aren't."""
    for plan in plans:
        api_cost = api_costs.get(plan.school, len(api_costs) == 1 and next(iter(api_costs.values())))
        for step in plan.steps:
            step.ai_generated = not (step.type == "cost" and api_cost)


def apply_open_data(plans: list[Plan], exchange: tm.ExchangeRate | None) -> None:
    """Sets the fields that come from open data: the home-currency rate, official website and official links."""
    for plan in plans:
        if exchange and plan.metrics:
            plan.metrics.home_currency, plan.metrics.usd_to_home_rate = exchange.currency, exchange.rate
        try:
            university = open_data.find_university(plan.school)
        except httpx.HTTPError as e:
            log.warning("University list unavailable for %s: %s", plan.school, e)
            university = None
        domains = university["domains"] if university else []
        if university and university["web_pages"]:
            website = university["web_pages"][0].replace("http://", "https://", 1)  # the list still stores http
            plan.school_website = tm.ResourceLink(url=website, label="Official website", official=True)
        for step in plan.steps:
            if step.link:
                step.link.official = open_data.is_official(step.link.url, domains)


def agent_events(profile: dict) -> Iterator[ToolCallEvent | ToolResultEvent | PlansEvent]:
    system = f"Today's date is {date.today()}. Use upcoming dates only.\n{SYSTEM_PROMPT}"
    messages: list = [{"role": "user", "content": f"Student profile: {json.dumps(profile)}"}]

    started = time.monotonic()
    log.info("Agent run started for a %s %s student", profile.get("level"), profile.get("major"))
    nudged = False  # only ask for schedule_steps once, even if it fails

    schools: list[str] = []  # every college the agent has looked up, in order, including shortlisted ones
    researched: list[str] = []  # colleges researched beyond the shortlist checks
    schedules: dict[str, tm.Schedule] = {}  # by college, from schedule_steps
    exchange: tm.ExchangeRate | None = None  # from get_exchange_rate
    api_costs: dict[str, bool] = {}  # by college: whether its costs came only from College Scorecard
    next_id = 0  # ids pair each ToolCallEvent with its ToolResultEvent
    for turn in range(1, MAX_STEPS + 1):
        elapsed = time.monotonic() - started
        if elapsed > MAX_RUN_SECONDS:
            log.error("Agent run timed out after %.0fs (%d turns)", elapsed, turn - 1)
            raise TimeoutError(f"the agent took longer than {MAX_RUN_SECONDS:.0f}s")

        plans = None
        try:
            response = generate(system=system, tools=TOOL_DEFINITIONS, messages=messages)
            if response.stop_reason == "refusal":
                raise RuntimeError("Claude declined to answer this request")
            calls = [block for block in response.content if block.type == "tool_use"]
            if not calls and next_id > 0 and not schedules and not nudged:
                # Forced tool choice isn't available on this model, so ask for schedule_steps by name instead.
                log.info("Agent tried to finish without schedule_steps; asking for it")
                nudged = True
                messages.append({"role": "assistant", "content": response.content})
                messages.append({"role": "user", "content": SCHEDULE_NUDGE})
                continue
            if not calls:
                plans = final_plans(messages, system, response)
                apply_schedules(plans.plans, schedules)
                apply_open_data(plans.plans, exchange)
                mark_ai_generated(plans.plans, api_costs)
        except anthropic.RateLimitError:
            # UPDATE LATER: temporary short circuit. If we're still rate limited after the retries in
            # call_claude(), skip the rest of the research and just select the colleges researched so far.
            chosen = researched or schools[:1] or ["Undecided"]
            log.warning("Still rate limited; returning %d researched college(s) without steps", len(chosen))
            plans = Plans(plans=[Plan(school=school, steps=[]) for school in chosen])
        if plans is not None:
            log.info("Agent run finished in %.1fs after %d turn(s) with %d plan(s), %d college(s) considered",
                     time.monotonic() - started, turn, len(plans.plans), len(plans.considered))
            yield PlansEvent(plans=plans.plans, considered=plans.considered)
            return

        log.info("Turn %d: calling %s", turn, ", ".join(call.name for call in calls))
        messages.append({"role": "assistant", "content": response.content})
        # Run this turn's tool calls one at a time, in the order Claude asked for them.
        results = []
        for call in calls:
            args = call.input or {}
            school = args.get("college")
            if school and school not in schools:
                schools.append(school)
            if school and call.name not in SHORTLIST_TOOLS and school not in researched:
                researched.append(school)
            yield ToolCallEvent(id=next_id, name=call.name, school=school, args=args)
            result = run_tool(call.name, args)
            yield ToolResultEvent(
                id=next_id, name=call.name, school=school, result=result, ai_generated=is_ai_generated(call.name, result),
            )
            if call.name == "get_university_cost" and "error" not in result:
                api_costs[args.get("college", "")] = not is_ai_generated(call.name, result)
            if call.name == "schedule_steps" and "error" not in result:
                try:
                    schedules[result["college"]] = tm.Schedule.model_validate(result)
                except (KeyError, ValidationError):
                    log.warning("Ignoring a malformed schedule_steps result")
            if call.name == "get_exchange_rate" and "error" not in result:
                try:
                    exchange = tm.ExchangeRate.model_validate(result)
                except ValidationError:
                    log.warning("Ignoring a malformed get_exchange_rate result")
            results.append(result)
            next_id += 1

        # All of a turn's results go back in one user message.
        messages.append({"role": "user", "content": [
            {"type": "tool_result", "tool_use_id": call.id, "content": json.dumps(result), "is_error": "error" in result}
            for call, result in zip(calls, results)
        ]})

    log.error("Agent run hit the %d-turn limit", MAX_STEPS)
    raise RuntimeError("agent hit max steps")


REDO_PROMPT = """Today's date is {today}. A student is planning to study at {school}.
Student profile: {profile}
Suggest one new "{step_type}" step for their plan. The student rejected these earlier suggestions, so don't repeat
them or offer anything similar; choose a genuinely different option, provider, route or approach:
{rejected}
{feedback}Include a link to the page that states the details."""


def redo_step(profile: dict, school: str, rejected: list[Step], feedback: str | None) -> Step:
    """A new version of a step, unlike every rejected one. Dates stay from the schedule; the facts come from Claude."""
    current = rejected[-1]
    shown = [step.model_dump(mode="json", exclude={"start_date", "end_date", "complete", "ai_generated"}) for step in rejected]
    prompt = REDO_PROMPT.format(
        today=date.today(),
        school=school,
        profile=json.dumps(profile),
        step_type=current.type,
        rejected=json.dumps(shown, indent=1),
        feedback=f"What the student wants instead: {feedback}\n" if feedback else "",
    )
    log.info("Redoing the %s step for %s (%d rejected)", current.type, school, len(rejected))
    for _ in range(3):
        response = generate_structured(type(current), messages=[{"role": "user", "content": prompt}])
        if response.parsed_output is not None and response.parsed_output.type == current.type:
            break
        log.warning("Claude gave no valid %s step; asking again", current.type)
    else:
        raise RuntimeError(f"could not get a new {current.type} step")
    step = response.parsed_output.model_copy(update={
        "start_date": current.start_date, "end_date": current.end_date, "complete": False, "ai_generated": True,
    })
    if step.link:
        step.link.official = open_data.is_official(step.link.url, open_data.college_domains(school))
    return step
