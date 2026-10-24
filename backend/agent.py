import json
import os
from collections.abc import Iterator

from google import genai
from google.genai import types

from pydantic import ValidationError

from models import GpaConversion, Plan, PlanEvent, ToolCallEvent, ToolResultEvent

MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
MAX_STEPS = 10

client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

SYSTEM_PROMPT = f"""You help international students plan studying abroad.
Use the tools to research the student's situation, pick the best-fit school,
then reply with ONLY a JSON object matching this schema:
{json.dumps(Plan.model_json_schema())}"""


def convert_gpa(gpa: str, from_school: str, from_location: str) -> dict:
    # Plain Gemini call for now; swap in a search-backed lookup later.
    # GpaConversion is the response schema, so the agent gets structured fields back.
    for _ in range(3):
        response = client.models.generate_content(
            model=MODEL,
            contents=f"Convert a GPA of {gpa} from {from_school} in {from_location} to the US 4.0 scale.",
            config={
                "response_mime_type": "application/json",
                "response_schema": GpaConversion,
            },
        )
        try:
            return GpaConversion.model_validate_json(response.text).model_dump()
        except ValidationError:
            continue
    raise RuntimeError("convert_gpa could not get a valid GpaConversion")


# Tools: not implemented yet.
def get_test_requirements(college: str) -> dict:
    return {"error": "not implemented"}


def get_visa_requirements(from_country: str, college_location: str) -> dict:
    return {"error": "not implemented"}


TOOLS = {
    "convert_gpa": convert_gpa,
    "get_test_requirements": get_test_requirements,
    "get_visa_requirements": get_visa_requirements,
}

TOOL_DECLARATIONS = [
    {
        "name": "convert_gpa",
        "description": "Convert a GPA from the student's home school grading system to the US 4.0 scale.",
        "parameters": {
            "type": "object",
            "properties": {
                "gpa": {"type": "string"},
                "from_school": {"type": "string"},
                "from_location": {"type": "string"},
            },
            "required": ["gpa", "from_school", "from_location"],
        },
    },
    # {
    #     "name": "get_test_requirements",
    #     "description": "Get required standardized tests (SAT, TOEFL, IELTS, ...) for a college.",
    #     "parameters": {
    #         "type": "object",
    #         "properties": {"college": {"type": "string"}},
    #         "required": ["college"],
    #     },
    # },
    # {
    #     "name": "get_visa_requirements",
    #     "description": "Get student visa requirements for someone from one country studying in another location.",
    #     "parameters": {
    #         "type": "object",
    #         "properties": {"from_country": {"type": "string"}, "college_location": {"type": "string"}},
    #         "required": ["from_country", "college_location"],
    #     },
    # },
]


def run_agent(profile: dict) -> Plan:
    for event in agent_events(profile):
        if isinstance(event, PlanEvent):
            return event.plan


def agent_events(profile: dict) -> Iterator[ToolCallEvent | ToolResultEvent | PlanEvent]:
    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT,
        tools=[types.Tool(function_declarations=TOOL_DECLARATIONS)],
    )
    contents = [types.Content(role="user", parts=[types.Part(text=f"Student profile: {json.dumps(profile)}")])]

    for _ in range(MAX_STEPS):
        response = client.models.generate_content(model=MODEL, contents=contents, config=config)
        calls = response.function_calls
        if not calls:
            text = (response.text or "").strip().removeprefix("```json").removeprefix("```").removesuffix("```")
            yield PlanEvent(plan=Plan.model_validate_json(text))
            return

        contents.append(response.candidates[0].content)
        parts = []
        for call in calls:
            yield ToolCallEvent(name=call.name, args=call.args or {})
            result = TOOLS[call.name](**(call.args or {}))
            yield ToolResultEvent(name=call.name, result=result)
            parts.append(types.Part.from_function_response(name=call.name, response=result))
        contents.append(types.Content(role="user", parts=parts))

    raise RuntimeError("agent hit max steps")
