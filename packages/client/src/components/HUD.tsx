import { useEffect, useRef, useState } from 'react'
import { useServerStore } from '../store/useServerStore'
import { useLerpedMetrics } from '../hooks/useLerpedMetrics'
import { useLastUpdated } from '../hooks/useLastUpdated'
import { useMetricHistory } from '../hooks/useMetricHistory'

interface Props {
  onDisconnect: () => void
  onReconnect: () => void
  onOpenExplorer?: () => void
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB/s`
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB/s`
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(1)} KB/s`
  return `${bytes} B/s`
}

// ── Sparkline SVG ─────────────────────────────────────────────────────────────
function Sparkline({ data, width = 52, height = 14, color }: { data: number[]; width?: number; height?: number; color: string }) {
  if (data.length < 2) return null
  const max = Math.max(...data, 1)
  const pts = data
    .map((v, i) => `${((i / (data.length - 1)) * width).toFixed(1)},${(height - (v / max) * height).toFixed(1)}`)
    .join(' ')
  return (
    <svg width={width} height={height} style={{ display: 'block', opacity: 0.65 }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

// ── OOM screen-edge vignette ──────────────────────────────────────────────────
function OOMVignette({ memPercent }: { memPercent: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const frameRef = useRef(0)
  const phaseRef = useRef(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const animate = () => {
      phaseRef.current += 0.04
      const t = Math.sin(phaseRef.current)
      if (memPercent >= 95) {
        el.style.boxShadow = `inset 0 0 120px 40px rgba(220,38,38,${0.18 + Math.abs(t) * 0.22})`
        el.style.opacity = '1'
      } else if (memPercent >= 85) {
        el.style.boxShadow = `inset 0 0 100px 30px rgba(168,85,247,${0.07 + Math.abs(t) * 0.08})`
        el.style.opacity = '1'
      } else {
        el.style.opacity = '0'
      }
      frameRef.current = requestAnimationFrame(animate)
    }
    frameRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameRef.current)
  }, [memPercent])

  return <div ref={ref} className="absolute inset-0 pointer-events-none z-20 transition-opacity duration-700" style={{ opacity: 0 }} />
}

// ── Compact metric card ───────────────────────────────────────────────────────
interface MetricCardProps {
  label: string
  value: string
  sub?: string
  percent?: number
  danger?: boolean
  warn?: boolean
  sparkData?: number[]
  sparkColor?: string
}

function MetricCard({ label, value, sub, percent, danger, warn, sparkData, sparkColor }: MetricCardProps) {
  const barColor  = danger ? '#ef4444' : warn ? '#f59e0b' : '#6366f1'
  const textColor = danger ? '#fca5a5' : warn ? '#fcd34d' : '#e2e8f0'

  return (
    <div style={{
      background: 'rgba(6,6,18,0.88)',
      border: `1px solid ${danger ? 'rgba(239,68,68,0.3)' : warn ? 'rgba(245,158,11,0.25)' : 'rgba(99,102,241,0.18)'}`,
      borderRadius: 8,
      padding: '7px 11px',
      minWidth: 88,
      backdropFilter: 'blur(8px)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
        <span style={{ color: '#6b7280', fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>
        {sparkData && sparkColor && <Sparkline data={sparkData} color={sparkColor} />}
      </div>
      <div style={{ color: textColor, fontWeight: 700, fontSize: 15, fontFamily: 'monospace', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ color: '#4b5563', fontSize: 9, marginTop: 2 }}>{sub}</div>}
      {percent !== undefined && (
        <div style={{ marginTop: 5, height: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 1, overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(100, percent)}%`, height: '100%', background: barColor, borderRadius: 1, transition: 'width 0.6s ease' }} />
        </div>
      )}
    </div>
  )
}

// ── Shortcuts overlay ─────────────────────────────────────────────────────────
function ShortcutsLegend({ onClose }: { onClose: () => void }) {
  const shortcuts = [
    { key: 'R', desc: 'Reset camera' },
    { key: 'D', desc: 'Toggle disk sidebar' },
    { key: 'P', desc: 'Toggle process panel' },
    { key: '1–5', desc: 'Select floor' },
    { key: 'Esc', desc: 'Deselect / close' },
  ]
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.65)' }} onClick={onClose}>
      <div className="bg-city-panel border border-city-border rounded-xl px-6 py-5 backdrop-blur min-w-[200px]" onClick={e => e.stopPropagation()}>
        <div className="text-white font-semibold text-sm mb-3">Keyboard Shortcuts</div>
        {shortcuts.map(({ key, desc }) => (
          <div key={key} className="flex items-center gap-3 mb-2">
            <kbd className="bg-black/60 border border-gray-600 rounded px-2 py-0.5 text-xs font-mono text-gray-200 min-w-[36px] text-center">{key}</kbd>
            <span className="text-gray-400 text-xs">{desc}</span>
          </div>
        ))}
        <button onClick={onClose} className="mt-3 text-gray-600 hover:text-gray-400 text-xs w-full text-center transition-colors">Close</button>
      </div>
    </div>
  )
}

