import { useState } from 'react'
import { ExternalLink } from './ExternalLink'
import { formatDate, list, usd } from './format'
import type { Plan, Step } from './types'

const STEP_LABELS: Record<Step['type'], string> = {
  gpa: 'GPA',
  test: 'Testing',
  language: 'English',
  application: 'Application',
  scholarship: 'Scholarship',
  cost: 'Budget',
  visa: 'Visa',
  insurance: 'Insurance',
  housing: 'Housing',
  transfer: 'Credits',
  travel: 'Travel',
  work: 'Work',
}

// Shows one plan at a time, with arrows to move between them.
export function PlanBrowser({ plans }: { plans: Plan[] }) {
  const [index, setIndex] = useState(0)
  return (
    <section className="plans">
      {plans.length > 1 && (
        <nav className="plans-nav" aria-label="Plans">
          <button className="plans-arrow" onClick={() => setIndex(index - 1)} disabled={index === 0} aria-label="Previous plan">
            ←
          </button>
          <span className="plans-count">
            Option {index + 1} of {plans.length}
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
      <Timeline plan={plans[index]} label={index === 0 ? 'Best fit' : 'Alternative'} />
    </section>
  )
}

function Timeline({ plan, label }: { plan: Plan; label: string }) {
  return (
    <div className="timeline">
      <p className="timeline-eyebrow">{label}</p>
      <h2 className="timeline-school">{plan.school}</h2>
      {plan.steps.length === 0 && <p className="timeline-empty">We picked a school but couldn't build the full timeline this time.</p>}
      <ol className="timeline-list">
        {plan.steps.map((step, i) => (
          <li key={i} className={`step step--${step.type}`}>
            <div className="step-header">
              <span className="step-badge">{STEP_LABELS[step.type]}</span>
              {'due_date' in step && step.due_date && (
                <span className="step-due">Due {formatDate(step.due_date)}</span>
              )}
            </div>
            <h3 className="step-title">{step.title}</h3>
            <p className="step-description">{step.description}</p>
            <StepDetails step={step} />
            <ExternalLink link={step.link} className="step-link" />
          </li>
        ))}
      </ol>
    </div>
  )
}

// The key facts for each type of timeline step.
function StepDetails({ step }: { step: Step }) {
  const facts = (() => {
    switch (step.type) {
      case 'gpa':
        return [`${step.converted_gpa} / 4.0`]
      case 'visa':
        return [`${step.visa_type} visa`, `Bring: ${list(step.documents)}`]
      case 'travel':
        return [step.arrival_airport, step.flight_cost_usd ? `~${usd(step.flight_cost_usd)} one way` : null]
      case 'scholarship':
        return [step.scholarship, step.amount_usd ? `Worth ${usd(step.amount_usd)}` : null]
      case 'housing':
        return [step.option, step.monthly_cost_usd ? `~${usd(step.monthly_cost_usd)} / month` : null]
      case 'language':
        return [step.test, `Minimum ${step.minimum_score}`]
      case 'application':
        return [step.round, step.application_fee_usd != null ? `${usd(step.application_fee_usd)} fee` : null]
      case 'cost':
        return [`~${usd(step.amount_usd)}`]
      case 'insurance':
        return [step.plan, step.annual_cost_usd ? `~${usd(step.annual_cost_usd)} / year` : null]
      case 'test':
        return [step.test]
      case 'transfer':
        return [step.evaluation ?? 'No evaluation needed']
      case 'work':
        return [step.permit, step.hours_per_week ? `Up to ${step.hours_per_week} hrs / week` : null]
    }
  })().filter((fact): fact is string => Boolean(fact))
  return (
    <ul className="step-facts">
      {facts.map((fact) => (
        <li key={fact} className="step-fact">{fact}</li>
      ))}
    </ul>
  )
}
