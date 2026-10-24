import httpx
import pytest

import agent
import scorecard
import tool_models as tm

PURDUE_MAIN = {
    "id": 243780,
    "school.name": "Purdue University-Main Campus",
    "latest.student.size": 44503,
    "latest.cost.tuition.out_of_state": 28794,
    "latest.cost.roomboard.oncampus": 11000,
    "latest.cost.otherexpense.oncampus": 5350,
    "latest.cost.booksupply": 800,
}
PURDUE_FORT_WAYNE = {**PURDUE_MAIN, "id": 1, "school.name": "Purdue University Fort Wayne", "latest.student.size": 5484}


class FakeResponse:
    def __init__(self, results):
        self.results = results

    def raise_for_status(self):
        pass

    def json(self):
        return {"results": self.results}


@pytest.fixture
def scorecard_results(monkeypatch):
    """Makes httpx.get return the given Scorecard results; records the request params."""
    state = {"results": [], "params": None}

    def fake_get(url, params, timeout):
        state["params"] = params
        return FakeResponse(state["results"])

    monkeypatch.setattr(httpx, "get", fake_get)
    return state


def test_find_school_prefers_exact_name_then_main_campus_then_size(scorecard_results):
    scorecard_results["results"] = [PURDUE_FORT_WAYNE, PURDUE_MAIN]
    assert scorecard.find_school("Purdue University")["id"] == PURDUE_MAIN["id"]

    exact = {**PURDUE_FORT_WAYNE, "school.name": "Purdue University"}
    scorecard_results["results"] = [PURDUE_MAIN, exact]
    assert scorecard.find_school("Purdue University") is exact

    small, large = {**PURDUE_FORT_WAYNE, "school.name": "A"}, {**PURDUE_FORT_WAYNE, "school.name": "B", "latest.student.size": 9e9}
    scorecard_results["results"] = [small, large]
    assert scorecard.find_school("Purdue") is large


def test_find_school_returns_none_without_results(scorecard_results):
    assert scorecard.find_school("Monash University") is None


def test_find_school_uses_key_from_env(scorecard_results, monkeypatch):
    monkeypatch.delenv("SCORECARD_API_KEY", raising=False)
    scorecard.find_school("X")
    assert scorecard_results["params"]["api_key"] == "DEMO_KEY"
    monkeypatch.setenv("SCORECARD_API_KEY", "real-key")
    scorecard.find_school("X")
    assert scorecard_results["params"]["api_key"] == "real-key"


def test_living_cost_and_page_url():
    assert scorecard.living_cost(PURDUE_MAIN) == 11000 + 5350 + 800
    assert scorecard.living_cost({**PURDUE_MAIN, "latest.cost.booksupply": None}) is None
    assert scorecard.page_url(PURDUE_MAIN) == "https://collegescorecard.ed.gov/school/?243780"


def no_claude(prompt, schema):
    raise AssertionError("should not ask Claude")


def claude_estimate(tuition=40000, living=15000, fees=1200):
    return lambda prompt, schema: tm.UniversityCost(
        tuition_usd_per_year=tuition, living_usd_per_year=living, fees_usd_per_year=fees,
        link=tm.ResourceLink(url="https://example.edu/costs"),
    )


def test_undergraduate_cost_comes_only_from_scorecard(monkeypatch):
    monkeypatch.setattr(scorecard, "find_school", lambda name: PURDUE_MAIN)
    monkeypatch.setattr(agent, "ask_structured", no_claude)
    cost = agent.university_cost(tm.CollegeLevelArgs(college="Purdue University", level="undergraduate"))
    assert cost.tuition_usd_per_year == 28794
    assert cost.living_usd_per_year == 17150
    assert cost.room_board_usd_per_year == 11000 and cost.books_usd_per_year == 800
    assert cost.source == "College Scorecard"
    assert cost.link.url == scorecard.page_url(PURDUE_MAIN)


def test_graduate_cost_mixes_scorecard_living_with_estimated_tuition(monkeypatch):
    monkeypatch.setattr(scorecard, "find_school", lambda name: PURDUE_MAIN)
    monkeypatch.setattr(agent, "ask_structured", claude_estimate())
    cost = agent.university_cost(tm.CollegeLevelArgs(college="Purdue University", level="graduate"))
    assert cost.tuition_usd_per_year == 40000
    assert cost.living_usd_per_year == 17150
    assert cost.fees_usd_per_year == 1200
    assert "College Scorecard" in cost.source and "Claude" in cost.source


@pytest.mark.parametrize("lookup", [lambda name: None, lambda name: (_ for _ in ()).throw(httpx.ConnectError("down"))])
def test_cost_falls_back_to_claude_without_scorecard(monkeypatch, lookup):
    monkeypatch.setattr(scorecard, "find_school", lookup)
    monkeypatch.setattr(agent, "ask_structured", claude_estimate())
    cost = agent.university_cost(tm.CollegeLevelArgs(college="Monash University", level="graduate"))
    assert cost.tuition_usd_per_year == 40000
    assert cost.source == "Claude estimate"
