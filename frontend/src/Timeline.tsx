import { useState, type FormEvent } from 'react'
import { ExternalLink } from './ExternalLink'
import { list, monthLabel, parseDate, today, usd } from './format'
import type { Step } from './types'

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

interface Entry {
  step: Step
  index: number // position in plan.steps, used to toggle and to link from the axis
  start: Date | null
  due: Date | null // the end of the step's window
}

type Item = { kind: 'step'; date: Date; entry: Entry } | { kind: 'today' | 'start'; date: Date }

const shortDate = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

// A dated timeline: an overview axis, then the steps month by month, then anything without a date.
export function Timeline({ steps, startTerm, onToggleStep, onRedoStep, replaced }: {
  steps: Step[]
  startTerm: Date | null
  onToggleStep: (index: number) => void
  onRedoStep?: (index: number, feedback: string) => Promise<void> // absent when there's no profile to redo with
  replaced: Record<number, number> // how many earlier versions of each step were rejected
}) {
  const now = today()
  const stepProps = { now, onToggle: onToggleStep, onRedo: onRedoStep, replaced }
  const entries = steps.map((step, index) => ({
    step,
    index,
    start: step.start_date ? parseDate(step.start_date) : null,
    due: step.end_date ? parseDate(step.end_date) : null,
  }))
  const dated = entries.filter((entry) => entry.due).sort((a, b) => a.due!.getTime() - b.due!.getTime())
  const undated = entries.filter((entry) => !entry.due)

  const items: Item[] = [
    ...dated.map((entry) => ({ kind: 'step' as const, date: entry.due!, entry })),
    { kind: 'today' as const, date: now },
    ...(startTerm ? [{ kind: 'start' as const, date: startTerm }] : []),
  ].sort((a, b) => a.date.getTime() - b.date.getTime() || (a.kind === 'today' ? -1 : b.kind === 'today' ? 1 : 0))

  const months: { label: string; items: Item[] }[] = []
  for (const item of items) {
    const label = monthLabel(item.date)
    if (months[months.length - 1]?.label !== label) months.push({ label, items: [] })
    months[months.length - 1].items.push(item)
  }

  return (
    <div className="timeline">
      <TimelineAxis dated={dated} now={now} startTerm={startTerm} />
      <ol className="tl">
        {months.map((month) => (
          <li key={month.label} className="tl-month">
            <h3 className="tl-month-label">{month.label}</h3>
            <ol className="tl-items">
              {month.items.map((item) =>
                item.kind === 'step' ? (
                  <StepItem key={item.entry.index} entry={item.entry} {...stepProps} />
                ) : (
                  <Milestone key={item.kind} kind={item.kind} date={item.date} />
                ),
              )}
            </ol>
          </li>
        ))}
        {undated.length > 0 && (
          <li className="tl-month">
            <h3 className="tl-month-label">No fixed date</h3>
            <ol className="tl-items">
              {undated.map((entry) => (
                <StepItem key={entry.index} entry={entry} {...stepProps} />
              ))}
            </ol>
          </li>
        )}
      </ol>
    </div>
  )
}

