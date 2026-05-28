import { useState } from 'react'
import { AppState, GenerateResult } from './types'
import UploadZone from './components/UploadZone'
import SettingsCard from './components/SettingsCard'
import ProgressCard from './components/ProgressCard'
import SlidePreview from './components/SlidePreview'

const API = '/api'

export default function App() {
  const [file, setFile] = useState<File | null>(null)
  const [templateId, setTemplateId] = useState('edu1')  // default to first bundled template
  const [templateFile, setTemplateFile] = useState<File | null>(null)
  const [courseName, setCourseName] = useState('')
  const [authorName, setAuthorName] = useState('')
  const [appState, setAppState] = useState<AppState>('idle')
  const [result, setResult] = useState<GenerateResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isGenerating = appState === 'generating'
  const isDone = appState === 'done'

  async function handleGenerate() {
    if (!file) return
    setAppState('generating')
    setError(null)
    setResult(null)

    const formData = new FormData()
    formData.append('pdf', file)
    if (templateFile) {
      formData.append('template', templateFile)
    } else {
      formData.append('template_id', templateId)
    }
    formData.append('course_name', courseName.trim())
    formData.append('author_name', authorName.trim())

    try {
      const res = await fetch(`${API}/generate`, { method: 'POST', body: formData })

      if (!res.ok) {
        const body = await res.json().catch(() => ({ detail: 'Unknown error' }))
        throw new Error(body.detail ?? `HTTP ${res.status}`)
      }

      const data: GenerateResult = await res.json()
      setResult(data)
      setAppState('done')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
      setAppState('error')
    }
  }

  function handleReset() {
    setAppState('idle')
    setResult(null)
    setError(null)
    setFile(null)
    setCourseName('')
    // keep authorName and templateFile — user probably wants the same author/template next time
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* Nav */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 32px',
        borderBottom: '1px solid #1e1e2e',
        background: '#0f0f13',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, fontSize: 17, letterSpacing: '-0.3px' }}>
          <div style={{
            width: 32, height: 32,
            background: 'linear-gradient(135deg, #6c63ff, #a78bfa)',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16,
          }}>✦</div>
          PPT Generator
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {isDone && (
            <button
              onClick={handleReset}
              style={{
                background: '#1e1e2e',
                border: '1px solid #2e2e42',
                color: '#9090a8',
                borderRadius: 8,
                padding: '7px 16px',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              ← New presentation
            </button>
          )}
          <div style={{
            width: 32, height: 32,
            background: 'linear-gradient(135deg, #6c63ff, #a78bfa)',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 600,
          }}>
            AC
          </div>
        </div>
      </nav>

      {/* Main */}
      <main style={{ flex: 1, padding: '40px 32px', maxWidth: 1100, margin: '0 auto', width: '100%' }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 4 }}>
          {isDone ? 'Presentation Ready 🎉' : 'New Presentation'}
        </h1>
        <p style={{ color: '#6b6b80', fontSize: 14, marginBottom: 32 }}>
          {isDone
            ? `${result!.slide_count} slides generated from ${file?.name}`
            : 'Upload a PDF and generate a polished UPANA-formatted presentation in seconds.'}
        </p>

        {/* Upload + Settings grid (hide when done) */}
        {!isDone && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 24,
            marginBottom: 24,
          }}>
            {/* Upload */}
            <div style={{
              background: '#16161f',
              border: '1px solid #1e1e2e',
              borderRadius: 14,
              padding: 24,
            }}>
              <UploadZone file={file} onChange={setFile} disabled={isGenerating} />
            </div>

            {/* Settings */}
            <div style={{
              background: '#16161f',
              border: '1px solid #1e1e2e',
              borderRadius: 14,
              padding: 24,
            }}>
              <SettingsCard
                courseName={courseName}
                onCourseChange={setCourseName}
                authorName={authorName}
                onAuthorChange={setAuthorName}
                templateId={templateId}
                onTemplateIdChange={setTemplateId}
                templateFile={templateFile}
                onTemplateChange={setTemplateFile}
                onGenerate={handleGenerate}
                canGenerate={!!file}
                disabled={isGenerating}
              />
            </div>
          </div>
        )}

        {/* Progress bar */}
        {(isGenerating || isDone) && (
          <div style={{ marginBottom: 24 }}>
            <ProgressCard active={isGenerating} done={isDone} />
          </div>
        )}

        {/* Error */}
        {appState === 'error' && error && (
          <div style={{
            background: '#1a0d0d',
            border: '1px solid #5a1a1a',
            borderRadius: 12,
            padding: '16px 20px',
            marginBottom: 24,
            color: '#ff8080',
            fontSize: 14,
          }}>
            <strong>Error:</strong> {error}
            <br />
            <button
              onClick={handleReset}
              style={{
                marginTop: 10,
                background: '#2a1010',
                border: '1px solid #5a1a1a',
                color: '#ff8080',
                borderRadius: 7,
                padding: '6px 14px',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
          </div>
        )}

        {/* Slide preview */}
        {isDone && result && (
          <>
            <SlidePreview
              slides={result.slides}
              filename={result.filename}
              fileId={result.file_id}
              thumbnailCount={result.thumbnail_count ?? 0}
            />
          </>
        )}
      </main>
    </div>
  )
}
