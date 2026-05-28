import { useEffect, useRef, useState, ChangeEvent } from 'react'
import { BundledTemplate } from '../types'

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
  templateId: string
  onTemplateIdChange: (id: string) => void
  templateFile: File | null
  onTemplateChange: (f: File | null) => void
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

const TPL_INPUT_ID = 'template-file-input'

export default function SettingsCard({
  courseName, onCourseChange,
  authorName, onAuthorChange,
  templateId, onTemplateIdChange,
  templateFile, onTemplateChange,
  onGenerate, canGenerate, disabled,
}: Props) {
  const [recentCourses, setRecentCourses] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [bundledTemplates, setBundledTemplates] = useState<BundledTemplate[]>([])
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Hydrate from localStorage + fetch bundled templates on mount
  useEffect(() => {
    setRecentCourses(loadRecentCourses())
    if (!authorName) onAuthorChange(loadAuthor())

    fetch('/api/templates')
      .then(r => r.json())
      .then((tpls: BundledTemplate[]) => {
        setBundledTemplates(tpls)
        // Default to first bundled template if nothing is selected yet
        if (!templateId && tpls.length > 0) onTemplateIdChange(tpls[0].id)
      })
      .catch(() => {/* offline / first load — silently ignore */})
  }, [])

  function handleGenerate() {
    saveRecentCourse(courseName)
    saveAuthor(authorName)
    setRecentCourses(loadRecentCourses())
    onGenerate()
  }

  const suggestions = recentCourses.filter(c =>
    !courseName.trim() || c.toLowerCase().includes(courseName.toLowerCase())
  )

  function pickSuggestion(course: string) {
    onCourseChange(course)
    setShowSuggestions(false)
  }

  // ── Template card helper ─────────────────────────────────────────────────
  // A card is "active" when it's the selected bundled template (and no custom
  // file is uploaded), or when it's the custom-upload slot and a file IS set.
  function TemplateCard({
    id, label, icon, isCustom = false,
  }: { id: string; label: string; icon: string; isCustom?: boolean }) {
    const isActive = isCustom ? !!templateFile : (!templateFile && templateId === id)

    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (isCustom) {
            // Trigger the hidden file input
            document.getElementById(TPL_INPUT_ID)?.click()
          } else {
            onTemplateChange(null)   // clear any custom file
            onTemplateIdChange(id)
          }
        }}
        style={{
          flex: '1 1 0',
          minWidth: 0,
          background: isActive ? '#1a1230' : '#0f0f18',
          border: `1.5px solid ${isActive ? '#7c5cfc' : '#2e2e40'}`,
          borderRadius: 10,
          padding: '10px 8px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 5,
          transition: 'border-color 0.15s, background 0.15s',
          opacity: disabled ? 0.5 : 1,
        }}
        onMouseEnter={e => { if (!isActive && !disabled) (e.currentTarget as HTMLButtonElement).style.borderColor = '#4a4a70' }}
        onMouseLeave={e => { if (!isActive && !disabled) (e.currentTarget as HTMLButtonElement).style.borderColor = '#2e2e40' }}
      >
        <span style={{ fontSize: 20 }}>{icon}</span>
        <span style={{
          fontSize: 11,
          fontWeight: isActive ? 600 : 400,
          color: isActive ? '#a78bfa' : '#6b6b80',
          textAlign: 'center',
          lineHeight: 1.3,
          wordBreak: 'break-word',
          maxWidth: '100%',
        }}>
          {isCustom && templateFile ? truncate(templateFile.name, 18) : label}
        </span>
        {isActive && (
          <span style={{
            width: 6, height: 6,
            borderRadius: '50%',
            background: '#7c5cfc',
          }} />
        )}
      </button>
    )
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

      {/* ── Template picker ── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <label style={{ ...labelStyle, marginBottom: 0 }}>Template</label>
          {templateFile && (
            <button
              type="button"
              onClick={() => onTemplateChange(null)}
              disabled={disabled}
              style={{
                background: 'none', border: 'none',
                color: '#555570', fontSize: 11,
                cursor: disabled ? 'not-allowed' : 'pointer',
                textDecoration: 'underline', textUnderlineOffset: 3,
                padding: 0,
              }}
            >
              Clear custom
            </button>
          )}
        </div>

        {/* Hidden file input for custom upload */}
        <input
          id={TPL_INPUT_ID}
          type="file"
          accept=".pptx"
          style={{ display: 'none' }}
          disabled={disabled}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            const f = e.target.files?.[0]
            if (f) onTemplateChange(f)
            e.target.value = ''
          }}
        />

        {/* Card row: bundled templates + custom upload slot */}
        <div style={{ display: 'flex', gap: 8 }}>
          {bundledTemplates.map(tpl => (
            <TemplateCard key={tpl.id} id={tpl.id} label={tpl.name} icon="🎨" />
          ))}
          <TemplateCard id="custom" label="Upload custom" icon="📤" isCustom />
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

function truncate(s: string, max: number) {
  if (s.length <= max) return s
  const ext = s.lastIndexOf('.')
  const name = ext > 0 ? s.slice(0, ext) : s
  const suffix = ext > 0 ? s.slice(ext) : ''
  return name.slice(0, max - suffix.length - 1) + '…' + suffix
}
