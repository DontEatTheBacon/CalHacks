import json

import pytest
from fastapi.testclient import TestClient
from google.genai import errors

import main
import models

PROFILE = {
    "gpa": "8.5", "from_school": "IIT Bombay", "citizenship": "India", "level": "graduate",
    "major": "Computer Science", "start_term": "February 2027", "budget_usd_per_year": 45000,
}
client = TestClient(main.app)


def test_plan_route_returns_validated_plans(monkeypatch):
    profiles = []
    monkeypatch.setattr(main, "run_agent", lambda profile: profiles.append(profile) or models.Plans(plans=[models.Plan(school="A", steps=[])]))
    response = client.post("/api/plan", json=PROFILE)
    assert response.status_code == 200
    assert response.json()["plans"][0]["school"] == "A"
    assert profiles == [PROFILE]


def test_invalid_profile_is_rejected():
    assert client.post("/api/plan", json={**PROFILE, "level": "phd"}).status_code == 422
    assert client.post("/api/plan/stream", json={"gpa": "8.5"}).status_code == 422


@pytest.mark.parametrize("error, status", [
    (RuntimeError("agent hit max steps"), 502),
    (errors.ServerError(503, {"error": {"code": 503, "message": "busy", "status": "UNAVAILABLE"}}), 503),
])
def test_plan_route_maps_errors_to_status_codes(monkeypatch, error, status):
    def fail(profile):
        raise error

    monkeypatch.setattr(main, "run_agent", fail)
    assert client.post("/api/plan", json=PROFILE).status_code == status


def stream_events(monkeypatch, events):
    def fake_events(profile):
        for event in events:
            if isinstance(event, Exception):
                raise event
            yield event

    monkeypatch.setattr(main, "agent_events", fake_events)
    response = client.post("/api/plan/stream", json=PROFILE)
    assert response.headers["content-type"].startswith("application/x-ndjson")
    return [json.loads(line) for line in response.text.splitlines()]


def test_stream_sends_one_json_event_per_line(monkeypatch):
    events = stream_events(monkeypatch, [
        models.ToolCallEvent(id=0, name="convert_gpa", args={}),
        models.ToolResultEvent(id=0, name="convert_gpa", result={"converted_gpa": 3.7}),
        models.PlansEvent(plans=[models.Plan(school="A", steps=[])]),
    ])
    assert [e["type"] for e in events] == ["tool_call", "tool_result", "plans"]
    assert events[1]["id"] == events[0]["id"]


@pytest.mark.parametrize("error", [RuntimeError("max steps"), ValueError("unexpected")])
def test_stream_reports_failures_as_a_final_error_event(monkeypatch, error):
    events = stream_events(monkeypatch, [models.ToolCallEvent(id=0, name="convert_gpa", args={}), error])
    assert events[-1]["type"] == "error"
    assert events[-1]["detail"]
