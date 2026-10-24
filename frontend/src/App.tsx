import { useState, type FormEvent } from 'react'
import { ActivityFeed, type ToolActivity } from './Activity'
import { PlanBrowser } from './Timeline'
import type { AgentEvent, Plan, Profile } from './types'
import './App.css'

// Test data, prefilled so the form can be submitted as-is.
const TEST_PROFILE: Profile = {
  gpa: '8.5',
  from_school: 'Indian Institute of Technology Bombay',
  citizenship: 'India',
  level: 'graduate',
  major: 'Computer Science',
  start_term: 'February 2027',
  budget_usd_per_year: 45000,
}

const FIELD_LABELS: Record<keyof Profile, string> = {
  gpa: 'GPA',
  from_school: 'Current school',
  citizenship: 'Citizenship',
  level: 'Degree level',
  major: 'Major',
  start_term: 'Start term',
  budget_usd_per_year: 'Budget (USD per year)',
}

export default function App() {
  const [activity, setActivity] = useState<ToolActivity[]>([])
  const [plans, setPlans] = useState<Plan[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function handleEvent(event: AgentEvent) {
    if (event.type === 'plans') setPlans(event.plans)
    else if (event.type === 'error') setError(event.detail)
    else if (event.type === 'tool_call') setActivity((items) => [...items, { id: event.id, name: event.name }])
    else {
      // Resolve the call with the same id.
      setActivity((items) => items.map((item) => (item.id === event.id ? { ...item, result: event.result } : item)))
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const profile = Object.fromEntries(new FormData(e.currentTarget)) as unknown as Profile
    setLoading(true)
    setActivity([])
    setPlans(null)
    setError(null)
    try {
      const res = await fetch('/api/plan/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      })
      if (!res.ok || !res.body) {
        const body = await res.json()
        setError(typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail))
        return
      }

      // Read newline-delimited JSON events as they arrive.
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
      let buffer = ''
      let finished = false
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += value
        const lines = buffer.split('\n')
        buffer = lines.pop()!
        for (const line of lines) {
          if (!line) continue
          const event = JSON.parse(line) as AgentEvent
          if (event.type === 'plans' || event.type === 'error') finished = true
          handleEvent(event)
        }
      }
      if (!finished) setError('The agent stopped without returning a plan.')
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="app">
      <header className="app-header">
        <h1>Study abroad planner</h1>
        <p>Tell us about yourself and we'll research your move and build a step-by-step timeline.</p>
      </header>

      <form className="profile-form" onSubmit={onSubmit}>
        {(Object.keys(TEST_PROFILE) as (keyof Profile)[]).map((name) => (
          <label key={name} className="field">
            <span className="field-label">{FIELD_LABELS[name]}</span>
            {name === 'level' ? (
              <select name={name} defaultValue={TEST_PROFILE[name]} className="field-input">
                <option value="undergraduate">Undergraduate</option>
                <option value="graduate">Graduate</option>
              </select>
            ) : (
              <input
                name={name}
                defaultValue={TEST_PROFILE[name]}
                type={name === 'budget_usd_per_year' ? 'number' : 'text'}
                className="field-input"
                required
              />
            )}
          </label>
        ))}
        <button type="submit" className="submit-button" disabled={loading}>
          {loading ? 'Building your plan…' : 'Build my plan'}
        </button>
      </form>

      {loading && !plans && <ActivityFeed activity={activity} />}

      {error && (
        <p className="error" role="alert">
          Something went wrong: {error}
        </p>
      )}

      {plans && <PlanBrowser key={plans.map((plan) => plan.school).join('|')} plans={plans} />}
    </main>
  )
}
