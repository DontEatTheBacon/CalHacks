import json
from datetime import date

import anthropic
import pytest

import agent
import models
import schedule
import tool_models as tm
from samples import TOOL_ARGS, api_error, claude_response, plans_text, rate_limited

VISA = ("get_visa_requirements", {"citizenship": "India", "study_country": "USA"})
SCHEDULE = ("schedule_steps", TOOL_ARGS["schedule_steps"])


def housing(college):
    return ("get_housing_options", {"college": college})


def cost(college):
    return ("get_university_cost", {"college": college, "level": "graduate"})


@pytest.fixture
def fake_tools(monkeypatch):
    """Replaces run_tool and records each call in the order it ran."""
    runs = []

    def fake_run_tool(name, args):
        runs.append((name, args))
        if name == "schedule_steps":  # the real scheduler: it's deterministic and offline
            return schedule.schedule_steps(tm.ScheduleArgs.model_validate(args)).model_dump(mode="json")
        return {"tool": name, "college": args.get("college")}

    monkeypatch.setattr(agent, "run_tool", fake_run_tool)
    return runs


def tool_results(message):
    """The tool_result blocks in a user message, as (tool_use_id, decoded content, is_error)."""
    return [(block["tool_use_id"], json.loads(block["content"]), block["is_error"]) for block in message["content"]]


def test_streams_calls_results_and_plans_with_matching_ids(scripted_claude, fake_tools):
    scripted_claude.script += [
        claude_response([VISA, housing("Purdue University")]),
        claude_response([housing("MIT")]),
        claude_response([SCHEDULE]),
        claude_response(text=f"```json\n{plans_text('Purdue University', 'MIT')}\n```"),
    ]
    events = list(agent.agent_events({"gpa": "8.5"}))

    # Each tool runs to completion, in Claude's order, before the next one starts.
    assert [(e.type, e.id, e.name) for e in events[:-1]] == [
        ("tool_call", 0, "get_visa_requirements"), ("tool_result", 0, "get_visa_requirements"),
        ("tool_call", 1, "get_housing_options"), ("tool_result", 1, "get_housing_options"),
        ("tool_call", 2, "get_housing_options"), ("tool_result", 2, "get_housing_options"),
        ("tool_call", 3, "schedule_steps"), ("tool_result", 3, "schedule_steps"),
    ]
    assert [args.get("college") for _, args in fake_tools][:3] == [None, "Purdue University", "MIT"]
    assert isinstance(events[-1], models.PlansEvent)
    assert [p.school for p in events[-1].plans] == ["Purdue University", "MIT"]
    assert len(fake_tools) == 4


def test_results_go_back_as_one_message_in_call_order(scripted_claude, fake_tools):
    scripted_claude.script += [
        claude_response([VISA, housing("A"), housing("B")]),
        claude_response([SCHEDULE]),
        claude_response(text=plans_text("A")),
    ]
    list(agent.agent_events({}))
    messages = scripted_claude.sent[-1]["messages"]
    assert messages[1]["role"] == "assistant"  # the tool_use turn, appended as returned
    results = tool_results(messages[2])
    assert [(tool_id, content.get("college"), error) for tool_id, content, error in results] == [
        ("toolu_0", None, False), ("toolu_1", "A", False), ("toolu_2", "B", False),
    ]


def test_failed_tools_are_flagged_as_errors(scripted_claude, monkeypatch):
    monkeypatch.setattr(agent, "run_tool", lambda name, args: {"error": "boom"})
    scripted_claude.script += [claude_response([VISA]), claude_response(text=plans_text("A")), claude_response(text=plans_text("A"))]
    list(agent.agent_events({}))
    assert tool_results(scripted_claude.sent[1]["messages"][2]) == [("toolu_0", {"error": "boom"}, True)]


def test_repeated_calls_each_run(scripted_claude, fake_tools):
    scripted_claude.script += [
        claude_response([VISA, VISA]), claude_response([VISA]), claude_response([SCHEDULE]), claude_response(text=plans_text("A")),
    ]
    list(agent.agent_events({}))
    assert [name for name, _ in fake_tools].count("get_visa_requirements") == 3


def test_requests_carry_the_system_prompt_and_tools(scripted_claude):
    scripted_claude.script.append(claude_response(text=plans_text("A")))
    list(agent.agent_events({}))
    request = scripted_claude.sent[0]
    assert str(date.today()) in request["system"]
    assert '"plans"' in request["system"]
    assert request["tools"] is agent.TOOL_DEFINITIONS


def test_rate_limit_returns_researched_schools_without_steps(scripted_claude, fake_tools):
    scripted_claude.script += [claude_response([housing("Purdue University"), housing("MIT"), VISA]), rate_limited()]
    events = list(agent.agent_events({}))
    assert [(p.school, p.steps) for p in events[-1].plans] == [("Purdue University", []), ("MIT", [])]


def test_rate_limit_before_any_research_is_undecided(scripted_claude):
    scripted_claude.script.append(rate_limited())
    assert [p.school for p in list(agent.agent_events({}))[-1].plans] == ["Undecided"]