// ── Icon button ───────────────────────────────────────────────────────────────
function IconBtn({ onClick, title, active, children }: { onClick: () => void; title: string; active?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: active ? 'rgba(99,102,241,0.2)' : 'rgba(6,6,18,0.88)',
        border: `1px solid ${active ? 'rgba(99,102,241,0.5)' : 'rgba(99,102,241,0.18)'}`,
        borderRadius: 8,
        width: 34,
        height: 34,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        color: active ? '#a5b4fc' : '#6b7280',
        fontSize: 13,
        transition: 'all 0.2s',
        backdropFilter: 'blur(8px)',
      }}
    >
      {children}
    </button>
  )
}

// ── Main HUD ─────────────────────────────────────────────────────────────────
export function HUD({ onDisconnect, onReconnect, onOpenExplorer }: Props) {
  const {
    status, hostname, metrics: rawMetrics, metricsStale, retryAttempt, retryCountdown,
    resetCamera, serverInfo, processPanelVisible, toggleProcessPanel,
  } = useServerStore()
  const metrics = useLerpedMetrics(rawMetrics)
  const secondsAgo = useLastUpdated(rawMetrics)
  const [showShortcuts, setShowShortcuts] = useState(false)

  const cpuPct = metrics?.cpu.overall ?? 0
  const memPct = metrics?.memory.usedPercent ?? 0
  const cpuHistory = useMetricHistory(cpuPct)
  const memHistory = useMetricHistory(memPct)

  const isOOM = memPct >= 95
  const isMemWarn = memPct >= 85 && !isOOM
  const isCPUWarn = cpuPct >= 90

  const statusColor = status === 'connected' ? '#4ade80' : status === 'disconnected' ? '#f87171' : '#fbbf24'

  return (
    <>
      {metrics && <OOMVignette memPercent={memPct} />}
      {showShortcuts && <ShortcutsLegend onClose={() => setShowShortcuts(false)} />}

      {/* Critical memory banner */}
      {isOOM && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 animate-pulse">
          <div className="bg-red-900/80 border border-red-500 rounded-xl px-5 py-2 text-red-300 text-xs font-bold tracking-widest uppercase backdrop-blur">
            ⚠ Critical Memory — {memPct.toFixed(0)}%
          </div>
        </div>
      )}

      {/* ── Top-left: status pill ── */}
      <div style={{
        position: 'absolute', top: 14, left: 14, zIndex: 10,
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(6,6,18,0.88)', border: '1px solid rgba(99,102,241,0.18)',
          borderRadius: 10, padding: '8px 14px', backdropFilter: 'blur(8px)',
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor, boxShadow: `0 0 6px ${statusColor}`, flexShrink: 0 }} />
          <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 13, fontFamily: 'monospace' }}>
            {hostname || 'ServerCity'}
          </span>
          {secondsAgo !== null && status === 'connected' && (
            <span style={{ fontSize: 10, color: metricsStale ? '#f87171' : secondsAgo > 4 ? '#fbbf24' : '#4b5563', fontFamily: 'monospace' }}>
              {metricsStale ? `stale·${secondsAgo}s` : `${secondsAgo}s`}
            </span>
          )}
        </div>

        {/* Server info — kernel/uptime */}
        {serverInfo && status === 'connected' && (
          <div style={{
            background: 'rgba(6,6,18,0.75)', border: '1px solid rgba(99,102,241,0.10)',
            borderRadius: 7, padding: '4px 10px', backdropFilter: 'blur(6px)',
          }}>
            <div style={{ color: '#4b5563', fontSize: 9, fontFamily: 'monospace', lineHeight: 1.7 }}>
              {serverInfo.os} {serverInfo.kernel && `· ${serverInfo.kernel}`}
              {serverInfo.uptime && <><br />{serverInfo.uptime}</>}
            </div>
          </div>
        )}
      </div>

      {/* ── Top-right: action buttons ── */}
      <div style={{ position: 'absolute', top: 14, right: 14, zIndex: 10, display: 'flex', gap: 6 }}>
        <IconBtn onClick={() => setShowShortcuts(true)} title="Keyboard shortcuts">?</IconBtn>
        {status === 'connected' && (
          <>
            <IconBtn onClick={resetCamera} title="Reset camera (R)">⟳</IconBtn>
            <IconBtn onClick={toggleProcessPanel} title="Process panel (P)" active={processPanelVisible}>⚙</IconBtn>
            {onOpenExplorer && (
              <IconBtn onClick={onOpenExplorer} title="File explorer (F)">⌕</IconBtn>
            )}
            <button
              onClick={onDisconnect}
              style={{
                background: 'rgba(6,6,18,0.88)',
                border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: 8,
                padding: '0 14px',
                height: 34,
                cursor: 'pointer',
                color: '#9ca3af',
                fontSize: 12,
                fontFamily: 'monospace',
                transition: 'all 0.2s',
                backdropFilter: 'blur(8px)',
              }}
              onMouseEnter={e => { (e.target as HTMLElement).style.color = '#fca5a5'; (e.target as HTMLElement).style.borderColor = 'rgba(239,68,68,0.5)' }}
              onMouseLeave={e => { (e.target as HTMLElement).style.color = '#9ca3af'; (e.target as HTMLElement).style.borderColor = 'rgba(239,68,68,0.25)' }}
            >
              Disconnect
            </button>
          </>
        )}
      </div>

      {/* ── Reconnecting overlay ── */}
      {status === 'reconnecting' && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 text-center">
          <div className="bg-city-panel border border-amber-500/40 rounded-xl px-8 py-6 backdrop-blur min-w-[260px]">
            <div className="text-amber-400 font-semibold mb-1">Connection Lost</div>
            <div className="text-gray-400 text-sm mb-3">
              Retrying in <span className="text-white font-bold">{retryCountdown}s</span>
              <span className="text-gray-500 ml-2">(attempt {retryAttempt}/3)</span>
            </div>
            <div className="h-1 rounded-full bg-white/10 mb-4 overflow-hidden">
              <div className="h-full bg-amber-400 rounded-full transition-all duration-1000" style={{ width: `${((3 - retryCountdown) / 3) * 100}%` }} />
            </div>
            <button onClick={onDisconnect} className="text-gray-500 hover:text-gray-300 text-xs transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {/* ── Disconnected overlay ── */}
      {status === 'disconnected' && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 text-center">
          <div className="bg-city-panel border border-city-border rounded-xl px-8 py-6 backdrop-blur min-w-[260px]">
            <div className="text-red-400 font-semibold mb-1">Disconnected</div>
            <div className="text-gray-400 text-sm mb-4">
              {retryAttempt > 0 ? `Auto-retry failed after ${retryAttempt} attempt${retryAttempt > 1 ? 's' : ''}.` : 'The server disconnected.'}
            </div>
            <div className="flex gap-2 justify-center">
              <button onClick={onReconnect} className="bg-city-accent hover:bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors">Reconnect</button>
              <button onClick={onDisconnect} className="bg-transparent border border-gray-700 hover:border-gray-500 text-gray-400 hover:text-white rounded-lg px-4 py-2 text-sm transition-colors">Back</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bottom metric bar ── */}
      {metrics && (
        <div style={{
          position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)',
          zIndex: 10, display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', padding: '0 8px',
        }}>
          <MetricCard
            label="CPU"
            value={`${cpuPct.toFixed(1)}%`}
            percent={cpuPct}
            warn={isCPUWarn}
            sparkData={cpuHistory}
            sparkColor={isCPUWarn ? '#f87171' : '#818cf8'}
          />
          <MetricCard
            label="Memory"
            value={`${memPct.toFixed(1)}%`}
            sub={`${metrics.memory.usedMb}/${metrics.memory.totalMb} MB`}
            percent={memPct}
            danger={isOOM}
            warn={isMemWarn}
            sparkData={memHistory}
            sparkColor={isOOM ? '#f87171' : isMemWarn ? '#c084fc' : '#60a5fa'}
          />
          {metrics.swap && metrics.swap.totalMb > 0 && (
            <MetricCard
              label="Swap"
              value={`${metrics.swap.usedMb} MB`}
              sub={`of ${metrics.swap.totalMb} MB`}
              percent={(metrics.swap.usedMb / metrics.swap.totalMb) * 100}
              warn={(metrics.swap.usedMb / metrics.swap.totalMb) > 0.5}
              danger={(metrics.swap.usedMb / metrics.swap.totalMb) > 0.85}
            />
          )}
          {metrics.disk.slice(0, 2).map(d => (
            <MetricCard
              key={d.mount}
              label={`Disk ${d.mount}`}
              value={`${d.usedPercent}%`}
              sub={`${d.usedGb.toFixed(1)}/${d.totalGb.toFixed(1)} GB`}
              percent={d.usedPercent}
              danger={d.usedPercent > 90}
              warn={d.usedPercent > 70}
            />
          ))}
          <MetricCard label="↓ In" value={formatBytes(metrics.network.bytesIn)} />
          <MetricCard label="↑ Out" value={formatBytes(metrics.network.bytesOut)} />
        </div>
      )}
    </>
  )
}
