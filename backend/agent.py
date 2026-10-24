import json
import os

from google import genai
from google.genai import types

MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
MAX_STEPS = 10

SYSTEM_PROMPT = """You help international students plan studying abroad.
Use the tools to research the student's situation, pick the best-fit school,
then reply with ONLY a JSON object of the form:
{"school": "...", "steps": [{"title": "...", "category": "visa|testing|transportation|...", "description": "...", "deadline": "..."}]}"""


# Tools: not implemented yet.
def convert_gpa(gpa: str, from_country: str) -> dict:
    return {"error": "not implemented"}


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
        "description": "Convert a GPA from the student's home grading system to the US 4.0 scale.",
        "parameters": {
            "type": "object",
            "properties": {"gpa": {"type": "string"}, "from_country": {"type": "string"}},
            "required": ["gpa", "from_country"],
        },
    },
    {
        "name": "get_test_requirements",
        "description": "Get required standardized tests (SAT, TOEFL, IELTS, ...) for a college.",
        "parameters": {
            "type": "object",
            "properties": {"college": {"type": "string"}},
            "required": ["college"],
        },
    },
    {
        "name": "get_visa_requirements",
        "description": "Get student visa requirements for someone from one country studying in another location.",
        "parameters": {
            "type": "object",
            "properties": {"from_country": {"type": "string"}, "college_location": {"type": "string"}},
            "required": ["from_country", "college_location"],
        },
    },
]


def run_agent(profile: dict) -> dict:
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT,
        tools=[types.Tool(function_declarations=TOOL_DECLARATIONS)],
    )
    contents = [types.Content(role="user", parts=[types.Part(text=f"Student profile: {json.dumps(profile)}")])]

    for _ in range(MAX_STEPS):
        response = client.models.generate_content(model=MODEL, contents=contents, config=config)
        calls = response.function_calls
        if not calls:
            text = response.text or ""
            try:
                return json.loads(text.strip().removeprefix("```json").removesuffix("```"))
            except json.JSONDecodeError:
                return {"raw": text}

        contents.append(response.candidates[0].content)
        contents.append(types.Content(role="user", parts=[
            types.Part.from_function_response(name=call.name, response=TOOLS[call.name](**call.args))
            for call in calls
        ]))

    return {"error": "agent hit max steps"}
