import { useRef, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { BLDG_D, BLDG_W, FLOOR_H } from './constants'

export interface DiskData {
  mount: string
  usedGb: number
  totalGb: number
  usedPercent: number
}

export interface DiskFloorProps {
  disk: DiskData | null
  floor: number
  selected?: boolean
}

function diskColor(pct: number): string {
  if (pct > 90) return '#ef4444'
  if (pct > 70) return '#f59e0b'
  return '#22c55e'
}

// Tray is the dark container visible for every floor (the "black background")
const TRAY_W  = BLDG_W - 0.12  // 2.88 — slightly wider than fill
const TRAY_H  = 0.22
const TRAY_D  = BLDG_D - 0.22
const FILL_H  = 0.14            // fill is slightly shorter than tray — tray border visible
const FILL_D  = BLDG_D - 0.34
const MAX_FILL = BLDG_W - 0.2  // 2.8 — fill travels this width

export function DiskFloor({ disk, floor, selected = false }: DiskFloorProps) {
  const groupRef    = useRef<THREE.Group>(null)
  const fillRef     = useRef<THREE.Mesh>(null)
  const fillMatRef  = useRef<THREE.MeshStandardMaterial>(null)
  const accentRef   = useRef<THREE.MeshStandardMaterial>(null)

  const isHovered = useRef(false)
  const hoverProg = useRef(0)
  const [showPanel, setShowPanel] = useState(false)

  const animFill = useRef(0)

  const pct   = disk ? Math.max(0, Math.min(100, disk.usedPercent)) : 0
  const color = diskColor(pct)
  const baseY = floor * FLOOR_H + TRAY_H / 2 + 0.05

  // Replay fill animation from zero each time floor is selected
  useEffect(() => {
    if (selected) animFill.current = 0
  }, [selected])

  useFrame(({ clock }) => {
    hoverProg.current += ((isHovered.current ? 1 : 0) - hoverProg.current) * 0.10

    // Slower on select (dramatic reveal), faster on normal mount
    const fillSpeed = selected ? 0.025 : 0.055
    animFill.current = Math.min(1, animFill.current + (1 - animFill.current) * fillSpeed)

    // Drive fill mesh — left-edge pinned
    const currentW = Math.max(0.001, (pct / 100) * MAX_FILL * animFill.current)
    if (fillRef.current) {
      fillRef.current.position.x = -MAX_FILL / 2 + currentW / 2
      fillRef.current.scale.x = currentW / Math.max(0.001, MAX_FILL)
    }

    // Emissive: base 0.6, extra when selected (pulsing), extra on hover
    if (fillMatRef.current && disk) {
      const pulse = selected
        ? 0.55 + Math.abs(Math.sin(clock.getElapsedTime() * 3)) * 0.7
        : 0.6
      fillMatRef.current.emissiveIntensity = pulse + hoverProg.current * 0.4
    }

    // Accent line on top changes intensity with urgency
    if (accentRef.current && disk) {
      const base = pct > 90 ? 0.9 : pct > 70 ? 0.7 : 0.45
      accentRef.current.emissiveIntensity = base + Math.sin(clock.getElapsedTime() * 2) * 0.1
    }

    // Hover Y lift
    if (groupRef.current) {
      groupRef.current.position.y = baseY + hoverProg.current * 0.04
    }
  })

  const freeGb = disk ? disk.totalGb - disk.usedGb : 0
  const panelVisible = showPanel || selected

  return (
    <group ref={groupRef} position={[0, baseY, 0]}>

      {/* ── TRAY: the "black background" container ── */}
      <mesh>
        <boxGeometry args={[TRAY_W, TRAY_H, TRAY_D]} />
        <meshStandardMaterial
          color="#05050e"
          emissive="#08083a"
          emissiveIntensity={0.06}
          transparent
          opacity={0.97}
        />
      </mesh>

      {/* ── ACCENT LINE: top edge of tray, color = usage level ── */}
      {disk && (
        <mesh position={[0, TRAY_H / 2 + 0.005, 0]}>
          <boxGeometry args={[TRAY_W, 0.018, TRAY_D + 0.01]} />
          <meshStandardMaterial
            ref={accentRef}
            color={color}
            emissive={color}
            emissiveIntensity={0.7}
          />
        </mesh>
      )}

      {/* ── FILL: left-pinned, width = usedPercent × MAX_FILL ── */}
      {disk && (
        <mesh
          ref={fillRef}
          position={[-MAX_FILL / 2, 0, 0]}  // position updated in useFrame
        >
          <boxGeometry args={[MAX_FILL, FILL_H, FILL_D]} />
          <meshStandardMaterial
            ref={fillMatRef}
            color={color}
            emissive={color}
            emissiveIntensity={0.6}
          />
        </mesh>
      )}

      {/* ── HIT AREA: full tray footprint for pointer events ── */}
      {disk && (
        <mesh
          onPointerOver={(e) => {
            e.stopPropagation()
            document.body.style.cursor = 'pointer'
            isHovered.current = true
            setShowPanel(true)
          }}
          onPointerOut={() => {
            document.body.style.cursor = 'default'
            isHovered.current = false
            setShowPanel(false)
          }}
        >
          <boxGeometry args={[TRAY_W, TRAY_H + 0.1, TRAY_D]} />
          <meshStandardMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}

      {/* ── DETAIL PANEL ── */}
      {panelVisible && disk && (
        <Html
          position={[BLDG_W / 2 + 0.45, 0, 0]}
          center={false}
          occlude={false}
          style={{ pointerEvents: 'none' }}
        >
          <div
            style={{
              background: selected ? 'rgba(12,12,28,0.97)' : 'rgba(8,8,18,0.93)',
              border: `1px solid ${color}${selected ? 'bb' : '66'}`,
              borderRadius: 7,
              padding: '7px 11px',
              whiteSpace: 'nowrap',
              fontFamily: 'monospace',
              fontSize: 11,
              color: color,
              minWidth: 158,
              lineHeight: 1.7,
              boxShadow: selected ? `0 0 18px ${color}44` : 'none',
            }}
          >
            <div style={{ fontSize: 10, opacity: 0.6, marginBottom: 4 }}>
              FLOOR {floor + 1} — {disk.mount}
            </div>

            {/* Animated mini bar */}
            <div style={{ height: 5, background: '#05050e', borderRadius: 3, overflow: 'hidden', marginBottom: 7 }}>
              <div
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  background: color,
                  borderRadius: 3,
                  transition: 'width 0.15s ease',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <div style={{ opacity: 0.55, fontSize: 9, marginBottom: 1 }}>USED</div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{disk.usedGb.toFixed(1)} GB</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ opacity: 0.55, fontSize: 9, marginBottom: 1, color: '#6b7280' }}>FREE</div>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#6b7280' }}>{freeGb.toFixed(1)} GB</div>
              </div>
            </div>

            <div style={{ fontSize: 19, fontWeight: 800, marginTop: 5, letterSpacing: '-0.02em' }}>
              {pct}%
            </div>
          </div>
        </Html>
      )}
    </group>
  )
}
