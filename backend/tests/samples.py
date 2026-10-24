"""Shared test data: valid arguments for every tool and minimal valid results for every result model."""

import json

from google.genai import types

import tool_models as tm

COLLEGE = "Georgia Institute of Technology"

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
    "get_work_options": {"citizenship": "India", "study_country": "United States"},
}

# Results with only the required fields, as a terse Gemini answer might look.
MINIMAL_RESULTS = {
    tm.GpaConversion: {"original_gpa": 8.5, "converted_gpa": 3.7},
    tm.VisaRequirements: {"visa_type": "F-1", "required_documents": ["Form I-20"], "processing_time": "2 to 4 weeks"},
    tm.FlightInfo: {"departure_airport": "Mumbai (BOM)", "arrival_airport": "Atlanta (ATL)", "flight_hours": 20.5, "layovers": ["Doha (DOH)"]},
    tm.TravelInfo: {"banned_travel_forms": [], "travel_forms": ["train"], "travel_duration": [0.4], "travel_destinations": ["Midtown"]},
    tm.Scholarships: {"scholarships": [{"name": "Merit award", "amount_usd": 5000, "eligibility": "All applicants", "due_date": "2027-01-15"}]},
    tm.HousingInfo: {"on_campus_monthly_usd": 900, "off_campus_monthly_usd": 1200, "first_year_guaranteed": True},
    tm.LanguageRequirements: {"accepted_tests": [{"test": "TOEFL iBT", "minimum_score": "90"}], "waiver_possible": False},
    tm.ApplicationDeadlines: {"deadlines": [{"round": "Fall", "due_date": "2026-12-15"}], "application_fee_usd": 75},
    tm.UniversityCost: {"tuition_usd_per_year": 30000, "living_usd_per_year": 20000},
    tm.InsuranceRequirements: {"school_plan_required": True, "annual_cost_usd": 3800, "waiver_allowed": True},
    tm.TestRequirements: {"required": [], "recommended": ["GRE"]},
    tm.CourseTransfer: {"accepts_transfer_credit": False, "max_credits": None, "evaluation_required": None},
    tm.WorkOptions: {"on_campus_hours_per_week": 20, "post_study_work": "OPT", "post_study_duration": "12 months"},
}

# One minimal step of every type, deliberately out of order.
STEPS = [
    {"type": "work", "title": "Work", "description": "d", "permit": "OPT", "hours_per_week": 20},
    {"type": "travel", "title": "Travel", "description": "d", "arrival_airport": "ATL", "flight_cost_usd": 900},
    {"type": "transfer", "title": "Transfer", "description": "d", "evaluation": None},
    {"type": "housing", "title": "Housing", "description": "d", "option": "Dorm", "monthly_cost_usd": 900},
    {"type": "insurance", "title": "Insurance", "description": "d", "plan": "SHIP", "annual_cost_usd": 3800},
    {"type": "visa", "title": "Visa", "description": "d", "visa_type": "F-1", "documents": ["I-20"]},
    {"type": "cost", "title": "Cost", "description": "d", "amount_usd": 50000},
    {"type": "scholarship", "title": "Scholarship", "description": "d", "scholarship": "Merit", "amount_usd": None},
    {"type": "application", "title": "Apply", "description": "d", "round": "Fall", "application_fee_usd": 75},
    {"type": "language", "title": "English", "description": "d", "test": "TOEFL", "minimum_score": "90"},
    {"type": "test", "title": "GRE", "description": "d", "test": "GRE"},
    {"type": "gpa", "title": "GPA", "description": "d", "converted_gpa": 3.7},
]


def gemini_response(calls=(), text=None) -> types.GenerateContentResponse:
    """A Gemini response that either calls tools ([(name, args), ...]) or answers with text."""
    parts = [types.Part(function_call=types.FunctionCall(name=name, args=args)) for name, args in calls]
    if text is not None:
        parts.append(types.Part(text=text))
    return types.GenerateContentResponse(candidates=[types.Candidate(content=types.Content(role="model", parts=parts))])


def plans_text(*schools: str) -> str:
    return json.dumps({"plans": [{"school": school, "steps": []} for school in schools]})
