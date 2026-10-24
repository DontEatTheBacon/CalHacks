from datetime import date
from typing import Annotated, Any, Literal

from pydantic import Field, computed_field, model_validator
from sqlmodel import SQLModel

from .tool_models import ResourceLink

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
    ai_generated: bool = Field(default=True, description="Set by code, leave as is: false only when the step's facts came from an API")
    complete: bool = Field(default=False, description="Whether the student has finished this step; always false in a new plan")
    title: str
    description: str = Field(description="What the student should do, in one or two sentences")
    link: ResourceLink | None = Field(default=None, description="The link from the matching tool result, if any")
    start_date: date | None = Field(default=None, description="When to start this step, as YYYY-MM-DD; set by schedule_steps")
    end_date: date | None = Field(default=None, description="When this step must be done by, as YYYY-MM-DD; set by schedule_steps")


class GpaStep(StepBase):
    type: Literal["gpa"]
    converted_gpa: float
    original_gpa: float | None = Field(default=None, description="The GPA on the student's home scale")


class VisaStep(StepBase):
    type: Literal["visa"]
    visa_type: str
    documents: list[str]
    link: ResourceLink = Field(description="Official page listing the visa's requirements and fees")
    fee_usd: int | None = Field(default=None, description="Visa and related fees")


class TravelStep(StepBase):
    type: Literal["travel"]
    arrival_airport: str
    flight_cost_usd: int | None
    link: ResourceLink = Field(description="Page showing fares for this trip")
    departure_airport: str | None = Field(default=None, description="Airport the student leaves from")
    route: list[str] = Field(default=[], description="Ground legs from the airport to campus, e.g. 'MARTA Red Line to North Avenue'")


class ScholarshipStep(StepBase):
    type: Literal["scholarship"]
    scholarship: str
    amount_usd: int | None
    link: ResourceLink = Field(description="The scholarship's own application or information page")
    eligibility: str | None = Field(default=None, description="Who can apply, in one sentence")


class HousingStep(StepBase):
    type: Literal["housing"]
    option: str = Field(description="e.g. 'On-campus residence'")
    monthly_cost_usd: int | None
    link: ResourceLink = Field(description="The college's page listing housing costs")
    deposit_usd: int | None = Field(default=None, description="Housing deposit")


class LanguageStep(StepBase):
    type: Literal["language"]
    test: str
    minimum_score: str
    waiver_possible: bool | None = Field(default=None, description="Whether the student could get this waived")


class ApplicationStep(StepBase):
    type: Literal["application"]
    round: str
    application_fee_usd: int | None
    link: ResourceLink = Field(description="The college's application page")
    required_documents: list[str] = Field(default=[], description="Documents to submit with the application")


class CostStep(StepBase):
    type: Literal["cost"]
    amount_usd: int = Field(description="Amount to pay or show as funds")
    link: ResourceLink = Field(description="The page listing these costs")
    tuition_usd: int | None = Field(default=None, description="Tuition part of the amount")
    living_usd: int | None = Field(default=None, description="Living-cost part of the amount")


class InsuranceStep(StepBase):
    type: Literal["insurance"]
    plan: str
    annual_cost_usd: int | None
    link: ResourceLink = Field(description="The college's page listing the insurance plan and its cost")
    waiver_allowed: bool | None = Field(default=None, description="Whether outside insurance can replace the school plan")


class TestStep(StepBase):
    type: Literal["test"]
    test: str = Field(description="Standardized test, e.g. 'GRE'")
    target_score: str | None = Field(default=None, description="Typical score of admitted students")


class TransferStep(StepBase):
    type: Literal["transfer"]
    evaluation: str | None = Field(description="Credential evaluation needed, if any")
    max_credits: int | None = Field(default=None, description="Most credits that can transfer")


class WorkStep(StepBase):
    type: Literal["work"]
    permit: str = Field(description="e.g. 'OPT'")
    hours_per_week: int | None
    hourly_pay_usd: float = Field(description="Typical hourly pay for on-campus jobs")
    post_study_salary_usd: int | None = Field(default=None, description="Typical starting salary per year for this major after graduating")
    post_study_duration: str | None = Field(default=None, description="How long the student can work after graduating")


