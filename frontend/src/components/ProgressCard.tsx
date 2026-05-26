import { useEffect, useState } from 'react'

interface Stage {
  label: string
  pct: number
}

const STAGES: Stage[] = [
  { label: 'Reading PDF…',                           pct: 15 },
  { label: 'Extracting text from pages…',            pct: 35 },
  { label: 'Classifying content with Claude AI…',    pct: 65 },
  { label: 'Building slides from EDU Template…',     pct: 88 },
  { label: 'Finalizing presentation…',               pct: 96 },
]

interface Props {
  active: boolean   // true while generating
  done: boolean     // true when finished
}

export default function ProgressCard({ active, done }: Props) {
  const [stageIdx, setStageIdx] = useState(0)
  const [pct, setPct] = useState(0)

  useEffect(() => {
    if (!active) return

    setStageIdx(0)
    setPct(0)

    // Advance through stages with realistic timing
    const timings = [800, 2500, 6000, 10000]   // ms to advance each stage
    const timers: ReturnType<typeof setTimeout>[] = []

    timings.forEach((delay, i) => {
      timers.push(setTimeout(() => {
        setStageIdx(i + 1)
        setPct(STAGES[i + 1]?.pct ?? 96)
      }, delay))
    })

    return () => timers.forEach(clearTimeout)
  }, [active])

  useEffect(() => {
    if (done) {
      setPct(100)
      setStageIdx(STAGES.length)
    }
  }, [done])

  const currentLabel = done
    ? '✅ Done — presentation ready!'
    : STAGES[stageIdx]?.label ?? STAGES[STAGES.length - 1].label

  return (
    <div style={{
      background: '#16161f',
      border: '1px solid #1e1e2e',
      borderRadius: 14,
      padding: '20px 24px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
          {!done && (
            <span style={{
              display: 'inline-block', width: 7, height: 7,
              background: '#a78bfa', borderRadius: '50%',
              animation: 'pulse-dot 1.4s infinite',
            }} />
          )}
          {done ? 'Presentation ready' : 'Generating slides…'}
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa' }}>
          {pct}%
        </span>
      </div>

      {/* Progress bar */}
      <div style={{
        background: '#1e1e2e', borderRadius: 99,
        height: 6, overflow: 'hidden', marginBottom: 8,
      }}>
        <div style={{
          background: 'linear-gradient(90deg, #6c63ff, #a78bfa)',
          height: '100%', borderRadius: 99,
          width: `${pct}%`,
          transition: 'width 0.6s ease',
        }} />
      </div>

      <div style={{ fontSize: 12, color: '#6b6b80' }}>
        {currentLabel}
      </div>

      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}
