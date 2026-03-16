import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ServerMetrics } from '@servercity/shared'
import { BLDG_D, BLDG_W, FLOORS, FLOOR_H, TOTAL_H } from './constants'
import { FloorWindows } from './FloorWindows'
import { WaterFill } from './WaterFill'
import { DiskFloor } from './DiskFloor'
import { NetworkBeams } from './NetworkBeams'

export interface BuildingProps {
  metrics: ServerMetrics
  connected: boolean
}

export function Building({ metrics, connected }: BuildingProps) {
  const groupRef = useRef<THREE.Group>(null)
  const scaleY = useRef(connected ? 1 : 0)

  const isHighCPU = metrics.cpu.overall > 90

  useFrame(({ clock }) => {
    if (!groupRef.current) return

    // rise / sink animation
    const target = connected ? 1 : 0
    scaleY.current += (target - scaleY.current) * 0.04
    groupRef.current.scale.y = scaleY.current

    // OOM shake
    if (metrics.memory.usedPercent > 95) {
      groupRef.current.position.x = Math.sin(clock.getElapsedTime() * 30) * 0.04
    } else {
      groupRef.current.position.x = 0
    }
  })

  return (
    <group ref={groupRef}>
      {/* Shell */}
      <mesh position={[0, TOTAL_H / 2, 0]}>
        <boxGeometry args={[BLDG_W, TOTAL_H, BLDG_D]} />
        <meshStandardMaterial
          color="#1a1a2e"
          emissive={isHighCPU ? '#ff3300' : '#3344ff'}
          emissiveIntensity={isHighCPU ? 0.3 : 0.05}
          transparent
          opacity={0.92}
        />
      </mesh>

      {/* Floor separators */}
      {Array.from({ length: FLOORS }).map((_, i) => (
        <mesh key={i} position={[0, i * FLOOR_H, 0]}>
          <boxGeometry args={[BLDG_W + 0.02, 0.04, BLDG_D + 0.02]} />
          <meshStandardMaterial color="#2a2a4e" />
        </mesh>
      ))}

      <WaterFill memPercent={metrics.memory.usedPercent} />

      {metrics.disk.slice(0, FLOORS).map((d, i) => (
        <DiskFloor key={d.mount} usedPercent={d.usedPercent} floor={i} />
      ))}

      {Array.from({ length: FLOORS }).map((_, i) => (
        <FloorWindows key={i} cpuPercent={metrics.cpu.overall} floor={i} />
      ))}

      <NetworkBeams bytesIn={metrics.network.bytesIn} bytesOut={metrics.network.bytesOut} />
    </group>
  )
}