def test_other_api_errors_are_raised(scripted_claude):
    scripted_claude.script.append(api_error(anthropic.BadRequestError, 400))
    with pytest.raises(anthropic.BadRequestError):
        list(agent.agent_events({}))


def test_refusals_are_raised(scripted_claude):
    scripted_claude.script.append(claude_response(stop_reason="refusal"))
    with pytest.raises(RuntimeError, match="declined"):
        list(agent.agent_events({}))


def test_invalid_final_plan_raises(scripted_claude):
    scripted_claude.script += [claude_response(text='{"plans": []}')] * (agent.PARSE_RETRIES + 1)
    with pytest.raises(Exception):
        list(agent.agent_events({}))


def test_gives_up_after_max_steps(scripted_claude, fake_tools):
    scripted_claude.script += [claude_response([VISA])] * agent.MAX_STEPS
    with pytest.raises(RuntimeError):
        list(agent.agent_events({}))


def test_run_agent_returns_plans(scripted_claude):
    scripted_claude.script.append(claude_response(text=plans_text("A", "B")))
    assert [p.school for p in agent.run_agent({}).plans] == ["A", "B"]


STEP = {"type": "visa", "title": "Visa", "description": "d", "visa_type": "F-1", "documents": [], "link": {"url": "https://example.gov"}}


def test_finishing_without_scheduling_asks_for_schedule_steps(scripted_claude, fake_tools):
    final = json.dumps({"plans": [{"school": TOOL_ARGS["schedule_steps"]["college"], "steps": [STEP]}]})
    scripted_claude.script += [
        claude_response([VISA]),
        claude_response(text=plans_text("A")),  # tries to finish without dates
        claude_response([SCHEDULE]),
        claude_response(text=final),
    ]
    events = list(agent.agent_events({}))
    nudge_turn = scripted_claude.sent[2]
    assert "tool_choice" not in nudge_turn  # forced tool choice is a 400 on this model, so it's asked for by name
    assert any(message["content"] == agent.SCHEDULE_NUDGE for message in nudge_turn["messages"])
    visa = events[-1].plans[0].steps[0]
    expected = {s.step_type: s for s in schedule.schedule_steps(tm.ScheduleArgs.model_validate(TOOL_ARGS["schedule_steps"])).steps}["visa"]
    assert (visa.start_date, visa.end_date) == (expected.start_date, expected.end_date)  # dates come from code


def test_schedule_is_only_asked_for_once(scripted_claude, monkeypatch):
    monkeypatch.setattr(agent, "run_tool", lambda name, args: {"error": "bad start term"} if name == "schedule_steps" else {"ok": True})
    scripted_claude.script += [
        claude_response([VISA]),
        claude_response(text=plans_text("A")),
        claude_response([SCHEDULE]),
        claude_response(text=plans_text("A")),
    ]
    assert [p.school for p in list(agent.agent_events({}))[-1].plans] == ["A"]
    assert len(scripted_claude.sent) == 4


def test_no_research_means_no_schedule_nudge(scripted_claude):
    scripted_claude.script.append(claude_response(text=plans_text("A")))
    list(agent.agent_events({}))
    assert len(scripted_claude.sent) == 1


def test_tool_events_are_labelled_with_their_school(scripted_claude, fake_tools):
    scripted_claude.script += [
        claude_response([cost("Purdue University"), cost("MIT"), VISA]),
        claude_response([SCHEDULE]),
        claude_response(text=plans_text("Purdue University")),
    ]
    events = list(agent.agent_events({}))
    labels = [(e.type, e.name, e.school) for e in events if e.type in ("tool_call", "tool_result")]
    assert ("tool_call", "get_university_cost", "MIT") in labels
    assert ("tool_result", "get_university_cost", "Purdue University") in labels
    assert ("tool_result", "get_visa_requirements", None) in labels  # general lookups have no school


def test_considered_colleges_come_through_with_the_plans(scripted_claude):
    considered = [
        {"school": "Purdue University", "cost_per_year_usd": 41000, "chosen": True, "reason": "Within budget"},
        {"school": "MIT", "cost_per_year_usd": 82000, "chosen": False, "reason": "Over budget by $37,000 a year"},
    ]
    scripted_claude.script.append(claude_response(text=json.dumps({"plans": [{"school": "Purdue University", "steps": []}], "considered": considered})))
    plans = agent.run_agent({})
    assert [(c.school, c.chosen) for c in plans.considered] == [("Purdue University", True), ("MIT", False)]


def test_rate_limit_fallback_skips_colleges_that_were_only_shortlisted(scripted_claude, fake_tools):
    scripted_claude.script += [
        claude_response([cost("Purdue University"), cost("MIT")]),
        claude_response([housing("Purdue University")]),
        rate_limited(),
    ]
    assert [p.school for p in list(agent.agent_events({}))[-1].plans] == ["Purdue University"]


def test_prompt_asks_to_narrow_down_a_shortlist():
    assert "Shortlist 3 to 4 colleges" in agent.SYSTEM_PROMPT
    assert "over the student's budget" in agent.SYSTEM_PROMPT
    assert '"considered"' in agent.SYSTEM_PROMPT
