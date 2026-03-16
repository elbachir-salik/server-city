import { useEffect, useRef } from 'react'
import { useServerStore } from '../store/useServerStore'
import { useLerpedMetrics } from '../hooks/useLerpedMetrics'

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
        // Full alarm: fast bright pulse
        const alpha = 0.18 + Math.abs(t) * 0.22
        el.style.boxShadow = `inset 0 0 120px 40px rgba(220,38,38,${alpha})`
        el.style.opacity = '1'
      } else if (memPercent >= 85) {
        // Warning: slow dim pulse
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
}

function MetricCard({ label, value, sub, percent, danger, warn }: MetricCardProps) {
  const barColor = danger ? 'bg-red-500' : warn ? 'bg-amber-400' : 'bg-indigo-400'
  const borderColor = danger ? 'border-red-500/50' : warn ? 'border-amber-400/40' : 'border-city-border'
  const valueColor = danger ? 'text-red-400' : warn ? 'text-amber-400' : 'text-white'

  return (
    <div className={`bg-black/50 border ${borderColor} rounded-lg px-3 py-2 min-w-[105px]`}>
      <div className="text-gray-400 text-xs mb-0.5">{label}</div>
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

// ── Main HUD ─────────────────────────────────────────────────────────────────
export function HUD({ onDisconnect, onReconnect }: Props) {
  const { status, hostname, metrics: rawMetrics, metricsStale, retryAttempt, retryCountdown } = useServerStore()
  const metrics = useLerpedMetrics(rawMetrics)

  const statusColor =
    status === 'connected'
      ? 'bg-green-400'
      : status === 'disconnected'
        ? 'bg-red-400'
        : 'bg-yellow-400'

  const memPct = metrics?.memory.usedPercent ?? 0
  const cpuPct = metrics?.cpu.overall ?? 0
  const isOOM = memPct >= 95
  const isMemWarn = memPct >= 85 && !isOOM
  const isCPUWarn = cpuPct >= 90

  return (
    <>
      {/* OOM screen-edge vignette */}
      {metrics && <OOMVignette memPercent={memPct} />}

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
        {metricsStale && (
          <span className="text-yellow-400 text-xs ml-2 animate-pulse">[stale]</span>
        )}
      </div>

      {/* Top-right: disconnect */}
      {status === 'connected' && (
        <div className="absolute top-4 right-4 z-10">
          <button
            onClick={onDisconnect}
            className="bg-city-panel border border-city-border rounded-xl px-4 py-2 text-gray-400 hover:text-white hover:border-red-500/50 text-sm transition-colors backdrop-blur"
          >
            Disconnect
          </button>
        </div>
      )}

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
          />
          <MetricCard
            label="Memory"
            value={`${memPct.toFixed(1)}%`}
            sub={`${metrics.memory.usedMb} / ${metrics.memory.totalMb} MB`}
            percent={memPct}
            danger={isOOM}
            warn={isMemWarn}
          />
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
