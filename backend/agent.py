import json
import os
import time
from collections.abc import Callable, Iterator
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date
from typing import Any, NamedTuple

import httpx
from google import genai
from google.genai import errors, types

from pydantic import ValidationError

from sqlmodel import SQLModel

import maps
import scorecard
import tool_models as tm
from models import Plan, Plans, PlansEvent, ToolCallEvent, ToolResultEvent

MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
MAX_STEPS = 10
PLAN_COUNT = 1
RETRIES = 3
PARALLEL_TOOLS = 4

client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])


def generate(**kwargs) -> types.GenerateContentResponse:
    # Retry 503 "high demand" errors with a short backoff (1s, 2s, 4s).
    for attempt in range(RETRIES + 1):
        try:
            return client.models.generate_content(model=MODEL, **kwargs)
        except errors.ServerError as e:
            if e.code != 503 or attempt == RETRIES:
                raise
            time.sleep(2 ** attempt)

SYSTEM_PROMPT = f"""You help international students plan studying abroad.
Pick the {PLAN_COUNT} best-fit colleges for the student's major, level and budget,
then use the tools to research every part of the move for each one:
GPA, visa, travel, scholarships, housing, language, deadlines, cost, insurance,
standardized tests, course transfer and work. Call independent tools together in one turn.
For travel, call get_flights first, then get_ground_route from its arrival airport to the college.
Copy each tool result's link into the matching step.
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


GROUND_PROMPT = (
    "List the public transport route from {origin} to {college} (or by car if there is none) as legs in order: "
    "the transport type, the line name if any, the duration in hours, and where each leg ends. "
    "Also list any forms of transport that are banned or not allowed."
)


def ground_route(args: tm.GroundRouteArgs) -> tm.TravelInfo:
    # Google Maps has real transit lines and times; Gemini estimates when there's no key or no route.
    try:
        route = maps.ground_route(args.origin, args.college)
    except httpx.HTTPError:
        route = None
    if route:
        return route
    estimate = ask_structured(GROUND_PROMPT.format(**args.model_dump()), tm.TravelInfo)
    return estimate.model_copy(update={"source": "Gemini estimate"})


COST_PROMPT ="What are yearly tuition and living costs in USD for an international {level} student at {college}?"


def university_cost(args: tm.CollegeLevelArgs) -> tm.UniversityCost:
    # College Scorecard has exact figures for US schools; Gemini fills in whatever it doesn't cover.
    try:
        school = scorecard.find_school(args.college)
    except httpx.HTTPError:  # Scorecard down or rate limited (DEMO_KEY allows few requests)
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
        tm.GroundRouteArgs, tm.TravelInfo,
        "Ground route from a place (usually the arrival airport) to the college: each leg's transport type, "
        "line name, duration and where it ends.",
        GROUND_PROMPT,
        ground_route,
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
        tm.CountryArgs, tm.WorkOptions,
        "Look up work rights during and after studies.",
        "What can a citizen of {citizenship} studying in {study_country} do for work during and after studies?",
    ),
}

TOOL_DECLARATIONS = [
    {"name": name, "description": tool.description, "parameters": tool.args.model_json_schema()}
    for name, tool in TOOLS.items()
]


def run_tool(name: str, args: dict) -> dict:
    try:
        tool = TOOLS[name]
        validated = tool.args.model_validate(args)
        if tool.run:
            result = tool.run(validated)
        else:
            result = ask_structured(tool.prompt.format(**validated.model_dump()), tool.result)
        return result.model_dump(mode="json")  # JSON mode turns dates into strings for Gemini
    except Exception as e:
        # Report failures back to the agent so one bad tool doesn't end the run.
        return {"error": str(e)}


def run_agent(profile: dict) -> Plans:
    for event in agent_events(profile):
        if isinstance(event, PlansEvent):
            return Plans(plans=event.plans)


def agent_events(profile: dict) -> Iterator[ToolCallEvent | ToolResultEvent | PlansEvent]:
    config = types.GenerateContentConfig(
        system_instruction=f"Today's date is {date.today()}. Use upcoming dates only.\n{SYSTEM_PROMPT}",
        tools=[types.Tool(function_declarations=TOOL_DECLARATIONS)],
    )
    contents = [types.Content(role="user", parts=[types.Part(text=f"Student profile: {json.dumps(profile)}")])]

    schools: list[str] = []  # colleges the agent has researched, in order
    next_id = 0  # ids pair each ToolCallEvent with its ToolResultEvent
    for _ in range(MAX_STEPS):
        try:
            response = generate(contents=contents, config=config)
        except errors.ClientError as e:
            # UPDATE LATER: temporary short circuit. On a 429 rate limit, skip the rest of
            # the research and just select the colleges researched so far, with no steps.
            if e.code != 429:
                raise
            yield PlansEvent(plans=[Plan(school=school, steps=[]) for school in schools or ["Undecided"]])
            return
        calls = response.function_calls
        if not calls:
            text = (response.text or "").strip().removeprefix("```json").removeprefix("```").removesuffix("```")
            yield PlansEvent(plans=Plans.model_validate_json(text).plans)
            return

        contents.append(response.candidates[0].content)
        ids = list(range(next_id, next_id + len(calls)))
        next_id += len(calls)
        for call_id, call in zip(ids, calls):
            yield ToolCallEvent(id=call_id, name=call.name, args=call.args or {})
            school = (call.args or {}).get("college")
            if school and school not in schools:
                schools.append(school)

        # Run this turn's tool calls in parallel and stream each result as it finishes.
        results = {}
        with ThreadPoolExecutor(PARALLEL_TOOLS) as pool:
            futures = {pool.submit(run_tool, call.name, call.args or {}): i for i, call in enumerate(calls)}
            for future in as_completed(futures):
                i = futures[future]
                results[i] = future.result()
                yield ToolResultEvent(id=ids[i], name=calls[i].name, result=results[i])

        contents.append(types.Content(role="user", parts=[
            types.Part.from_function_response(name=call.name, response=results[i])
            for i, call in enumerate(calls)
        ]))

    raise RuntimeError("agent hit max steps")
