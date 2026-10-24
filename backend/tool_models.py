from datetime import date
from typing import Literal

from sqlmodel import Field, SQLModel

class ConvertGpaArgs(SQLModel):
    gpa: str = Field(description="GPA as written on the transcript, e.g. '8.5'")
    from_school: str = Field(description="The student's current school")
    from_location: str = Field(description="City and country of that school")


class CountryArgs(SQLModel):
    citizenship: str = Field(description="Country the student is a citizen of")
    study_country: str = Field(description="Country the student will study in")


class CollegeArgs(SQLModel):
    college: str = Field(description="College the student will attend")


class CollegeLevelArgs(SQLModel):
    college: str = Field(description="College the student will attend")
    level: Literal["undergraduate", "graduate"] = Field(description="Degree level")


class CollegeCitizenshipArgs(SQLModel):
    college: str = Field(description="College the student will attend")
    citizenship: str = Field(description="Country the student is a citizen of")


class TravelArgs(SQLModel):
    from_location: str = Field(description="Student's home city and country")
    college: str = Field(description="College the student will attend")


class GroundRouteArgs(SQLModel):
    origin: str = Field(description="Where the trip starts, usually the arrival airport, e.g. 'Hartsfield-Jackson Atlanta International Airport'")
    college: str = Field(description="College the student will attend")


class TransferArgs(SQLModel):
    from_school: str = Field(description="The student's current school")
    college: str = Field(description="College the student will attend")


# Tool results; used as Gemini's response_schema.


class ResourceLink(SQLModel):
    url: str = Field(description="Link to the resouce or application for an item or any useful information")
    label: str | None = Field(default=None, description="Short name of the page, e.g. 'Graduate admissions'")


class GpaConversion(SQLModel):
    original_gpa: float = Field(description="The original GPA on origianl scale")
    converted_gpa: float = Field(description="The GPA on the US 4.0 scale")
    original_scale: str | None = Field(default=None, description="The home grading scale, e.g. '10-point CGPA'")
    method: str | None = Field(default=None, description="How the conversion was made, in one sentence")
    confidence: Literal["low", "medium", "high"] | None = Field(default=None, description="How reliable the conversion is")


class VisaRequirements(SQLModel):
    visa_type: str = Field(description="Student visa needed, e.g. 'F-1'")
    required_documents: list[str] = Field(description="Key documents to prepare")
    processing_time: str = Field(description="Typical time from application to visa")
    visa_fee_usd: int | None = Field(default=None, description="Visa application fee")
    additional_fees_usd: int | None = Field(default=None, description="Other mandatory fees, e.g. the SEVIS I-901 fee")
    interview_required: bool | None = Field(default=None, description="Whether an in-person interview is required")
    financial_proof_usd: int | None = Field(default=None, description="Funds the student must show for the first year")
    earliest_application: str | None = Field(default=None, description="How early the student can apply, e.g. '365 days before the program starts'")
    earliest_entry: str | None = Field(default=None, description="How early the student can enter the country, e.g. '30 days before the program starts'")
    link: ResourceLink | None = Field(default=None, description="Official visa application or information page")


class TravelInfo(SQLModel):
    banned_travel_forms: list[str] = Field(description="List of any banned forms of transportation which may be a result of country laws or air laws etc")
    travel_forms: list[str] = Field(description="List of the forms of transportation in order eg train, car, plane if applicable")
    travel_duration: list[float] = Field(description="List of the amount of time of each form of transportation")
    travel_destinations: list[str] = Field(description="List of the travel locations in order")
    line_names: list[str | None] = Field(default=[], description="Transit line for each leg in order, e.g. 'MARTA Red Line', or null for walking or driving")
    fare_usd: float | None = Field(default=None, description="Total public transport fare for the route")
    source: str | None = Field(default=None, description="Where the route came from, e.g. 'Google Maps' or 'Gemini estimate'")


class FlightInfo(SQLModel):
    departure_airport: str = Field(description="Airport near the student's home, e.g. 'Mumbai (BOM)'")
    arrival_airport: str = Field(description="International airport closest to the college, e.g. 'Atlanta (ATL)'")
    flight_hours: float = Field(description="Typical total travel time including layovers")
    layovers: list[str] = Field(description="Typical layover airports, empty for a direct flight")
    typical_cost_usd: int | None = Field(default=None, description="Typical one-way economy fare")
    airlines: list[str] = Field(default=[], description="Airlines that commonly fly this route")
    baggage_allowance: str | None = Field(default=None, description="Typical checked baggage allowance, e.g. '2 x 23 kg'")
    link: ResourceLink | None = Field(default=None, description="Arrival airport's page for international arrivals")

# probably add some form that is generated based on the requirements 
class Scholarship(SQLModel):
    name: str
    amount_usd: int | None = Field(description="Award per year, if known")
    eligibility: str = Field(description="Who can apply, in one sentence")
    due_date: date | None = Field(description="Application deadline as YYYY-MM-DD, or null if unknown")
    link: ResourceLink | None = Field(default=None, description="Scholarship application or information page")
    award_type: Literal["merit", "need", "merit_and_need", "other"] | None = Field(default=None, description="What the award is based on")
    renewable: bool | None = Field(default=None, description="Whether the award renews each year")
    required_documents: list[str] = Field(default=[], description="Documents the application needs, e.g. essay, recommendation letters")


