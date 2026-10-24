import { useEffect, useRef, useState } from 'react'
import type { Profile, SchoolOption, TermOptions } from './types'

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

// The profile form's fields, using the backend's option lists (/api/options/*). Falls back to plain
// text inputs if a list can't be loaded, so the form always works.
export function ProfileFields({ defaults, labels }: { defaults: Profile; labels: Record<keyof Profile, string> }) {
  const [countries, setCountries] = useState<string[] | null>(null)
  const [majors, setMajors] = useState<string[]>([])
  const [terms, setTerms] = useState<TermOptions | null>(null)
  const [schools, setSchools] = useState<SchoolOption[]>([])
  const schoolSearch = useRef<number>()

  useEffect(() => {
    getJson<string[]>('/api/options/countries').then(setCountries).catch(() => setCountries(null))
    getJson<string[]>('/api/options/majors').then(setMajors).catch(() => setMajors([]))
    getJson<TermOptions>('/api/options/terms').then(setTerms).catch(() => setTerms(null))
  }, [])

  // Search the full school list as the student types, a moment after they pause.
  function searchSchools(query: string) {
    window.clearTimeout(schoolSearch.current)
    schoolSearch.current = window.setTimeout(() => {
      getJson<SchoolOption[]>(`/api/options/schools?q=${encodeURIComponent(query)}&limit=20`)
        .then(setSchools)
        .catch(() => setSchools([]))
    }, 200)
  }

  const [defaultSeason, defaultYear] = defaults.start_term.split(' ')

  return (
    <>
      <label className="field">
        <span className="field-label">{labels.gpa}</span>
        <input name="gpa" defaultValue={defaults.gpa} className="field-input" required />
      </label>

      <label className="field">
        <span className="field-label">{labels.from_school}</span>
        <input
          name="from_school"
          defaultValue={defaults.from_school}
          list="school-options"
          autoComplete="off"
          placeholder="Start typing your school's name"
          onChange={(e) => searchSchools(e.target.value)}
          onFocus={(e) => searchSchools(e.target.value)}
          className="field-input"
          required
        />
        <datalist id="school-options">
          {schools.map((school) => (
            <option key={`${school.name}|${school.country}`} value={school.name} label={school.country} />
          ))}
        </datalist>
      </label>

      <label className="field">
        <span className="field-label">{labels.citizenship}</span>
        {countries ? (
          <select name="citizenship" defaultValue={defaults.citizenship} className="field-input">
            {countries.map((country) => (
              <option key={country}>{country}</option>
            ))}
          </select>
        ) : (
          <input name="citizenship" defaultValue={defaults.citizenship} className="field-input" required />
        )}
      </label>

      <label className="field">
        <span className="field-label">{labels.level}</span>
        <select name="level" defaultValue={defaults.level} className="field-input">
          <option value="undergraduate">Undergraduate</option>
          <option value="graduate">Graduate</option>
        </select>
      </label>

      <label className="field">
        <span className="field-label">{labels.major}</span>
        <input name="major" defaultValue={defaults.major} list="major-options" autoComplete="off" className="field-input" required />
        <datalist id="major-options">
          {majors.map((major) => (
            <option key={major} value={major} />
          ))}
        </datalist>
      </label>

      <fieldset className="field field-group">
        <legend className="field-label">{labels.start_term}</legend>
        {terms ? (
          <div className="field-row">
            <select name="term_season" defaultValue={defaultSeason} aria-label="Season" className="field-input">
              {terms.seasons.map((season) => (
                <option key={season}>{season}</option>
              ))}
            </select>
            <select name="term_year" defaultValue={defaultYear} aria-label="Year" className="field-input">
              {terms.years.map((year) => (
                <option key={year}>{year}</option>
              ))}
            </select>
          </div>
        ) : (
          <input name="start_term" defaultValue={defaults.start_term} className="field-input" required />
        )}
      </fieldset>

      <label className="field">
        <span className="field-label">{labels.budget_usd_per_year}</span>
        <input name="budget_usd_per_year" type="number" min={0} step={1000} defaultValue={defaults.budget_usd_per_year} className="field-input" required />
      </label>
    </>
  )
}
