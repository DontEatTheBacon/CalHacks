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


// Timeline steps: each type has the shared fields plus its own key details.
interface StepBase {
  complete: boolean
  title: string
  description: string
  link: ResourceLink | null
}

interface DatedStep extends StepBase {
  due_date: string | null // YYYY-MM-DD
}

export interface GpaStep extends StepBase {
  type: 'gpa'
  converted_gpa: number
  original_gpa: number | null
}

export interface VisaStep extends DatedStep {
  type: 'visa'
  visa_type: string
  documents: string[]
  fee_usd: number | null
}

export interface TravelStep extends DatedStep {
  type: 'travel'
  arrival_airport: string
  flight_cost_usd: number | null
  departure_airport: string | null
  route: string[]
}

export interface ScholarshipStep extends DatedStep {
  type: 'scholarship'
  scholarship: string
  amount_usd: number | null
  eligibility: string | null
}

export interface HousingStep extends DatedStep {
  type: 'housing'
  option: string
  monthly_cost_usd: number | null
  deposit_usd: number | null
}

export interface LanguageStep extends DatedStep {
  type: 'language'
  test: string
  minimum_score: string
  waiver_possible: boolean | null
}

export interface ApplicationStep extends DatedStep {
  type: 'application'
  round: string
  application_fee_usd: number | null
  required_documents: string[]
}

export interface CostStep extends DatedStep {
  type: 'cost'
  amount_usd: number
  tuition_usd: number | null
  living_usd: number | null
}

export interface InsuranceStep extends DatedStep {
  type: 'insurance'
  plan: string
  annual_cost_usd: number | null
  waiver_allowed: boolean | null
}

export interface TestStep extends DatedStep {
  type: 'test'
  test: string
  target_score: string | null
}

export interface TransferStep extends DatedStep {
  type: 'transfer'
  evaluation: string | null
  max_credits: number | null
}

export interface WorkStep extends StepBase {
  type: 'work'
  permit: string
  hours_per_week: number | null
  post_study_duration: string | null
}

export type Step =
  | GpaStep | VisaStep | TravelStep | ScholarshipStep | HousingStep | LanguageStep
  | ApplicationStep | CostStep | InsuranceStep | TestStep | TransferStep | WorkStep

export interface Plan {
  school: string
  steps: Step[]
  fit_reason: string | null
  total_cost_usd_per_year: number | null
}

// Events streamed from /api/plan/stream, one JSON object per line.
export interface ToolCallEvent {
  type: 'tool_call'
  id: number // matches the ToolResultEvent for this call
  name: string
  args: Record<string, unknown>
}

export interface ToolResultEvent {
  type: 'tool_result'
  id: number
  name: string
  result: Record<string, unknown>
}

export interface Plans {
  plans: Plan[] // best fit first
}

export interface PlansEvent {
  type: 'plans'
  plans: Plan[]
}

export interface ErrorEvent {
  type: 'error'
  detail: string
}

export type AgentEvent = ToolCallEvent | ToolResultEvent | PlansEvent | ErrorEvent
