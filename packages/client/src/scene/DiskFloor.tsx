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

const MAX_FILL = BLDG_W - 0.2   // 2.8
const SEG_H   = 0.16
const SEG_D   = BLDG_D - 0.3
const GAP     = 0.04

export function DiskFloor({ disk, floor, selected = false }: DiskFloorProps) {
  const groupRef   = useRef<THREE.Group>(null)
  const usedMatRef = useRef<THREE.MeshStandardMaterial>(null)
  const freeMatRef = useRef<THREE.MeshStandardMaterial>(null)
  const usedMeshRef = useRef<THREE.Mesh>(null)
  const freeMeshRef = useRef<THREE.Mesh>(null)

  // Hover state (ref-driven animation, state only for Html mount)
  const isHovered  = useRef(false)
  const hoverProg  = useRef(0)
  const [showPanel, setShowPanel] = useState(false)

  // Fill animation — resets to 0 when selected becomes true so it replays
  const animFill   = useRef(0)
  const prevSelected = useRef(false)

  const pct    = disk ? Math.max(0, Math.min(100, disk.usedPercent)) : 0
  const usedW  = (pct / 100) * MAX_FILL
  const freeW  = Math.max(0.01, MAX_FILL - usedW - GAP)
  const color  = diskColor(pct)
  const baseY  = floor * FLOOR_H + SEG_H / 2 + 0.06

  // Reset fill animation each time the floor becomes selected
  useEffect(() => {
    if (selected) {
      animFill.current = 0
    }
  }, [selected])

  useFrame(({ clock }) => {
    prevSelected.current = selected

    // Hover progress
    hoverProg.current += ((isHovered.current ? 1 : 0) - hoverProg.current) * 0.10

    // Fill progress — faster when selected (dramatic reveal), normal on mount
    const fillSpeed = selected ? 0.03 : 0.06
    animFill.current = Math.min(1, animFill.current + (1 - animFill.current) * fillSpeed)

    if (!disk) return

    const currentUsedW = Math.max(0.001, usedW * animFill.current)
    const currentFreeW = Math.max(0.001, MAX_FILL - currentUsedW - GAP)

    // Reposition and rescale used segment to stay left-pinned
    if (usedMeshRef.current) {
      usedMeshRef.current.position.x = -MAX_FILL / 2 + currentUsedW / 2
      usedMeshRef.current.scale.x = currentUsedW / Math.max(0.001, usedW)
    }

    // Reposition free segment to stay right-pinned
    if (freeMeshRef.current) {
      freeMeshRef.current.position.x = MAX_FILL / 2 - currentFreeW / 2
      freeMeshRef.current.scale.x = currentFreeW / Math.max(0.001, freeW)
    }

    // Emissive intensity: base + hover boost + selected pulse
    if (usedMatRef.current) {
      const pulse = selected
        ? 0.4 + Math.abs(Math.sin(clock.getElapsedTime() * 3)) * 0.6
        : 0.35
      usedMatRef.current.emissiveIntensity = pulse + hoverProg.current * 0.5
    }

    if (freeMatRef.current) {
      freeMatRef.current.emissiveIntensity = 0.08 + hoverProg.current * 0.1
    }

    // Y lift on hover
    if (groupRef.current) {
      groupRef.current.position.y = baseY + hoverProg.current * 0.04
    }
  })

  // Empty placeholder — no disk data for this slot
  if (!disk) {
    return (
      <mesh position={[0, baseY, 0]}>
        <boxGeometry args={[MAX_FILL, SEG_H, SEG_D]} />
        <meshStandardMaterial color="#1a1a3a" transparent opacity={0.3} />
      </mesh>
    )
  }

  const freeGb = disk.totalGb - disk.usedGb
  const panelVisible = showPanel || selected

  return (
    <group ref={groupRef} position={[0, baseY, 0]}>
      {/* Used segment — left side (animated width) */}
      <mesh ref={usedMeshRef} position={[-MAX_FILL / 2 + usedW / 2, 0, 0]}>
        <boxGeometry args={[Math.max(0.001, usedW), SEG_H, SEG_D]} />
        <meshStandardMaterial
          ref={usedMatRef}
          color={color}
          emissive={color}
          emissiveIntensity={0.35}
        />
      </mesh>

      {/* Free segment — right side */}
      <mesh ref={freeMeshRef} position={[MAX_FILL / 2 - freeW / 2, 0, 0]}>
        <boxGeometry args={[Math.max(0.001, freeW), SEG_H, SEG_D]} />
        <meshStandardMaterial
          ref={freeMatRef}
          color="#1a1a3a"
          emissive="#2a2a5a"
          emissiveIntensity={0.08}
        />
      </mesh>

      {/* Transparent hit-area for hover events */}
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
        <boxGeometry args={[MAX_FILL, SEG_H + 0.12, SEG_D]} />
        <meshStandardMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Detail panel — shown on hover OR when selected */}
      {panelVisible && (
        <Html
          position={[BLDG_W / 2 + 0.45, 0, 0]}
          center={false}
          occlude={false}
          style={{ pointerEvents: 'none' }}
        >
          <div
            style={{
              background: selected ? 'rgba(20,20,50,0.96)' : 'rgba(8,8,18,0.92)',
              border: `1px solid ${color}${selected ? 'aa' : '66'}`,
              borderRadius: 7,
              padding: '7px 11px',
              whiteSpace: 'nowrap',
              fontFamily: 'monospace',
              fontSize: 11,
              color: color,
              minWidth: 155,
              lineHeight: 1.7,
              boxShadow: selected ? `0 0 16px ${color}33` : 'none',
              transition: 'box-shadow 0.3s',
            }}
          >
            {/* Mount label */}
            <div style={{ fontSize: 10, opacity: 0.65, marginBottom: 4 }}>
              FLOOR {floor + 1} — {disk.mount}
            </div>

            {/* Animated mini bar */}
            <div
              style={{
                height: 5,
                background: '#1a1a3a',
                borderRadius: 3,
                overflow: 'hidden',
                marginBottom: 6,
              }}
            >
              <div
                style={{
                  width: `${pct * animFill.current}%`,
                  height: '100%',
                  background: color,
                  borderRadius: 3,
                  transition: 'width 0.1s',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <div style={{ opacity: 0.6, fontSize: 9, marginBottom: 1 }}>USED</div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{disk.usedGb.toFixed(1)} GB</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ opacity: 0.6, fontSize: 9, marginBottom: 1, color: '#6b7280' }}>FREE</div>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#6b7280' }}>{freeGb.toFixed(1)} GB</div>
              </div>
            </div>

            <div
              style={{
                fontSize: 18,
                fontWeight: 800,
                marginTop: 4,
                letterSpacing: '-0.02em',
              }}
            >
              {pct}%
            </div>
          </div>
        </Html>
      )}
    </group>
  )
}
