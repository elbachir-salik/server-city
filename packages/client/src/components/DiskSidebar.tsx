import { useServerStore } from '../store/useServerStore'

function diskColor(pct: number): string {
  if (pct > 90) return '#ef4444'
  if (pct > 70) return '#f59e0b'
  return '#22c55e'
}

interface DiskSidebarProps {
  readonly onRequestSubdirs: (mount: string) => void
}

export function DiskSidebar({ onRequestSubdirs: _onRequestSubdirs }: DiskSidebarProps) {
  const metrics        = useServerStore(s => s.metrics)
  const subdirsByMount = useServerStore(s => s.subdirsByMount)
  const selectedFloor  = useServerStore(s => s.selectedFloor)
  const setSelectedFloor = useServerStore(s => s.setSelectedFloor)

  if (!metrics || metrics.disk.length === 0) return null

  // Build one flat sorted list of all subdirs from every disk mount.
  // usedPercent is relative to the parent disk's total size.
  const items = metrics.disk
    .flatMap(disk =>
      (subdirsByMount[disk.mount] ?? []).map(sub => ({
        path: sub.path,
        usedGb: sub.usedGb,
        totalGb: disk.totalGb,
        usedPercent: Math.min(100, Math.round((sub.usedGb / disk.totalGb) * 100)),
        parentMount: disk.mount,
      }))
    )
    .sort((a, b) => b.usedGb - a.usedGb)
    .slice(0, 5)   // top 5 → FLOORS

  // While subdirs are loading, fall back to raw disk mounts
  const loading = items.length === 0
  const displayItems = loading
    ? metrics.disk.slice(0, 5).map(d => ({
        path: d.mount,
        usedGb: d.usedGb,
        totalGb: d.totalGb,
        usedPercent: d.usedPercent,
        parentMount: d.mount,
      }))
    : items

  return (
    <div
      style={{
        position: 'absolute',
        left: 16,
        top: '50%',
        transform: 'translateY(-50%)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        zIndex: 10,
        pointerEvents: 'all',
      }}
    >
      {displayItems.map((item, i) => {
        const selected = selectedFloor === i
        const color    = diskColor(item.usedPercent)
        const freeGb   = item.totalGb - item.usedGb
        const name     = item.path === '/' ? '/' : item.path.split('/').pop() || item.path

        return (
          <button
            key={item.path}
            onClick={() => setSelectedFloor(selected ? null : i)}
            style={{
              background: selected ? 'rgba(58,58,110,0.92)' : 'rgba(8,8,18,0.78)',
              border: `1px solid ${selected ? color : color + '33'}`,
              borderRadius: 8,
              padding: '8px 12px',
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: 'monospace',
              color,
              minWidth: 164,
              transition: 'background 0.25s, border-color 0.25s, box-shadow 0.25s',
              boxShadow: selected ? `0 0 14px ${color}44` : 'none',
              outline: 'none',
            }}
          >
            {/* Floor label */}
            <div style={{ fontSize: 9, opacity: 0.5, letterSpacing: '0.08em', marginBottom: 2 }}>
              FLOOR {i + 1} {loading ? '· loading…' : ''}
            </div>

            {/* Directory name */}
            <div
              style={{
                fontWeight: 700,
                fontSize: 14,
                marginBottom: 5,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: 140,
              }}
            >
              /{name === '/' ? '' : name}
            </div>

            {/* Usage bar */}
            <div style={{ height: 4, background: '#1a1a3a', borderRadius: 2, marginBottom: 5, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${item.usedPercent}%`,
                  height: '100%',
                  background: color,
                  transition: 'width 0.6s ease',
                  borderRadius: 2,
                }}
              />
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
              <span style={{ fontWeight: 600 }}>{item.usedPercent}% used</span>
              <span style={{ color: '#6b7280' }}>
                {item.usedGb >= 1 ? `${item.usedGb.toFixed(1)} GB` : `${(item.usedGb * 1024).toFixed(0)} MB`}
              </span>
            </div>
            <div style={{ fontSize: 9, opacity: 0.45, marginTop: 2 }}>
              {freeGb.toFixed(1)} GB free of {item.totalGb.toFixed(1)} GB
            </div>
          </button>
        )
      })}
    </div>
  )
}
