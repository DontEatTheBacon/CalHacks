"""Rate limits, timeouts, final-plan retries, run deadline, logging and error responses."""

import json
import logging

import anthropic
import httpx
import pytest
from fastapi.testclient import TestClient

import agent
import main
from samples import api_error, claude_response, plans_text, rate_limited, timeout_error
from test_api import PROFILE


@pytest.fixture
def claude_outcomes(monkeypatch):
    """Makes call_claude() see these outcomes in order; records every sleep instead of waiting."""
    state = {"outcomes": [], "sleeps": [], "calls": 0}

    def request():
        state["calls"] += 1
        outcome = state["outcomes"].pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome

    monkeypatch.setattr(agent.time, "sleep", state["sleeps"].append)
    state["call"] = lambda: agent.call_claude(request)
    return state


def test_429_waits_for_the_retry_after_header(claude_outcomes):
    claude_outcomes["outcomes"] += [rate_limited(23), "ok"]
    assert claude_outcomes["call"]() == "ok"
    assert claude_outcomes["sleeps"] == [pytest.approx(23, abs=0.5)]


def test_429_without_a_retry_after_backs_off(claude_outcomes):
    claude_outcomes["outcomes"] += [rate_limited(), rate_limited(), "ok"]
    assert claude_outcomes["call"]() == "ok"
    assert claude_outcomes["sleeps"] == [pytest.approx(5, abs=0.5), pytest.approx(10, abs=0.5)]


def test_429_cooldown_pauses_other_calls(claude_outcomes):
    agent._start_cooldown(12)
    claude_outcomes["outcomes"].append("ok")
    claude_outcomes["call"]()
    assert claude_outcomes["sleeps"] == [pytest.approx(12, abs=0.5)]


def test_429_gives_up_when_the_wait_is_too_long(claude_outcomes):
    claude_outcomes["outcomes"].append(rate_limited(3600))
    with pytest.raises(anthropic.RateLimitError):
        claude_outcomes["call"]()
    assert claude_outcomes["sleeps"] == [] and claude_outcomes["calls"] == 1


def test_429_gives_up_after_retries(claude_outcomes):
    claude_outcomes["outcomes"] += [rate_limited(1)] * (agent.RETRIES + 1)
    with pytest.raises(anthropic.RateLimitError):
        claude_outcomes["call"]()
    assert claude_outcomes["calls"] == agent.RETRIES + 1


@pytest.mark.parametrize("error_class, status", [(anthropic.OverloadedError, 529), (anthropic.InternalServerError, 500)])
def test_overload_and_server_errors_are_retried(claude_outcomes, error_class, status):
    claude_outcomes["outcomes"] += [api_error(error_class, status), "ok"]
    assert claude_outcomes["call"]() == "ok"
    assert claude_outcomes["sleeps"] == [1]


def test_client_errors_are_not_retried(claude_outcomes):
    claude_outcomes["outcomes"].append(api_error(anthropic.BadRequestError, 400))
    with pytest.raises(anthropic.BadRequestError):
        claude_outcomes["call"]()
    assert claude_outcomes["calls"] == 1


def test_timeouts_are_retried(claude_outcomes):
    claude_outcomes["outcomes"] += [timeout_error(), timeout_error(), "ok"]
    assert claude_outcomes["call"]() == "ok"
    claude_outcomes["outcomes"] += [timeout_error()] * (agent.RETRIES + 1)
    with pytest.raises(anthropic.APITimeoutError):
        claude_outcomes["call"]()


def test_client_has_a_timeout_and_leaves_retries_to_us():
    assert agent.client.timeout == agent.CLAUDE_TIMEOUT_SECONDS
    assert agent.client.max_retries == 0


def test_invalid_final_plan_is_retried_with_the_errors(scripted_claude):
    scripted_claude.script += [
        claude_response(text="Here are your plans: " + plans_text("A")),
        claude_response(text=plans_text("A", "B")),
    ]
    plans = list(agent.agent_events({}))[-1].plans
    assert [p.school for p in plans] == ["A", "B"]
    retry = scripted_claude.sent[-1]
    assert retry["tool_choice"] == {"type": "none"}  # tools stay declared (the history has tool calls) but can't be called
    assert retry["messages"][-2]["role"] == "assistant"  # the bad reply, appended as returned
    assert "did not match the schema" in retry["messages"][-1]["content"]


def test_final_plan_gives_up_after_parse_retries(scripted_claude):
    scripted_claude.script += [claude_response(text="not json")] * (agent.PARSE_RETRIES + 1)
    with pytest.raises(Exception):
        list(agent.agent_events({}))
    assert len(scripted_claude.sent) == agent.PARSE_RETRIES + 1


def test_rate_limit_during_final_retry_returns_researched_schools(scripted_claude, monkeypatch):
    monkeypatch.setattr(agent, "run_tool", lambda name, args: {"ok": True})
    scripted_claude.script += [
        claude_response([("get_housing_options", {"college": "MIT"})]),
        claude_response(text="not json"),  # asked for schedule_steps first
        claude_response(text="not json"),
        rate_limited(),
    ]
    assert [p.school for p in list(agent.agent_events({}))[-1].plans] == ["MIT"]


def test_run_deadline(scripted_claude, monkeypatch):
    monkeypatch.setattr(agent, "MAX_RUN_SECONDS", -1)
    with pytest.raises(TimeoutError):
        list(agent.agent_events({}))
    assert scripted_claude.sent == []


def test_tool_failures_are_logged(monkeypatch, caplog):
    def fail(prompt, schema):
        raise ValueError("boom")

    monkeypatch.setattr(agent, "ask_structured", fail)
    with caplog.at_level(logging.WARNING, logger="agent"):
        assert agent.run_tool("get_housing_options", {"college": "MIT"}) == {"error": "boom"}
    assert "get_housing_options failed" in caplog.text


@pytest.mark.parametrize("error, status", [
    (TimeoutError("too slow"), 504),
    (httpx.ReadTimeout("too slow"), 504),
    (timeout_error(), 504),
    (rate_limited(), 503),
    (RuntimeError("agent hit max steps"), 502),
    (KeyError("bug"), 500),
])
def test_failures_map_to_status_codes(monkeypatch, caplog, error, status):
    def fail(profile):
        raise error

    monkeypatch.setattr(main, "run_agent", fail)
    with caplog.at_level(logging.ERROR, logger="main"):
        response = TestClient(main.app).post("/api/plan", json=PROFILE)
    assert response.status_code == status
    assert "Plan request failed" in caplog.text


def test_stream_reports_timeouts(monkeypatch):
    def slow(profile):
        raise TimeoutError("too slow")
        yield

    monkeypatch.setattr(main, "agent_events", slow)
    lines = TestClient(main.app).post("/api/plan/stream", json=PROFILE).text.splitlines()
    assert json.loads(lines[-1])["detail"].startswith("The agent took too long")
