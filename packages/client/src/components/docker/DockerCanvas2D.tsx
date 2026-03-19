import { useRef, useEffect, useState, useCallback } from 'react'
import { DockerInfo, DockerContainer } from '@servercity/shared'
import {
  computeLayout, drawRoom, drawNetworkZone, drawCorridor, drawVolumes,
  ROOM_W, ROOM_H, OUTER_PAD,
  HitRect, CanvasLayout,
} from './canvasRenderer'

interface DockerCanvas2DProps {
  dockerInfo: DockerInfo
  onSelectContainer: (c: DockerContainer) => void
  selectedId?: string
}

export function DockerCanvas2D({ dockerInfo, onSelectContainer, selectedId: _selectedId }: DockerCanvas2DProps) {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const wrapperRef   = useRef<HTMLDivElement>(null)
  const hitMapRef    = useRef<HitRect[]>([])
  const layoutRef    = useRef<CanvasLayout | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  // ── Master draw function ──────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas  = canvasRef.current
    const wrapper = wrapperRef.current
    if (!canvas || !wrapper) return

    const dpr = window.devicePixelRatio || 1
    const W   = wrapper.clientWidth
    if (W === 0) return

    const layout = computeLayout(dockerInfo, W)
    layoutRef.current = layout

    // Resize canvas
    canvas.style.width  = `${W}px`
    canvas.style.height = `${layout.totalHeight}px`
    canvas.width  = Math.round(W * dpr)
    canvas.height = Math.round(layout.totalHeight * dpr)

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, W, layout.totalHeight)

    // Background
    ctx.fillStyle = '#0d0f1a'
    ctx.fillRect(0, 0, W, layout.totalHeight)

    const hits: HitRect[] = []

    // ── Draw each network zone ──
    layout.zones.forEach(zone => {
      if (zone.rooms.length === 0) return

      // Zone background
      drawNetworkZone(ctx, zone.zoneX, zone.zoneY, zone.zoneW, zone.zoneH, zone.networkName, zone.driver)

      // Corridors between adjacent rooms on the same row
      for (let i = 0; i < zone.rooms.length - 1; i++) {
        const r1 = zone.rooms[i]
        const r2 = zone.rooms[i + 1]
        if (Math.abs(r1.y - r2.y) < 1) {
          drawCorridor(ctx, r1.x, r1.y, r2.x)
        }
      }

      // Rooms
      zone.rooms.forEach(room => {
        const container = dockerInfo.containers.find(c => c.id === room.containerId)
        if (!container) return
        drawRoom(ctx, room.x, room.y, container, hoveredId === container.id)
        hits.push({ x: room.x, y: room.y, w: ROOM_W, h: ROOM_H, containerId: container.id })
      })
    })

    // ── Volumes ──
    drawVolumes(ctx, OUTER_PAD, layout.volumeY, dockerInfo.volumes)

    hitMapRef.current = hits
  }, [dockerInfo, hoveredId])

  // ── Trigger redraw when data or hover changes ─────────────────────────────
  useEffect(() => {
    // Wait for pixel font before first draw
    document.fonts.ready.then(() => draw())
  }, [draw])

  // ── Resize observer ───────────────────────────────────────────────────────
  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    const observer = new ResizeObserver(() => {
      document.fonts.ready.then(() => draw())
    })
    observer.observe(wrapper)
    return () => observer.disconnect()
  }, [draw])

  // ── Mouse move → hover detection ──────────────────────────────────────────
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const mx   = e.clientX - rect.left
    const my   = e.clientY - rect.top

    const hit = hitMapRef.current.find(
      h => mx >= h.x && mx <= h.x + h.w && my >= h.y && my <= h.y + h.h
    )
    const newId = hit?.containerId ?? null
    if (newId !== hoveredId) setHoveredId(newId)
    canvas.style.cursor = hit ? 'pointer' : 'default'
  }, [hoveredId])

  const handleMouseLeave = useCallback(() => {
    setHoveredId(null)
    if (canvasRef.current) canvasRef.current.style.cursor = 'default'
  }, [])

  // ── Click → select container ──────────────────────────────────────────────
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const mx   = e.clientX - rect.left
    const my   = e.clientY - rect.top

    const hit = hitMapRef.current.find(
      h => mx >= h.x && mx <= h.x + h.w && my >= h.y && my <= h.y + h.h
    )
    if (hit) {
      const container = dockerInfo.containers.find(c => c.id === hit.containerId)
      if (container) onSelectContainer(container)
    }
  }, [dockerInfo, onSelectContainer])

  return (
    <div
      ref={wrapperRef}
      style={{ width: '100%', minHeight: '100%' }}
    >
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        style={{ display: 'block', imageRendering: 'pixelated' }}
      />
    </div>
  )
}
