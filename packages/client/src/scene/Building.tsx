import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ServerMetrics } from '@servercity/shared'
import { BLDG_D, BLDG_W, FLOORS, FLOOR_H, TOTAL_H } from './constants'
import { FloorWindows } from './FloorWindows'
import { WaterFill } from './WaterFill'
import { DiskFloor } from './DiskFloor'
import { NetworkBeams } from './NetworkBeams'
import { BaseRing } from './BaseRing'
import { CPUCorona } from './CPUCorona'

export interface BuildingProps {
  metrics: ServerMetrics
  connected: boolean
}

// Ease-out cubic: fast start, decelerates to target
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

export function Building({ metrics, connected }: BuildingProps) {
  const groupRef = useRef<THREE.Group>(null)
  const shellMatRef = useRef<THREE.MeshStandardMaterial>(null)

  // Spring state: position, velocity
  const spring = useRef({ pos: connected ? 1 : 0, vel: 0 })
  const STIFFNESS = 0.1
  const DAMPING = 0.82

  const isHighCPU = metrics.cpu.overall > 90

  useFrame(({ clock }) => {
    if (!groupRef.current) return

    // Spring physics for rise/sink
    const target = connected ? 1 : 0
    const { pos, vel } = spring.current
    const newVel = (vel + (target - pos) * STIFFNESS) * DAMPING
    const newPos = Math.max(0, Math.min(1, pos + newVel))
    spring.current = { pos: newPos, vel: newVel }

    // Apply eased scale
    groupRef.current.scale.y = easeOutCubic(newPos)

    // OOM shake — amplitude grows with severity above 95%
    const mem = metrics.memory.usedPercent
    if (mem > 95) {
      const severity = (mem - 95) / 5  // 0→1 as mem goes 95→100%
      const amp = 0.03 + severity * 0.06
      groupRef.current.position.x = Math.sin(clock.getElapsedTime() * 28) * amp
    } else {
      groupRef.current.position.x = 0
    }

    // Animate shell emissive intensity independently for high-CPU pulse
    if (shellMatRef.current) {
      if (isHighCPU) {
        const freq = 2 + (metrics.cpu.overall - 90) * 0.15 // faster at higher CPU
        shellMatRef.current.emissiveIntensity = 0.2 + Math.abs(Math.sin(clock.getElapsedTime() * freq)) * 0.25
      } else {
        shellMatRef.current.emissiveIntensity += (0.05 - shellMatRef.current.emissiveIntensity) * 0.05
      }
      shellMatRef.current.emissive.set(isHighCPU ? '#ff3300' : '#3344ff')
    }
  })

  return (
    <>
      {/* Ground ring + CPU corona sit outside the group so they aren't y-scaled */}
      <BaseRing riseProgress={spring.current.pos} />
      <CPUCorona cpuPercent={metrics.cpu.overall} />

      <group ref={groupRef}>
        {/* Shell */}
        <mesh position={[0, TOTAL_H / 2, 0]}>
          <boxGeometry args={[BLDG_W, TOTAL_H, BLDG_D]} />
          <meshStandardMaterial
            ref={shellMatRef}
            color="#1a1a2e"
            emissive="#3344ff"
            emissiveIntensity={0.05}
            transparent
            opacity={0.92}
          />
        </mesh>

        {/* Floor separators */}
        {Array.from({ length: FLOORS }).map((_, i) => (
          <mesh key={i} position={[0, i * FLOOR_H, 0]}>
            <boxGeometry args={[BLDG_W + 0.02, 0.04, BLDG_D + 0.02]} />
            <meshStandardMaterial color="#3a3a6e" emissive="#3a3a6e" emissiveIntensity={0.2} />
          </mesh>
        ))}

        <WaterFill memPercent={metrics.memory.usedPercent} />

        {Array.from({ length: FLOORS }).map((_, i) => (
          <DiskFloor key={i} disk={metrics.disk[i] ?? null} floor={i} />
        ))}

        {Array.from({ length: FLOORS }).map((_, i) => (
          <FloorWindows key={i} cpuPercent={metrics.cpu.overall} floor={i} />
        ))}

        <NetworkBeams bytesIn={metrics.network.bytesIn} bytesOut={metrics.network.bytesOut} />
      </group>
    </>
  )
}
