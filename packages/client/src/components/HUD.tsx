import { useEffect, useRef, useState } from 'react'
import { useServerStore } from '../store/useServerStore'
import { useLerpedMetrics } from '../hooks/useLerpedMetrics'
import { useLastUpdated } from '../hooks/useLastUpdated'
import { useMetricHistory } from '../hooks/useMetricHistory'

interface Props {
  onDisconnect: () => void
  onReconnect: () => void
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB/s`
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB/s`
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(1)} KB/s`
  return `${bytes} B/s`
}

// ── Sparkline SVG polyline ────────────────────────────────────────────────────
function Sparkline({ data, width = 60, height = 16, color }: { data: number[]; width?: number; height?: number; color: string }) {
  if (data.length < 2) return null
  const max = Math.max(...data, 1)
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width
      const y = height - (v / max) * height
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg width={width} height={height} style={{ display: 'block', opacity: 0.7 }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

// ── Pulsing vignette that appears at memory danger thresholds ────────────────
function OOMVignette({ memPercent }: { memPercent: number }) {
  const vignetteRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<number>(0)
  const phaseRef = useRef(0)

  useEffect(() => {
    const el = vignetteRef.current
    if (!el) return

    const animate = () => {
      phaseRef.current += 0.04
      const t = Math.sin(phaseRef.current)

      if (memPercent >= 95) {
        const alpha = 0.18 + Math.abs(t) * 0.22
        el.style.boxShadow = `inset 0 0 120px 40px rgba(220,38,38,${alpha})`
        el.style.opacity = '1'
      } else if (memPercent >= 85) {
        const alpha = 0.06 + Math.abs(t) * 0.08
        el.style.boxShadow = `inset 0 0 100px 30px rgba(251,146,60,${alpha})`
        el.style.opacity = '1'
      } else {
        el.style.opacity = '0'
      }

      frameRef.current = requestAnimationFrame(animate)
    }

    frameRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameRef.current)
  }, [memPercent])

  return (
    <div
      ref={vignetteRef}
      className="absolute inset-0 pointer-events-none z-20 transition-opacity duration-700"
      style={{ opacity: 0 }}
    />
  )
}

// ── Single metric card ───────────────────────────────────────────────────────
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
  const barColor = danger ? 'bg-red-500' : warn ? 'bg-amber-400' : 'bg-indigo-400'
  const borderColor = danger ? 'border-red-500/50' : warn ? 'border-amber-400/40' : 'border-city-border'
  const valueColor = danger ? 'text-red-400' : warn ? 'text-amber-400' : 'text-white'

  return (
    <div className={`bg-black/50 border ${borderColor} rounded-lg px-3 py-2 min-w-[105px]`}>
      <div className="flex items-center justify-between mb-0.5">
        <div className="text-gray-400 text-xs">{label}</div>
        {sparkData && sparkColor && <Sparkline data={sparkData} color={sparkColor} />}
      </div>
      <div className={`font-bold text-sm ${valueColor}`}>{value}</div>
      {sub && <div className="text-gray-500 text-xs">{sub}</div>}
      {percent !== undefined && (
        <div className="mt-1.5 h-1 rounded-full bg-white/10 overflow-hidden">
          <div
            className={`h-full rounded-full ${barColor} transition-all duration-700`}
            style={{ width: `${Math.min(100, percent)}%` }}
          />
        </div>
      )}
    </div>
  )
}

// ── Shortcuts legend overlay ──────────────────────────────────────────────────
function ShortcutsLegend({ onClose }: { onClose: () => void }) {
  const shortcuts = [
    { key: 'R', desc: 'Reset camera view' },
    { key: 'D', desc: 'Toggle disk sidebar' },
    { key: '1–5', desc: 'Select floor' },
    { key: 'Esc', desc: 'Deselect floor' },
  ]

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="bg-city-panel border border-city-border rounded-xl px-6 py-5 backdrop-blur min-w-[220px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-white font-semibold text-sm mb-3">Keyboard Shortcuts</div>
        {shortcuts.map(({ key, desc }) => (
          <div key={key} className="flex items-center gap-3 mb-2">
            <kbd className="bg-black/60 border border-gray-600 rounded px-2 py-0.5 text-xs font-mono text-gray-200 min-w-[36px] text-center">
              {key}
            </kbd>
            <span className="text-gray-400 text-xs">{desc}</span>
          </div>
        ))}
        <button
          onClick={onClose}
          className="mt-3 text-gray-600 hover:text-gray-400 text-xs w-full text-center transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  )
}

// ── Main HUD ─────────────────────────────────────────────────────────────────
export function HUD({ onDisconnect, onReconnect }: Props) {
  const { status, hostname, metrics: rawMetrics, metricsStale, retryAttempt, retryCountdown, resetCamera } = useServerStore()
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

  const statusColor =
    status === 'connected'
      ? 'bg-green-400'
      : status === 'disconnected'
        ? 'bg-red-400'
        : 'bg-yellow-400'

  return (
    <>
      {/* OOM screen-edge vignette */}
      {metrics && <OOMVignette memPercent={memPct} />}

      {/* Shortcuts overlay */}
      {showShortcuts && <ShortcutsLegend onClose={() => setShowShortcuts(false)} />}

      {/* Critical memory banner */}
      {isOOM && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 animate-pulse">
          <div className="bg-red-900/80 border border-red-500 rounded-xl px-5 py-2 text-red-300 text-xs font-bold tracking-widest uppercase backdrop-blur">
            ⚠ Critical Memory — {memPct.toFixed(0)}%
          </div>
        </div>
      )}

      {/* Top-left: hostname + status */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-city-panel border border-city-border rounded-xl px-4 py-2.5 backdrop-blur">
        <span className={`w-2 h-2 rounded-full ${statusColor} animate-pulse`} />
        <span className="text-white font-semibold text-sm">{hostname || 'ServerCity'}</span>
        {secondsAgo !== null && status === 'connected' && (
          <span className={`text-xs ml-2 tabular-nums ${metricsStale ? 'text-red-400 animate-pulse' : secondsAgo > 4 ? 'text-yellow-400' : 'text-gray-500'}`}>
            {metricsStale ? `stale · ${secondsAgo}s ago` : `${secondsAgo}s ago`}
          </span>
        )}
      </div>

      {/* Top-right: controls */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        {/* Shortcuts help */}
        <button
          onClick={() => setShowShortcuts(true)}
          title="Keyboard shortcuts"
          className="bg-city-panel border border-city-border rounded-xl w-9 h-9 flex items-center justify-center text-gray-400 hover:text-white hover:border-gray-500 text-sm transition-colors backdrop-blur"
        >
          ?
        </button>

        {/* Camera reset — only when connected */}
        {status === 'connected' && (
          <button
            onClick={resetCamera}
            title="Reset camera view (R)"
            className="bg-city-panel border border-city-border rounded-xl px-3 py-2 text-gray-400 hover:text-white hover:border-indigo-500/50 text-sm transition-colors backdrop-blur"
          >
            ⟳
          </button>
        )}

        {/* Disconnect */}
        {status === 'connected' && (
          <button
            onClick={onDisconnect}
            className="bg-city-panel border border-city-border rounded-xl px-4 py-2 text-gray-400 hover:text-white hover:border-red-500/50 text-sm transition-colors backdrop-blur"
          >
            Disconnect
          </button>
        )}
      </div>

      {/* Auto-retry countdown banner */}
      {status === 'reconnecting' && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 text-center">
          <div className="bg-city-panel border border-amber-500/40 rounded-xl px-8 py-6 backdrop-blur min-w-[260px]">
            <div className="text-amber-400 font-semibold mb-1">Connection Lost</div>
            <div className="text-gray-400 text-sm mb-3">
              Retrying in <span className="text-white font-bold">{retryCountdown}s</span>
              <span className="text-gray-500 ml-2">(attempt {retryAttempt}/3)</span>
            </div>
            <div className="h-1 rounded-full bg-white/10 mb-4 overflow-hidden">
              <div
                className="h-full bg-amber-400 rounded-full transition-all duration-1000"
                style={{ width: `${((3 - retryCountdown) / 3) * 100}%` }}
              />
            </div>
            <button
              onClick={onDisconnect}
              className="text-gray-500 hover:text-gray-300 text-xs transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Manual reconnect overlay (after retries exhausted or server-side disconnect) */}
      {status === 'disconnected' && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 text-center">
          <div className="bg-city-panel border border-city-border rounded-xl px-8 py-6 backdrop-blur min-w-[260px]">
            <div className="text-red-400 font-semibold mb-1">Disconnected</div>
            <div className="text-gray-400 text-sm mb-4">
              {retryAttempt > 0
                ? `Auto-retry failed after ${retryAttempt} attempt${retryAttempt > 1 ? 's' : ''}.`
                : 'The server disconnected.'}
            </div>
            <div className="flex gap-2 justify-center">
              <button
                onClick={onReconnect}
                className="bg-city-accent hover:bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              >
                Reconnect
              </button>
              <button
                onClick={onDisconnect}
                className="bg-transparent border border-gray-700 hover:border-gray-500 text-gray-400 hover:text-white rounded-lg px-4 py-2 text-sm transition-colors"
              >
                Back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom metric cards */}
      {metrics && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex gap-2 flex-wrap justify-center px-4">
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
            sub={`${metrics.memory.usedMb} / ${metrics.memory.totalMb} MB`}
            percent={memPct}
            danger={isOOM}
            warn={isMemWarn}
            sparkData={memHistory}
            sparkColor={isOOM ? '#f87171' : isMemWarn ? '#fb923c' : '#60a5fa'}
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
          {metrics.disk.slice(0, 2).map((d) => (
            <MetricCard
              key={d.mount}
              label={`Disk ${d.mount}`}
              value={`${d.usedPercent}%`}
              sub={`${d.usedGb.toFixed(1)} / ${d.totalGb.toFixed(1)} GB`}
              percent={d.usedPercent}
              danger={d.usedPercent > 90}
              warn={d.usedPercent > 70}
            />
          ))}
          <MetricCard label="Net In" value={formatBytes(metrics.network.bytesIn)} />
          <MetricCard label="Net Out" value={formatBytes(metrics.network.bytesOut)} />
        </div>
      )}
    </>
  )
}
