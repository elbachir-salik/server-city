import { useState, useMemo } from 'react'
import { DockerInfo, DockerContainer, DockerVolume, DockerNetwork } from '@servercity/shared'

// ── Pixel font style ──────────────────────────────────────────────────────────
const PX: React.CSSProperties = { fontFamily: '"Press Start 2P", monospace' }

// ── Status colors ─────────────────────────────────────────────────────────────
const STATUS_FLOOR: Record<DockerContainer['status'], string> = {
  running:    '#0f2a0f',
  paused:     '#2a2a0f',
  exited:     '#1a1a1a',
  dead:       '#2a0f0f',
  created:    '#0f1a2a',
  restarting: '#1a0f2a',
}
const STATUS_GLOW: Record<DockerContainer['status'], string> = {
  running:    '#22c55e',
  paused:     '#f59e0b',
  exited:     '#4b5563',
  dead:       '#ef4444',
  created:    '#3b82f6',
  restarting: '#a855f7',
}
const STATUS_LABEL: Record<DockerContainer['status'], string> = {
  running:    'RUN',
  paused:     'PAU',
  exited:     'EXI',
  dead:       'DED',
  created:    'NEW',
  restarting: 'RST',
}

// ── Network zone colors (cycle) ───────────────────────────────────────────────
const NET_COLORS = [
  '#3b82f6', '#8b5cf6', '#06b6d4', '#ec4899', '#f59e0b', '#10b981', '#f97316',
]

// ── Pixel art icons (16x16 SVG drawn with colored rects) ─────────────────────
function PixelIcon({ type }: { type: string }) {
  const img = useMemo(() => {
    const t = type.toLowerCase()
    if (/nginx|apache|caddy|traefik|haproxy/.test(t)) return 'webserver'
    if (/postgres|mysql|mariadb|mongo|sqlite|cassandra/.test(t)) return 'database'
    if (/redis|memcache|valkey/.test(t)) return 'memory'
    if (/node|python|php|java|ruby|go|rust|dotnet/.test(t)) return 'code'
    return 'unknown'
  }, [type])

  const size = 24
  const px = size / 8  // pixel size for 8x8 grid

  if (img === 'webserver') {
    // simple rack: 3 rows of blinking lights
    return (
      <svg width={size} height={size} viewBox="0 0 8 8">
        <rect x="1" y="1" width="6" height="2" fill="#1e3a5f" />
        <rect x="1" y="4" width="6" height="2" fill="#1e3a5f" />
        <rect x="5" y="1.5" width="1" height="1" fill="#60a5fa" />
        <rect x="5" y="4.5" width="1" height="1" fill="#22c55e" />
        <rect x="1" y="7" width="6" height="1" fill="#374151" />
        {px > 0 && null}
      </svg>
    )
  }
  if (img === 'database') {
    // cylinder side view
    return (
      <svg width={size} height={size} viewBox="0 0 8 8">
        <ellipse cx="4" cy="2" rx="3" ry="1" fill="#7c3aed" />
        <rect x="1" y="2" width="6" height="4" fill="#4c1d95" />
        <ellipse cx="4" cy="6" rx="3" ry="1" fill="#7c3aed" />
        <line x1="1" y1="3.5" x2="7" y2="3.5" stroke="#6d28d9" strokeWidth="0.5" />
      </svg>
    )
  }
  if (img === 'memory') {
    // chip grid
    return (
      <svg width={size} height={size} viewBox="0 0 8 8">
        <rect x="2" y="2" width="4" height="4" fill="#1a3a1a" stroke="#22c55e" strokeWidth="0.5" />
        <rect x="3" y="3" width="2" height="2" fill="#22c55e" opacity="0.6" />
        <rect x="0" y="3" width="2" height="0.5" fill="#22c55e" />
        <rect x="6" y="3" width="2" height="0.5" fill="#22c55e" />
        <rect x="3" y="0" width="0.5" height="2" fill="#22c55e" />
        <rect x="4.5" y="0" width="0.5" height="2" fill="#22c55e" />
        <rect x="3" y="6" width="0.5" height="2" fill="#22c55e" />
        <rect x="4.5" y="6" width="0.5" height="2" fill="#22c55e" />
      </svg>
    )
  }
  if (img === 'code') {
    // monitor
    return (
      <svg width={size} height={size} viewBox="0 0 8 8">
        <rect x="1" y="1" width="6" height="4" fill="#1e1e2e" stroke="#6366f1" strokeWidth="0.5" />
        <rect x="2" y="2" width="1" height="0.5" fill="#22c55e" />
        <rect x="4" y="2" width="1.5" height="0.5" fill="#60a5fa" />
        <rect x="2" y="3" width="2" height="0.5" fill="#f59e0b" />
        <rect x="3" y="6" width="2" height="0.5" fill="#374151" />
        <rect x="2" y="6.5" width="4" height="0.5" fill="#374151" />
      </svg>
    )
  }
  // unknown: question mark
  return (
    <svg width={size} height={size} viewBox="0 0 8 8">
      <rect x="2" y="1" width="4" height="1" fill="#4b5563" />
      <rect x="5" y="2" width="1" height="2" fill="#4b5563" />
      <rect x="3" y="4" width="2" height="1" fill="#4b5563" />
      <rect x="3" y="6" width="2" height="1" fill="#4b5563" />
    </svg>
  )
}

