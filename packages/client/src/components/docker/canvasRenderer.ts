import { DockerContainer, DockerVolume, DockerInfo } from '@servercity/shared'

// ── Constants ─────────────────────────────────────────────────────────────────
export const ROOM_W      = 160
export const ROOM_H      = 120
export const ROOM_GAP    = 24
export const ZONE_PAD    = 20
export const OUTER_PAD   = 24
export const ZONE_LABEL_H = 20
export const WALL_W      = 4
export const DOORWAY_W   = 20
export const PIXEL_SCALE = 3

// ── Hit rect for mouse interaction ────────────────────────────────────────────
export interface HitRect {
  x: number
  y: number
  w: number
  h: number
  containerId: string
}

// ── Status theme tables ───────────────────────────────────────────────────────
const FLOOR_COLOR: Record<string, string> = {
  running:    '#1a3d1a',
  paused:     '#3d3d0a',
  exited:     '#1a1a1a',
  dead:       '#3d0a0a',
  created:    '#0a1a3d',
  restarting: '#1a0a3d',
}
const WALL_COLOR: Record<string, string> = {
  running:    '#2a4a2a',
  paused:     '#4a4a0a',
  exited:     '#2a2a2a',
  dead:       '#4a0a0a',
  created:    '#0a2a4a',
  restarting: '#2a0a4a',
}
const GLOW_COLOR: Record<string, string> = {
  running:    '#00ff41',
  paused:     '#ffff00',
  exited:     '#444444',
  dead:       '#ff2222',
  created:    '#4444ff',
  restarting: '#aa44ff',
}
const GLOW_BLUR: Record<string, number> = {
  running:    12,
  paused:     8,
  exited:     4,
  dead:       10,
  created:    6,
  restarting: 8,
}
const NAME_COLOR: Record<string, string> = {
  running:    '#00ff41',
  paused:     '#ffff00',
  exited:     '#888888',
  dead:       '#ff4444',
  created:    '#4488ff',
  restarting: '#aa44ff',
}

// ── Pixel icon maps ───────────────────────────────────────────────────────────
const ICONS: Record<string, { pixels: number[][]; color: string }> = {
  database: {
    color: '#aa44ff',
    pixels: [
      [0,1,1,1,1,1,1,0],
      [1,1,1,1,1,1,1,1],
      [1,1,0,0,0,0,1,1],
      [0,1,1,1,1,1,1,0],
      [0,1,1,1,1,1,1,0],
      [1,1,0,0,0,0,1,1],
      [1,1,1,1,1,1,1,1],
      [0,1,1,1,1,1,1,0],
    ],
  },
  webserver: {
    color: '#44aaff',
    pixels: [
      [0,0,1,1,1,1,0,0],
      [0,1,1,1,1,1,1,0],
      [1,1,0,1,1,0,1,1],
      [1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1],
      [1,1,0,0,0,0,1,1],
      [0,1,1,0,0,1,1,0],
      [0,0,1,1,1,1,0,0],
    ],
  },
  app: {
    color: '#44ffaa',
    pixels: [
      [0,0,1,1,1,1,0,0],
      [0,1,1,0,0,1,1,0],
      [1,1,0,0,0,0,1,1],
      [1,0,0,1,1,0,0,1],
      [1,0,0,1,1,0,0,1],
      [1,1,0,0,0,0,1,1],
      [0,1,1,0,0,1,1,0],
      [0,0,1,1,1,1,0,0],
    ],
  },
  unknown: {
    color: '#888888',
    pixels: [
      [0,0,1,1,1,1,0,0],
      [0,1,1,0,0,1,1,0],
      [0,0,0,0,1,1,0,0],
      [0,0,0,1,1,0,0,0],
      [0,0,0,1,1,0,0,0],
      [0,0,0,0,0,0,0,0],
      [0,0,0,1,1,0,0,0],
      [0,0,0,1,1,0,0,0],
    ],
  },
}

function getIconType(image: string): keyof typeof ICONS {
  const img = image.toLowerCase()
  if (/postgres|mysql|mongo|redis|mariadb|sqlite|cassandra/.test(img)) return 'database'
  if (/nginx|apache|caddy|traefik|haproxy/.test(img)) return 'webserver'
  if (/node|python|java|php|ruby|go|rust|dotnet|app/.test(img)) return 'app'
  return 'unknown'
}

