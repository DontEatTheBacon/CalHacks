from datetime import date
from typing import Annotated, Any, Literal

from pydantic import Field, model_validator
from sqlmodel import SQLModel

from tool_models import ResourceLink

# basically just the user input, make dynamic? and have a bunch of nullable fields
class Profile(SQLModel):
    gpa: str
    from_school: str
    citizenship: str
    level: Literal["undergraduate", "graduate"]
    major: str
    start_term: str
    budget_usd_per_year: int


# Tool args and results live in tool_models.py.


# Timeline steps: each type has the shared fields plus its own key details.
class StepBase(SQLModel):
    complete: bool = False
    title: str
    description: str = Field(description="What the student should do, in one or two sentences")
    link: ResourceLink | None = Field(default=None, description="The link from the matching tool result, if any")


class DatedStep(StepBase):
    due_date: date | None = Field(default=None, description="When this must be done, as YYYY-MM-DD, or null if unknown")


class GpaStep(StepBase):
    type: Literal["gpa"]
    converted_gpa: float
    original_gpa: float | None = Field(default=None, description="The GPA on the student's home scale")


class VisaStep(DatedStep):
    type: Literal["visa"]
    visa_type: str
    documents: list[str]
    fee_usd: int | None = Field(default=None, description="Visa and related fees")


class TravelStep(DatedStep):
    type: Literal["travel"]
    arrival_airport: str
    flight_cost_usd: int | None
    departure_airport: str | None = Field(default=None, description="Airport the student leaves from")
    route: list[str] = Field(default=[], description="Ground legs from the airport to campus, e.g. 'MARTA Red Line to North Avenue'")


class ScholarshipStep(DatedStep):
    type: Literal["scholarship"]
    scholarship: str
    amount_usd: int | None
    eligibility: str | None = Field(default=None, description="Who can apply, in one sentence")


class HousingStep(DatedStep):
    type: Literal["housing"]
    option: str = Field(description="e.g. 'On-campus residence'")
    monthly_cost_usd: int | None
    deposit_usd: int | None = Field(default=None, description="Housing deposit")


class LanguageStep(DatedStep):
    type: Literal["language"]
    test: str
    minimum_score: str
    waiver_possible: bool | None = Field(default=None, description="Whether the student could get this waived")


class ApplicationStep(DatedStep):
    type: Literal["application"]
    round: str
    application_fee_usd: int | None
    required_documents: list[str] = Field(default=[], description="Documents to submit with the application")


class CostStep(DatedStep):
    type: Literal["cost"]
    amount_usd: int = Field(description="Amount to pay or show as funds")
    tuition_usd: int | None = Field(default=None, description="Tuition part of the amount")
    living_usd: int | None = Field(default=None, description="Living-cost part of the amount")


class InsuranceStep(DatedStep):
    type: Literal["insurance"]
    plan: str
    annual_cost_usd: int | None
    waiver_allowed: bool | None = Field(default=None, description="Whether outside insurance can replace the school plan")


class TestStep(DatedStep):
    type: Literal["test"]
    test: str = Field(description="Standardized test, e.g. 'GRE'")
    target_score: str | None = Field(default=None, description="Typical score of admitted students")


class TransferStep(DatedStep):
    type: Literal["transfer"]
    evaluation: str | None = Field(description="Credential evaluation needed, if any")
    max_credits: int | None = Field(default=None, description="Most credits that can transfer")


class WorkStep(StepBase):
    type: Literal["work"]
    permit: str = Field(description="e.g. 'OPT'")
    hours_per_week: int | None
    post_study_duration: str | None = Field(default=None, description="How long the student can work after graduating")


Step = Annotated[
    GpaStep | VisaStep | TravelStep | ScholarshipStep | HousingStep | LanguageStep
    | ApplicationStep | CostStep | InsuranceStep | TestStep | TransferStep | WorkStep,
    Field(discriminator="type"),
]

# UPDATE LATER: hard-coded timeline order; factor in due_date once dates are reliable.
STEP_ORDER = [
    "gpa", "test", "language", "application", "scholarship", "cost",
    "visa", "insurance", "housing", "transfer", "travel", "work",
]


class Plan(SQLModel):
    school: str
    steps: list[Step]
    fit_reason: str | None = Field(default=None, description="Why this college fits the student, in one sentence")
    total_cost_usd_per_year: int | None = Field(default=None, description="Tuition plus living costs per year")

    @model_validator(mode="after")
    def order_steps(self):
        self.steps.sort(key=lambda step: STEP_ORDER.index(step.type))
        return self


class Plans(SQLModel):
    plans: list[Plan] = Field(min_length=1, description="One plan per college, best fit first")


# Events streamed from /api/plan/stream, one JSON object per line.
class ToolCallEvent(SQLModel):
    type: Literal["tool_call"] = "tool_call"
    id: int  # matches the ToolResultEvent for this call
    name: str
    args: dict[str, Any]


class ToolResultEvent(SQLModel):
    type: Literal["tool_result"] = "tool_result"
    id: int
    name: str
    result: dict[str, Any]


class PlansEvent(SQLModel):
    type: Literal["plans"] = "plans"
    plans: list[Plan]


class ErrorEvent(SQLModel):
    type: Literal["error"] = "error"
    detail: str
