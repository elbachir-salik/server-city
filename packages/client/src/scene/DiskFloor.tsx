import { useRef, useState } from 'react'
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

export function DiskFloor({ disk, floor }: DiskFloorProps) {
  const groupRef    = useRef<THREE.Group>(null)
  const usedMatRef  = useRef<THREE.MeshStandardMaterial>(null)
  const isHovered   = useRef(false)
  const hoverProg   = useRef(0)

  const [showPanel, setShowPanel] = useState(false)

  // Pre-compute geometry values from disk data (or 0 if no disk)
  const pct      = disk ? Math.max(0, Math.min(100, disk.usedPercent)) : 0
  const usedW    = (pct / 100) * MAX_FILL
  const freeW    = Math.max(0.01, MAX_FILL - usedW - GAP)
  const color    = diskColor(pct)
  const baseY    = floor * FLOOR_H + SEG_H / 2 + 0.06

  useFrame(() => {
    hoverProg.current += ((isHovered.current ? 1 : 0) - hoverProg.current) * 0.10

    if (groupRef.current) {
      groupRef.current.position.y = baseY + hoverProg.current * 0.04
    }

    if (usedMatRef.current && disk) {
      usedMatRef.current.emissiveIntensity = 0.35 + hoverProg.current * 0.65
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

  return (
    <group ref={groupRef} position={[0, baseY, 0]}>
      {/* Used segment — left side */}
      <mesh position={[-MAX_FILL / 2 + usedW / 2, 0, 0]}>
        <boxGeometry args={[Math.max(0.01, usedW), SEG_H, SEG_D]} />
        <meshStandardMaterial
          ref={usedMatRef}
          color={color}
          emissive={color}
          emissiveIntensity={0.35}
        />
      </mesh>

      {/* Free segment — right side */}
      <mesh position={[MAX_FILL / 2 - freeW / 2, 0, 0]}>
        <boxGeometry args={[freeW, SEG_H, SEG_D]} />
        <meshStandardMaterial color="#1a1a3a" emissive="#2a2a5a" emissiveIntensity={0.08} />
      </mesh>

      {/* Invisible hit-area covering full floor width for pointer events */}
      <mesh
        position={[0, 0, 0]}
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
        <boxGeometry args={[MAX_FILL, SEG_H + 0.1, SEG_D]} />
        <meshStandardMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Hover detail panel */}
      {showPanel && (
        <Html
          position={[BLDG_W / 2 + 0.4, 0, 0]}
          center={false}
          occlude={false}
          style={{ pointerEvents: 'none' }}
        >
          <div
            style={{
              background: 'rgba(8,8,18,0.92)',
              border: `1px solid ${color}66`,
              borderRadius: 6,
              padding: '6px 10px',
              whiteSpace: 'nowrap',
              fontFamily: 'monospace',
              fontSize: 11,
              color: color,
              minWidth: 150,
              lineHeight: 1.6,
            }}
          >
            <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 4 }}>{disk.mount}</div>

            {/* Mini used/free bar */}
            <div
              style={{
                display: 'flex',
                height: 4,
                borderRadius: 2,
                overflow: 'hidden',
                marginBottom: 6,
                background: '#1a1a3a',
              }}
            >
              <div style={{ width: `${pct}%`, background: color }} />
            </div>

            <div>Used&nbsp;&nbsp;{disk.usedGb.toFixed(1)} GB</div>
            <div style={{ color: '#6b7280' }}>Free&nbsp;&nbsp;{freeGb.toFixed(1)} GB</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 3 }}>{pct}%</div>
          </div>
        </Html>
      )}
    </group>
  )
}
