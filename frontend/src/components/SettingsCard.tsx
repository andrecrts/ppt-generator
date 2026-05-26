import { useEffect, useRef, useState } from 'react'

// ── localStorage helpers ────────────────────────────────────────────────────
const COURSES_KEY = 'pptgen_recent_courses'   // string[], max 3
const AUTHOR_KEY  = 'pptgen_author'           // string, last used

function loadRecentCourses(): string[] {
  try { return JSON.parse(localStorage.getItem(COURSES_KEY) || '[]') }
  catch { return [] }
}

function saveRecentCourse(course: string) {
  if (!course.trim()) return
  const recent = loadRecentCourses()
  const updated = [course.trim(), ...recent.filter(c => c !== course.trim())].slice(0, 3)
  localStorage.setItem(COURSES_KEY, JSON.stringify(updated))
}

function loadAuthor(): string {
  return localStorage.getItem(AUTHOR_KEY) || ''
}

function saveAuthor(author: string) {
  if (author.trim()) localStorage.setItem(AUTHOR_KEY, author.trim())
}

// ── Component ───────────────────────────────────────────────────────────────
interface Props {
  courseName: string
  onCourseChange: (v: string) => void
  authorName: string
  onAuthorChange: (v: string) => void
  onGenerate: () => void
  canGenerate: boolean
  disabled?: boolean
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#0f0f18',
  border: '1px solid #2e2e40',
  borderRadius: 8,
  padding: '9px 12px',
  color: '#e2e2e8',
  fontSize: 13,
  outline: 'none',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 500,
  color: '#9090a8',
  marginBottom: 6,
}

export default function SettingsCard({
  courseName, onCourseChange,
  authorName, onAuthorChange,
  onGenerate, canGenerate, disabled,
}: Props) {
  const [recentCourses, setRecentCourses] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Hydrate from localStorage on mount
  useEffect(() => {
    setRecentCourses(loadRecentCourses())
    if (!authorName) onAuthorChange(loadAuthor())
  }, [])

  function handleGenerate() {
    saveRecentCourse(courseName)
    saveAuthor(authorName)
    setRecentCourses(loadRecentCourses())
    onGenerate()
  }

  // Suggestions: show all recent when input is empty, filter when typing
  const suggestions = recentCourses.filter(c =>
    !courseName.trim() || c.toLowerCase().includes(courseName.toLowerCase())
  )

  function pickSuggestion(course: string) {
    onCourseChange(course)
    setShowSuggestions(false)
  }

  return (
    <div>
      <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#6b6b80', marginBottom: 14 }}>
        Presentation Settings
      </p>

      {/* ── Course ── */}
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Course</label>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            value={courseName}
            placeholder="e.g. Pedagogía General"
            disabled={disabled}
            onChange={e => onCourseChange(e.target.value)}
            onFocus={() => {
              if (blurTimer.current) clearTimeout(blurTimer.current)
              setShowSuggestions(true)
            }}
            onBlur={() => {
              blurTimer.current = setTimeout(() => setShowSuggestions(false), 150)
            }}
            style={{ ...inputStyle, opacity: disabled ? 0.5 : 1 }}
          />

          {/* Suggestions dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0, right: 0,
              background: '#1a1a28',
              border: '1px solid #2e2e44',
              borderRadius: 8,
              overflow: 'hidden',
              zIndex: 50,
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}>
              {suggestions.map((course, i) => (
                <div
                  key={course}
                  onMouseDown={() => pickSuggestion(course)}
                  style={{
                    padding: '9px 12px',
                    fontSize: 13,
                    color: '#c8c8e0',
                    cursor: 'pointer',
                    borderTop: i > 0 ? '1px solid #2a2a3a' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#252535')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ color: '#6b6b80', fontSize: 11 }}>↺</span>
                  {course}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Author ── */}
      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>Author / Teacher</label>
        <input
          type="text"
          value={authorName}
          placeholder="e.g. Licda. María García"
          disabled={disabled}
          onChange={e => onAuthorChange(e.target.value)}
          style={{ ...inputStyle, opacity: disabled ? 0.5 : 1 }}
        />
      </div>

      {/* ── Template badge ── */}
      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>Template</label>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: '#1a1a2e', border: '1px solid #2e2e4a',
          color: '#a78bfa', borderRadius: 6, padding: '6px 12px', fontSize: 12,
        }}>
          🎨 EDU Template.pptx
        </div>
      </div>

      {/* ── Generate button ── */}
      <button
        onClick={handleGenerate}
        disabled={!canGenerate || disabled}
        style={{
          width: '100%',
          background: canGenerate && !disabled ? 'linear-gradient(135deg, #6c63ff, #a78bfa)' : '#2a2a3a',
          border: 'none', borderRadius: 10,
          color: canGenerate && !disabled ? '#fff' : '#6b6b80',
          fontSize: 14, fontWeight: 600,
          padding: '13px 28px',
          cursor: canGenerate && !disabled ? 'pointer' : 'not-allowed',
          letterSpacing: '0.1px',
          transition: 'opacity 0.2s',
        }}
      >
        {disabled ? '⏳ Generating…' : '✨ Generate Presentation'}
      </button>

      {!canGenerate && !disabled && (
        <p style={{ textAlign: 'center', fontSize: 12, color: '#6b6b80', marginTop: 8 }}>
          Upload a PDF to get started
        </p>
      )}
    </div>
  )
}