// ── Mini bar ─────────────────────────────────────────────────────────────────
function MiniBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min(100, (value / Math.max(max, 1)) * 100)
  return (
    <div style={{ height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 1, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 1 }} />
    </div>
  )
}

// ── Pixel Room (container card) ───────────────────────────────────────────────
function PixelRoom({
  container,
  selected,
  onClick,
}: {
  container: DockerContainer
  selected: boolean
  onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const glow   = STATUS_GLOW[container.status]
  const floor  = STATUS_FLOOR[container.status]
  const active = selected || hovered

  const shortName = container.name.replace(/^\//, '').slice(0, 14)
  const shortImage = container.image.replace(/^.*\//, '').slice(0, 18)

  const cpuColor = container.cpuPercent > 80 ? '#ef4444' : container.cpuPercent > 50 ? '#f59e0b' : '#22c55e'
  const memPct   = container.memoryLimitMb > 0 ? (container.memoryMb / container.memoryLimitMb) * 100 : 0
  const memColor = memPct > 80 ? '#ef4444' : memPct > 60 ? '#f59e0b' : '#60a5fa'

  const hasVolumes = container.mounts.length > 0

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 160,
        height: 148,
        background: floor,
        border: `2px solid ${active ? glow : glow + '55'}`,
        borderRadius: 2,
        cursor: 'pointer',
        position: 'relative',
        flexShrink: 0,
        transition: 'border-color 0.15s, box-shadow 0.15s',
        boxShadow: active
          ? `0 0 12px ${glow}55, inset 0 0 8px ${glow}11`
          : `0 0 4px ${glow}22`,
        padding: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        imageRendering: 'pixelated',
      }}
    >
      {/* Top: icon + name */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 5 }}>
        <div style={{ flexShrink: 0, marginTop: 2 }}>
          <PixelIcon type={container.image} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            ...PX,
            fontSize: 6,
            color: '#e2e8f0',
            lineHeight: 1.4,
            wordBreak: 'break-all',
            maxHeight: 28,
            overflow: 'hidden',
          }}>
            {shortName}
          </div>
          <div style={{ fontSize: 9, color: '#4b5563', marginTop: 2, wordBreak: 'break-all' }}>
            {shortImage}
          </div>
        </div>
      </div>

      {/* Status badge */}
      <div style={{
        ...PX,
        fontSize: 6,
        color: glow,
        background: `${glow}1a`,
        border: `1px solid ${glow}44`,
        borderRadius: 1,
        padding: '1px 4px',
        alignSelf: 'flex-start',
      }}>
        {STATUS_LABEL[container.status]}
      </div>

      {/* Port pills */}
      {container.ports.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          {container.ports.slice(0, 3).map((p, i) => (
            <span key={i} style={{
              fontSize: 8,
              color: '#38bdf8',
              background: 'rgba(56,189,248,0.1)',
              border: '1px solid rgba(56,189,248,0.25)',
              borderRadius: 1,
              padding: '0 3px',
            }}>
              :{p.host}
            </span>
          ))}
          {container.ports.length > 3 && (
            <span style={{ fontSize: 8, color: '#4b5563' }}>+{container.ports.length - 3}</span>
          )}
        </div>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Volume icon bottom-right */}
      {hasVolumes && (
        <div style={{
          position: 'absolute', bottom: 6, right: 6,
          fontSize: 10, opacity: 0.45,
          filter: `drop-shadow(0 0 3px ${glow})`,
        }} title={`${container.mounts.length} volume(s)`}>
          ⊟
        </div>
      )}

      {/* CPU + Mem bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 7, color: '#374151', width: 22 }}>CPU</span>
          <div style={{ flex: 1 }}>
            <MiniBar value={container.cpuPercent} color={cpuColor} />
          </div>
          <span style={{ fontSize: 7, color: cpuColor, width: 28, textAlign: 'right' }}>
            {container.cpuPercent.toFixed(0)}%
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 7, color: '#374151', width: 22 }}>MEM</span>
          <div style={{ flex: 1 }}>
            <MiniBar value={memPct} color={memColor} />
          </div>
          <span style={{ fontSize: 7, color: memColor, width: 28, textAlign: 'right' }}>
            {container.memoryMb.toFixed(0)}m
          </span>
        </div>
      </div>

      {/* Wall texture: pixel dots on walls */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        pointerEvents: 'none',
        backgroundImage: `radial-gradient(circle, ${glow}08 1px, transparent 1px)`,
        backgroundSize: '12px 12px',
        borderRadius: 2,
        opacity: active ? 0.8 : 0.3,
      }} />
    </div>
  )
}

