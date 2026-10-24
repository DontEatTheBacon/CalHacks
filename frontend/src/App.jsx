import { useState } from 'react'

const FIELDS = ['budget', 'major', 'from_country', 'gpa', 'college', 'college_location']

export default function App() {
  const [result, setResult] = useState(null)

  async function onSubmit(e) {
    e.preventDefault()
    setResult('Loading...')
    const res = await fetch('/api/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(new FormData(e.target))),
    })
    setResult(await res.json())
  }

  return (
    <div>
      <h1>Student Profile</h1>
      <form onSubmit={onSubmit}>
        {FIELDS.map((name) => (
          <p key={name}>
            <label>{name}: <input name={name} required /></label>
          </p>
        ))}
        <button type="submit">Submit</button>
      </form>
      <pre>{result && JSON.stringify(result, null, 2)}</pre>
    </div>
  )
}