// ── drawPixelIcon ─────────────────────────────────────────────────────────────
export function drawPixelIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  imageType: string,
) {
  const type = getIconType(imageType)
  const icon = ICONS[type]
  const scale = PIXEL_SCALE
  const iconW = 8 * scale
  const iconH = 8 * scale
  const startX = Math.round(cx - iconW / 2)
  const startY = Math.round(cy - iconH / 2)

  ctx.save()
  ctx.shadowBlur = 0
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if (icon.pixels[row][col]) {
        ctx.fillStyle = icon.color
        ctx.fillRect(startX + col * scale, startY + row * scale, scale, scale)
      }
    }
  }
  ctx.restore()
}

// ── drawRoom ──────────────────────────────────────────────────────────────────
export function drawRoom(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  container: DockerContainer,
  hovered: boolean,
) {
  const W = ROOM_W
  const H = ROOM_H
  const status     = container.status
  const floorColor = FLOOR_COLOR[status] ?? '#1a1a1a'
  const wallColor  = WALL_COLOR[status]  ?? '#2a2a2a'
  const glowColor  = GLOW_COLOR[status]  ?? '#444444'
  const glowBlur   = GLOW_BLUR[status]   ?? 4
  const nameColor  = NAME_COLOR[status]  ?? '#888888'

  ctx.save()

  // ── Floor ──
  ctx.shadowColor = glowColor
  ctx.shadowBlur  = hovered ? glowBlur + 8 : glowBlur
  ctx.fillStyle   = floorColor
  ctx.fillRect(x, y, W, H)
  ctx.shadowBlur  = 0

  // ── Walls ──
  ctx.strokeStyle = wallColor
  ctx.lineWidth   = WALL_W

  // Bottom wall
  ctx.beginPath(); ctx.moveTo(x, y + H);     ctx.lineTo(x + W, y + H);   ctx.stroke()
  // Left wall
  ctx.beginPath(); ctx.moveTo(x, y);         ctx.lineTo(x, y + H);        ctx.stroke()
  // Right wall
  ctx.beginPath(); ctx.moveTo(x + W, y);     ctx.lineTo(x + W, y + H);   ctx.stroke()

  // Top wall with doorway gap
  const doorLeft  = x + W / 2 - DOORWAY_W / 2
  const doorRight = x + W / 2 + DOORWAY_W / 2

  ctx.beginPath(); ctx.moveTo(x, y);         ctx.lineTo(doorLeft, y);     ctx.stroke()
  ctx.beginPath(); ctx.moveTo(doorRight, y); ctx.lineTo(x + W, y);        ctx.stroke()

  // Door frame — two short verticals going up from the gap
  ctx.beginPath(); ctx.moveTo(doorLeft, y);  ctx.lineTo(doorLeft,  y - 8); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(doorRight, y); ctx.lineTo(doorRight, y - 8); ctx.stroke()

  // ── Hover bright border inside walls ──
  if (hovered) {
    ctx.strokeStyle = glowColor
    ctx.lineWidth   = 1
    ctx.strokeRect(x + 2, y + 2, W - 4, H - 4)
  }

  // ── Pixel art icon — upper-center of room ──
  drawPixelIcon(ctx, x + W / 2, y + H * 0.33, container.image)

  // ── Container name ──
  ctx.fillStyle    = nameColor
  ctx.font         = '7px "Press Start 2P"'
  ctx.textAlign    = 'center'
  ctx.textBaseline = 'middle'
  const rawName     = container.name.replace(/^\//, '')
  const displayName = rawName.length > 12 ? rawName.slice(0, 12) + '…' : rawName
  ctx.fillText(displayName, x + W / 2, y + H * 0.62)

  // ── CPU bar ──
  const barX    = x + 20
  const barW    = W - 40
  const cpuY    = y + H - 26
  const memY    = y + H - 14
  const cpuHot  = container.cpuPercent > 80
  const memPct  = container.memoryLimitMb > 0 ? container.memoryMb / container.memoryLimitMb : 0
  const memHot  = memPct > 0.85

  // CPU label
  ctx.fillStyle    = cpuHot ? '#ff4444' : '#00ff41'
  ctx.font         = '6px "Press Start 2P"'
  ctx.textAlign    = 'right'
  ctx.textBaseline = 'middle'
  ctx.fillText('C', x + 18, cpuY + 2)

  ctx.fillStyle = '#1a1a1a'
  ctx.fillRect(barX, cpuY - 2, barW, 4)
  ctx.fillStyle = cpuHot ? '#ff4444' : '#00ff41'
  ctx.fillRect(barX, cpuY - 2, Math.min(barW, barW * (container.cpuPercent / 100)), 4)

  // MEM label
  ctx.fillStyle    = memHot ? '#ff4444' : '#4444ff'
  ctx.textAlign    = 'right'
  ctx.textBaseline = 'middle'
  ctx.fillText('M', x + 18, memY + 2)

  ctx.fillStyle = '#1a1a1a'
  ctx.fillRect(barX, memY - 2, barW, 4)
  ctx.fillStyle = memHot ? '#ff4444' : '#4444ff'
  ctx.fillRect(barX, memY - 2, Math.min(barW, barW * memPct), 4)

  // ── Port badges on right wall ──
  const maxBadges = 4
  const ports     = container.ports.slice(0, maxBadges)
  const badgeGap  = (H - 20) / (maxBadges + 1)
  ports.forEach((_, i) => {
    ctx.fillStyle = '#00aaff'
    ctx.fillRect(x + W - 3, y + 10 + i * badgeGap, 4, 12)
  })
  if (container.ports.length > maxBadges) {
    ctx.fillStyle    = '#00aaff'
    ctx.font         = '5px "Press Start 2P"'
    ctx.textAlign    = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('+', x + W + 3, y + 10 + maxBadges * badgeGap + 6)
  }

  ctx.restore()
}

// ── drawNetworkZone ───────────────────────────────────────────────────────────
export function drawNetworkZone(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  name: string,
  driver: string,
) {
  ctx.save()
  ctx.shadowBlur = 0

  ctx.fillStyle = '#00aaff08'
  ctx.fillRect(x, y, w, h)

  ctx.setLineDash([4, 4])
  ctx.strokeStyle = '#00aaff44'
  ctx.lineWidth   = 1
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)
  ctx.setLineDash([])

  ctx.fillStyle    = '#00aaff88'
  ctx.font         = '6px "Press Start 2P"'
  ctx.textAlign    = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText(`${name} · ${driver}`, x + 8, y + 6)

  ctx.restore()
}