// A horizontal overview from the earliest to the latest date, one tick per month.
function TimelineAxis({ dated, now, startTerm }: { dated: Entry[]; now: Date; startTerm: Date | null }) {
  if (dated.length === 0 && !startTerm) return null
  const dates = [now, ...dated.flatMap((entry) => [entry.start ?? entry.due!, entry.due!]), ...(startTerm ? [startTerm] : [])]
  const earliest = new Date(Math.min(...dates.map(Number)))
  const latest = new Date(Math.max(...dates.map(Number)))
  const from = new Date(earliest.getFullYear(), earliest.getMonth(), 1)
  const to = new Date(latest.getFullYear(), latest.getMonth() + 1, 1)
  const position = (date: Date) => `${((date.getTime() - from.getTime()) / (to.getTime() - from.getTime())) * 100}%`

  const ticks: Date[] = []
  for (let month = new Date(from); month < to; month = new Date(month.getFullYear(), month.getMonth() + 1, 1)) {
    ticks.push(month)
  }
  const labelEvery = ticks.length > 14 ? 3 : 1

  return (
    <figure className="axis" aria-label="Timeline overview">
      <div className="axis-track">
        {ticks.map((tick, i) => (
          <span key={tick.getTime()} className="axis-tick" style={{ left: position(tick) }}>
            {i % labelEvery === 0 && (
              <span className="axis-tick-label">
                {tick.toLocaleDateString('en-US', { month: 'short' })}
                {(i === 0 || tick.getMonth() === 0) && ` ${tick.getFullYear()}`}
              </span>
            )}
          </span>
        ))}
        <span className="axis-marker axis-marker--today" style={{ left: position(now) }}>
          <span className="axis-marker-label">Today</span>
        </span>
        {startTerm && (
          <span className="axis-marker axis-marker--start" style={{ left: position(startTerm) }}>
            <span className="axis-marker-label">Start</span>
          </span>
        )}
        {dated.map(
          (entry) =>
            entry.start &&
            entry.start < entry.due! && (
              <span
                key={`range-${entry.index}`}
                className={`axis-range${entry.step.complete ? ' axis-range--done' : ''}`}
                style={{ left: position(entry.start), width: `calc(${position(entry.due!)} - ${position(entry.start)})` }}
              />
            ),
        )}
        {dated.map((entry) => (
          <a
            key={entry.index}
            href={`#step-${entry.index}`}
            className={`axis-dot${entry.step.complete ? ' axis-dot--done' : ''}`}
            style={{ left: position(entry.due!) }}
            title={`${entry.step.title} · ${entry.start ? `${shortDate(entry.start)} – ` : ''}${shortDate(entry.due!)}`}
            aria-label={entry.step.title}
          />
        ))}
      </div>
    </figure>
  )
}

function Milestone({ kind, date }: { kind: 'today' | 'start'; date: Date }) {
  return (
    <li className={`tl-item tl-milestone tl-milestone--${kind}`}>
      <div className="tl-date">
        <span className="tl-day">{date.getDate()}</span>
        <span className="tl-weekday">{date.toLocaleDateString('en-US', { weekday: 'short' })}</span>
      </div>
      <span className="tl-node" aria-hidden />
      <p className="tl-milestone-label">{kind === 'today' ? 'Today' : 'Program starts'}</p>
    </li>
  )
}

function StepItem({ entry, now, onToggle, onRedo, replaced }: {
  entry: Entry
  now: Date
  onToggle: (index: number) => void
  onRedo?: (index: number, feedback: string) => Promise<void>
  replaced: Record<number, number>
}) {
  const { step, index, start, due } = entry
  const overdue = due !== null && due < now && !step.complete
  const open = !overdue && !step.complete && start !== null && due !== null && start <= now && now <= due
  const classes = ['tl-item', 'step', `step--${step.type}`, step.complete && 'step--complete', overdue && 'step--overdue']
  return (
    <li id={`step-${index}`} className={classes.filter(Boolean).join(' ')}>
      <div className="tl-date">
        {due ? (
          <>
            <span className="tl-day">{due.getDate()}</span>
            <span className="tl-weekday">{due.toLocaleDateString('en-US', { weekday: 'short' })}</span>
          </>
        ) : (
          <span className="tl-day tl-day--none">–</span>
        )}
      </div>
      <span className="tl-node" aria-hidden />
      <div className="tl-body">
        <div className="step-header">
          <span className="step-badge">{STEP_LABELS[step.type]}</span>
          {start && due && <span className="step-window">{shortDate(start)} – {shortDate(due)}</span>}
          {overdue && <span className="step-overdue">Overdue</span>}
          {open && <span className="step-open">Open now</span>}
          <label className="step-done">
            <input type="checkbox" checked={step.complete} onChange={() => onToggle(index)} />
            Done
          </label>
        </div>
        {/* Just the title until the student opens it, so the timeline stays easy to scan. */}
        <details className="step-details">
          <summary className="step-title">{step.title}</summary>
          <div className="step-body">
            <p className="step-description">{step.description}</p>
            <StepDetails step={step} />
            <ExternalLink link={step.link} className="step-link" />
            {step.ai_generated && <p className="source-note">AI-generated · verify on the linked page before relying on it</p>}
            {onRedo && <RedoStep onRedo={(feedback) => onRedo(index, feedback)} replaced={replaced[index] ?? 0} />}
          </div>
        </details>
      </div>
    </li>
  )
}

