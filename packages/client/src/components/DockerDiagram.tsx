import { useMemo } from 'react'
import { DockerContainer, DockerInfo } from '@servercity/shared'

// ── Layout constants ───────────────────────────────────────────────────────────
const CARD_W    = 164
const CARD_H    = 136
const CARD_GAP  = 18
const LABEL_W   = 90   // left column for network labels
const PAD_R     = 16
const PAD_T     = 14   // above container row
const NET_PAD   = 10   // extra space for bands above/below cards
const CONT_Y    = PAD_T + NET_PAD
const VOL_ROW_Y = CONT_Y + CARD_H + 56
const VOL_W     = 52
const VOL_H     = 36
const VOL_GAP   = 14

const NET_PALETTES = [
  { fill: 'rgba(59,130,246,0.10)',  stroke: '#3b82f6', text: '#60a5fa' },
  { fill: 'rgba(168,85,247,0.10)', stroke: '#a855f7', text: '#c084fc' },
  { fill: 'rgba(34,197,94,0.10)',  stroke: '#22c55e', text: '#4ade80' },
  { fill: 'rgba(245,158,11,0.10)', stroke: '#f59e0b', text: '#fcd34d' },
  { fill: 'rgba(236,72,153,0.10)', stroke: '#ec4899', text: '#f9a8d4' },
]

const DRIVER_PALETTE: Record<string, typeof NET_PALETTES[0]> = {
  bridge:  NET_PALETTES[0],
  overlay: NET_PALETTES[1],
  host:    { fill: 'rgba(249,250,251,0.06)', stroke: '#6b7280', text: '#9ca3af' },
  none:    { fill: 'rgba(55,65,81,0.06)',    stroke: '#374151', text: '#4b5563' },
}

function statusColor(s: DockerContainer['status']): string {
  if (s === 'running')    return '#22c55e'
  if (s === 'paused')     return '#f59e0b'
  if (s === 'dead')       return '#ef4444'
  if (s === 'restarting') return '#a855f7'
  return '#6b7280'
}

function barColor(pct: number): string {
  return pct > 80 ? '#ef4444' : pct > 60 ? '#f59e0b' : '#22c55e'
}

interface Props {
  dockerInfo: DockerInfo
  onSelectContainer: (c: DockerContainer) => void
  selectedId: string | undefined
}

