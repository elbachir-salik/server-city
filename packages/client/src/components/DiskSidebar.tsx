import { useServerStore } from '../store/useServerStore'

function diskColor(pct: number): string {
  if (pct > 90) return '#ef4444'
  if (pct > 70) return '#f59e0b'
  return '#22c55e'
}

interface DiskSidebarProps {
  readonly onRequestSubdirs: (mount: string) => void
}

export function DiskSidebar({ onRequestSubdirs }: DiskSidebarProps) {
  const metrics      = useServerStore(s => s.metrics)
  const selectedFloor = useServerStore(s => s.selectedFloor)
  const setSelectedFloor = useServerStore(s => s.setSelectedFloor)

  if (!metrics || metrics.disk.length === 0) return null

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
      {metrics.disk.map((d, i) => {
        const selected = selectedFloor === i
        const color    = diskColor(d.usedPercent)
        const freeGb   = d.totalGb - d.usedGb

        return (
          <button
            key={d.mount}
            onClick={() => {
              const next = selected ? null : i
              setSelectedFloor(next)
              if (next !== null) onRequestSubdirs(d.mount)
            }}
            style={{
              background: selected ? 'rgba(58,58,110,0.92)' : 'rgba(8,8,18,0.78)',
              border: `1px solid ${selected ? color : color + '33'}`,
              borderRadius: 8,
              padding: '8px 12px',
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: 'monospace',
              color: color,
              minWidth: 158,
              transition: 'background 0.25s, border-color 0.25s, box-shadow 0.25s',
              boxShadow: selected ? `0 0 14px ${color}44` : 'none',
              outline: 'none',
            }}
          >
            {/* Floor label */}
            <div
              style={{
                fontSize: 9,
                opacity: 0.55,
                letterSpacing: '0.08em',
                marginBottom: 2,
              }}
            >
              FLOOR {i + 1}
            </div>

            {/* Mount point */}
            <div
              style={{
                fontWeight: 700,
                fontSize: 13,
                marginBottom: 6,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: 134,
              }}
            >
              {d.mount}
            </div>

            {/* Usage bar */}
            <div
              style={{
                height: 4,
                background: '#1a1a3a',
                borderRadius: 2,
                marginBottom: 5,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${d.usedPercent}%`,
                  height: '100%',
                  background: color,
                  transition: 'width 0.6s ease',
                  borderRadius: 2,
                }}
              />
            </div>

            {/* Stats row */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 10,
              }}
            >
              <span style={{ fontWeight: 600 }}>{d.usedPercent}% full</span>
              <span style={{ color: '#6b7280' }}>{freeGb.toFixed(1)} GB free</span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