// The key facts for each type of timeline step.
function StepDetails({ step }: { step: Step }) {
  const facts = (() => {
    switch (step.type) {
      case 'gpa':
        return [step.original_gpa != null ? `${step.original_gpa} → ${step.converted_gpa} / 4.0` : `${step.converted_gpa} / 4.0`]
      case 'visa':
        return [`${step.visa_type} visa`, step.fee_usd ? `${usd(step.fee_usd)} in fees` : null, `Bring: ${list(step.documents)}`]
      case 'travel':
        return [
          step.departure_airport ? `${step.departure_airport} → ${step.arrival_airport}` : step.arrival_airport,
          step.flight_cost_usd ? `~${usd(step.flight_cost_usd)} one way` : null,
          step.route.length ? `Then ${list(step.route)}` : null,
        ]
      case 'scholarship':
        return [step.scholarship, step.amount_usd ? `Worth ${usd(step.amount_usd)}` : null]
      case 'housing':
        return [step.option, step.monthly_cost_usd ? `~${usd(step.monthly_cost_usd)} / month` : null]
      case 'language':
        return [step.test, `Minimum ${step.minimum_score}`]
      case 'application':
        return [step.round, step.application_fee_usd != null ? `${usd(step.application_fee_usd)} fee` : null]
      case 'cost':
        return [
          `~${usd(step.amount_usd)}`,
          step.tuition_usd != null && step.living_usd != null ? `${usd(step.tuition_usd)} tuition + ${usd(step.living_usd)} living` : null,
        ]
      case 'insurance':
        return [step.plan, step.annual_cost_usd ? `~${usd(step.annual_cost_usd)} / year` : null]
      case 'test':
        return [step.test, step.target_score ? `Typical score ${step.target_score}` : null]
      case 'transfer':
        return [step.evaluation ?? 'No evaluation needed']
      case 'work':
        return [
          step.permit,
          step.hours_per_week ? `Up to ${step.hours_per_week} hrs / week` : null,
          `~${usd(step.hourly_pay_usd)} / hour`,
          step.post_study_salary_usd ? `~${usd(step.post_study_salary_usd)} / year after graduating` : null,
        ]
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

// Lets the student turn down a step and ask for a different one, optionally saying what should change.
function RedoStep({ onRedo, replaced }: { onRedo: (feedback: string) => Promise<void>; replaced: number }) {
  const [open, setOpen] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await onRedo(feedback.trim())
      setOpen(false)
      setFeedback('')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="redo">
      {replaced > 0 && (
        <p className="source-note">
          Replaced {replaced} earlier suggestion{replaced === 1 ? '' : 's'}; they won't be suggested again.
        </p>
      )}
      {open ? (
        <form className="redo-form" onSubmit={submit}>
          <label className="field">
            <span className="field-label">What should be different? (optional)</span>
            <textarea
              className="field-input"
              rows={2}
              maxLength={500}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="e.g. no layovers in Dubai, or something cheaper"
              disabled={busy}
            />
          </label>
          <div className="form-actions">
            <button type="submit" className="submit-button" disabled={busy}>
              {busy ? 'Finding another…' : 'Find another'}
            </button>
            <button type="button" className="secondary-button" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </button>
          </div>
          {error && <p className="error">{error}</p>}
        </form>
      ) : (
        <button type="button" className="text-button" onClick={() => setOpen(true)}>
          Not right? Suggest something else
        </button>
      )}
    </div>
  )
}
