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


def test_due_date_parses_iso_dates_and_rejects_free_text():
    visa = {"type": "visa", "title": "t", "description": "d", "visa_type": "F-1", "documents": []}
    plan = models.Plan.model_validate({"school": "X", "steps": [{**visa, "due_date": "2027-06-01"}]})
    assert plan.steps[0].due_date == date(2027, 6, 1)
    assert plan.model_dump(mode="json")["steps"][0]["due_date"] == "2027-06-01"
    with pytest.raises(ValidationError):
        models.Plan.model_validate({"school": "X", "steps": [{**visa, "due_date": "December 2026"}]})


def test_plans_need_at_least_one_plan():
    with pytest.raises(ValidationError):
        models.Plans.model_validate({"plans": []})


def test_minimal_plan_fills_optional_details_with_defaults():
    plan = models.Plan.model_validate({"school": "X", "steps": STEPS})
    assert plan.fit_reason is None and plan.total_cost_usd_per_year is None
    for step in plan.steps:
        assert step.complete is False
        assert step.link is None


@pytest.mark.parametrize("model", list(MINIMAL_RESULTS), ids=lambda m: m.__name__)
def test_tool_results_accept_only_required_fields(model):
    result = model.model_validate(MINIMAL_RESULTS[model])
    # Round-trips through JSON (dates become strings), as tool results are sent to Gemini and the UI.
    assert model.model_validate_json(json.dumps(result.model_dump(mode="json"))) == result


def test_every_tool_result_model_has_a_minimal_sample():
    assert {tool.result for tool in agent.TOOLS.values()} <= set(MINIMAL_RESULTS)


@pytest.mark.parametrize("model", list(MINIMAL_RESULTS), ids=lambda m: m.__name__)
def test_links_are_optional(model):
    if "link" in model.model_fields:
        assert not model.model_fields["link"].is_required()


def test_resource_link_label_is_optional():
    assert tm.ResourceLink(url="https://example.edu").label is None


def test_profile_rejects_unknown_level():
    profile = {"gpa": "8.5", "from_school": "S", "citizenship": "India", "major": "CS", "start_term": "Fall 2027", "budget_usd_per_year": 45000}
    assert models.Profile.model_validate({**profile, "level": "graduate"}).level == "graduate"
    with pytest.raises(ValidationError):
        models.Profile.model_validate({**profile, "level": "phd"})
