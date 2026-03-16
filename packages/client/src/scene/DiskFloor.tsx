import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { BLDG_D, BLDG_W, FLOOR_H } from './constants'

export interface DiskFloorProps {
  usedPercent: number
  usedGb: number
  totalGb: number
  mount: string
  floor: number
}

function diskColor(pct: number) {
  if (pct > 90) return '#ef4444'
  if (pct > 70) return '#f59e0b'
  return '#22c55e'
}

const MAX_FILL = BLDG_W - 0.2
const EDGE_W = 0.06
const FILL_H = 0.07
const FILL_D = BLDG_D - 0.2

export function DiskFloor({ usedPercent, usedGb, totalGb, mount, floor }: DiskFloorProps) {
  const fillRef = useRef<THREE.Mesh>(null)
  const edgeRef = useRef<THREE.Mesh>(null)
  const currentScale = useRef(0)

  const targetFill = (usedPercent / 100) * MAX_FILL
  const color = diskColor(usedPercent)
  const y = floor * FLOOR_H + FILL_H / 2 + 0.01

  useFrame(({ clock }) => {
    // Animate fill width in from 0 → target on mount
    currentScale.current += (targetFill - currentScale.current) * 0.06

    const w = currentScale.current
    if (w < 0.01) return

    if (fillRef.current) {
      // Scale geometry: keep left edge pinned by adjusting position
      fillRef.current.scale.x = w / MAX_FILL
      fillRef.current.position.x = -(MAX_FILL - w) / 2
    }

    if (edgeRef.current) {
      // Glowing edge trails the fill's right side
      edgeRef.current.position.x = -(MAX_FILL / 2) + w - EDGE_W / 2;
      // Pulse intensity
      (edgeRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
        1.5 + Math.sin(clock.getElapsedTime() * 4) * 0.5
    }
  })

  if (usedPercent <= 0) return null

  return (
    <group position={[0, y, 0]}>
      {/* Fill bar */}
      <mesh ref={fillRef} position={[-MAX_FILL / 2, 0, 0]}>
        <boxGeometry args={[MAX_FILL, FILL_H, FILL_D]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} />
      </mesh>

      {/* Glowing leading edge */}
      <mesh ref={edgeRef} position={[-MAX_FILL / 2, 0, 0]}>
        <boxGeometry args={[EDGE_W, FILL_H + 0.04, FILL_D + 0.04]} />
        <meshStandardMaterial color="#ffffff" emissive={color} emissiveIntensity={1.5} transparent opacity={0.9} />
      </mesh>

      {/* Floating HTML label — sits outside the right wall */}
      <Html
        position={[BLDG_W / 2 + 0.3, 0, 0]}
        center={false}
        occlude={false}
        style={{ pointerEvents: 'none' }}
      >
        <div
          style={{
            background: 'rgba(8,8,18,0.82)',
            border: `1px solid ${color}55`,
            borderRadius: 6,
            padding: '3px 7px',
            whiteSpace: 'nowrap',
            fontFamily: 'monospace',
            fontSize: 11,
            color: color,
            lineHeight: 1.5,
          }}
        >
          <div style={{ opacity: 0.7, fontSize: 10 }}>{mount}</div>
          <div>
            {usedGb.toFixed(1)}/{totalGb.toFixed(1)} GB
            <span style={{ marginLeft: 6, fontWeight: 700 }}>{usedPercent}%</span>
          </div>
        </div>
      </Html>
    </group>
  )
}
