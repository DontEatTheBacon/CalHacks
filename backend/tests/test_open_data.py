from datetime import date

import httpx
import pytest

import agent
import models
import open_data
import tool_models as tm
from samples import STEPS

FIND_UNIVERSITY = open_data.find_university  # the real, cached lookup; conftest stubs it per test
GATECH = {"name": "Georgia Institute of Technology", "domains": ["gatech.edu"], "web_pages": ["https://www.gatech.edu/"], "country": "United States"}


class FakeResponse:
    def __init__(self, body):
        self.body = body

    def raise_for_status(self):
        pass

    def json(self):
        return self.body


def test_exchange_rate_reads_frankfurter(monkeypatch):
    calls = []
    monkeypatch.setattr(httpx, "get", lambda url, params, timeout, follow_redirects: calls.append(params) or FakeResponse(
        {"amount": 1.0, "base": "USD", "date": "2026-10-23", "rates": {"INR": 94.94}}))
    rate = open_data.exchange_rate(tm.ExchangeArgs(currency="inr"))
    assert (rate.currency, rate.rate, rate.date) == ("INR", 94.94, date(2026, 10, 23))
    assert rate.link.official and calls == [{"base": "USD", "symbols": "INR"}]


def test_exchange_rate_rejects_unknown_currency(monkeypatch):
    monkeypatch.setattr(httpx, "get", lambda *a, **k: FakeResponse({"date": "2026-10-23", "rates": {}}))
    with pytest.raises(ValueError):
        open_data.exchange_rate(tm.ExchangeArgs(currency="XYZ"))


def test_find_university_prefers_the_exact_name(monkeypatch):
    FIND_UNIVERSITY.cache_clear()
    purdue = [{"name": "Purdue University Northwest", "domains": ["pnw.edu"]}, {"name": "Purdue University", "domains": ["purdue.edu"]}]
    monkeypatch.setattr(httpx, "get", lambda url, params, timeout: FakeResponse(purdue))
    assert FIND_UNIVERSITY("Purdue University")["domains"] == ["purdue.edu"]
    FIND_UNIVERSITY.cache_clear()


@pytest.mark.parametrize("url, official", [
    ("https://grad.gatech.edu/admissions", True),
    ("https://gatech.edu/", True),
    ("https://travel.state.gov/content/visas", True),
    ("https://www.gov.uk/student-visa", True),
    ("https://www.canada.ca.example.com/", False),
    ("https://gatech.edu.evil.com/", False),
    ("https://www.inlaksfoundation.org/", False),
])
def test_is_official(url, official):
    assert open_data.is_official(url, ["gatech.edu"]) is official


def test_tool_results_mark_official_links(monkeypatch):
    monkeypatch.setattr(open_data, "find_university", lambda name: GATECH)
    monkeypatch.setattr(agent, "ask_structured", lambda prompt, schema: tm.HousingInfo(
        on_campus_monthly_usd=900, off_campus_monthly_usd=1200, first_year_guaranteed=True,
        link=tm.ResourceLink(url="https://housing.gatech.edu/rates")))
    assert agent.run_tool("get_housing_options", {"college": "Georgia Institute of Technology"})["link"]["official"] is True


def test_plans_get_website_official_links_and_home_currency(monkeypatch):
    monkeypatch.setattr(open_data, "find_university", lambda name: GATECH)
    metrics = models.PlanMetrics(match_rate=90, program_years=2, cost_per_year_usd=50000, work_pay_per_year_usd=10000)
    plan = models.Plan.model_validate({"school": GATECH["name"], "steps": STEPS, "metrics": metrics.model_dump()})
    plan.steps[0].link = tm.ResourceLink(url="https://grad.gatech.edu/")
    exchange = tm.ExchangeRate(currency="INR", rate=94.94, date=date(2026, 10, 23), link=tm.ResourceLink(url="https://api.frankfurter.dev"))
    agent.apply_open_data([plan], exchange)
    assert plan.school_website.url == "https://www.gatech.edu/" and plan.school_website.official
    assert plan.steps[0].link.official is True
    assert [s.link.official for s in plan.steps if s.link and s.link.url == "https://example.edu/page"] == [False] * 7
    assert (plan.metrics.home_currency, plan.metrics.usd_to_home_rate) == ("INR", 94.94)


def test_university_list_outage_is_tolerated(monkeypatch):
    def down(name):
        raise httpx.ConnectError("down")

    monkeypatch.setattr(open_data, "find_university", down)
    plan = models.Plan.model_validate({"school": "X", "steps": STEPS})
    agent.apply_open_data([plan], None)
    assert plan.school_website is None


@pytest.mark.parametrize("name, result, ai", [
    ("get_exchange_rate", {"rate": 94.94}, False),
    ("schedule_steps", {"steps": []}, False),
    ("schedule_steps", {"error": "bad term"}, True),
    ("get_university_cost", {"source": "College Scorecard"}, False),
    ("get_university_cost", {"source": "College Scorecard (living costs), Claude estimate (graduate tuition)"}, True),
    ("get_university_cost", {"source": "Claude estimate"}, True),
    ("get_visa_requirements", {"visa_type": "F-1"}, True),
])
def test_is_ai_generated(name, result, ai):
    assert agent.is_ai_generated(name, result) is ai


def test_only_api_backed_cost_steps_are_not_ai_generated():
    plan = models.Plan.model_validate({"school": "Purdue University", "steps": STEPS})
    agent.mark_ai_generated([plan], {"Purdue University": True})
    assert {s.type: s.ai_generated for s in plan.steps if not s.ai_generated} == {"cost": False}
    agent.mark_ai_generated([plan], {"Purdue University": False})
    assert all(s.ai_generated for s in plan.steps)
