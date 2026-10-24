// Mirrors the SQLModel classes in backend/models.py.

export interface Profile {
  gpa: string
  from_school: string
  from_location: string
}

export interface GpaConversion {
  converted_gpa: number
  original_scale: string
  confidence: 'low' | 'medium' | 'high'
  explanation: string
}

export interface Step {
  title: string
  category: string
  description: string
  deadline: string | null
}

export interface Plan {
  school: string
  steps: Step[]
}

// Events streamed from /api/plan/stream, one JSON object per line.
export interface ToolCallEvent {
  type: 'tool_call'
  name: string
  args: Record<string, unknown>
}

export interface ToolResultEvent {
  type: 'tool_result'
  name: string
  result: Record<string, unknown>
}

export interface PlanEvent {
  type: 'plan'
  plan: Plan
}

export interface ErrorEvent {
  type: 'error'
  detail: string
}

export type AgentEvent = ToolCallEvent | ToolResultEvent | PlanEvent | ErrorEvent
