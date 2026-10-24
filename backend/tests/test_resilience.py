"""Rate limits, timeouts, final-plan retries, run deadline, logging and error responses."""

import json
import logging

import httpx
import pytest
from fastapi.testclient import TestClient
from google.genai import errors

import agent
import main
from samples import gemini_response, plans_text
from test_api import PROFILE


def rate_limited(delay=None):
    details = [{"@type": "type.googleapis.com/google.rpc.RetryInfo", "retryDelay": delay}] if delay else []
    return errors.ClientError(429, {"error": {"code": 429, "message": "quota", "status": "RESOURCE_EXHAUSTED", "details": details}})


@pytest.fixture
def gemini_outcomes(monkeypatch):
    """Makes the real generate() see these outcomes in order; records every sleep instead of waiting."""
    state = {"outcomes": [], "sleeps": [], "calls": 0}

    def fake_generate_content(**kwargs):
        state["calls"] += 1
        outcome = state["outcomes"].pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome

    monkeypatch.setattr(agent.client.models, "generate_content", fake_generate_content)
    monkeypatch.setattr(agent.time, "sleep", state["sleeps"].append)
    return state


def test_429_waits_for_gemini_retry_delay(gemini_outcomes):
    gemini_outcomes["outcomes"] += [rate_limited("23s"), "ok"]
    assert agent.generate(contents="hi") == "ok"
    assert gemini_outcomes["sleeps"] == [pytest.approx(23, abs=0.5)]


def test_429_without_a_delay_backs_off(gemini_outcomes):
    gemini_outcomes["outcomes"] += [rate_limited(), rate_limited(), "ok"]
    assert agent.generate(contents="hi") == "ok"
    assert gemini_outcomes["sleeps"] == [pytest.approx(5, abs=0.5), pytest.approx(10, abs=0.5)]


def test_429_cooldown_pauses_other_calls(gemini_outcomes):
    agent._start_cooldown(12)
    gemini_outcomes["outcomes"].append("ok")
    agent.generate(contents="the next call")
    assert gemini_outcomes["sleeps"] == [pytest.approx(12, abs=0.5)]


def test_429_gives_up_when_the_quota_is_gone(gemini_outcomes):
    gemini_outcomes["outcomes"].append(rate_limited("3600s"))
    with pytest.raises(errors.ClientError):
        agent.generate(contents="hi")
    assert gemini_outcomes["sleeps"] == [] and gemini_outcomes["calls"] == 1


def test_429_gives_up_after_retries(gemini_outcomes):
    gemini_outcomes["outcomes"] += [rate_limited("1s")] * (agent.RETRIES + 1)
    with pytest.raises(errors.ClientError):
        agent.generate(contents="hi")
    assert gemini_outcomes["calls"] == agent.RETRIES + 1


def test_timeouts_are_retried(gemini_outcomes):
    gemini_outcomes["outcomes"] += [httpx.ReadTimeout("slow"), httpx.ReadTimeout("slow"), "ok"]
    assert agent.generate(contents="hi") == "ok"
    gemini_outcomes["outcomes"] += [httpx.ReadTimeout("slow")] * (agent.RETRIES + 1)
    with pytest.raises(httpx.TimeoutException):
        agent.generate(contents="hi")


def test_client_has_a_timeout():
    assert agent.client._api_client._http_options.timeout == int(agent.GEMINI_TIMEOUT_SECONDS * 1000)


def test_invalid_final_plan_is_retried_with_the_errors(scripted_gemini):
    scripted_gemini.script += [
        gemini_response(text="Here are your plans: " + plans_text("A")),
        gemini_response(text=plans_text("A", "B")),
    ]
    plans = list(agent.agent_events({}))[-1].plans
    assert [p.school for p in plans] == ["A", "B"]
    retry = scripted_gemini.sent[-1]
    assert retry["config"].response_mime_type == "application/json"
    assert not retry["config"].tools
    assert "did not match the schema" in retry["contents"][-1].parts[0].text


def test_final_plan_gives_up_after_parse_retries(scripted_gemini):
    scripted_gemini.script += [gemini_response(text="not json")] * (agent.PARSE_RETRIES + 1)
    with pytest.raises(Exception):
        list(agent.agent_events({}))
    assert len(scripted_gemini.sent) == agent.PARSE_RETRIES + 1


def test_rate_limit_during_final_retry_returns_researched_schools(scripted_gemini, monkeypatch):
    monkeypatch.setattr(agent, "run_tool", lambda name, args: {"ok": True})
    scripted_gemini.script += [
        gemini_response([("get_housing_options", {"college": "MIT"})]),
        gemini_response(text="not json"),
        rate_limited(),
    ]
    assert [p.school for p in list(agent.agent_events({}))[-1].plans] == ["MIT"]


def test_run_deadline(scripted_gemini, monkeypatch):
    monkeypatch.setattr(agent, "MAX_RUN_SECONDS", -1)
    with pytest.raises(TimeoutError):
        list(agent.agent_events({}))
    assert scripted_gemini.sent == []


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
