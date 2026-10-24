import json
import logging
import os
import time
from collections.abc import Callable, Iterator
from datetime import date
from typing import Any, NamedTuple

import httpx
from google import genai
from google.genai import errors, types

from pydantic import ValidationError

from sqlmodel import SQLModel

import scorecard
import tool_models as tm
from models import Plan, Plans, PlansEvent, ToolCallEvent, ToolResultEvent

log = logging.getLogger(__name__)

MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
MAX_STEPS = 10
PLAN_COUNT = 1
RETRIES = 3
PARSE_RETRIES = 2  # extra attempts at a valid final plan
GEMINI_TIMEOUT_SECONDS = float(os.getenv("GEMINI_TIMEOUT_SECONDS", "60"))  # per Gemini call
MAX_RUN_SECONDS = float(os.getenv("MAX_RUN_SECONDS", "300"))  # whole agent run
RATE_LIMIT_BACKOFF = 5  # seconds to pause after a 429 without a retry delay; doubles each attempt
MAX_RATE_LIMIT_WAIT = 60  # longer waits mean the daily quota is gone, so give up instead

client = genai.Client(
    api_key=os.environ["GEMINI_API_KEY"],
    http_options=types.HttpOptions(timeout=int(GEMINI_TIMEOUT_SECONDS * 1000)),  # milliseconds
)

# After a 429, every later Gemini call (agent turns and tools alike) waits until this time.
_resume_at = 0.0


def _start_cooldown(seconds: float) -> None:
    global _resume_at
    _resume_at = max(_resume_at, time.monotonic() + seconds)


def _wait_for_cooldown() -> None:
    wait = _resume_at - time.monotonic()
    if wait > 0:
        log.info("Waiting %.1fs for the Gemini rate limit to clear", wait)
        time.sleep(wait)


def _retry_delay(error: errors.APIError) -> float | None:
    """The wait Gemini asks for in a 429 (its RetryInfo detail, e.g. "23s"), if any."""
    details = error.details.get("error", {}).get("details", []) if isinstance(error.details, dict) else []
    for detail in details:
        if detail.get("@type", "").endswith("RetryInfo"):
            try:
                return float(detail.get("retryDelay", "").rstrip("s"))
            except ValueError:
                return None
    return None


def generate(**kwargs) -> types.GenerateContentResponse:
    """Calls Gemini, retrying rate limits (429), overload (503) and timeouts."""
    for attempt in range(RETRIES + 1):
        _wait_for_cooldown()
        try:
            return client.models.generate_content(model=MODEL, **kwargs)
        except errors.ClientError as e:
            if e.code != 429 or attempt == RETRIES:
                raise
            delay = _retry_delay(e) or RATE_LIMIT_BACKOFF * 2 ** attempt
            if delay > MAX_RATE_LIMIT_WAIT:
                log.error("Gemini quota exhausted (it asked to wait %.0fs); giving up", delay)
                raise
            log.warning("Gemini rate limited (429); pausing calls for %.1fs (retry %d of %d)", delay, attempt + 1, RETRIES)
            _start_cooldown(delay)
        except errors.ServerError as e:
            if e.code != 503 or attempt == RETRIES:
                raise
            log.warning("Gemini overloaded (503); retrying in %ds (retry %d of %d)", 2 ** attempt, attempt + 1, RETRIES)
            time.sleep(2 ** attempt)
        except httpx.TimeoutException:
            if attempt == RETRIES:
                raise
            log.warning("Gemini call timed out after %.0fs; retrying (retry %d of %d)", GEMINI_TIMEOUT_SECONDS, attempt + 1, RETRIES)

SYSTEM_PROMPT = f"""You help international students plan studying abroad.
Pick the {PLAN_COUNT} best-fit colleges for the student's major, level and budget,
then use the tools to research every part of the move for each one:
GPA, visa, travel, scholarships, housing, language, deadlines, cost, insurance,
standardized tests, course transfer and work. Call independent tools together in one turn.
For travel, call get_flights first, then get_ground_route from its arrival airport to the college.
Copy each tool result's link into the matching step; links must go to the page that states the cost or details.
Fill in metrics for every plan: match_rate (0 to 100) for how well the college fits the student's grades, budget
and goals; program_years; cost_per_year_usd from get_university_cost; work_pay_per_year_usd from get_work_options
(hourly pay times the allowed hours over the academic year); and post_study_salary_usd.
Then reply with ONLY a JSON object with one plan per college, best fit first, matching this schema:
{json.dumps(Plans.model_json_schema())}"""


def ask_structured[T: SQLModel](prompt: str, schema: type[T]) -> T:
    # Plain Gemini call with the SQLModel as response schema; swap in search-backed lookups later.
    for _ in range(3):
        response = generate(
            contents=f"Today's date is {date.today()}. {prompt}",
            config={
                "response_mime_type": "application/json",
                "response_schema": schema,
            },
        )
        try:
            return schema.model_validate_json(response.text)
        except ValidationError:
            continue
    raise RuntimeError(f"could not get a valid {schema.__name__}")


class Tool(NamedTuple):
    args: type[SQLModel]
    result: type[SQLModel]
    description: str
    prompt: str  # formatted with the validated args
    run: Callable[[Any], SQLModel] | None = None  # custom lookup instead of asking Gemini with the prompt


COST_PROMPT ="What are yearly tuition and living costs in USD for an international {level} student at {college}?"


