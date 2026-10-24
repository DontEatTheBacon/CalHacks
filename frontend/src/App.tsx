import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ActivityFeed, type ToolActivity } from './Activity'
import { parseTerm } from './format'
import { PlanBrowser } from './Plan'
import { ProfileFields } from './ProfileFields'
import type { AgentEvent, ConsideredCollege, Plan, Plans, Profile } from './types'
import './App.css'

// Test data, prefilled so the form can be submitted as-is.
const TEST_PROFILE: Profile = {
  gpa: '8.5',
  from_school: 'Indian Institute of Technology, Bombay',
  citizenship: 'India',
  level: 'graduate',
  major: 'Computer Science',
  start_term: 'Spring 2027',
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

// A readable message from a failed response: FastAPI sends a string, or a list of field errors for a 422.
async function readError(res: Response): Promise<string> {
  try {
    const { detail } = await res.json()
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) {
      return detail
        .map((e: { loc?: string[]; msg: string }) => `${FIELD_LABELS[e.loc?.[e.loc.length - 1] as keyof Profile] ?? 'Request'}: ${e.msg}`)
        .join('. ')
    }
    return JSON.stringify(detail)
  } catch {
    return `${res.status} ${res.statusText}`
  }
}

export default function App() {
  const [live, setLive] = useState(true)
  const [activity, setActivity] = useState<ToolActivity[]>([])
  const [plans, setPlans] = useState<Plan[] | null>(null)
  const [considered, setConsidered] = useState<ConsideredCollege[]>([])
  const [startTerm, setStartTerm] = useState<Date | null>(null)
  const [submitted, setSubmitted] = useState<Profile | null>(null) // sent again when a step is redone
  const [error, setError] = useState<string | null>(null)
  const [stopped, setStopped] = useState(false)
  const [loading, setLoading] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const abort = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!loading) return
    const started = Date.now()
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000)
    return () => clearInterval(timer)
  }, [loading])

  function handleEvent(event: AgentEvent) {
    if (event.type === 'plans') {
      setPlans(event.plans)
      setConsidered(event.considered)
    }
    else if (event.type === 'error') setError(event.detail)
    else if (event.type === 'tool_call') setActivity((items) => [...items, { id: event.id, name: event.name, school: event.school }])
    else {
      // Resolve the call with the same id.
      setActivity((items) =>
        items.map((item) => (item.id === event.id ? { ...item, result: event.result, aiGenerated: event.ai_generated } : item)),
      )
    }
  }

  // POST /api/plan/stream: newline-delimited events, so each lookup shows up as it happens.
  async function runLive(profile: Profile, signal: AbortSignal) {
    const res = await fetch('/api/plan/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
      signal,
    })
    if (!res.ok || !res.body) return setError(await readError(res))

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
  }

  // POST /api/plan: one request that returns the finished plans.
  async function runOnce(profile: Profile, signal: AbortSignal) {
    const res = await fetch('/api/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
      signal,
    })
    if (!res.ok) return setError(await readError(res))
    const body = (await res.json()) as Plans
    setPlans(body.plans)
    setConsidered(body.considered)
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    // The start term is picked as a season and a year; the backend takes them as one string, e.g. 'Spring 2027'.
    const { term_season, term_year, ...fields } = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
    const profile = (term_season ? { ...fields, start_term: `${term_season} ${term_year}` } : fields) as unknown as Profile
    abort.current = new AbortController()
    setLoading(true)
    setElapsed(0)
    setActivity([])
    setPlans(null)
    setConsidered([])
    setError(null)
    setStopped(false)
    setStartTerm(parseTerm(profile.start_term))
    setSubmitted(profile)
    try {
      await (live ? runLive : runOnce)(profile, abort.current.signal)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') setStopped(true)
      else setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <header className="masthead">
        <h1>Study abroad planner</h1>
        <p>Tell us about yourself. We'll pick a best-fit college, research the move, and lay out every step on a timeline.</p>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <form className="profile-form" onSubmit={onSubmit}>
            <h2 className="section-title">Your profile</h2>
            <ProfileFields defaults={TEST_PROFILE} labels={FIELD_LABELS} />
            <label className="toggle">
              <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} disabled={loading} />
              <span>Show research as it happens</span>
            </label>
            <div className="form-actions">
              <button type="submit" className="submit-button" disabled={loading}>
                {loading ? 'Building…' : 'Build my plan'}
              </button>
              {loading && (
                <button type="button" className="secondary-button" onClick={() => abort.current?.abort()}>
                  Stop
                </button>
              )}
            </div>
          </form>
        </aside>

        <main className="results" aria-live="polite">
          {loading && (
            <p className="results-status">
              Researching your move · {elapsed}s
            </p>
          )}
          {loading && live && !plans && <ActivityFeed activity={activity} />}
          {loading && !live && (
            <p className="waiting">Looking up visas, costs, housing and more. This usually takes a minute or two.</p>
          )}

          {error && (
            <p className="error" role="alert">
              Something went wrong: {error}
            </p>
          )}

          {!loading && !plans && !error && (
            <div className="empty">
              <h2 className="empty-title">{stopped ? 'Stopped' : 'Your plan will appear here'}</h2>
              <p>
                {stopped
                  ? 'Nothing was saved. Adjust your profile and build again whenever you like.'
                  : 'Each plan includes a match rate, yearly and total costs, expected work pay, and a dated timeline of everything to do: tests, applications, scholarships, visa, insurance, housing and travel.'}
              </p>
            </div>
          )}

          {plans && <PlanBrowser key={plans.map((plan) => plan.school).join('|')} plans={plans} considered={considered} startTerm={startTerm} profile={submitted} />}
        </main>
      </div>
    </div>
  )
}