export function DockerDiagram({ dockerInfo, onSelectContainer, selectedId }: Props) {
  const { containers, volumes, networks } = dockerInfo

  // Container X positions
  const contX = useMemo(
    () => containers.map((_, i) => LABEL_W + i * (CARD_W + CARD_GAP)),
    [containers],
  )

  // Diagram total width
  const diagramW = Math.max(
    300,
    LABEL_W + containers.length * CARD_W + Math.max(0, containers.length - 1) * CARD_GAP + PAD_R,
  )

  // Volumes that are mounted by at least one container
  const mountedVolumes = useMemo(
    () => volumes.filter(v => containers.some(c => c.mounts.some(m => m.name === v.name))),
    [volumes, containers],
  )
  const volX = useMemo(
    () => mountedVolumes.map((_, i) => LABEL_W + i * (VOL_W + VOL_GAP)),
    [mountedVolumes],
  )
  const volXByName = useMemo(() => {
    const m = new Map<string, number>()
    mountedVolumes.forEach((v, i) => m.set(v.name, volX[i] + VOL_W / 2))
    return m
  }, [mountedVolumes, volX])

  // Visible networks (skip "host"/"none" if they contain nothing interesting)
  const visNets = useMemo(
    () => networks.filter(n => n.containers.length > 0 && !['host', 'none'].includes(n.name)),
    [networks],
  )

  const hasVolumes = mountedVolumes.length > 0
  const diagramH = hasVolumes ? VOL_ROW_Y + VOL_H + 28 : CONT_Y + CARD_H + NET_PAD + 24

  const memPct = (c: DockerContainer) =>
    c.memoryLimitMb > 0 ? Math.min(100, (c.memoryMb / c.memoryLimitMb) * 100) : 0

  if (containers.length === 0) {
    return (
      <div style={{ color: '#4b5563', fontSize: 11, padding: '24px 16px', textAlign: 'center', fontFamily: 'monospace' }}>
        No containers found.
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto', overflowY: 'hidden', paddingBottom: 8 }}>
      <div style={{ position: 'relative', width: diagramW, height: diagramH }}>

        {/* ── SVG background: network bands + connection lines + volume lines ── */}
        <svg
          style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', overflow: 'visible' }}
          width={diagramW}
          height={diagramH}
        >
          {/* Network bands */}
          {visNets.map((net, ni) => {
            const memberIdxs = net.containers
              .map(id => containers.findIndex(c => c.id === id))
              .filter(i => i >= 0)
            if (memberIdxs.length === 0) return null
            const minI = Math.min(...memberIdxs)
            const maxI = Math.max(...memberIdxs)
            const bx  = contX[minI] - 6
            const bw  = contX[maxI] + CARD_W + 6 - bx
            const by  = CONT_Y - NET_PAD - ni * 3
            const bh  = CARD_H + NET_PAD * 2 + ni * 6
            const pal = DRIVER_PALETTE[net.driver] ?? NET_PALETTES[ni % NET_PALETTES.length]

            return (
              <g key={net.name}>
                <rect x={bx} y={by} width={bw} height={bh} rx={8}
                  fill={pal.fill} stroke={pal.stroke} strokeWidth={0.8} />

                {/* Solid lines between members in the same network */}
                {memberIdxs.slice(0, -1).map((idx, j) => {
                  const x1 = contX[idx] + CARD_W
                  const x2 = contX[memberIdxs[j + 1]]
                  const ly = CONT_Y + CARD_H / 2 + ni * 8 - 12
                  return (
                    <line key={j} x1={x1} y1={ly} x2={x2} y2={ly}
                      stroke={pal.stroke} strokeWidth={1.5} opacity={0.7} />
                  )
                })}

                {/* Network label: left of band */}
                <text x={bx - 4} y={by + bh / 2 - 5} textAnchor="end"
                  fill={pal.text} fontSize={9} fontFamily="monospace">
                  {net.name}
                </text>
                <text x={bx - 4} y={by + bh / 2 + 7} textAnchor="end"
                  fill={pal.text} fontSize={8} fontFamily="monospace" opacity={0.55}>
                  {net.driver}
                </text>
              </g>
            )
          })}

          {/* Volume dashed lines */}
          {hasVolumes && containers.map((c, i) =>
            c.mounts.map(mount => {
              const vx = volXByName.get(mount.name)
              if (vx === undefined) return null
              const cx = contX[i] + CARD_W / 2
              const midX = (cx + vx) / 2
              return (
                <g key={`${c.id}-${mount.name}`}>
                  <path
                    d={`M${cx},${CONT_Y + CARD_H} C${cx},${VOL_ROW_Y - 10} ${vx},${CONT_Y + CARD_H + 10} ${vx},${VOL_ROW_Y}`}
                    fill="none" stroke="#374151" strokeWidth={1} strokeDasharray="4 3" />
                  {/* Mount path label */}
                  <text x={midX} y={(CONT_Y + CARD_H + VOL_ROW_Y) / 2}
                    textAnchor="middle" fill="#4b5563" fontSize={8} fontFamily="monospace">
                    {mount.destination || mount.name}
                  </text>
                </g>
              )
            })
          )}
        </svg>

        {/* ── Container cards (HTML) ── */}
        {containers.map((c, i) => {
          const cpu  = c.cpuPercent
          const mem  = memPct(c)
          const sc   = statusColor(c.status)
          const sel  = selectedId === c.id
          const ports = c.ports.slice(0, 3)

          return (
            <div
              key={c.id}
              onClick={() => onSelectContainer(c)}
              style={{
                position: 'absolute',
                left: contX[i],
                top: CONT_Y,
                width: CARD_W,
                height: CARD_H,
                background: sel ? 'rgba(99,102,241,0.16)' : 'rgba(9,15,32,0.92)',
                border: `1px solid ${sel ? 'rgba(99,102,241,0.65)' : 'rgba(255,255,255,0.07)'}`,
                borderRadius: 8,
                padding: '8px 10px',
                cursor: 'pointer',
                fontFamily: 'monospace',
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
                boxShadow: sel ? '0 0 14px rgba(99,102,241,0.35)' : '0 2px 10px rgba(0,0,0,0.5)',
                transition: 'border-color 0.15s, box-shadow 0.15s',
                userSelect: 'none',
              }}
            >
              {/* Name + status dot */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ color: sc, fontSize: 7, lineHeight: 1, flexShrink: 0 }}>●</span>
                <span style={{
                  color: '#f1f5f9', fontSize: 11, fontWeight: 700,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                }}>
                  {c.name}
                </span>
              </div>

              {/* Image */}
              <div style={{ color: '#4b5563', fontSize: 9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.image}
              </div>

              {/* Status badge */}
              <div>
                <span style={{
                  background: `${sc}1a`, border: `1px solid ${sc}44`, color: sc,
                  borderRadius: 3, padding: '0 5px', fontSize: 8, letterSpacing: '0.06em',
                }}>
                  {c.status.toUpperCase()}
                </span>
              </div>

              {/* CPU bar */}
              <MiniBar label="CPU" pct={cpu} color={barColor(cpu)} />

              {/* MEM bar */}
              <MiniBar label="MEM" pct={mem} color={barColor(mem)} />

              {/* Ports */}
              {ports.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginTop: 2 }}>
                  {ports.map((p, pi) => {
                    const isCyan = true  // all exposed ports shown cyan
                    return (
                      <div key={pi} style={{ fontSize: 8, color: isCyan ? '#67e8f9' : '#9ca3af', display: 'flex', alignItems: 'center', gap: 2 }}>
                        <span style={{ color: '#374151', fontSize: 10, lineHeight: 1 }}>→</span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          :{p.host} → {p.container}/{p.protocol}
                        </span>
                      </div>
                    )
                  })}
                  {c.ports.length > 3 && (
                    <div style={{ fontSize: 8, color: '#374151' }}>+{c.ports.length - 3} more</div>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {/* ── Volume icons ── */}
        {hasVolumes && mountedVolumes.map((vol, i) => (
          <div
            key={vol.name}
            style={{ position: 'absolute', left: volX[i], top: VOL_ROW_Y, width: VOL_W, textAlign: 'center' }}
          >
            <svg width={VOL_W} height={VOL_H} style={{ overflow: 'visible', display: 'block', margin: '0 auto' }}>
              {/* Cylinder body */}
              <rect x={6} y={8} width={VOL_W - 12} height={VOL_H - 14} rx={2} fill="#0f172a" stroke="#1e3a5f" strokeWidth={1} />
              {/* Top ellipse */}
              <ellipse cx={VOL_W / 2} cy={8} rx={(VOL_W - 12) / 2} ry={5} fill="#1e3a5f" stroke="#2563eb44" strokeWidth={1} />
              {/* Stripe */}
              <rect x={6} y={14} width={VOL_W - 12} height={2} fill="#1e3a5f" opacity={0.8} />
            </svg>
            <div style={{ color: '#4b5563', fontSize: 8, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {vol.name.length > 13 ? `${vol.name.slice(0, 11)}…` : vol.name}
            </div>
          </div>
        ))}

      </div>
    </div>
  )
}

function MiniBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ color: '#374151', fontSize: 8, width: 22, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 3, background: '#1e293b', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: color, transition: 'width 0.4s', borderRadius: 2 }} />
      </div>
      <span style={{ color, fontSize: 8, width: 26, textAlign: 'right', flexShrink: 0 }}>{pct.toFixed(0)}%</span>
    </div>
  )
}
