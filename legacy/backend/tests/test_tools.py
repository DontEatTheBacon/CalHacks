import string
from datetime import date

import pytest

import agent
import tool_models as tm
from samples import MINIMAL_RESULTS, TOOL_ARGS, parsed


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


def test_tool_definitions_match_the_registry():
    names = [definition["name"] for definition in agent.TOOL_DEFINITIONS]
    assert names == list(agent.TOOLS)
    for definition in agent.TOOL_DEFINITIONS:
        tool = agent.TOOLS[definition["name"]]
        assert definition["description"]
        assert definition["input_schema"] == tool.args.model_json_schema()


def test_run_tool_reports_unknown_tools_and_bad_args():
    assert "error" in agent.run_tool("not_a_tool", {})
    assert "error" in agent.run_tool("get_housing_options", {})


def test_run_tool_returns_json_ready_results(monkeypatch):
    sample = tm.Scholarships.model_validate(MINIMAL_RESULTS[tm.Scholarships])
    prompts = []
    monkeypatch.setattr(agent, "ask_structured", lambda prompt, schema: prompts.append(prompt) or sample)
    result = agent.run_tool("find_scholarships", TOOL_ARGS["find_scholarships"])
    assert result["scholarships"][0]["end_date"] == "2027-01-15"  # dates become strings in tool results
    assert TOOL_ARGS["find_scholarships"]["college"] in prompts[0]


def test_run_tool_turns_exceptions_into_errors(monkeypatch):
    def fail(prompt, schema):
        raise RuntimeError("boom")

    monkeypatch.setattr(agent, "ask_structured", fail)
    assert agent.run_tool("get_housing_options", TOOL_ARGS["get_housing_options"]) == {"error": "boom"}


def test_ask_structured_retries_when_claude_gives_no_valid_answer(scripted_claude):
    scripted_claude.script += [parsed(None, stop_reason="max_tokens"), parsed(tm.GpaConversion(original_gpa=8.5, converted_gpa=3.7))]
    result = agent.ask_structured("Convert", tm.GpaConversion)
    assert result.converted_gpa == 3.7
    assert len(scripted_claude.sent) == 2
    assert scripted_claude.sent[0]["schema"] is tm.GpaConversion
    assert str(date.today()) in scripted_claude.sent[0]["messages"][0]["content"]


def test_ask_structured_gives_up_after_three_tries(scripted_claude):
    scripted_claude.script += [parsed(None)] * 3
    with pytest.raises(RuntimeError):
        agent.ask_structured("Convert", tm.GpaConversion)


def test_agent_turns_use_fallbacks_effort_and_caching(monkeypatch):
    sent = []
    monkeypatch.setattr(agent.client.beta.messages, "create", lambda **kwargs: sent.append(kwargs) or "ok")
    assert agent.generate(system="s", messages=[]) == "ok"
    request = sent[0]
    assert request["model"] == agent.MODEL == "claude-opus-5-5"
    assert request["betas"] == [agent.FALLBACK_BETA] and request["fallbacks"] == "default"
    assert request["output_config"] == {"effort": agent.EFFORT}
    assert request["cache_control"] == {"type": "ephemeral"}


def test_lookups_use_structured_outputs_at_low_effort(monkeypatch):
    sent = []
    monkeypatch.setattr(agent.client.messages, "parse", lambda **kwargs: sent.append(kwargs) or "ok")
    assert agent.generate_structured(tm.GpaConversion, messages=[]) == "ok"
    assert sent[0]["output_format"] is tm.GpaConversion
    assert sent[0]["output_config"] == {"effort": "low"}
