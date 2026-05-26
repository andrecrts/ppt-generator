import { useState } from 'react'
import { EditSlideResult, SlideData, SlideType } from '../types'
import SlideModal from './SlideModal'

interface Props {
  slides: SlideData[]
  filename: string
  fileId: string
  thumbnailCount: number
}

export default function SlidePreview({ slides: initialSlides, filename, fileId, thumbnailCount: initialThumbCount }: Props) {
  // Local mutable copies so edits are reflected immediately without re-generating
  const [slides, setSlides] = useState<SlideData[]>(initialSlides)
  const [thumbCount, setThumbCount] = useState(initialThumbCount)
  const [thumbVersion, setThumbVersion] = useState(0)  // bumped after every edit to bust cache

  const hasRealThumbs = thumbCount > 0

  // Modal state
  const [modalIndex, setModalIndex] = useState<number | null>(null)  // 1-based
  const [isApplying, setIsApplying] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)

  const downloadHref = `/api/download/${fileId}`
  const downloadName = filename || 'presentation.pptx'

  function thumbUrl(slideIndex: number): string | null {
    if (!hasRealThumbs || slideIndex > thumbCount) return null
    return `/api/slides/${fileId}/${slideIndex}?v=${thumbVersion}`
  }

  async function handleApply(instruction: string) {
    if (modalIndex === null) return
    setIsApplying(true)
    setApplyError(null)
    try {
      const res = await fetch(`/api/slides/${fileId}/${modalIndex}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ detail: 'Unknown error' }))
        throw new Error(body.detail ?? `HTTP ${res.status}`)
      }
      const data: EditSlideResult = await res.json()
      setSlides(prev => prev.map((s, i) => i === data.index - 1 ? data.slide : s))
      setThumbCount(data.thumbnail_count)
      setThumbVersion(v => v + 1)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setApplyError(msg)
      throw err  // re-throw so SlideModal doesn't clear its textarea
    } finally {
      setIsApplying(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <span style={{ fontSize: 15, fontWeight: 700 }}>Slide Preview</span>
          <span style={{ fontSize: 13, color: '#6b6b80', marginLeft: 8 }}>
            {slides.length} slides generated
          </span>
        </div>
        <a
          href={downloadHref}
          download={downloadName}
          style={{
            background: 'linear-gradient(135deg, #6c63ff, #a78bfa)',
            border: 'none',
            color: '#fff',
            borderRadius: 8,
            padding: '9px 18px',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            textDecoration: 'none',
          }}
        >
          ⬇ Download .pptx
        </a>
      </div>

      {/* Note about previews */}
      <p style={{ fontSize: 11, color: '#4b4b60', marginBottom: 12 }}>
        {hasRealThumbs
          ? '💡 Click any slide to expand it or request AI changes.'
          : 'ℹ️ Style previews — download for real slides. Click any to expand or request AI changes.'}
      </p>

      {/* Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: 14,
      }}>
        {slides.map((slide, i) => (
          <SlideCard
            key={i}
            slide={slide}
            index={i + 1}
            thumbUrl={thumbUrl(i + 1)}
            onClick={() => { setModalIndex(i + 1); setApplyError(null) }}
          />
        ))}
      </div>

      {/* Filename */}
      <p style={{ marginTop: 16, fontSize: 12, color: '#4b4b60', textAlign: 'center' }}>
        📁 {filename}
      </p>

      {/* Expand / edit modal */}
      {modalIndex !== null && (
        <SlideModal
          slide={slides[modalIndex - 1]}
          index={modalIndex}
          fileId={fileId}
          thumbUrl={thumbUrl(modalIndex)}
          onClose={() => { setModalIndex(null); setApplyError(null) }}
          onApply={handleApply}
          isApplying={isApplying}
          applyError={applyError}
        />
      )}
    </div>
  )
}

// ── Slide card ───────────────────────────────────────────────────────────────

// Colors derived from the EDU Template (#002060 main, #4472C4 accent)
const SLIDE_STYLES: Record<SlideType, {
  bg: string
  titleColor: string
  accentLine: string
  dotColor: string
  lineColor: string
  label: string
}> = {
  title: {
    bg: 'linear-gradient(150deg, #001845 0%, #002060 50%, #002d80 100%)',
    titleColor: '#ffffff',
    accentLine: '#4472C4',
    dotColor: '#4472C4',
    lineColor: '#1a3a7a',
    label: 'Cover',
  },
  section_header: {
    bg: 'linear-gradient(135deg, #002060 0%, #1f3864 100%)',
    titleColor: '#BDD7EE',
    accentLine: '#4472C4',
    dotColor: '#4472C4',
    lineColor: '#2a4a8a',
    label: 'Section',
  },
  content: {
    bg: '#002060',
    titleColor: '#ffffff',
    accentLine: '#4472C4',
    dotColor: '#4472C4',
    lineColor: '#1a3a7a',
    label: 'Content',
  },
}

function SlideCard({
  slide, index, thumbUrl, onClick,
}: {
  slide: SlideData
  index: number
  thumbUrl: string | null
  onClick: () => void
}) {
  const s = SLIDE_STYLES[slide.slide_type] ?? SLIDE_STYLES.content

  return (
    <div
      onClick={onClick}
      style={{
        background: '#16161f',
        border: '1px solid #1e1e2e',
        borderRadius: 10,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'border-color 0.15s, transform 0.15s',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = '#6c63ff'
        ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = '#1e1e2e'
        ;(e.currentTarget as HTMLDivElement).style.transform = 'none'
      }}
    >
      {/* Thumbnail area */}
      {thumbUrl ? (
        <div style={{ aspectRatio: '16/9', overflow: 'hidden', background: '#0f0f18' }}>
          <img
            src={thumbUrl}
            alt={`Slide ${index}`}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            loading="lazy"
          />
        </div>
      ) : (
        <div style={{
          aspectRatio: '16/9',
          background: s.bg,
          padding: '8px 10px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}>
          <div style={{
            fontSize: 5, fontWeight: 700, color: s.titleColor,
            marginBottom: 3, lineHeight: 1.3, overflow: 'hidden',
            maxHeight: 13, letterSpacing: '0.3px',
          }}>
            {slide.title.toUpperCase()}
          </div>
          <div style={{
            height: 1.5, borderRadius: 1, background: s.accentLine,
            marginBottom: 4, width: '80%', opacity: 0.9,
          }} />
          {slide.bullets.slice(0, 6).map((_, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: 2 }}>
              <div style={{ width: 2, height: 2, borderRadius: '50%', background: s.dotColor, flexShrink: 0, opacity: 0.85 }} />
              <div style={{ height: 1.5, borderRadius: 1, background: s.lineColor, width: `${58 + (i % 4) * 10}%` }} />
            </div>
          ))}
          <div style={{
            position: 'absolute', bottom: 4, right: 5,
            background: 'rgba(68,114,196,0.25)', border: '1px solid rgba(68,114,196,0.5)',
            borderRadius: 3, padding: '1.5px 4px', fontSize: 4, color: '#BDD7EE', fontWeight: 600,
          }}>
            {s.label}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{
        padding: '5px 10px', borderTop: '1px solid #1e1e2e',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 11, color: '#6b6b80', fontWeight: 500 }}>{index}</span>
        <span style={{ fontSize: 10, color: '#5b7bb0', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {slide.title}
        </span>
      </div>
    </div>
  )
}
