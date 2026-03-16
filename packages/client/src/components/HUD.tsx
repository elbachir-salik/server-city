import { useServerStore } from '../store/useServerStore'

interface Props {
  onDisconnect: () => void
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-black/50 border border-city-border rounded-lg px-3 py-2 min-w-[100px]">
      <div className="text-gray-400 text-xs mb-0.5">{label}</div>
      <div className="text-white font-bold text-sm">{value}</div>
      {sub && <div className="text-gray-500 text-xs">{sub}</div>}
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB/s`
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB/s`
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(1)} KB/s`
  return `${bytes} B/s`
}

export function HUD({ onDisconnect }: Props) {
  const { status, hostname, metrics, metricsStale } = useServerStore()

  const statusColor =
    status === 'connected' ? 'bg-green-400' : status === 'disconnected' ? 'bg-red-400' : 'bg-yellow-400'

  return (
    <>
      {/* Top-left: hostname + status */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-city-panel border border-city-border rounded-xl px-4 py-2.5 backdrop-blur">
        <span className={`w-2 h-2 rounded-full ${statusColor} animate-pulse`} />
        <span className="text-white font-semibold text-sm">{hostname || 'ServerCity'}</span>
        {metricsStale && (
          <span className="text-yellow-400 text-xs ml-2">[stale]</span>
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

      {/* Reconnect button when disconnected mid-session */}
      {status === 'disconnected' && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 text-center">
          <div className="bg-city-panel border border-city-border rounded-xl px-8 py-6 backdrop-blur">
            <div className="text-red-400 font-semibold mb-1">Connection Lost</div>
            <div className="text-gray-400 text-sm mb-4">The server disconnected unexpectedly.</div>
            <button
              onClick={onDisconnect}
              className="bg-city-accent hover:bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            >
              Back to Connect
            </button>
          </div>
        </div>
      )}

      {/* Bottom: metric cards */}
      {metrics && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex gap-2 flex-wrap justify-center px-4">
          <MetricCard
            label="CPU"
            value={`${metrics.cpu.overall.toFixed(1)}%`}
          />
          <MetricCard
            label="Memory"
            value={`${metrics.memory.usedPercent.toFixed(1)}%`}
            sub={`${metrics.memory.usedMb} / ${metrics.memory.totalMb} MB`}
          />
          {metrics.disk.slice(0, 2).map((d) => (
            <MetricCard
              key={d.mount}
              label={`Disk ${d.mount}`}
              value={`${d.usedPercent}%`}
              sub={`${d.usedGb.toFixed(1)} / ${d.totalGb.toFixed(1)} GB`}
            />
          ))}
          <MetricCard
            label="Net In"
            value={formatBytes(metrics.network.bytesIn)}
          />
          <MetricCard
            label="Net Out"
            value={formatBytes(metrics.network.bytesOut)}
          />
        </div>
      )}
    </>
  )
}
