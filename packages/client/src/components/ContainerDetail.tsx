import { useState, useEffect, useRef, useCallback } from 'react'
import { useServerStore } from '../store/useServerStore'
import { DockerContainer } from '@servercity/shared'

type Tab = 'overview' | 'logs' | 'env'

const SECRET_KEYS = /password|secret|token|key|auth|credential|api_key/i

// ── Status colors ─────────────────────────────────────────────────────────────
const STATUS_COLOR: Record<DockerContainer['status'], string> = {
  running:    '#22c55e',
  paused:     '#f59e0b',
  exited:     '#6b7280',
  dead:       '#ef4444',
  created:    '#3b82f6',
  restarting: '#a855f7',
}

function StatusBadge({ status }: { status: DockerContainer['status'] }) {
  const c = STATUS_COLOR[status]
  return (
    <span style={{
      background: `${c}22`, border: `1px solid ${c}55`, color: c,
      borderRadius: 4, padding: '2px 10px', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
    }}>
      {status.toUpperCase()}
    </span>
  )
}

// ── Mem bar ───────────────────────────────────────────────────────────────────
function MemBar({ used, limit }: { used: number; limit: number }) {
  const pct   = limit > 0 ? Math.min(100, (used / limit) * 100) : 0
  const color = pct > 90 ? '#ef4444' : pct > 75 ? '#f59e0b' : '#22c55e'
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, color: '#9ca3af', fontSize: 11 }}>
        <span>Memory</span>
        <span style={{ fontWeight: 600, color }}>
          {used.toFixed(0)} MiB {limit > 0 ? `/ ${limit.toFixed(0)} MiB` : '/ unlimited'}
        </span>
      </div>
      <div style={{ height: 6, background: '#1f2937', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.4s' }} />
      </div>
      <div style={{ textAlign: 'right', fontSize: 10, color: '#4b5563', marginTop: 2 }}>{pct.toFixed(1)}%</div>
    </div>
  )
}

// ── Sparkline ─────────────────────────────────────────────────────────────────
function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null
  const max = Math.max(...values, 1)
  const W = 120, H = 28
  const pts = values.map((v, i) =>
    `${((i / (values.length - 1)) * W).toFixed(1)},${(H - (v / max) * H).toFixed(1)}`
  ).join(' ')
  return (
    <svg width={W} height={H} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinejoin="round" strokeLinecap="round" opacity="0.8" />
    </svg>
  )
}

// ── Stat row ──────────────────────────────────────────────────────────────────
function StatRow({ label, value, children, color = '#e2e8f0' }: {
  label: string; value?: string; children?: React.ReactNode; color?: string
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #0f172a' }}>
      <span style={{ color: '#6b7280', fontSize: 12 }}>{label}</span>
      {value && <span style={{ color, fontFamily: 'monospace', fontSize: 12, fontWeight: 600 }}>{value}</span>}
      {children}
    </div>
  )
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ color: '#374151', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 18, marginBottom: 8 }}>
      {children}
    </div>
  )
}

// ── ContainerDetail ───────────────────────────────────────────────────────────
interface ContainerDetailProps {
  onRequestLogs: (id: string) => void
  onStopLogs: (id: string) => void
}

