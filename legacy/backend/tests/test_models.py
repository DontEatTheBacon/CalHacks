import json
import typing
from datetime import date

import pytest
from pydantic import ValidationError

import agent
import models
import tool_models as tm
from samples import MINIMAL_RESULTS, STEPS


def step_classes():
    union = typing.get_args(models.Step)[0]
    return typing.get_args(union)


def test_plan_sorts_steps_into_step_order():
    plan = models.Plan.model_validate({"school": "X", "steps": STEPS})
    assert [step.type for step in plan.steps] == models.STEP_ORDER


def test_step_order_covers_every_step_type_exactly_once():
    types_ = [typing.get_args(cls.model_fields["type"].annotation)[0] for cls in step_classes()]
    assert sorted(types_) == sorted(models.STEP_ORDER)
    assert len(set(models.STEP_ORDER)) == len(models.STEP_ORDER)


def test_steps_validate_against_their_own_type():
    with pytest.raises(ValidationError):
        models.Plan.model_validate({"school": "X", "steps": [{"type": "visa", "title": "t", "description": "d"}]})
    with pytest.raises(ValidationError):
        models.Plan.model_validate({"school": "X", "steps": [{"type": "unknown", "title": "t", "description": "d"}]})


def test_step_dates_parse_iso_dates_and_reject_free_text():
    visa = {"type": "visa", "title": "t", "description": "d", "visa_type": "F-1", "documents": [], "link": {"url": "https://example.gov"}}
    plan = models.Plan.model_validate({"school": "X", "steps": [{**visa, "start_date": "2027-04-01", "end_date": "2027-06-01"}]})
    assert (plan.steps[0].start_date, plan.steps[0].end_date) == (date(2027, 4, 1), date(2027, 6, 1))
    assert plan.model_dump(mode="json")["steps"][0]["end_date"] == "2027-06-01"
    with pytest.raises(ValidationError):
        models.Plan.model_validate({"school": "X", "steps": [{**visa, "end_date": "December 2026"}]})


def test_plans_need_at_least_one_plan():
    with pytest.raises(ValidationError):
        models.Plans.model_validate({"plans": []})


def test_minimal_plan_fills_optional_details_with_defaults():
    plan = models.Plan.model_validate({"school": "X", "steps": STEPS})
    assert plan.fit_reason is None and plan.metrics is None
    for step in plan.steps:
        assert step.complete is False


@pytest.mark.parametrize("model", list(MINIMAL_RESULTS), ids=lambda m: m.__name__)
def test_tool_results_accept_only_required_fields(model):
    result = model.model_validate(MINIMAL_RESULTS[model])
    # Round-trips through JSON (dates become strings), as tool results are sent to Claude and the UI.
    assert model.model_validate_json(json.dumps(result.model_dump(mode="json"))) == result


def test_every_tool_result_model_has_a_minimal_sample():
    assert {tool.result for tool in agent.TOOLS.values()} <= set(MINIMAL_RESULTS)


# Anything with a cost, plus scholarships and applications, must link to the page stating it.
LINKED_RESULTS = {tm.VisaRequirements, tm.TravelInfo, tm.FlightInfo, tm.Scholarship, tm.HousingInfo,
                  tm.ApplicationDeadlines, tm.UniversityCost, tm.InsuranceRequirements, tm.CourseTransfer, tm.ExchangeRate}
LINKED_STEPS = {"visa", "travel", "scholarship", "housing", "application", "cost", "insurance"}


def test_cost_scholarship_and_application_results_require_links():
    for model in set(MINIMAL_RESULTS) | {tm.Scholarship, tm.TravelInfo}:  # including the models nested in lists
        if "link" in model.model_fields:
            assert model.model_fields["link"].is_required() == (model in LINKED_RESULTS), model.__name__


def test_cost_scholarship_and_application_steps_require_links():
    for cls in step_classes():
        step_type = typing.get_args(cls.model_fields["type"].annotation)[0]
        assert cls.model_fields["link"].is_required() == (step_type in LINKED_STEPS), step_type


def test_plan_metrics_totals_are_calculated():
    metrics = models.PlanMetrics(match_rate=87, program_years=2, cost_per_year_usd=52000, work_pay_per_year_usd=12000)
    assert (metrics.total_cost_usd, metrics.total_work_pay_usd) == (104000, 24000)
    # Totals from Claude are ignored, and they aren't in the schema it's asked to fill.
    assert models.PlanMetrics.model_validate({**metrics.model_dump(), "total_cost_usd": 1}).total_cost_usd == 104000
    assert "total_cost_usd" not in models.PlanMetrics.model_json_schema()["properties"]
    assert models.Plan(school="X", steps=[], metrics=metrics).model_dump()["metrics"]["total_work_pay_usd"] == 24000


@pytest.mark.parametrize("bad", [{"match_rate": 101}, {"match_rate": -1}, {"program_years": 0}, {"cost_per_year_usd": -5}])
def test_plan_metrics_reject_impossible_values(bad):
    good = {"match_rate": 80, "program_years": 2, "cost_per_year_usd": 50000, "work_pay_per_year_usd": 10000}
    with pytest.raises(ValidationError):
        models.PlanMetrics.model_validate({**good, **bad})


def test_resource_link_label_is_optional():
    assert tm.ResourceLink(url="https://example.edu").label is None


def test_profile_rejects_unknown_level():
    profile = {"gpa": "8.5", "from_school": "S", "citizenship": "India", "major": "CS", "start_term": "Fall 2027", "budget_usd_per_year": 45000}
    assert models.Profile.model_validate({**profile, "level": "graduate"}).level == "graduate"
    with pytest.raises(ValidationError):
        models.Profile.model_validate({**profile, "level": "phd"})