def university_cost(args: tm.CollegeLevelArgs) -> tm.UniversityCost:
    # College Scorecard has exact figures for US schools; Gemini fills in whatever it doesn't cover.
    try:
        school = scorecard.find_school(args.college)
    except httpx.HTTPError as e:  # Scorecard down or rate limited (DEMO_KEY allows few requests)
        log.warning("College Scorecard unavailable for %s: %s", args.college, e)
        school = None
    if school is None:  # not a US school, or Scorecard unavailable
        estimate = ask_structured(COST_PROMPT.format(**args.model_dump()), tm.UniversityCost)
        return estimate.model_copy(update={"source": "Gemini estimate"})

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
        source="College Scorecard (living costs), Gemini estimate (graduate tuition)",
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

TOOL_DECLARATIONS = [
    {"name": name, "description": tool.description, "parameters": tool.args.model_json_schema()}
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
        log.info("Tool %s finished in %.1fs", name, time.monotonic() - started)
        return result.model_dump(mode="json")  # JSON mode turns dates into strings for Gemini
    except Exception as e:
        # Report failures back to the agent so one bad tool doesn't end the run.
        log.warning("Tool %s failed after %.1fs: %s", name, time.monotonic() - started, e, exc_info=not isinstance(e, errors.APIError))
        return {"error": str(e)}


def run_agent(profile: dict) -> Plans:
    for event in agent_events(profile):
        if isinstance(event, PlansEvent):
            return Plans(plans=event.plans)


def _strip_fences(text: str) -> str:
    return text.strip().removeprefix("```json").removeprefix("```").removesuffix("```")


def final_plans(contents: list[types.Content], system_instruction: str, text: str) -> list[Plan]:
    """Validates the agent's final answer; if it's invalid, asks again in JSON mode with the errors."""
    retry_config = types.GenerateContentConfig(
        system_instruction=system_instruction,
        response_mime_type="application/json",
        response_json_schema=Plans.model_json_schema(),
    )
    for attempt in range(PARSE_RETRIES + 1):
        try:
            return Plans.model_validate_json(_strip_fences(text)).plans
        except ValidationError as e:
            problems = "\n".join(f"{'.'.join(map(str, error['loc']))}: {error['msg']}" for error in e.errors()[:10])
            if attempt == PARSE_RETRIES:
                log.error("Final plan still invalid after %d retries:\n%s", PARSE_RETRIES, problems)
                raise
            log.warning("Final plan invalid; asking again (retry %d of %d):\n%s", attempt + 1, PARSE_RETRIES, problems)
            contents = [
                *contents,
                types.Content(role="model", parts=[types.Part(text=text or "(empty reply)")]),
                types.Content(role="user", parts=[types.Part(
                    text=f"That reply did not match the schema:\n{problems}\nReply with ONLY the corrected JSON object.",
                )]),
            ]
            text = generate(contents=contents, config=retry_config).text or ""


def agent_events(profile: dict) -> Iterator[ToolCallEvent | ToolResultEvent | PlansEvent]:
    config = types.GenerateContentConfig(
        system_instruction=f"Today's date is {date.today()}. Use upcoming dates only.\n{SYSTEM_PROMPT}",
        tools=[types.Tool(function_declarations=TOOL_DECLARATIONS)],
    )
    contents = [types.Content(role="user", parts=[types.Part(text=f"Student profile: {json.dumps(profile)}")])]

    started = time.monotonic()
    log.info("Agent run started for a %s %s student", profile.get("level"), profile.get("major"))
    schools: list[str] = []  # colleges the agent has researched, in order
    next_id = 0  # ids pair each ToolCallEvent with its ToolResultEvent
    for turn in range(1, MAX_STEPS + 1):
        elapsed = time.monotonic() - started
        if elapsed > MAX_RUN_SECONDS:
            log.error("Agent run timed out after %.0fs (%d turns)", elapsed, turn - 1)
            raise TimeoutError(f"the agent took longer than {MAX_RUN_SECONDS:.0f}s")

        plans = None
        try:
            response = generate(contents=contents, config=config)
            calls = response.function_calls
            if not calls:
                plans = final_plans(contents, config.system_instruction, response.text or "")
        except errors.ClientError as e:
            # UPDATE LATER: temporary short circuit. If we're still rate limited after the retries in
            # generate(), skip the rest of the research and just select the colleges researched so far.
            if e.code != 429:
                raise
            log.warning("Still rate limited; returning %d researched college(s) without steps", len(schools))
            plans = [Plan(school=school, steps=[]) for school in schools or ["Undecided"]]
        if plans is not None:
            log.info("Agent run finished in %.1fs after %d turn(s) with %d plan(s)", time.monotonic() - started, turn, len(plans))
            yield PlansEvent(plans=plans)
            return

        log.info("Turn %d: calling %s", turn, ", ".join(call.name for call in calls))
        contents.append(response.candidates[0].content)
        # Run this turn's tool calls one at a time, in the order Gemini asked for them.
        results = []
        for call in calls:
            args = call.args or {}
            school = args.get("college")
            if school and school not in schools:
                schools.append(school)
            yield ToolCallEvent(id=next_id, name=call.name, args=args)
            result = run_tool(call.name, args)
            yield ToolResultEvent(id=next_id, name=call.name, result=result)
            results.append(result)
            next_id += 1

        contents.append(types.Content(role="user", parts=[
            types.Part.from_function_response(name=call.name, response=result)
            for call, result in zip(calls, results)
        ]))

    log.error("Agent run hit the %d-turn limit", MAX_STEPS)
    raise RuntimeError("agent hit max steps")
