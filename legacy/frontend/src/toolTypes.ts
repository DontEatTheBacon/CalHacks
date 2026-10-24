// Mirrors the tool result SQLModels in backend/tool_models.py.

export interface ResourceLink {
  url: string
  label: string | null
  official: boolean | null // set by code: on the college's own site or a government site
}

export interface GpaConversion {
  original_gpa: number
  converted_gpa: number
  original_scale: string | null
  method: string | null
  confidence: 'low' | 'medium' | 'high' | null
}

export interface VisaRequirements {
  visa_type: string
  required_documents: string[]
  processing_time: string
  visa_fee_usd: number | null
  additional_fees_usd: number | null
  interview_required: boolean | null
  financial_proof_usd: number | null
  earliest_application: string | null
  earliest_entry: string | null
  link: ResourceLink
}

export interface TravelInfo {
  name: string | null // e.g. 'MARTA train' or 'Taxi'
  banned_travel_forms: string[]
  travel_forms: string[] // one per leg, in order, e.g. 'plane'
  travel_duration: number[] // one per leg, in hours
  travel_destinations: string[] // where each leg ends, in order
  line_names: (string | null)[] // transit line per leg, null for walking or driving
  link: ResourceLink // page with this option's fares
  fare_usd: number | null
  source: string | null
}

export interface RouteOptions {
  routes: TravelInfo[] // fastest first
}

export interface FlightInfo {
  departure_airport: string
  arrival_airport: string
  flight_hours: number
  layovers: string[]
  typical_cost_usd: number | null
  airlines: string[]
  baggage_allowance: string | null
  link: ResourceLink
}

export interface Scholarship {
  name: string
  amount_usd: number | null
  eligibility: string
  start_date: string | null // YYYY-MM-DD, when it opens
  end_date: string | null // YYYY-MM-DD, the deadline
  link: ResourceLink
  award_type: 'merit' | 'need' | 'merit_and_need' | 'other' | null
  renewable: boolean | null
  required_documents: string[]
}

export interface Scholarships {
  scholarships: Scholarship[]
}

export interface HousingInfo {
  on_campus_monthly_usd: number | null
  off_campus_monthly_usd: number | null
  first_year_guaranteed: boolean
  options: string[]
  application_deadline: string | null // YYYY-MM-DD
  deposit_usd: number | null
  meal_plan_required: boolean | null
  link: ResourceLink
}

export interface TestScore {
  test: string
  minimum_score: string
  minimum_subscores: string | null
}

export interface LanguageRequirements {
  accepted_tests: TestScore[]
  waiver_possible: boolean
  waiver_conditions: string | null
  link: ResourceLink | null
}

export interface Deadline {
  round: string
  start_date: string | null // YYYY-MM-DD, when it opens
  end_date: string | null // YYYY-MM-DD, the deadline
}

export interface ApplicationDeadlines {
  deadlines: Deadline[]
  application_fee_usd: number | null
  required_documents: string[]
  decision_date: string | null // YYYY-MM-DD
  link: ResourceLink
}

export interface UniversityCost {
  tuition_usd_per_year: number
  living_usd_per_year: number
  room_board_usd_per_year: number | null
  books_usd_per_year: number | null
  fees_usd_per_year: number | null
  source: string | null
  link: ResourceLink
}

export interface InsuranceRequirements {
  school_plan_required: boolean
  annual_cost_usd: number | null
  waiver_allowed: boolean
  waiver_deadline: string | null // YYYY-MM-DD
  minimum_coverage: string | null
  link: ResourceLink
}

export interface TestRequirements {
  required: string[]
  recommended: string[]
  typical_scores: TestScore[]
  link: ResourceLink | null
}

export interface CourseTransfer {
  accepts_transfer_credit: boolean
  max_credits: number | null
  evaluation_required: string | null
  evaluation_services: string[]
  evaluation_cost_usd: number | null
  link: ResourceLink
}

export interface WorkOptions {
  on_campus_hours_per_week: number | null
  post_study_work: string
  post_study_duration: string
  on_campus_hourly_pay_usd: number
  post_study_salary_usd: number
  off_campus_allowed: boolean | null
  stem_extension: string | null
  link: ResourceLink | null
}

export type StepType =
  | 'gpa' | 'test' | 'language' | 'application' | 'scholarship' | 'cost'
  | 'visa' | 'insurance' | 'housing' | 'transfer' | 'travel' | 'work'

export interface ScheduledStep {
  step_type: StepType
  start_date: string // YYYY-MM-DD
  end_date: string // YYYY-MM-DD
  rule: string
}

export interface Schedule {
  college: string
  program_start: string // YYYY-MM-DD
  steps: ScheduledStep[]
}

export interface ExchangeRate {
  base: string // 'USD'
  currency: string
  rate: number // 1 USD in the home currency
  date: string // YYYY-MM-DD
  link: ResourceLink
}
