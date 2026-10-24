import { useState, type FormEvent } from 'react'
import type { AgentEvent, Plan, Profile, ToolCallEvent, ToolResultEvent } from './types'

// Test data, prefilled so the form can be submitted as-is.
const TEST_PROFILE: Profile = {
  gpa: '8.5',
  from_school: 'Indian Institute of Technology Bombay',
  from_location: 'Mumbai, India',
}

export default function App() {
  const [toolLog, setToolLog] = useState<(ToolCallEvent | ToolResultEvent)[]>([])
  const [plan, setPlan] = useState<Plan | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function handleEvent(event: AgentEvent) {
    if (event.type === 'plan') setPlan(event.plan)
    else if (event.type === 'error') setError(event.detail)
    else setToolLog((log) => [...log, event])
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const profile = Object.fromEntries(new FormData(e.currentTarget)) as unknown as Profile
    setLoading(true)
    setToolLog([])
    setPlan(null)
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
          if (event.type === 'plan' || event.type === 'error') finished = true
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
    <div>
      <h1>Student Profile</h1>
      <form onSubmit={onSubmit}>
        {Object.entries(TEST_PROFILE).map(([name, value]) => (
          <p key={name}>
            <label>{name}: <input name={name} defaultValue={value} required /></label>
          </p>
        ))}
        <button type="submit" disabled={loading}>Submit</button>
      </form>

      {(loading || toolLog.length > 0) && (
        <section>
          <h2>Agent activity</h2>
          <ul>
            {toolLog.map((event, i) => (
              <li key={i}>
                {event.type === 'tool_call' ? (
                  <>Calling <code>{event.name}</code> with <code>{JSON.stringify(event.args)}</code></>
                ) : (
                  <>Result from <code>{event.name}</code>: <pre>{JSON.stringify(event.result, null, 2)}</pre></>
                )}
              </li>
            ))}
            {loading && <li>Thinking...</li>}
          </ul>
        </section>
      )}

      {error && <p>Error: {error}</p>}

      {plan && (
        <section>
          <h2>Best fit: {plan.school}</h2>
          <ol>
            {plan.steps.map((step, i) => (
              <li key={i}>
                <h3>{step.title}</h3>
                <p>
                  <strong>{step.category}</strong>
                  {step.deadline && <> · Due {step.deadline}</>}
                </p>
                <p>{step.description}</p>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}
