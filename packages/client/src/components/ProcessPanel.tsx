import { useState, useEffect, useCallback } from 'react'
import { useServerStore } from '../store/useServerStore'

interface ProcessPanelProps {
  onRequestPs: () => void
}

type SortKey = 'cpu' | 'mem'

export function ProcessPanel({ onRequestPs }: ProcessPanelProps) {
  const processPanelVisible = useServerStore(s => s.processPanelVisible)
  const toggleProcessPanel  = useServerStore(s => s.toggleProcessPanel)
  const processes           = useServerStore(s => s.processes)
  const status              = useServerStore(s => s.status)
  const [sortBy, setSortBy] = useState<SortKey>('cpu')

  // Auto-refresh every 5s while panel is open and connected
  const refresh = useCallback(() => {
    if (status === 'connected') onRequestPs()
  }, [status, onRequestPs])

  useEffect(() => {
    if (!processPanelVisible) return
    refresh()
    const id = setInterval(refresh, 5000)
    return () => clearInterval(id)
  }, [processPanelVisible, refresh])

  if (!processPanelVisible) return null

  const sorted = [...processes].sort((a, b) => b[sortBy] - a[sortBy])

  const rowColor = (cpu: number) => {
    if (cpu > 50) return '#ef4444'
    if (cpu > 20) return '#f59e0b'
    return '#9ca3af'
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: 16,
        top: '50%',
        transform: 'translateY(-50%)',
        width: 380,
        maxHeight: '75vh',
        overflowY: 'auto',
        background: 'rgba(6,6,18,0.97)',
        border: '1px solid rgba(99,102,241,0.25)',
        borderRadius: 12,
        padding: '14px 16px',
        fontFamily: 'monospace',
        fontSize: 11,
        zIndex: 30,
        backdropFilter: 'blur(12px)',
        boxShadow: '0 0 28px rgba(99,102,241,0.12)',
      }}
    >
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 13 }}>
          Processes
          {processes.length > 0 && (
            <span style={{ color: '#6b7280', fontWeight: 400, fontSize: 10, marginLeft: 6 }}>
              top {processes.length}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {/* Sort toggle */}
          <div style={{ display: 'flex', gap: 2 }}>
            {(['cpu', 'mem'] as SortKey[]).map(k => (
              <button
                key={k}
                onClick={() => setSortBy(k)}
                style={{
                  background: sortBy === k ? 'rgba(99,102,241,0.25)' : 'none',
                  border: `1px solid ${sortBy === k ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 4,
                  padding: '2px 7px',
                  cursor: 'pointer',
                  color: sortBy === k ? '#a5b4fc' : '#6b7280',
                  fontSize: 9,
                  fontFamily: 'monospace',
                  textTransform: 'uppercase',
                }}
              >
                {k}
              </button>
            ))}
          </div>
          <button
            onClick={toggleProcessPanel}
            style={{
              background: 'none', border: 'none', color: '#4b5563',
              cursor: 'pointer', fontSize: 14, padding: 0,
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* ── Column headers ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '48px 80px 42px 42px 1fr',
          gap: '0 8px',
          color: '#4b5563',
          fontSize: 9,
          letterSpacing: '0.06em',
          marginBottom: 6,
          paddingBottom: 6,
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <span>PID</span>
        <span>USER</span>
        <span style={{ textAlign: 'right' }}>CPU%</span>
        <span style={{ textAlign: 'right' }}>MEM%</span>
        <span>COMMAND</span>
      </div>

      {/* ── Process rows ── */}
      {sorted.length === 0 && (
        <div style={{ color: '#4b5563', textAlign: 'center', padding: '20px 0', fontSize: 11 }}>
          Loading…
        </div>
      )}

      {sorted.map(p => (
        <div
          key={p.pid}
          style={{
            display: 'grid',
            gridTemplateColumns: '48px 80px 42px 42px 1fr',
            gap: '0 8px',
            padding: '4px 0',
            borderBottom: '1px solid rgba(255,255,255,0.03)',
            color: rowColor(p.cpu),
            fontSize: 11,
          }}
        >
          <span style={{ color: '#6b7280' }}>{p.pid}</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#9ca3af' }}>
            {p.user}
          </span>
          <span style={{ textAlign: 'right', fontWeight: p.cpu > 20 ? 700 : 400 }}>
            {p.cpu.toFixed(1)}
          </span>
          <span style={{ textAlign: 'right', color: '#9ca3af' }}>
            {p.mem.toFixed(1)}
          </span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#d1d5db', fontSize: 10 }}>
            {p.cmd}
          </span>
        </div>
      ))}
    </div>
  )
}