// ── drawCorridor — connects adjacent same-row rooms ───────────────────────────
export function drawCorridor(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
) {
  // Connect the doorway tops of two rooms on the same row
  const cx1 = x1 + ROOM_W / 2
  const cx2 = x2 + ROOM_W / 2
  const from = Math.min(cx1, cx2)
  const to   = Math.max(cx1, cx2)

  ctx.save()
  ctx.shadowBlur = 0
  ctx.fillStyle  = '#00ff4122'
  ctx.fillRect(from, y1 - 8, to - from, 8)
  ctx.restore()
}

// ── drawVolumes ───────────────────────────────────────────────────────────────
export function drawVolumes(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  volumes: DockerVolume[],
) {
  if (volumes.length === 0) return

  ctx.save()
  ctx.shadowBlur = 0

  // Section header
  ctx.fillStyle    = '#aa44ff'
  ctx.font         = '8px "Press Start 2P"'
  ctx.textAlign    = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText('■ VOLUMES', x, y)

  const VOL_W   = 80
  const VOL_H   = 60
  const VOL_GAP = 16
  const startY  = y + 24

  volumes.forEach((vol, i) => {
    const vx = x + i * (VOL_W + VOL_GAP)
    const vy = startY
    const cx = vx + VOL_W / 2
    const cy = vy + VOL_H / 2 - 4

    ctx.save()
    // Glow + floor
    ctx.shadowColor = '#aa44ff'
    ctx.shadowBlur  = 8
    ctx.fillStyle   = '#1a0a2a'
    ctx.fillRect(vx, vy, VOL_W, VOL_H)
    ctx.shadowBlur  = 0

    // Walls
    ctx.strokeStyle = '#2a1a3a'
    ctx.lineWidth   = 2
    ctx.strokeRect(vx, vy, VOL_W, VOL_H)
    ctx.restore()

    // Cylinder icon
    ctx.save()
    ctx.strokeStyle = '#aa44ff'
    ctx.fillStyle   = '#aa44ff33'
    ctx.lineWidth   = 1.5

    ctx.beginPath()
    ctx.ellipse(cx, cy - 8, 16, 5, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(cx - 16, cy - 8)
    ctx.lineTo(cx - 16, cy + 12)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(cx + 16, cy - 8)
    ctx.lineTo(cx + 16, cy + 12)
    ctx.stroke()

    ctx.beginPath()
    ctx.ellipse(cx, cy + 12, 16, 5, 0, 0, Math.PI)
    ctx.fill()
    ctx.stroke()
    ctx.restore()

    // Name
    ctx.save()
    ctx.fillStyle    = '#aa44ff'
    ctx.font         = '5px "Press Start 2P"'
    ctx.textAlign    = 'center'
    ctx.textBaseline = 'bottom'
    const shortName = vol.name.length > 10 ? vol.name.slice(0, 10) + '…' : vol.name
    ctx.fillText(shortName, cx, vy + VOL_H - 4)
    ctx.restore()
  })

  ctx.restore()
}

// ── Layout ────────────────────────────────────────────────────────────────────
export interface RoomLayout {
  containerId: string
  x: number
  y: number
}

export interface ZoneLayout {
  networkName: string
  driver: string
  zoneX: number
  zoneY: number
  zoneW: number
  zoneH: number
  rooms: RoomLayout[]
}

export interface CanvasLayout {
  zones: ZoneLayout[]
  volumeY: number
  totalHeight: number
}

export function computeLayout(dockerInfo: DockerInfo, canvasWidth: number): CanvasLayout {
  const roomsPerRow = Math.max(1, Math.floor(
    (canvasWidth - OUTER_PAD * 2 - ZONE_PAD * 2) / (ROOM_W + ROOM_GAP)
  ))

  let curY = OUTER_PAD
  const zones: ZoneLayout[] = []
  const assigned = new Set<string>()

  const processGroup = (networkName: string, driver: string, containers: DockerContainer[]) => {
    if (containers.length === 0) return

    const rows  = Math.ceil(containers.length / roomsPerRow)
    const cols  = Math.min(containers.length, roomsPerRow)
    const zoneW = ZONE_PAD * 2 + cols * ROOM_W + (cols - 1) * ROOM_GAP
    const zoneH = ZONE_LABEL_H + ZONE_PAD + rows * ROOM_H + (rows - 1) * ROOM_GAP + ZONE_PAD

    const zoneX = OUTER_PAD
    const zoneY = curY

    const rooms: RoomLayout[] = containers.map((c, i) => ({
      containerId: c.id,
      x: zoneX + ZONE_PAD + (i % roomsPerRow) * (ROOM_W + ROOM_GAP),
      y: zoneY + ZONE_LABEL_H + ZONE_PAD + Math.floor(i / roomsPerRow) * (ROOM_H + ROOM_GAP),
    }))

    zones.push({ networkName, driver, zoneX, zoneY, zoneW, zoneH, rooms })
    curY += zoneH + ROOM_GAP
    containers.forEach(c => assigned.add(c.id))
  }

  // Containers grouped by their first network
  const processed = new Set<string>()
  dockerInfo.networks.forEach(net => {
    const members = dockerInfo.containers.filter(c =>
      !processed.has(c.id) && c.networks.includes(net.name)
    )
    members.forEach(c => processed.add(c.id))
    processGroup(net.name, net.driver, members)
    members.forEach(c => assigned.add(c.id))
  })

  // Containers with no network
  const unassigned = dockerInfo.containers.filter(c => !assigned.has(c.id))
  if (unassigned.length > 0) processGroup('no network', 'none', unassigned)

  const volumeY     = curY + ROOM_GAP
  const volCount    = dockerInfo.volumes.length
  const volSectionH = volCount > 0 ? 24 + 60 + 40 : 0
  const totalHeight = volumeY + volSectionH + OUTER_PAD * 2

  return { zones, volumeY, totalHeight }
}
