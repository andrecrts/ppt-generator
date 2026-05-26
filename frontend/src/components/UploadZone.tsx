import { useState, DragEvent, ChangeEvent } from 'react'

interface Props {
  file: File | null
  onChange: (file: File | null) => void
  disabled?: boolean
}

// Unique ID so the label<->input association works even with multiple instances
const INPUT_ID = 'pdf-file-input'

export default function UploadZone({ file, onChange, disabled }: Props) {
  const [dragging, setDragging] = useState(false)

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    if (disabled) return
    const dropped = e.dataTransfer.files[0]
    if (dropped?.name.toLowerCase().endsWith('.pdf')) onChange(dropped)
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0]
    if (picked) onChange(picked)
    e.target.value = ''   // allow re-selecting same file
  }

  function fmt(bytes: number) {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  const btnStyle: React.CSSProperties = {
    background: '#1e1e2e',
    border: '1px solid #2e2e42',
    color: '#a0a0b8',
    borderRadius: 7,
    padding: '7px 16px',
    fontSize: 13,
    fontWeight: 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'inline-block',
  }

  return (
    <div>
      <p style={{
        fontSize: 11, fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.8px',
        color: '#6b6b80', marginBottom: 14,
      }}>
        Source Document
      </p>

      {/* Hidden file input — activated by the <label> below */}
      <input
        id={INPUT_ID}
        type="file"
        accept=".pdf"
        style={{ display: 'none' }}
        onChange={handleChange}
        disabled={disabled}
      />

      <div
        onDragOver={e => { e.preventDefault(); if (!disabled) setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${dragging ? '#6c63ff' : file ? '#a78bfa' : '#2e2e40'}`,
          borderRadius: 10,
          padding: '32px 20px',
          textAlign: 'center',
          background: '#0f0f18',
          transition: 'border-color 0.2s',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {file ? (
          <>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#a78bfa', marginBottom: 4 }}>
              {file.name}
            </div>
            <div style={{ fontSize: 12, color: '#6b6b80', marginBottom: 14 }}>
              {fmt(file.size)}
            </div>
            {/* Remove button — plain button, no file-picker logic */}
            <button
              type="button"
              onClick={() => onChange(null)}
              disabled={disabled}
              style={{ ...btnStyle, color: '#9090a8' }}
            >
              Remove
            </button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 30, marginBottom: 10 }}>📄</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
              Drag &amp; drop your PDF here
            </div>
            <div style={{ fontSize: 12, color: '#6b6b80', marginBottom: 16 }}>
              Supports .pdf files up to 50 MB
            </div>

            {/* <label htmlFor> is the native, no-JS way to open a file picker.
                Works in every browser regardless of display:none on the input. */}
            <label htmlFor={INPUT_ID} style={btnStyle}>
              Browse file
            </label>
          </>
        )}
      </div>
    </div>
  )
}
