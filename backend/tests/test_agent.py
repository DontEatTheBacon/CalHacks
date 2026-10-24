import threading
import time
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
    """Replaces run_tool; slower for earlier calls so results finish out of order."""
    runs, lock = [], threading.Lock()

    def fake_run_tool(name, args):
        with lock:
            runs.append((name, args))
            delay = 0.05 * (5 - len(runs))
        time.sleep(max(delay, 0))
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

    calls = [e for e in events if isinstance(e, models.ToolCallEvent)]
    results = [e for e in events if isinstance(e, models.ToolResultEvent)]
    assert [c.id for c in calls] == [0, 1, 2]
    assert {r.id: r.name for r in results} == {c.id: c.name for c in calls}
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
