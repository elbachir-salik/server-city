import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ServerMetrics } from '@servercity/shared'
import { useServerStore } from '../store/useServerStore'
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
  const selectedFloor   = useServerStore(s => s.selectedFloor)
  const subdirsByMount  = useServerStore(s => s.subdirsByMount)

  // Flatten all subdirs from every disk mount, sorted by size descending.
  // Each gets usedPercent relative to its parent disk's total.
  // Falls back to raw disk mount entries while subdirs are still loading.
  const allSubdirs = metrics.disk
    .flatMap(disk =>
      (subdirsByMount[disk.mount] ?? []).map(sub => ({
        mount: sub.path,
        usedGb: sub.usedGb,
        totalGb: disk.totalGb,
        usedPercent: Math.min(100, Math.round((sub.usedGb / disk.totalGb) * 100)),
      }))
    )
    .sort((a, b) => b.usedGb - a.usedGb)
    .slice(0, FLOORS)

  const floorData = allSubdirs.length > 0 ? allSubdirs : metrics.disk.slice(0, FLOORS)
  const shellMatRef = useRef<THREE.MeshStandardMaterial>(null)

  // Spring state: position, velocity
  const spring = useRef({ pos: connected ? 1 : 0, vel: 0 })
  const STIFFNESS = 0.1
  const DAMPING = 0.82

  const isHighCPU  = metrics.cpu.overall > 90
  const maxDiskPct = metrics.disk.reduce((m, d) => Math.max(m, d.usedPercent), 0)
  const isDiskWarn = maxDiskPct > 70
  const isDiskCrit = maxDiskPct > 90

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

    // Animate shell emissive — priority: CPU (red) > disk-crit (orange) > disk-warn (amber) > idle (blue)
    if (shellMatRef.current) {
      if (isHighCPU) {
        const freq = 2 + (metrics.cpu.overall - 90) * 0.15
        shellMatRef.current.emissiveIntensity = 0.2 + Math.abs(Math.sin(clock.getElapsedTime() * freq)) * 0.25
        shellMatRef.current.emissive.set('#ff3300')
      } else if (isDiskCrit) {
        // Disk >90% — orange pulse, speed scales with fullness
        const severity = (maxDiskPct - 90) / 10   // 0→1 as disk goes 90→100%
        const freq = 1.5 + severity * 2.5
        shellMatRef.current.emissiveIntensity = 0.18 + Math.abs(Math.sin(clock.getElapsedTime() * freq)) * 0.22
        shellMatRef.current.emissive.set('#ff6600')
      } else if (isDiskWarn) {
        // Disk 70–90% — slow amber glow
        shellMatRef.current.emissiveIntensity += (0.12 - shellMatRef.current.emissiveIntensity) * 0.05
        shellMatRef.current.emissive.set('#ffaa00')
      } else {
        shellMatRef.current.emissiveIntensity += (0.05 - shellMatRef.current.emissiveIntensity) * 0.05
        shellMatRef.current.emissive.set('#3344ff')
      }
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
            <meshStandardMaterial color="#4a4a8e" emissive="#5a5aae" emissiveIntensity={0.35} />
          </mesh>
        ))}

        <WaterFill
          memPercent={metrics.memory.usedPercent}
          swapUsedMb={metrics.swap?.usedMb}
          swapTotalMb={metrics.swap?.totalMb}
        />

        {Array.from({ length: FLOORS }).map((_, i) => (
          <DiskFloor key={i} disk={floorData[i] ?? null} floor={i} selected={selectedFloor === i} />
        ))}

        {Array.from({ length: FLOORS }).map((_, i) => (
          <FloorWindows key={i} cpuPercent={metrics.cpu.overall} floor={i} />
        ))}

        <NetworkBeams bytesIn={metrics.network.bytesIn} bytesOut={metrics.network.bytesOut} />
      </group>
    </>
  )
}
