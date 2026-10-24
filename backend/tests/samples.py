"""Shared test data: valid arguments for every tool and minimal valid results for every result model."""

import json
from types import SimpleNamespace

import anthropic
import httpx2

import tool_models as tm

COLLEGE = "Georgia Institute of Technology"
LINK = {"url": "https://example.edu/page"}

# Valid arguments for every tool in agent.TOOLS.
TOOL_ARGS = {
    "convert_gpa": {"gpa": "8.5", "from_school": "Indian Institute of Technology Bombay", "from_location": "Mumbai, India"},
    "get_visa_requirements": {"citizenship": "India", "study_country": "United States"},
    "get_flights": {"from_location": "Mumbai, India", "college": COLLEGE},
    "get_ground_route": {"origin": "Hartsfield-Jackson Atlanta International Airport", "college": COLLEGE},
    "find_scholarships": {"college": COLLEGE, "citizenship": "India"},
    "get_housing_options": {"college": COLLEGE},
    "get_language_requirements": {"college": COLLEGE, "citizenship": "India"},
    "get_application_deadlines": {"college": COLLEGE, "level": "graduate"},
    "get_university_cost": {"college": COLLEGE, "level": "graduate"},
    "get_insurance_requirements": {"college": COLLEGE},
    "get_standardized_tests": {"college": COLLEGE, "level": "graduate"},
    "check_course_transfer": {"from_school": "Indian Institute of Technology Bombay", "college": COLLEGE},
    "get_exchange_rate": {"currency": "INR"},
    "schedule_steps": {"college": COLLEGE, "start_term": "Fall 2027", "fixed_dates": [{"step_type": "application", "end_date": "2026-12-15"}]},
    "get_work_options": {"citizenship": "India", "study_country": "United States", "college": COLLEGE, "major": "Computer Science"},
}

# Results with only the required fields, as a terse Claude answer might look.
MINIMAL_RESULTS = {
    tm.GpaConversion: {"original_gpa": 8.5, "converted_gpa": 3.7},
    tm.VisaRequirements: {"visa_type": "F-1", "required_documents": ["Form I-20"], "processing_time": "2 to 4 weeks", "link": LINK},
    tm.FlightInfo: {"departure_airport": "Mumbai (BOM)", "arrival_airport": "Atlanta (ATL)", "flight_hours": 20.5, "layovers": ["Doha (DOH)"], "link": LINK},
    tm.RouteOptions: {"routes": [{"banned_travel_forms": [], "travel_forms": ["train"], "travel_duration": [0.4], "travel_destinations": ["Midtown"], "link": LINK}]},
    tm.Scholarships: {"scholarships": [{"name": "Merit award", "amount_usd": 5000, "eligibility": "All applicants", "end_date": "2027-01-15", "link": LINK}]},
    tm.HousingInfo: {"on_campus_monthly_usd": 900, "off_campus_monthly_usd": 1200, "first_year_guaranteed": True, "link": LINK},
    tm.LanguageRequirements: {"accepted_tests": [{"test": "TOEFL iBT", "minimum_score": "90"}], "waiver_possible": False},
    tm.ApplicationDeadlines: {"deadlines": [{"round": "Fall", "end_date": "2026-12-15"}], "application_fee_usd": 75, "link": LINK},
    tm.UniversityCost: {"tuition_usd_per_year": 30000, "living_usd_per_year": 20000, "link": LINK},
    tm.InsuranceRequirements: {"school_plan_required": True, "annual_cost_usd": 3800, "waiver_allowed": True, "link": LINK},
    tm.TestRequirements: {"required": [], "recommended": ["GRE"]},
    tm.CourseTransfer: {"accepts_transfer_credit": False, "max_credits": None, "evaluation_required": None, "link": LINK},
    tm.ExchangeRate: {"currency": "INR", "rate": 94.94, "date": "2026-10-23", "link": LINK},
    tm.Schedule: {"college": COLLEGE, "program_start": "2027-08-01", "steps": [{"step_type": "visa", "start_date": "2027-04-03", "end_date": "2027-06-02", "rule": "r"}]},
    tm.WorkOptions: {"on_campus_hours_per_week": 20, "post_study_work": "OPT", "post_study_duration": "12 months", "on_campus_hourly_pay_usd": 16.5, "post_study_salary_usd": 110000},
}

# One minimal step of every type, deliberately out of order.
STEPS = [
    {"type": "work", "title": "Work", "description": "d", "permit": "OPT", "hours_per_week": 20, "hourly_pay_usd": 16.5},
    {"type": "travel", "title": "Travel", "description": "d", "arrival_airport": "ATL", "flight_cost_usd": 900, "link": LINK},
    {"type": "transfer", "title": "Transfer", "description": "d", "evaluation": None},
    {"type": "housing", "title": "Housing", "description": "d", "option": "Dorm", "monthly_cost_usd": 900, "link": LINK},
    {"type": "insurance", "title": "Insurance", "description": "d", "plan": "SHIP", "annual_cost_usd": 3800, "link": LINK},
    {"type": "visa", "title": "Visa", "description": "d", "visa_type": "F-1", "documents": ["I-20"], "link": LINK},
    {"type": "cost", "title": "Cost", "description": "d", "amount_usd": 50000, "link": LINK},
    {"type": "scholarship", "title": "Scholarship", "description": "d", "scholarship": "Merit", "amount_usd": None, "link": LINK},
    {"type": "application", "title": "Apply", "description": "d", "round": "Fall", "application_fee_usd": 75, "link": LINK},
    {"type": "language", "title": "English", "description": "d", "test": "TOEFL", "minimum_score": "90"},
    {"type": "test", "title": "GRE", "description": "d", "test": "GRE"},
    {"type": "gpa", "title": "GPA", "description": "d", "converted_gpa": 3.7},
]


def claude_response(calls=(), text=None, stop_reason=None):
    """A Messages API response that either calls tools ([(name, args), ...]) or answers with text."""
    content = [SimpleNamespace(type="tool_use", id=f"toolu_{i}", name=name, input=args) for i, (name, args) in enumerate(calls)]
    if text is not None:
        content.append(SimpleNamespace(type="text", text=text))
    return SimpleNamespace(content=content, stop_reason=stop_reason or ("tool_use" if calls else "end_turn"))


def parsed(output, stop_reason="end_turn"):
    """A messages.parse response; output is the validated model, or None when Claude's answer didn't fit."""
    return SimpleNamespace(parsed_output=output, stop_reason=stop_reason)


def api_error(cls, status, headers=None, message="error"):
    """A real anthropic SDK exception, as the client raises it for an HTTP status."""
    response = httpx2.Response(status, headers=headers or {}, request=httpx2.Request("POST", "https://api.anthropic.com/v1/messages"))
    return cls(message, response=response, body=None)


def timeout_error():
    return anthropic.APITimeoutError(request=httpx2.Request("POST", "https://api.anthropic.com/v1/messages"))


def rate_limited(retry_after=None):
    return api_error(anthropic.RateLimitError, 429, {"retry-after": str(retry_after)} if retry_after else None)


def plans_text(*schools: str) -> str:
    return json.dumps({"plans": [{"school": school, "steps": []} for school in schools]})