// ── Volume Closet ─────────────────────────────────────────────────────────────
function VolumeCloset({ volume }: { volume: DockerVolume }) {
  const [hovered, setHovered] = useState(false)
  const shortName = volume.name.slice(0, 18)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={`${volume.name} · ${volume.driver}`}
      style={{
        width: 88,
        height: 64,
        background: '#0f0a1a',
        border: `2px solid ${hovered ? '#7c3aed' : '#3b1a6a'}`,
        borderRadius: 2,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        cursor: 'default',
        boxShadow: hovered ? '0 0 8px #7c3aed44' : 'none',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        flexShrink: 0,
      }}
    >
      {/* Cylinder SVG */}
      <svg width={28} height={28} viewBox="0 0 14 14">
        <ellipse cx="7" cy="3" rx="5" ry="1.5" fill="#4c1d95" />
        <rect x="2" y="3" width="10" height="7" fill="#2e1065" />
        <ellipse cx="7" cy="10" rx="5" ry="1.5" fill="#4c1d95" />
        <line x1="2" y1="5.5" x2="12" y2="5.5" stroke="#6d28d9" strokeWidth="0.4" />
        <line x1="2" y1="7.5" x2="12" y2="7.5" stroke="#6d28d9" strokeWidth="0.4" />
      </svg>
      <div style={{ ...PX, fontSize: 5, color: '#7c3aed', textAlign: 'center', wordBreak: 'break-all', maxWidth: 76 }}>
        {shortName}
      </div>
    </div>
  )
}

