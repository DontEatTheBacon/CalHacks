import { ExternalLink } from './ExternalLink'
import { duration, formatDate, list, usd } from './format'
import type * as T from './toolTypes'

export interface ToolActivity {
  id: number
  name: string
  result?: Record<string, unknown>
}

// What the agent is doing while each tool runs.
const LABELS: Record<string, string> = {
  convert_gpa: 'Converting your GPA',
  get_visa_requirements: 'Checking visa requirements',
  get_flights: 'Finding flights',
  get_ground_route: 'Planning the route to campus',
  find_scholarships: 'Looking for scholarships',
  get_housing_options: 'Comparing housing options',
  get_language_requirements: 'Checking English requirements',
  get_application_deadlines: 'Finding application deadlines',
  get_university_cost: 'Estimating your costs',
  get_insurance_requirements: 'Checking health insurance',
  get_standardized_tests: 'Checking standardized tests',
  check_course_transfer: 'Checking credit transfer',
  get_work_options: 'Checking work rights',
}

// A plain-English summary of each tool's result; falls back if the result has an unexpected shape.
function summarize(name: string, result: Record<string, unknown>): string {
  if ('error' in result) return "Couldn't look this up right now."
  try {
    return describe(name, result)
  } catch {
    return 'Done.'
  }
}

function describe(name: string, result: Record<string, unknown>): string {
  switch (name) {
    case 'convert_gpa': {
      const r = result as unknown as T.GpaConversion
      return `Your ${r.original_gpa} GPA is about ${r.converted_gpa} on the US 4.0 scale.`
    }
    case 'get_visa_requirements': {
      const r = result as unknown as T.VisaRequirements
      return `You'll need the ${r.visa_type} visa with ${r.required_documents.length} key documents. Processing: ${r.processing_time}.`
    }
    case 'get_flights': {
      const r = result as unknown as T.FlightInfo
      const via = r.layovers.length ? `via ${list(r.layovers)}` : 'nonstop'
      return `Fly from ${r.departure_airport} to ${r.arrival_airport} ${via}, about ${duration(r.flight_hours)}.`
    }
    case 'get_ground_route': {
      const r = result as unknown as T.TravelInfo
      const legs = r.travel_forms.map((form, i) => {
        const to = r.travel_destinations[i] ?? 'the next stop'
        const line = r.line_names[i]
        if (form === 'walk') return `walk to ${to}`
        return line ? `take the ${line} (${form}) to ${to}` : `${form} to ${to}`
      })
      const total = r.travel_duration.reduce((sum, leg) => sum + leg, 0)
      const banned = r.banned_travel_forms.length ? ` Not allowed: ${list(r.banned_travel_forms)}.` : ''
      const sentence = list(legs)
      return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}, about ${duration(total)} in total.${banned}`
    }
    case 'find_scholarships': {
      const r = result as unknown as T.Scholarships
      if (!r.scholarships.length) return 'No scholarships found yet.'
      return `Found ${r.scholarships.length} to look at, including ${r.scholarships[0].name}.`
    }
    case 'get_housing_options': {
      const r = result as unknown as T.HousingInfo
      const guaranteed = r.first_year_guaranteed ? ' First-year housing is guaranteed.' : ''
      return `On campus runs about ${usd(r.on_campus_monthly_usd)} a month, off campus about ${usd(r.off_campus_monthly_usd)}.${guaranteed}`
    }
    case 'get_language_requirements': {
      const r = result as unknown as T.LanguageRequirements
      const tests = r.accepted_tests.map((t) => `${t.test} ${t.minimum_score}`)
      return `Accepts ${tests.join(' or ')}.${r.waiver_possible ? ' You may qualify for a waiver.' : ''}`
    }
    case 'get_application_deadlines': {
      const r = result as unknown as T.ApplicationDeadlines
      const next = r.deadlines.find((d) => d.due_date)
      const due = next ? `${next.round} closes ${formatDate(next.due_date!)}` : 'Deadlines vary by program'
      return `${due}. The application fee is ${usd(r.application_fee_usd)}.`
    }
    case 'get_university_cost': {
      const r = result as unknown as T.UniversityCost
      return `About ${usd(r.tuition_usd_per_year)} tuition plus ${usd(r.living_usd_per_year)} living costs a year.`
    }
    case 'get_insurance_requirements': {
      const r = result as unknown as T.InsuranceRequirements
      const waiver = r.waiver_allowed ? ', or you can waive it with your own coverage' : ''
      return `The school plan costs about ${usd(r.annual_cost_usd)} a year${waiver}.`
    }
    case 'get_standardized_tests': {
      const r = result as unknown as T.TestRequirements
      const required = r.required.length ? `You'll need the ${list(r.required)}.` : 'No tests are required.'
      const recommended = r.recommended.length ? ` ${list(r.recommended)} recommended.` : ''
      return required + recommended
    }
    case 'check_course_transfer': {
      const r = result as unknown as T.CourseTransfer
      if (!r.accepts_transfer_credit) return "Credits from your current school likely won't transfer."
      const limit = r.max_credits ? ` up to ${r.max_credits} credits` : ''
      return `Credits can transfer${limit}${r.evaluation_required ? ` after a ${r.evaluation_required}` : ''}.`
    }
    case 'get_work_options': {
      const r = result as unknown as T.WorkOptions
      const hours = r.on_campus_hours_per_week ? `${r.on_campus_hours_per_week} hours a week during term` : 'part-time during term'
      return `You can work ${hours}, then use ${r.post_study_work} for ${r.post_study_duration}.`
    }
    default:
      return 'Done.'
  }
}

// Shown only while the agent is working; the app hides it once the plans arrive.
export function ActivityFeed({ activity }: { activity: ToolActivity[] }) {
  return (
    <section className="activity">
      <h2 className="section-title">Researching your move</h2>
      <ul className="activity-list">
        {activity.map((item) => {
          const failed = item.result && 'error' in item.result
          const status = !item.result ? 'pending' : failed ? 'failed' : 'done'
          return (
            <li key={item.id} className={`activity-item activity-item--${status}`}>
              <span className="activity-dot" aria-hidden />
              <div>
                <p className="activity-label">{LABELS[item.name] ?? item.name}</p>
                {item.result && <p className="activity-summary">{summarize(item.name, item.result)}</p>}
                {item.result && (
                  <ExternalLink link={item.result.link as T.ResourceLink | undefined} className="activity-link" />
                )}
              </div>
            </li>
          )
        })}
        <li className="activity-item activity-item--thinking">
          <span className="activity-dot" aria-hidden />
          <p className="activity-label">Thinking it through…</p>
        </li>
      </ul>
    </section>
  )
}
