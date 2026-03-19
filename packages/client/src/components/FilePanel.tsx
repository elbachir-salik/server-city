import { useCallback } from 'react'
import { useServerStore } from '../store/useServerStore'

function formatSize(sizeMb: number): string {
  if (sizeMb >= 1024) return `${(sizeMb / 1024).toFixed(1)} GB`
  if (sizeMb >= 1) return `${sizeMb.toFixed(1)} MB`
  return `${(sizeMb * 1024).toFixed(0)} KB`
}

function formatDate(mtimeSec: number): string {
  if (!mtimeSec) return 'unknown'
  const d = new Date(mtimeSec * 1000)
  return d.toLocaleString()
}

function getFileExt(path: string): string {
  return path.split('.').pop()?.toLowerCase() ?? ''
}

/** Very basic syntax highlighting for log/conf/env files using inline spans. */
function highlightLine(line: string, ext: string): React.ReactNode {
  // Log files: highlight timestamps, ERROR/WARN keywords, IPs
  if (ext === 'log' || ext === 'txt') {
    if (/error|crit|fatal/i.test(line)) {
      return <span style={{ color: '#ef4444' }}>{line}</span>
    }
    if (/warn|warning/i.test(line)) {
      return <span style={{ color: '#f59e0b' }}>{line}</span>
    }
    if (/info|notice/i.test(line)) {
      return <span style={{ color: '#6b7280' }}>{line}</span>
    }
    return <span style={{ color: '#9ca3af' }}>{line}</span>
  }

  // .env files: KEY=value
  if (ext === 'env') {
    const eqIdx = line.indexOf('=')
    if (line.startsWith('#')) return <span style={{ color: '#4b5563' }}>{line}</span>
    if (eqIdx > 0) {
      const key = line.slice(0, eqIdx)
      const val = line.slice(eqIdx)
      return (
        <>
          <span style={{ color: '#60a5fa' }}>{key}</span>
          <span style={{ color: '#d1d5db' }}>{val}</span>
        </>
      )
    }
  }

  // .conf / .ini — comments, section headers, keys
  if (ext === 'conf' || ext === 'ini' || ext === 'cfg') {
    if (line.trimStart().startsWith('#') || line.trimStart().startsWith(';')) {
      return <span style={{ color: '#4b5563' }}>{line}</span>
    }
    if (/^\[.+\]/.test(line.trim())) {
      return <span style={{ color: '#a78bfa' }}>{line}</span>
    }
    const eqIdx = line.indexOf('=')
    if (eqIdx > 0) {
      return (
        <>
          <span style={{ color: '#34d399' }}>{line.slice(0, eqIdx)}</span>
          <span style={{ color: '#d1d5db' }}>{line.slice(eqIdx)}</span>
        </>
      )
    }
  }

  return <span style={{ color: '#9ca3af' }}>{line}</span>
}

export function FilePanel() {
  const { filePanel, filePanelLoading, setFilePanel } = useServerStore()

  const handleClose = useCallback(() => setFilePanel(null), [setFilePanel])

  if (!filePanel && !filePanelLoading) return null

  const ext = filePanel ? getFileExt(filePanel.path) : ''
  const lines = filePanel?.content.split('\n') ?? []
  const fileName = filePanel?.path.split('/').pop() ?? ''

  return (
    <div
      className="absolute right-0 top-0 bottom-0 z-40"
      style={{
        width: '420px',
        background: 'rgba(2,2,18,0.96)',
        borderLeft: '1px solid #1f2937',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'monospace',
        animation: 'slideInRight 0.2s ease-out',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #1f2937',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <div>
          <div style={{ color: '#f9fafb', fontSize: '13px', fontWeight: 600 }}>{fileName}</div>
          {filePanel && (
            <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '2px' }}>
              {filePanel.path}
            </div>
          )}
        </div>
        <button
          onClick={handleClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#6b7280',
            cursor: 'pointer',
            fontSize: '18px',
            lineHeight: 1,
            padding: '0 4px',
          }}
        >
          ×
        </button>
      </div>

      {/* Metadata */}
      {filePanel && (
        <div
          style={{
            padding: '8px 16px',
            borderBottom: '1px solid #1f2937',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '4px',
          }}
        >
          <MetaRow label="Size" value={formatSize(filePanel.sizeMb)} />
          <MetaRow label="Modified" value={formatDate(filePanel.mtimeSec)} />
          <MetaRow label="Type" value={ext || 'file'} />
          <MetaRow label="Lines" value={`${lines.length} shown`} />
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
        {filePanelLoading && (
          <div style={{ color: '#f59e0b', padding: '16px', textAlign: 'center', fontSize: '12px' }}>
            loading…
          </div>
        )}
        {filePanel && lines.map((line, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              fontSize: '11px',
              lineHeight: '16px',
              padding: '0 8px',
            }}
          >
            <span style={{ color: '#374151', width: '32px', flexShrink: 0, textAlign: 'right', paddingRight: '8px' }}>
              {lines.length - lines.length + i + 1}
            </span>
            <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {highlightLine(line, ext)}
            </span>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </div>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ fontSize: '11px' }}>
      <span style={{ color: '#4b5563' }}>{label}: </span>
      <span style={{ color: '#9ca3af' }}>{value}</span>
    </div>
  )
}