export function ContainerDetail({ onRequestLogs, onStopLogs }: ContainerDetailProps) {
  const container        = useServerStore(s => s.selectedContainer)
  const setSelectedContainer = useServerStore(s => s.setSelectedContainer)
  const containerLogs    = useServerStore(s => s.containerLogs)
  const containerLogsActive = useServerStore(s => s.containerLogsActive)

  const [tab, setTab]    = useState<Tab>('overview')
  const [shownSecrets, setShownSecrets] = useState<Set<string>>(new Set())
  const [cpuHistory]     = useState<number[]>([])  // placeholder — real sparklines need history
  const logsEndRef       = useRef<HTMLDivElement>(null)

  const handleClose = useCallback(() => {
    if (containerLogsActive) onStopLogs(containerLogsActive)
    setSelectedContainer(null)
    setTab('overview')
  }, [containerLogsActive, onStopLogs, setSelectedContainer])

  // Auto-fetch logs on tab switch
  useEffect(() => {
    if (!container || tab !== 'logs') return
    if (containerLogsActive !== container.id) onRequestLogs(container.id)
  }, [tab, container, containerLogsActive, onRequestLogs])

  // Auto-scroll
  useEffect(() => {
    if (tab === 'logs') logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [containerLogs, tab])

  // Stop logs on unmount
  useEffect(() => {
    return () => { if (containerLogsActive) onStopLogs(containerLogsActive) }
  }, [containerLogsActive, onStopLogs])

  const toggleSecret = useCallback((key: string) => {
    setShownSecrets(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  if (!container) return null

  const logs   = containerLogs[container.id] ?? []
  const glow   = STATUS_COLOR[container.status]
  const cpuColor = container.cpuPercent > 80 ? '#ef4444' : container.cpuPercent > 50 ? '#f59e0b' : '#22c55e'
  const memPct = container.memoryLimitMb > 0 ? (container.memoryMb / container.memoryLimitMb) * 100 : 0

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) handleClose() }}
      style={{
        position: 'absolute', inset: 0,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div style={{
        width: '100%',
        maxWidth: 780,
        maxHeight: 'calc(100vh - 80px)',
        background: '#080c18',
        border: `1px solid ${glow}33`,
        borderRadius: 8,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'monospace',
        fontSize: 12,
        overflow: 'hidden',
        boxShadow: `0 0 40px ${glow}22`,
        animation: 'detailIn 0.15s ease-out',
      }}>
        {/* ── Header ── */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          background: `${glow}08`,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>
              {container.name.replace(/^\//, '')}
            </div>
            <div style={{ color: '#4b5563', fontSize: 11 }}>{container.image}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <StatusBadge status={container.status} />
            <button
              onClick={handleClose}
              style={{
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6, width: 30, height: 30, cursor: 'pointer',
                color: '#9ca3af', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{
          display: 'flex', gap: 0,
          borderBottom: '1px solid #1e293b',
          padding: '0 20px',
          background: 'rgba(0,0,0,0.3)',
        }}>
          {(['overview', 'logs', 'env'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: `2px solid ${tab === t ? glow : 'transparent'}`,
                padding: '10px 16px',
                cursor: 'pointer',
                color: tab === t ? '#f1f5f9' : '#4b5563',
                fontSize: 11,
                fontFamily: 'monospace',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                transition: 'color 0.15s, border-color 0.15s',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, overflow: 'auto', padding: tab === 'logs' ? 0 : '16px 20px' }}>

          {/* ── Overview ── */}
          {tab === 'overview' && (
            <div>
              {/* CPU + MEM big stats */}
              <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
                <div style={{
                  flex: 1, background: '#0f172a', borderRadius: 6, padding: '12px 14px',
                  border: '1px solid #1e293b',
                }}>
                  <div style={{ color: '#6b7280', fontSize: 10, marginBottom: 6 }}>CPU USAGE</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: cpuColor, lineHeight: 1 }}>
                    {container.cpuPercent.toFixed(2)}%
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <Sparkline values={[...cpuHistory, container.cpuPercent]} color={cpuColor} />
                  </div>
                </div>
                <div style={{
                  flex: 2, background: '#0f172a', borderRadius: 6, padding: '12px 14px',
                  border: '1px solid #1e293b',
                }}>
                  <MemBar used={container.memoryMb} limit={container.memoryLimitMb} />
                  <div style={{ marginTop: 8 }}>
                    <Sparkline values={[memPct]} color={memPct > 80 ? '#ef4444' : '#60a5fa'} />
                  </div>
                </div>
              </div>

              {/* Restart count */}
              {container.restartCount > 0 && (
                <StatRow label="Restart count" value={String(container.restartCount)} color="#f59e0b" />
              )}

              {/* Ports */}
              {container.ports.length > 0 && (
                <>
                  <SectionTitle>Port Mappings</SectionTitle>
                  <div style={{ background: '#0f172a', borderRadius: 6, overflow: 'hidden', border: '1px solid #1e293b' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #1e293b' }}>
                          <th style={{ padding: '6px 12px', color: '#374151', textAlign: 'left', fontWeight: 400 }}>Host</th>
                          <th style={{ padding: '6px 12px', color: '#374151', textAlign: 'left', fontWeight: 400 }}>Container</th>
                          <th style={{ padding: '6px 12px', color: '#374151', textAlign: 'left', fontWeight: 400 }}>Proto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {container.ports.map((p, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #0f172a' }}>
                            <td style={{ padding: '5px 12px', color: '#38bdf8' }}>{p.host}</td>
                            <td style={{ padding: '5px 12px', color: '#9ca3af' }}>{p.container}</td>
                            <td style={{ padding: '5px 12px', color: '#4b5563' }}>{p.protocol}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* Volume mounts */}
              {container.mounts.length > 0 && (
                <>
                  <SectionTitle>Volume Mounts</SectionTitle>
                  <div style={{ background: '#0f172a', borderRadius: 6, overflow: 'hidden', border: '1px solid #1e293b' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #1e293b' }}>
                          <th style={{ padding: '6px 12px', color: '#374151', textAlign: 'left', fontWeight: 400 }}>Container path</th>
                          <th style={{ padding: '6px 12px', color: '#374151', textAlign: 'left', fontWeight: 400 }}>Volume / host</th>
                        </tr>
                      </thead>
                      <tbody>
                        {container.mounts.map((m, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #0f172a' }}>
                            <td style={{ padding: '5px 12px', color: '#9ca3af', wordBreak: 'break-all' }}>{m.destination}</td>
                            <td style={{ padding: '5px 12px', color: '#7c3aed' }}>{m.name || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* Networks */}
              {container.networks.length > 0 && (
                <>
                  <SectionTitle>Networks</SectionTitle>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {container.networks.map(n => (
                      <span key={n} style={{
                        background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)',
                        color: '#38bdf8', borderRadius: 4, padding: '3px 10px', fontSize: 11,
                      }}>
                        {n}
                      </span>
                    ))}
                  </div>
                </>
              )}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 8, marginTop: 24, paddingTop: 16, borderTop: '1px solid #1e293b' }}>
                <ActionBtn
                  label="Restart"
                  color="#f59e0b"
                  disabled={container.status === 'exited' || container.status === 'dead'}
                  title="docker restart"
                />
                <ActionBtn
                  label="Stop"
                  color="#ef4444"
                  disabled={container.status !== 'running'}
                  title="docker stop"
                />
              </div>
            </div>
          )}

          {/* ── Logs ── */}
          {tab === 'logs' && (
            <div style={{
              background: '#030712',
              height: '100%',
              minHeight: 360,
              overflow: 'auto',
              padding: '10px 0',
            }}>
              {logs.length === 0 && (
                <div style={{ color: '#374151', textAlign: 'center', padding: 24, fontSize: 11 }}>
                  {containerLogsActive === container.id ? 'Streaming…' : 'Loading…'}
                </div>
              )}
              {logs.map((line, i) => {
                const isErr = line.startsWith('\x1b[31m')
                const text  = line.replace(/\x1b\[\d+m/g, '')
                return (
                  <div key={i} style={{
                    fontSize: 11, lineHeight: '16px', padding: '0 14px',
                    color: isErr ? '#ef4444' : '#6b7280',
                    whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                  }}>
                    {text}
                  </div>
                )
              })}
              <div ref={logsEndRef} />
            </div>
          )}

          {/* ── Env ── */}
          {tab === 'env' && (
            <div>
              {container.envVars.length === 0 && (
                <div style={{ color: '#374151', fontSize: 11, padding: '24px 0', textAlign: 'center' }}>No env vars</div>
              )}
              {container.envVars.map(({ key, value }) => {
                const isSensitive = SECRET_KEYS.test(key)
                const shown = shownSecrets.has(key)
                return (
                  <div key={key} style={{
                    display: 'flex', gap: 8, padding: '5px 0',
                    borderBottom: '1px solid #0f172a', alignItems: 'flex-start',
                  }}>
                    <span style={{ color: '#60a5fa', minWidth: 160, flexShrink: 0, fontSize: 11 }}>{key}</span>
                    <span style={{ color: isSensitive && !shown ? '#374151' : '#9ca3af', fontSize: 11, wordBreak: 'break-all', flex: 1 }}>
                      {isSensitive && !shown ? '••••••••' : value}
                    </span>
                    {isSensitive && (
                      <button
                        onClick={() => toggleSecret(key)}
                        style={{
                          background: 'none', border: 'none', color: '#4b5563',
                          cursor: 'pointer', fontSize: 10, flexShrink: 0, padding: '0 4px',
                          fontFamily: 'monospace',
                        }}
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
      </div>

      <style>{`
        @keyframes detailIn {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  )
}

// ── Action button (placeholder — no SSH exec yet) ─────────────────────────────
function ActionBtn({ label, color, disabled, title }: { label: string; color: string; disabled: boolean; title: string }) {
  return (
    <button
      disabled={disabled}
      title={title}
      style={{
        background: disabled ? 'rgba(255,255,255,0.03)' : `${color}15`,
        border: `1px solid ${disabled ? 'rgba(255,255,255,0.06)' : color + '44'}`,
        borderRadius: 6,
        padding: '6px 16px',
        color: disabled ? '#374151' : color,
        fontSize: 11,
        fontFamily: 'monospace',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {label}
    </button>
  )
}
