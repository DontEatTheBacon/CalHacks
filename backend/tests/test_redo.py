from datetime import date

from fastapi.testclient import TestClient

import agent
import main
import models
import open_data
import tool_models as tm
from samples import parsed, rate_limited
from test_api import PROFILE

client = TestClient(main.app)

LINK = {"url": "https://www.atl.com/flights"}
TRAVEL = {
    "type": "travel", "title": "Fly via Dubai", "description": "Emirates via DXB.", "link": LINK,
    "start_date": "2027-07-02", "end_date": "2027-07-25", "arrival_airport": "ATL", "flight_cost_usd": 950,
    "departure_airport": "BOM", "route": ["MARTA Red Line to North Avenue"],
}
SECOND_TRAVEL = {**TRAVEL, "title": "Fly via Doha", "description": "Qatar Airways via DOH."}


def new_travel(**changes):
    return models.TravelStep.model_validate({
        **TRAVEL, "title": "Fly via Frankfurt", "description": "Lufthansa via FRA.",
        "start_date": "2026-01-01", "end_date": "2026-01-02",  # Claude's dates, which get replaced
        "link": {"url": "https://www.lufthansa.com/"}, **changes,
    })


def redo(rejected, feedback=None, school="Georgia Institute of Technology"):
    return client.post("/api/steps/redo", json={"profile": PROFILE, "school": school, "rejected": rejected, "feedback": feedback})


def test_redo_returns_a_new_step_with_the_scheduled_dates(scripted_claude):
    scripted_claude.script.append(parsed(new_travel()))
    response = redo([TRAVEL])
    assert response.status_code == 200
    step = response.json()["step"]
    assert step["title"] == "Fly via Frankfurt"
    assert (step["start_date"], step["end_date"]) == ("2027-07-02", "2027-07-25")  # kept from the schedule
    assert step["ai_generated"] is True and step["complete"] is False


def test_redo_sends_every_rejected_version_and_the_feedback(scripted_claude):
    scripted_claude.script.append(parsed(new_travel()))
    redo([TRAVEL, SECOND_TRAVEL], feedback="no layovers in the Gulf")
    request = scripted_claude.sent[0]
    prompt = request["messages"][0]["content"]
    assert request["schema"] is models.TravelStep  # same step type, as structured output
    assert "Fly via Dubai" in prompt and "Fly via Doha" in prompt
    assert "no layovers in the Gulf" in prompt
    assert "don't repeat" in prompt
    assert str(date.today()) in prompt
    assert "2027-07-02" not in prompt  # dates aren't Claude's to change


def test_feedback_is_optional(scripted_claude):
    scripted_claude.script.append(parsed(new_travel()))
    assert redo([TRAVEL]).status_code == 200
    assert "What the student wants instead" not in scripted_claude.sent[0]["messages"][0]["content"]


def test_redo_retries_when_claude_gives_no_valid_step(scripted_claude):
    scripted_claude.script += [parsed(None, stop_reason="max_tokens"), parsed(new_travel())]
    assert redo([TRAVEL]).json()["step"]["title"] == "Fly via Frankfurt"
    assert len(scripted_claude.sent) == 2


def test_redo_marks_official_links(scripted_claude, monkeypatch):
    monkeypatch.setattr(open_data, "find_university", lambda name: {"domains": ["gatech.edu"], "web_pages": []})
    scripted_claude.script.append(parsed(new_travel(link={"url": "https://transportation.gatech.edu/"})))
    assert redo([TRAVEL]).json()["step"]["link"]["official"] is True


def test_redo_needs_at_least_one_rejected_step():
    assert redo([]).status_code == 422


def test_redo_rejects_overlong_feedback():
    assert redo([TRAVEL], feedback="x" * 501).status_code == 422


def test_redo_maps_claude_errors(scripted_claude):
    scripted_claude.script.append(rate_limited())
    assert redo([TRAVEL]).status_code == 503


def test_redo_step_keeps_the_step_type(scripted_claude):
    scripted_claude.script.append(parsed(new_travel()))
    step = agent.redo_step(PROFILE, "X", [models.TravelStep.model_validate(TRAVEL)], None)
    assert isinstance(step, models.TravelStep)
    assert isinstance(step.link, tm.ResourceLink)
