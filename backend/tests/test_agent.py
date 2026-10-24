from datetime import date

import pytest
from google.genai import errors

import agent
import models
from samples import gemini_response, plans_text

VISA = ("get_visa_requirements", {"citizenship": "India", "study_country": "USA"})


def housing(college):
    return ("get_housing_options", {"college": college})


@pytest.fixture
def fake_tools(monkeypatch):
    """Replaces run_tool and records each call in the order it ran."""
    runs = []

    def fake_run_tool(name, args):
        runs.append((name, args))
        return {"tool": name, "college": args.get("college")}

    monkeypatch.setattr(agent, "run_tool", fake_run_tool)
    return runs


def test_streams_calls_results_and_plans_with_matching_ids(scripted_gemini, fake_tools):
    scripted_gemini.script += [
        gemini_response([VISA, housing("Purdue University")]),
        gemini_response([housing("MIT")]),
        gemini_response(text=f"```json\n{plans_text('Purdue University', 'MIT')}\n```"),
    ]
    events = list(agent.agent_events({"gpa": "8.5"}))

    # Each tool runs to completion, in Gemini's order, before the next one starts.
    assert [(e.type, e.id, e.name) for e in events[:-1]] == [
        ("tool_call", 0, "get_visa_requirements"), ("tool_result", 0, "get_visa_requirements"),
        ("tool_call", 1, "get_housing_options"), ("tool_result", 1, "get_housing_options"),
        ("tool_call", 2, "get_housing_options"), ("tool_result", 2, "get_housing_options"),
    ]
    assert [args.get("college") for _, args in fake_tools] == [None, "Purdue University", "MIT"]
    assert isinstance(events[-1], models.PlansEvent)
    assert [p.school for p in events[-1].plans] == ["Purdue University", "MIT"]
    assert len(fake_tools) == 3


def test_results_go_back_to_gemini_in_call_order(scripted_gemini, fake_tools):
    scripted_gemini.script += [
        gemini_response([VISA, housing("A"), housing("B")]),
        gemini_response(text=plans_text("A")),
    ]
    list(agent.agent_events({}))
    responses = scripted_gemini.sent[-1]["contents"][-1].parts
    assert [(p.function_response.name, p.function_response.response.get("college")) for p in responses] == [
        ("get_visa_requirements", None), ("get_housing_options", "A"), ("get_housing_options", "B"),
    ]


def test_repeated_calls_each_run(scripted_gemini, fake_tools):
    scripted_gemini.script += [gemini_response([VISA, VISA]), gemini_response([VISA]), gemini_response(text=plans_text("A"))]
    list(agent.agent_events({}))
    assert len(fake_tools) == 3


def test_system_prompt_has_todays_date_and_plan_schema(scripted_gemini):
    scripted_gemini.script.append(gemini_response(text=plans_text("A")))
    list(agent.agent_events({}))
    instruction = scripted_gemini.sent[0]["config"].system_instruction
    assert str(date.today()) in instruction
    assert '"plans"' in instruction


def rate_limited():
    return errors.ClientError(429, {"error": {"code": 429, "message": "quota", "status": "RESOURCE_EXHAUSTED"}})


def test_rate_limit_returns_researched_schools_without_steps(scripted_gemini, fake_tools):
    scripted_gemini.script += [gemini_response([housing("Purdue University"), housing("MIT"), VISA]), rate_limited()]
    events = list(agent.agent_events({}))
    assert [(p.school, p.steps) for p in events[-1].plans] == [("Purdue University", []), ("MIT", [])]


def test_rate_limit_before_any_research_is_undecided(scripted_gemini):
    scripted_gemini.script.append(rate_limited())
    assert [p.school for p in list(agent.agent_events({}))[-1].plans] == ["Undecided"]


def test_other_client_errors_are_raised(scripted_gemini):
    scripted_gemini.script.append(errors.ClientError(400, {"error": {"code": 400, "message": "bad", "status": "INVALID_ARGUMENT"}}))
    with pytest.raises(errors.ClientError):
        list(agent.agent_events({}))


def test_invalid_final_plan_raises(scripted_gemini):
    scripted_gemini.script.append(gemini_response(text='{"plans": []}'))
    with pytest.raises(Exception):
        list(agent.agent_events({}))


def test_gives_up_after_max_steps(scripted_gemini, fake_tools):
    scripted_gemini.script += [gemini_response([VISA])] * agent.MAX_STEPS
    with pytest.raises(RuntimeError):
        list(agent.agent_events({}))


def test_run_agent_returns_plans(scripted_gemini):
    scripted_gemini.script.append(gemini_response(text=plans_text("A", "B")))
    assert [p.school for p in agent.run_agent({}).plans] == ["A", "B"]
