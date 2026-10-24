import type { ResourceLink } from './toolTypes'

// Mirrors the SQLModel classes in backend/models.py.

export interface Profile {
  gpa: string
  from_school: string
  citizenship: string
  level: 'undergraduate' | 'graduate'
  major: string
  start_term: string
  budget_usd_per_year: number
}


// Option lists for the profile form, from /api/options/*.
export interface SchoolOption {
  name: string
  country: string
  website: string | null
  domains: string[]
}

export interface TermOptions {
  seasons: string[]
  years: number[]
}

// Timeline steps: each type has the shared fields plus its own key details.
interface StepBase {
  ai_generated: boolean // set by code: false only when the facts came from an API
  complete: boolean
  title: string
  description: string
  link: ResourceLink | null
  start_date: string | null // YYYY-MM-DD, set by schedule_steps
  end_date: string | null // YYYY-MM-DD, the deadline
}

export interface GpaStep extends StepBase {
  type: 'gpa'
  converted_gpa: number
  original_gpa: number | null
}

export interface VisaStep extends StepBase {
  type: 'visa'
  visa_type: string
  documents: string[]
  link: ResourceLink
  fee_usd: number | null
}

export interface TravelStep extends StepBase {
  type: 'travel'
  arrival_airport: string
  flight_cost_usd: number | null
  link: ResourceLink
  departure_airport: string | null
  route: string[]
}

export interface ScholarshipStep extends StepBase {
  type: 'scholarship'
  scholarship: string
  amount_usd: number | null
  link: ResourceLink
  eligibility: string | null
}

export interface HousingStep extends StepBase {
  type: 'housing'
  option: string
  monthly_cost_usd: number | null
  link: ResourceLink
  deposit_usd: number | null
}

export interface LanguageStep extends StepBase {
  type: 'language'
  test: string
  minimum_score: string
  waiver_possible: boolean | null
}

export interface ApplicationStep extends StepBase {
  type: 'application'
  round: string
  application_fee_usd: number | null
  link: ResourceLink
  required_documents: string[]
}

export interface CostStep extends StepBase {
  type: 'cost'
  amount_usd: number
  link: ResourceLink
  tuition_usd: number | null
  living_usd: number | null
}

export interface InsuranceStep extends StepBase {
  type: 'insurance'
  plan: string
  annual_cost_usd: number | null
  link: ResourceLink
  waiver_allowed: boolean | null
}

export interface TestStep extends StepBase {
  type: 'test'
  test: string
  target_score: string | null
}

export interface TransferStep extends StepBase {
  type: 'transfer'
  evaluation: string | null
  max_credits: number | null
}

export interface WorkStep extends StepBase {
  type: 'work'
  permit: string
  hours_per_week: number | null
  hourly_pay_usd: number
  post_study_salary_usd: number | null
  post_study_duration: string | null
}

export type Step =
  | GpaStep | VisaStep | TravelStep | ScholarshipStep | HousingStep | LanguageStep
  | ApplicationStep | CostStep | InsuranceStep | TestStep | TransferStep | WorkStep

export interface PlanMetrics {
  match_rate: number // 0 to 100
  program_years: number
  cost_per_year_usd: number
  work_pay_per_year_usd: number
  home_currency: string | null // set by code from get_exchange_rate
  usd_to_home_rate: number | null
  post_study_salary_usd: number | null
  total_cost_usd: number // calculated: cost per year x years
  total_work_pay_usd: number // calculated: work pay per year x years
}

export interface Plan {
  school: string
  steps: Step[]
  fit_reason: string | null
  metrics: PlanMetrics | null
  school_website: ResourceLink | null // set by code from the official university list
}

// Events streamed from /api/plan/stream, one JSON object per line.
export interface ToolCallEvent {
  type: 'tool_call'
  id: number // matches the ToolResultEvent for this call
  name: string
  school: string | null // the college this lookup is for; null for general ones like visa
  args: Record<string, unknown>
}

export interface ToolResultEvent {
  type: 'tool_result'
  id: number
  name: string
  school: string | null
  ai_generated: boolean // from Claude rather than an API or our own code
  result: Record<string, unknown>
}

export interface ConsideredCollege {
  school: string
  cost_per_year_usd: number | null
  chosen: boolean
  reason: string
}

export interface StepRedoResult {
  step: Step
}

export interface Plans {
  plans: Plan[] // best fit first
  considered: ConsideredCollege[] // every shortlisted college, including dropped ones
}

export interface PlansEvent {
  type: 'plans'
  plans: Plan[]
  considered: ConsideredCollege[]
}

export interface ErrorEvent {
  type: 'error'
  detail: string
}

export type AgentEvent = ToolCallEvent | ToolResultEvent | PlansEvent | ErrorEvent