Step = Annotated[
    GpaStep | VisaStep | TravelStep | ScholarshipStep | HousingStep | LanguageStep
    | ApplicationStep | CostStep | InsuranceStep | TestStep | TransferStep | WorkStep,
    Field(discriminator="type"),
]

# UPDATE LATER: hard-coded timeline order; factor in end_date now that schedule_steps sets it.
STEP_ORDER = [
    "gpa", "test", "language", "application", "scholarship", "cost",
    "visa", "insurance", "housing", "transfer", "travel", "work",
]


class PlanMetrics(SQLModel):
    match_rate: int = Field(ge=0, le=100, description="How well this college fits the student's grades, budget and goals, from 0 to 100")
    program_years: float = Field(gt=0, description="Length of the program in years")
    cost_per_year_usd: int = Field(ge=0, description="Tuition plus living costs per year")
    work_pay_per_year_usd: int = Field(ge=0, description="Expected pay per year from allowed part-time work while studying")
    home_currency: str | None = Field(default=None, description="Set by code from get_exchange_rate; leave empty")
    usd_to_home_rate: float | None = Field(default=None, description="Set by code from get_exchange_rate; leave empty")
    post_study_salary_usd: int | None = Field(default=None, description="Typical starting salary per year for this major after graduating")

    # Totals are calculated rather than asked for, so they always match the yearly figures.
    @computed_field
    @property
    def total_cost_usd(self) -> int:
        return round(self.cost_per_year_usd * self.program_years)

    @computed_field
    @property
    def total_work_pay_usd(self) -> int:
        return round(self.work_pay_per_year_usd * self.program_years)


class Plan(SQLModel):
    school: str
    steps: list[Step]
    fit_reason: str | None = Field(default=None, description="Why this college fits the student, in one sentence")
    metrics: PlanMetrics | None = Field(default=None, description="Summary numbers for this plan; always fill these in")
    school_website: ResourceLink | None = Field(default=None, description="Set by code from the official university list; leave empty")

    @model_validator(mode="after")
    def order_steps(self):
        self.steps.sort(key=lambda step: STEP_ORDER.index(step.type))
        return self


class ConsideredCollege(SQLModel):
    school: str
    cost_per_year_usd: int | None = Field(default=None, description="From get_university_cost, if checked")
    chosen: bool = Field(description="Whether it made the final plans")
    reason: str = Field(description="Why it was kept or dropped, in one sentence, e.g. 'Over budget by $7,000 a year'")


class Plans(SQLModel):
    plans: list[Plan] = Field(min_length=1, description="One plan per college, best fit first")
    considered: list[ConsideredCollege] = Field(default=[], description="Every shortlisted college, including the ones dropped, and why")


# Events streamed from /api/plan/stream, one JSON object per line.
class ToolCallEvent(SQLModel):
    type: Literal["tool_call"] = "tool_call"
    id: int  # matches the ToolResultEvent for this call
    name: str
    school: str | None = None  # the college this lookup is for; None for general ones like visa or exchange rate
    args: dict[str, Any]


class ToolResultEvent(SQLModel):
    type: Literal["tool_result"] = "tool_result"
    id: int
    name: str
    school: str | None = None
    ai_generated: bool  # true when the result came from Claude rather than an API or our own code
    result: dict[str, Any]


class PlansEvent(SQLModel):
    type: Literal["plans"] = "plans"
    plans: list[Plan]
    considered: list[ConsideredCollege] = []


class ErrorEvent(SQLModel):
    type: Literal["error"] = "error"
    detail: str


# Option lists for the profile form, from /api/options/*.
class SchoolOption(SQLModel):
    name: str
    country: str
    website: str | None
    domains: list[str]


class TermOptions(SQLModel):
    seasons: list[str]
    years: list[int]


# Redoing one step: every version the student rejected (newest last) and an optional note on what to change.
class StepRedoRequest(SQLModel):
    profile: Profile
    school: str
    rejected: list[Step] = Field(min_length=1, description="Rejected versions of this step, newest last")
    feedback: str | None = Field(default=None, max_length=500, description="What the student wants instead, if anything")


class StepRedoResult(SQLModel):
    step: Step