class Scholarships(SQLModel):
    scholarships: list[Scholarship]


class HousingInfo(SQLModel):
    on_campus_monthly_usd: int | None = Field(description="Typical on-campus cost per month")
    off_campus_monthly_usd: int | None = Field(description="Typical off-campus rent per month")
    first_year_guaranteed: bool = Field(description="Whether first-year students are guaranteed housing")
    options: list[str] = Field(default=[], description="Housing options, e.g. 'residence halls', 'graduate apartments'")
    application_deadline: date | None = Field(default=None, description="Housing application deadline as YYYY-MM-DD, or null if unknown")
    deposit_usd: int | None = Field(default=None, description="Deposit due when applying or accepting housing")
    meal_plan_required: bool | None = Field(default=None, description="Whether on-campus residents must buy a meal plan")
    link: ResourceLink | None = Field(default=None, description="The college's housing page")


class TestScore(SQLModel):
    test: str = Field(description="e.g. 'TOEFL iBT'")
    minimum_score: str
    minimum_subscores: str | None = Field(default=None, description="Minimum section scores, if any, e.g. '20 in each section'")


class LanguageRequirements(SQLModel):
    accepted_tests: list[TestScore]
    waiver_possible: bool = Field(description="Whether this student could get the requirement waived")
    waiver_conditions: str | None = Field(default=None, description="When the requirement is waived, in one sentence")
    link: ResourceLink | None = Field(default=None, description="The college's English requirements page")


class Deadline(SQLModel):
    round: str = Field(description="e.g. 'Early Action' or 'Regular Decision'")
    due_date: date | None = Field(description="Deadline as YYYY-MM-DD, or null if unknown")


class ApplicationDeadlines(SQLModel):
    deadlines: list[Deadline]
    application_fee_usd: int | None
    required_documents: list[str] = Field(default=[], description="Documents to submit, e.g. transcripts, statement of purpose, recommendation letters")
    decision_date: date | None = Field(default=None, description="When decisions are usually released, as YYYY-MM-DD, or null if unknown")
    link: ResourceLink | None = Field(default=None, description="The college's application portal or deadlines page")


class UniversityCost(SQLModel):
    tuition_usd_per_year: int
    living_usd_per_year: int = Field(description="Housing, food and other living costs")
    room_board_usd_per_year: int | None = Field(default=None, description="On-campus room and board")
    books_usd_per_year: int | None = Field(default=None, description="Books and supplies")
    fees_usd_per_year: int | None = Field(default=None, description="Mandatory fees not included in tuition")
    source: str | None = Field(default=None, description="Where the figures came from, e.g. 'College Scorecard' or 'Gemini estimate'")
    link: ResourceLink | None = Field(default=None, description="Official cost of attendance page")


class InsuranceRequirements(SQLModel):
    school_plan_required: bool = Field(description="Whether students are enrolled in the school's plan by default")
    annual_cost_usd: int | None = Field(description="Cost of the school's plan per year")
    waiver_allowed: bool = Field(description="Whether outside insurance can replace the school plan")
    waiver_deadline: date | None = Field(default=None, description="Deadline to waive the school plan as YYYY-MM-DD, or null if unknown")
    minimum_coverage: str | None = Field(default=None, description="Coverage outside insurance must meet to waive the school plan")
    link: ResourceLink | None = Field(default=None, description="The college's student health insurance page")


class TestRequirements(SQLModel):
    required: list[str] = Field(description="Tests every international applicant must take")
    recommended: list[str] = Field(description="Optional or recommended tests")
    typical_scores: list[TestScore] = Field(default=[], description="Typical scores of admitted students")
    link: ResourceLink | None = Field(default=None, description="The college's testing requirements page")


class CourseTransfer(SQLModel):
    accepts_transfer_credit: bool
    max_credits: int | None = Field(description="Most credits that can transfer, if there is a limit")
    evaluation_required: str | None = Field(description="Credential evaluation needed, e.g. 'WES course-by-course'")
    evaluation_services: list[str] = Field(default=[], description="Accepted evaluation services, e.g. 'WES', 'ECE'")
    evaluation_cost_usd: int | None = Field(default=None, description="Typical cost of the credential evaluation")
    link: ResourceLink | None = Field(default=None, description="The college's transfer credit page")


class WorkOptions(SQLModel):
    on_campus_hours_per_week: int | None = Field(description="Hours allowed during term")
    post_study_work: str = Field(description="Post-study work permit, e.g. 'OPT'")
    post_study_duration: str = Field(description="How long the student can work after graduating")
    off_campus_allowed: bool | None = Field(default=None, description="Whether off-campus work is allowed during studies, e.g. through CPT")
    stem_extension: str | None = Field(default=None, description="Extra post-study work time for STEM graduates, if any")
    link: ResourceLink | None = Field(default=None, description="Official page on student work rights")
