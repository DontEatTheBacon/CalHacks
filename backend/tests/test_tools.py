import string
from datetime import date
from types import SimpleNamespace

import pytest
from google.genai import errors

import agent
import tool_models as tm
from samples import MINIMAL_RESULTS, TOOL_ARGS


def test_every_tool_has_valid_sample_args():
    assert set(TOOL_ARGS) == set(agent.TOOLS)
    for name, tool in agent.TOOLS.items():
        tool.args.model_validate(TOOL_ARGS[name])


@pytest.mark.parametrize("name", list(agent.TOOLS))
def test_prompt_placeholders_are_fields_of_the_args_model(name):
    tool = agent.TOOLS[name]
    placeholders = {field for _, field, _, _ in string.Formatter().parse(tool.prompt) if field}
    assert placeholders <= set(tool.args.model_fields)
    tool.prompt.format(**TOOL_ARGS[name])


def test_declarations_match_the_tool_registry():
    names = [declaration["name"] for declaration in agent.TOOL_DECLARATIONS]
    assert names == list(agent.TOOLS)
    for declaration in agent.TOOL_DECLARATIONS:
        tool = agent.TOOLS[declaration["name"]]
        assert declaration["description"]
        assert declaration["parameters"] == tool.args.model_json_schema()


def test_run_tool_reports_unknown_tools_and_bad_args():
    assert "error" in agent.run_tool("not_a_tool", {})
    assert "error" in agent.run_tool("get_housing_options", {})


def test_run_tool_returns_json_ready_results(monkeypatch):
    sample = tm.Scholarships.model_validate(MINIMAL_RESULTS[tm.Scholarships])
    prompts = []
    monkeypatch.setattr(agent, "ask_structured", lambda prompt, schema: prompts.append(prompt) or sample)
    result = agent.run_tool("find_scholarships", TOOL_ARGS["find_scholarships"])
    assert result["scholarships"][0]["due_date"] == "2027-01-15"  # dates become strings for Gemini
    assert TOOL_ARGS["find_scholarships"]["college"] in prompts[0]


def test_run_tool_turns_exceptions_into_errors(monkeypatch):
    def fail(prompt, schema):
        raise RuntimeError("boom")

    monkeypatch.setattr(agent, "ask_structured", fail)
    assert agent.run_tool("get_housing_options", TOOL_ARGS["get_housing_options"]) == {"error": "boom"}


def test_ask_structured_retries_invalid_answers(scripted_gemini):
    valid = '{"original_gpa": 8.5, "converted_gpa": 3.7}'
    scripted_gemini.script += [SimpleNamespace(text="not json"), SimpleNamespace(text=valid)]
    result = agent.ask_structured("Convert", tm.GpaConversion)
    assert result.converted_gpa == 3.7
    assert len(scripted_gemini.sent) == 2
    assert str(date.today()) in scripted_gemini.sent[0]["contents"]
    assert scripted_gemini.sent[0]["config"]["response_schema"] is tm.GpaConversion


def test_ask_structured_gives_up_after_three_invalid_answers(scripted_gemini):
    scripted_gemini.script += [SimpleNamespace(text="{}")] * 3
    with pytest.raises(RuntimeError):
        agent.ask_structured("Convert", tm.GpaConversion)


def server_error(code):
    return errors.ServerError(code, {"error": {"code": code, "message": "x", "status": "X"}})


def test_generate_retries_503_with_backoff(monkeypatch):
    sleeps, outcomes = [], [server_error(503), server_error(503), "ok"]

    def fake_generate_content(**kwargs):
        outcome = outcomes.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome

    monkeypatch.setattr(agent.client.models, "generate_content", fake_generate_content)
    monkeypatch.setattr(agent.time, "sleep", sleeps.append)
    assert agent.generate(contents="hi") == "ok"
    assert sleeps == [1, 2]


def test_generate_does_not_retry_other_errors(monkeypatch):
    calls = []

    def fail(**kwargs):
        calls.append(1)
        raise server_error(500)

    monkeypatch.setattr(agent.client.models, "generate_content", fail)
    with pytest.raises(errors.ServerError):
        agent.generate(contents="hi")
    assert len(calls) == 1


def test_generate_gives_up_after_retries(monkeypatch):
    def fail(**kwargs):
        raise server_error(503)

    monkeypatch.setattr(agent.client.models, "generate_content", fail)
    monkeypatch.setattr(agent.time, "sleep", lambda seconds: None)
    with pytest.raises(errors.ServerError):
        agent.generate(contents="hi")
