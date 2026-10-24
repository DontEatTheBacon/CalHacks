import { useState } from 'react'
import { ExternalLink } from './ExternalLink'
import { money, usd } from './format'
import { Timeline } from './Timeline'
import type { ConsideredCollege, Plan, PlanMetrics, Profile, Step, StepRedoResult } from './types'

// Shows one plan at a time, with arrows to move between them. Steps can be ticked off as done.
export function PlanBrowser({ plans: initialPlans, considered, startTerm, profile }: {
  plans: Plan[]
  considered: ConsideredCollege[]
  startTerm: Date | null
  profile: Profile | null
}) {
  const [plans, setPlans] = useState(initialPlans)
  const [index, setIndex] = useState(0)
  // Every version of a step the student turned down, keyed by "plan:step", sent with each redo so they don't come back.
  const [rejected, setRejected] = useState<Record<string, Step[]>>({})
  const plan = plans[index]

  // POST /api/steps/redo: swaps one step for a different suggestion, avoiding everything rejected so far.
  async function redoStep(stepIndex: number, feedback: string) {
    const key = `${index}:${stepIndex}`
    const history = [...(rejected[key] ?? []), plan.steps[stepIndex]]
    const res = await fetch('/api/steps/redo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile, school: plan.school, rejected: history, feedback: feedback || null }),
    })
    const body = await res.json().catch(() => null)
    if (!res.ok) throw new Error(typeof body?.detail === 'string' ? body.detail : `Request failed (${res.status})`)
    setRejected((current) => ({ ...current, [key]: history }))
    setPlans((current) =>
      current.map((p, i) =>
        i !== index ? p : { ...p, steps: p.steps.map((step, j) => (j === stepIndex ? (body as StepRedoResult).step : step)) },
      ),
    )
  }

  const replaced = Object.fromEntries(
    Object.entries(rejected)
      .filter(([key]) => key.startsWith(`${index}:`))
      .map(([key, steps]) => [Number(key.split(':')[1]), steps.length]),
  )

  function toggleStep(stepIndex: number) {
    setPlans((current) =>
      current.map((p, i) =>
        i !== index
          ? p
          : { ...p, steps: p.steps.map((step, j) => (j === stepIndex ? { ...step, complete: !step.complete } : step)) },
      ),
    )
  }

  const done = plan.steps.filter((step) => step.complete).length
  return (
    <article className="plan">
      <header className="plan-header">
        <div className="plan-heading">
          <p className="plan-eyebrow">{index === 0 ? 'Best fit' : 'Alternative'}</p>
          <h2 className="plan-school">{plan.school}</h2>
          <ExternalLink link={plan.school_website} className="plan-website" />
        </div>
        {plans.length > 1 && (
          <nav className="plans-nav" aria-label="Plans">
            <button className="plans-arrow" onClick={() => setIndex(index - 1)} disabled={index === 0} aria-label="Previous plan">
              ←
            </button>
            <span className="plans-count">
              {index + 1} of {plans.length}
            </span>
            <button
              className="plans-arrow"
              onClick={() => setIndex(index + 1)}
              disabled={index === plans.length - 1}
              aria-label="Next plan"
            >
              →
            </button>
          </nav>
        )}
      </header>

      {plan.fit_reason && <p className="plan-fit">{plan.fit_reason}</p>}
      {plan.metrics && <PlanSummary metrics={plan.metrics} />}
      {considered.length > 1 && <Considered colleges={considered} />}

      {plan.steps.length === 0 ? (
        <p className="plan-empty">We picked a school but couldn't build the full timeline this time.</p>
      ) : (
        <>
          <div className="plan-progress">
            <span>
              {done} of {plan.steps.length} steps done
            </span>
            <span className="plan-progress-bar" aria-hidden>
              <span style={{ width: `${(done / plan.steps.length) * 100}%` }} />
            </span>
          </div>
          {plan.steps.some((step) => step.ai_generated) && (
            <p className="plan-disclaimer">
              Steps marked AI-generated were researched by Claude, not taken from an official API, and may be out of date or wrong.
              Dates are calculated from your start term; links marked Official are on the college's own site or a government site.
            </p>
          )}
          <Timeline
            steps={plan.steps}
            startTerm={startTerm}
            onToggleStep={toggleStep}
            onRedoStep={profile ? redoStep : undefined}
            replaced={replaced}
          />
        </>
      )}
    </article>
  )
}

// The shortlist the agent narrowed down from: chosen colleges first, then the ones dropped and why.
function Considered({ colleges }: { colleges: ConsideredCollege[] }) {
  const ordered = [...colleges].sort((a, b) => Number(b.chosen) - Number(a.chosen))
  return (
    <details className="considered">
      <summary>
        Compared {colleges.length} colleges · {colleges.filter((c) => c.chosen).length} chosen
      </summary>
      <ul className="considered-list">
        {ordered.map((college) => (
          <li key={college.school} className={`considered-item${college.chosen ? ' considered-item--chosen' : ''}`}>
            <span className="considered-mark" aria-hidden>{college.chosen ? '✓' : '✕'}</span>
            <span className="considered-school">{college.school}</span>
            <span className="considered-cost">{college.cost_per_year_usd != null ? `${usd(college.cost_per_year_usd)} / year` : '–'}</span>
            <span className="considered-reason">{college.reason}</span>
          </li>
        ))}
      </ul>
    </details>
  )
}

// A brief summary of the plan's numbers, shown above the timeline.
function PlanSummary({ metrics }: { metrics: PlanMetrics }) {
  const years = `${metrics.program_years} ${metrics.program_years === 1 ? 'year' : 'years'}`
  // Money also shown in the student's home currency when the exchange rate is known.
  const home = (amount: number) =>
    metrics.home_currency && metrics.usd_to_home_rate ? `≈ ${money(amount * metrics.usd_to_home_rate, metrics.home_currency)}` : null
  const items: [string, string, string | null][] = [
    ['Match', `${metrics.match_rate}%`, null],
    ['Cost per year', usd(metrics.cost_per_year_usd), home(metrics.cost_per_year_usd)],
    [`Total cost (${years})`, usd(metrics.total_cost_usd), home(metrics.total_cost_usd)],
    ['Work pay per year', usd(metrics.work_pay_per_year_usd), home(metrics.work_pay_per_year_usd)],
    [`Total work pay (${years})`, usd(metrics.total_work_pay_usd), home(metrics.total_work_pay_usd)],
  ]
  if (metrics.post_study_salary_usd != null) {
    items.push(['Starting salary', usd(metrics.post_study_salary_usd), home(metrics.post_study_salary_usd)])
  }
  return (
    <dl className="plan-summary">
      {items.map(([label, value, converted]) => (
        <div key={label} className="plan-metric">
          <dt className="plan-metric-label">{label}</dt>
          <dd className="plan-metric-value">{value}</dd>
          {converted && <dd className="plan-metric-converted">{converted}</dd>}
        </div>
      ))}
    </dl>
  )
}
