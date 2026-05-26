import { useEffect, useRef, useState } from 'react'
import { SlideData, SlideType } from '../types'

interface Props {
  slide: SlideData
  index: number          // 1-based, shown in header
  fileId: string
  thumbUrl: string | null
  onClose: () => void
  onApply: (instruction: string) => Promise<void>
  isApplying: boolean
  applyError: string | null
}

// Same palette as SlidePreview so the CSS mock looks identical
const SLIDE_STYLES: Record<SlideType, {
  bg: string; titleColor: string; accentLine: string; dotColor: string; lineColor: string; label: string
}> = {
  title: {
    bg: 'linear-gradient(150deg, #001845 0%, #002060 50%, #002d80 100%)',
    titleColor: '#ffffff', accentLine: '#4472C4', dotColor: '#4472C4', lineColor: '#1a3a7a', label: 'Cover',
  },
  section_header: {
    bg: 'linear-gradient(135deg, #002060 0%, #1f3864 100%)',
    titleColor: '#BDD7EE', accentLine: '#4472C4', dotColor: '#4472C4', lineColor: '#2a4a8a', label: 'Section',
  },
  content: {
    bg: '#002060',
    titleColor: '#ffffff', accentLine: '#4472C4', dotColor: '#4472C4', lineColor: '#1a3a7a', label: 'Content',
  },
}

export default function SlideModal({
  slide, index, thumbUrl, onClose, onApply, isApplying, applyError,
}: Props) {
  const [instruction, setInstruction] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ESC to close + body scroll lock
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', handler)
    }
  }, [onClose])

  async function handleApply() {
    if (!instruction.trim() || isApplying) return
    await onApply(instruction.trim())
    // Clear on success (onApply throws on error, so this only runs if it succeeded)
    setInstruction('')
  }

  const s = SLIDE_STYLES[slide.slide_type] ?? SLIDE_STYLES.content

  return (
    // ── Overlay ─────────────────────────────────────────────────────────────
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.78)',
        zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      {/* ── Panel ───────────────────────────────────────────────────────── */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#16161f',
          border: '1px solid #2e2e42',
          borderRadius: 16,
          maxWidth: 880,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 24px',
          borderBottom: '1px solid #1e1e2e',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, color: '#6b6b80', fontWeight: 500 }}>
              Slide {index}
            </span>
            <span style={{
              background: 'rgba(68,114,196,0.18)',
              border: '1px solid rgba(68,114,196,0.4)',
              borderRadius: 5,
              padding: '2px 8px',
              fontSize: 11,
              color: '#BDD7EE',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              {s.label}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none',
              color: '#6b6b80', fontSize: 20, cursor: 'pointer',
              lineHeight: 1, padding: '2px 6px', borderRadius: 6,
            }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body: slide preview + content */}
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 24,
          padding: 24,
        }}>
          {/* Left: slide thumbnail (large) */}
          <div style={{ flex: '1 1 340px', minWidth: 280 }}>
            {thumbUrl ? (
              <img
                src={thumbUrl}
                alt={`Slide ${index}`}
                style={{
                  width: '100%',
                  aspectRatio: '16/9',
                  objectFit: 'contain',
                  borderRadius: 10,
                  display: 'block',
                  background: '#0f0f18',
                  border: '1px solid #1e1e2e',
                }}
              />
            ) : (
              // CSS mock at full width
              <div style={{
                width: '100%',
                aspectRatio: '16/9',
                background: s.bg,
                borderRadius: 10,
                padding: '5% 6%',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                position: 'relative',
                border: '1px solid #1e1e2e',
              }}>
                <div style={{
                  fontSize: 14, fontWeight: 700, color: s.titleColor,
                  marginBottom: 6, letterSpacing: '0.3px', lineHeight: 1.3,
                }}>
                  {slide.title.toUpperCase()}
                </div>
                <div style={{
                  height: 2.5, borderRadius: 1, background: s.accentLine,
                  marginBottom: 10, width: '80%', opacity: 0.9,
                }} />
                {slide.bullets.slice(0, 8).map((_, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: s.dotColor, flexShrink: 0 }} />
                    <div style={{ height: 3, borderRadius: 2, background: s.lineColor, width: `${55 + (i % 4) * 10}%` }} />
                  </div>
                ))}
                <div style={{
                  position: 'absolute', bottom: 8, right: 10,
                  background: 'rgba(68,114,196,0.25)',
                  border: '1px solid rgba(68,114,196,0.5)',
                  borderRadius: 4, padding: '3px 7px',
                  fontSize: 9, color: '#BDD7EE', fontWeight: 600,
                }}>
                  {s.label}
                </div>
              </div>
            )}
          </div>

          {/* Right: content + edit form */}
          <div style={{ flex: '1 1 260px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Title */}
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#6b6b80', marginBottom: 6 }}>
                Title
              </p>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#e2e2e8', lineHeight: 1.4 }}>
                {slide.title}
              </p>
            </div>

            {/* Bullets */}
            {slide.bullets.length > 0 && (
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#6b6b80', marginBottom: 8 }}>
                  Content
                </p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {slide.bullets.map((b, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#c0c0d0', lineHeight: 1.5 }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: '#6c63ff', flexShrink: 0, marginTop: 5,
                      }} />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Divider */}
            <div style={{ borderTop: '1px solid #1e1e2e' }} />

            {/* Edit form */}
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#6b6b80', marginBottom: 8 }}>
                ✦ Request a change
              </p>
              <textarea
                ref={textareaRef}
                value={instruction}
                onChange={e => setInstruction(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleApply()
                }}
                placeholder="e.g. Make the title shorter, add a bullet about assessment methods, translate to English…"
                disabled={isApplying}
                rows={3}
                style={{
                  width: '100%',
                  background: '#0f0f18',
                  border: '1px solid #2e2e40',
                  borderRadius: 8,
                  color: '#e2e2e8',
                  fontSize: 13,
                  padding: '10px 12px',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  outline: 'none',
                  boxSizing: 'border-box',
                  opacity: isApplying ? 0.5 : 1,
                }}
              />
              {applyError && (
                <p style={{ fontSize: 12, color: '#ff8080', marginTop: 6 }}>
                  ⚠ {applyError}
                </p>
              )}
              <button
                onClick={handleApply}
                disabled={isApplying || !instruction.trim()}
                style={{
                  marginTop: 10,
                  width: '100%',
                  background: isApplying || !instruction.trim()
                    ? '#2a2a3a'
                    : 'linear-gradient(135deg, #6c63ff, #a78bfa)',
                  border: 'none',
                  color: isApplying || !instruction.trim() ? '#6b6b80' : '#fff',
                  borderRadius: 8,
                  padding: '10px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: isApplying || !instruction.trim() ? 'not-allowed' : 'pointer',
                  transition: 'background 0.15s',
                }}
              >
                {isApplying ? '⏳ Applying…' : '✦ Apply changes'}
              </button>
              <p style={{ fontSize: 11, color: '#4b4b60', marginTop: 6, textAlign: 'center' }}>
                ⌘↵ to apply · ESC to close
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
