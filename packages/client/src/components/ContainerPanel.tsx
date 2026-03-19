import { useState, useEffect, useRef, useCallback } from 'react'
import { useServerStore } from '../store/useServerStore'
import { DockerContainer } from '@servercity/shared'

type Tab = 'overview' | 'logs' | 'env'

const SECRET_KEYS = /password|secret|token|key|auth|credential|api_key/i

function statusBadge(status: DockerContainer['status']) {
  const colors: Record<DockerContainer['status'], string> = {
    running:    '#22c55e',
    paused:     '#f59e0b',
    exited:     '#6b7280',
    dead:       '#ef4444',
    created:    '#3b82f6',
    restarting: '#a855f7',
  }
  return (
    <span style={{
      background: `${colors[status]}22`,
      border: `1px solid ${colors[status]}55`,
      color: colors[status],
      borderRadius: 3,
      padding: '1px 7px',
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.06em',
    }}>
      {status.toUpperCase()}
    </span>
  )
}

function MemBar({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0
  const color = pct > 90 ? '#ef4444' : pct > 75 ? '#f59e0b' : '#22c55e'
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9ca3af', marginBottom: 3 }}>
        <span>Memory</span>
        <span>{used.toFixed(0)} MiB / {limit > 0 ? `${limit.toFixed(0)} MiB` : 'unlimited'}</span>
      </div>
      <div style={{ height: 4, background: '#1f2937', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.4s' }} />
      </div>
    </div>
  )
}

interface ContainerPanelProps {
  onRequestLogs: (id: string) => void
  onStopLogs: (id: string) => void
}

export function ContainerPanel({ onRequestLogs, onStopLogs }: ContainerPanelProps) {
  const selectedContainer  = useServerStore(s => s.selectedContainer)
  const setSelectedContainer = useServerStore(s => s.setSelectedContainer)
  const containerLogs      = useServerStore(s => s.containerLogs)
  const containerLogsActive = useServerStore(s => s.containerLogsActive)
  const [tab, setTab]      = useState<Tab>('overview')
  const [shownSecrets, setShownSecrets] = useState<Set<string>>(new Set())
  const logsEndRef         = useRef<HTMLDivElement>(null)

  const container = selectedContainer

  // Auto-fetch logs when switching to logs tab
  useEffect(() => {
    if (!container || tab !== 'logs') return
    if (containerLogsActive !== container.id) {
      onRequestLogs(container.id)
    }
  }, [tab, container, containerLogsActive, onRequestLogs])

  // Auto-scroll logs
  useEffect(() => {
    if (tab === 'logs') logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [containerLogs, tab])

  // Stop logs when panel closes or container switches
  useEffect(() => {
    return () => {
      if (containerLogsActive) onStopLogs(containerLogsActive)
    }
  }, [containerLogsActive, onStopLogs])

  const handleClose = useCallback(() => {
    if (containerLogsActive) onStopLogs(containerLogsActive)
    setSelectedContainer(null)
    setTab('overview')
  }, [containerLogsActive, onStopLogs, setSelectedContainer])

  const toggleSecret = useCallback((key: string) => {
    setShownSecrets(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  if (!container) return null

  const logs = containerLogs[container.id] ?? []
  const envVars = container.envVars

  return (
    <div style={{
      position: 'absolute',
      right: 0,
      top: 0,
      bottom: 0,
      width: 400,
      background: 'rgba(2,4,24,0.97)',
      borderLeft: '1px solid #1e293b',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'monospace',
      fontSize: 12,
      zIndex: 40,
      animation: 'slideInRight 0.2s ease-out',
    }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e293b' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 14 }}>{container.name}</div>
            <div style={{ color: '#64748b', fontSize: 10, marginTop: 2 }}>{container.image}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {statusBadge(container.status)}
            <button onClick={handleClose} style={{ background: 'none', border: 'none', color: '#4b5563', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 2, marginTop: 10 }}>
          {(['overview', 'logs', 'env'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                background: tab === t ? 'rgba(99,102,241,0.2)' : 'none',
                border: `1px solid ${tab === t ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.06)'}`,
                borderRadius: 4,
                padding: '3px 10px',
                cursor: 'pointer',
                color: tab === t ? '#a5b4fc' : '#6b7280',
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'auto', padding: tab === 'logs' ? 0 : '12px 16px' }}>
        {/* ── Overview tab ── */}
        {tab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <MemBar used={container.memoryMb} limit={container.memoryLimitMb} />

            {container.status === 'running' && (
              <StatRow label="CPU" value={`${container.cpuPercent.toFixed(2)}%`} />
            )}

            {container.restartCount > 0 && (
              <StatRow label="Restarts" value={String(container.restartCount)} color="#f59e0b" />
            )}

            {container.ports.length > 0 && (
              <Section title="Ports">
                {container.ports.map((p, i) => (
                  <div key={i} style={{ color: '#9ca3af', fontSize: 11, padding: '2px 0' }}>
                    <span style={{ color: '#60a5fa' }}>{p.host}</span>
                    <span style={{ color: '#374151' }}> → </span>
                    <span>{p.container}</span>
                    <span style={{ color: '#4b5563' }}>/{p.protocol}</span>
                  </div>
                ))}
              </Section>
            )}

            {container.volumes.length > 0 && (
              <Section title="Volumes">
                {container.volumes.map((v, i) => (
                  <div key={i} style={{ color: '#9ca3af', fontSize: 11, padding: '2px 0', wordBreak: 'break-all' }}>{v}</div>
                ))}
              </Section>
            )}

            {container.networks.length > 0 && (
              <Section title="Networks">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {container.networks.map(n => (
                    <span key={n} style={{ background: '#1e293b', color: '#7dd3fc', padding: '2px 6px', borderRadius: 3, fontSize: 10 }}>{n}</span>
                  ))}
                </div>
              </Section>
            )}
          </div>
        )}

        {/* ── Logs tab ── */}
        {tab === 'logs' && (
          <div style={{ background: '#030712', height: '100%', overflow: 'auto', padding: '8px 0' }}>
            {logs.length === 0 && (
              <div style={{ color: '#374151', textAlign: 'center', padding: 20, fontSize: 11 }}>
                {containerLogsActive === container.id ? 'streaming…' : 'loading…'}
              </div>
            )}
            {logs.map((line, i) => {
              const isErr = line.startsWith('\x1b[31m')
              const text = line.replace(/\x1b\[\d+m/g, '')
              return (
                <div key={i} style={{
                  fontSize: 10,
                  lineHeight: '14px',
                  padding: '0 10px',
                  color: isErr ? '#ef4444' : '#6b7280',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}>
                  {text}
                </div>
              )
            })}
            <div ref={logsEndRef} />
          </div>
        )}

        {/* ── Env tab ── */}
        {tab === 'env' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {envVars.length === 0 && (
              <div style={{ color: '#374151', fontSize: 11, padding: '20px 0', textAlign: 'center' }}>No env vars</div>
            )}
            {envVars.map(({ key, value }) => {
              const isSensitive = SECRET_KEYS.test(key)
              const shown = shownSecrets.has(key)
              return (
                <div key={key} style={{ display: 'flex', gap: 6, padding: '3px 0', borderBottom: '1px solid #0f172a', alignItems: 'flex-start' }}>
                  <span style={{ color: '#60a5fa', minWidth: 120, flexShrink: 0, fontSize: 10 }}>{key}</span>
                  <span style={{ color: isSensitive && !shown ? '#374151' : '#9ca3af', fontSize: 10, wordBreak: 'break-all' }}>
                    {isSensitive && !shown ? '••••••••' : value}
                  </span>
                  {isSensitive && (
                    <button
                      onClick={() => toggleSecret(key)}
                      style={{ background: 'none', border: 'none', color: '#4b5563', cursor: 'pointer', fontSize: 9, flexShrink: 0, padding: '0 4px' }}
                    >
                      {shown ? 'hide' : 'show'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
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

function StatRow({ label, value, color = '#e2e8f0' }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ color: '#4b5563', fontSize: 11 }}>{label}</span>
      <span style={{ color, fontSize: 12, fontWeight: 600 }}>{value}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ color: '#374151', fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 5 }}>{title}</div>
      {children}
    </div>
  )
}