// ── Network Zone ──────────────────────────────────────────────────────────────
function NetworkZone({
  network,
  containers,
  colorIdx,
  onSelectContainer,
  selectedId,
}: {
  network: DockerNetwork
  containers: DockerContainer[]
  colorIdx: number
  onSelectContainer: (c: DockerContainer) => void
  selectedId?: string
}) {
  const color = NET_COLORS[colorIdx % NET_COLORS.length]
  const cols  = Math.min(4, containers.length)

  return (
    <div style={{ marginBottom: 32, position: 'relative' }}>
      {/* Zone label */}
      <div style={{
        ...PX,
        fontSize: 6,
        color,
        marginBottom: 8,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <span style={{
          background: `${color}1a`,
          border: `1px solid ${color}44`,
          borderRadius: 2,
          padding: '2px 8px',
        }}>
          ⬡ {network.name}
        </span>
        <span style={{ color: '#374151', fontFamily: 'monospace', fontSize: 8 }}>
          {network.driver} · {containers.length} container{containers.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Zone background + rooms */}
      <div style={{
        background: `${color}07`,
        border: `1px dashed ${color}22`,
        borderRadius: 4,
        padding: 16,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 14,
        maxWidth: cols * (160 + 14) + 32,
      }}>
        {containers.map(c => (
          <PixelRoom
            key={c.id}
            container={c}
            selected={c.id === selectedId}
            onClick={() => onSelectContainer(c)}
          />
        ))}
      </div>
    </div>
  )
}

// ── Volume row with SVG dashed lines ─────────────────────────────────────────
function VolumeRow({ volumes }: { volumes: DockerVolume[] }) {
  if (volumes.length === 0) return null
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ ...PX, fontSize: 6, color: '#4c1d95', marginBottom: 10 }}>
        ⊟ VOLUMES
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {volumes.map(v => (
          <VolumeCloset key={v.name} volume={v} />
        ))}
      </div>
    </div>
  )
}

// ── Uncategorized row (containers not in any network) ─────────────────────────
function UncategorizedRow({
  containers,
  onSelectContainer,
  selectedId,
}: {
  containers: DockerContainer[]
  onSelectContainer: (c: DockerContainer) => void
  selectedId?: string
}) {
  if (containers.length === 0) return null
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ ...PX, fontSize: 6, color: '#4b5563', marginBottom: 8 }}>
        — no network —
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
        {containers.map(c => (
          <PixelRoom
            key={c.id}
            container={c}
            selected={c.id === selectedId}
            onClick={() => onSelectContainer(c)}
          />
        ))}
      </div>
    </div>
  )
}

// ── PixelRoomView ─────────────────────────────────────────────────────────────
interface PixelRoomViewProps {
  dockerInfo: DockerInfo
  onSelectContainer: (c: DockerContainer) => void
  selectedId?: string
}

export function PixelRoomView({ dockerInfo, onSelectContainer, selectedId }: PixelRoomViewProps) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return dockerInfo.containers
    return dockerInfo.containers.filter(c =>
      c.name.toLowerCase().includes(q) || c.image.toLowerCase().includes(q)
    )
  }, [dockerInfo.containers, search])

  // Group by network — a container can be in multiple networks; assign to first
  const { networkGroups, uncategorized } = useMemo(() => {
    const groups: Map<string, DockerContainer[]> = new Map()
    const uncat: DockerContainer[] = []
    const seen = new Set<string>()

    // Build network → containers map
    for (const net of dockerInfo.networks) {
      const members = filtered.filter(c => c.networks.includes(net.name))
      if (members.length > 0) {
        groups.set(net.name, members)
        members.forEach(c => seen.add(c.id))
      }
    }

    // Containers not in any network
    filtered.forEach(c => {
      if (!seen.has(c.id)) uncat.push(c)
    })

    return { networkGroups: groups, uncategorized: uncat }
  }, [filtered, dockerInfo.networks])

  const getNetwork = (name: string) =>
    dockerInfo.networks.find(n => n.name === name) ?? { name, driver: 'bridge', id: '' }

  return (
    <div style={{ padding: '20px 24px 40px', minHeight: '100%' }}>
      {/* Search bar */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search containers…"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 4,
            padding: '6px 12px',
            color: '#e2e8f0',
            fontSize: 11,
            fontFamily: 'monospace',
            outline: 'none',
            width: 260,
          }}
        />
        {search && (
          <span style={{ fontSize: 10, color: '#4b5563', fontFamily: 'monospace' }}>
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Network zones */}
      {Array.from(networkGroups.entries()).map(([netName, containers], i) => (
        <NetworkZone
          key={netName}
          network={getNetwork(netName)}
          containers={containers}
          colorIdx={i}
          onSelectContainer={onSelectContainer}
          selectedId={selectedId}
        />
      ))}

      {/* Uncategorized containers */}
      <UncategorizedRow
        containers={uncategorized}
        onSelectContainer={onSelectContainer}
        selectedId={selectedId}
      />

      {/* Volumes */}
      <VolumeRow volumes={dockerInfo.volumes} />
    </div>
  )
}
