import { useRef, useMemo } from 'react'
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

// Edge geometry for glowing building outline (computed once)
const _edgeGeo = new THREE.EdgesGeometry(
  new THREE.BoxGeometry(BLDG_W + 0.01, TOTAL_H + 0.01, BLDG_D + 0.01)
)
const _edgeMat = new THREE.LineBasicMaterial({
  color: '#00d4ff',
  transparent: true,
  opacity: 0.22,
})

export function Building({ metrics, connected }: BuildingProps) {
  const groupRef = useRef<THREE.Group>(null)
  const shellMatRef = useRef<THREE.MeshStandardMaterial>(null)
  const edgeRef = useRef<THREE.LineSegments>(null)
  const selectedFloor = useServerStore(s => s.selectedFloor)
  const subdirsByMount = useServerStore(s => s.subdirsByMount)

  // Flatten all subdirs from every disk mount, sorted by size descending.
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

  // Max usedGb across all floors — used to scale band heights proportionally
  const maxUsedGb = useMemo(
    () => Math.max(...floorData.map(f => f.usedGb), 1),
    [floorData]
  )

  // Spring state: position, velocity
  const spring = useRef({ pos: connected ? 1 : 0, vel: 0 })
  const STIFFNESS = 0.1
  const DAMPING = 0.82

  const isHighCPU = metrics.cpu.overall > 90
  const maxDiskPct = metrics.disk.reduce((m, d) => Math.max(m, d.usedPercent), 0)
  const isDiskCrit = maxDiskPct > 90

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const t = clock.getElapsedTime()

    // Spring physics for rise/sink
    const target = connected ? 1 : 0
    const { pos, vel } = spring.current
    const newVel = (vel + (target - pos) * STIFFNESS) * DAMPING
    const newPos = Math.max(0, Math.min(1, pos + newVel))
    spring.current = { pos: newPos, vel: newVel }

    // Apply eased scale
    groupRef.current.scale.y = easeOutCubic(newPos)

    // Slow gentle oscillation (±3 degrees)
    groupRef.current.rotation.y = Math.sin(t * 0.09) * 0.055

    // OOM shake — amplitude grows with severity above 95%
    const mem = metrics.memory.usedPercent
    if (mem > 95) {
      const severity = (mem - 95) / 5
      const amp = 0.03 + severity * 0.06
      groupRef.current.position.x = Math.sin(t * 28) * amp
    } else {
      groupRef.current.position.x = 0
    }

    // Dark glass shell stays dark — subtle edge pulse only
    if (shellMatRef.current) {
      const baseIntensity = 0.03
      if (isHighCPU) {
        shellMatRef.current.emissiveIntensity = baseIntensity + Math.abs(Math.sin(t * 3)) * 0.04
      } else {
        shellMatRef.current.emissiveIntensity += (baseIntensity - shellMatRef.current.emissiveIntensity) * 0.04
      }
    }

    // Edge glow pulses with CPU / disk state
    if (edgeRef.current) {
      const mat = edgeRef.current.material as THREE.LineBasicMaterial
      if (isDiskCrit || isHighCPU) {
        const freq = isDiskCrit ? 2.5 : 3.5
        mat.opacity = 0.25 + Math.abs(Math.sin(t * freq)) * 0.35
        const c = isDiskCrit ? '#ff6600' : '#ff2200'
        mat.color.set(c)
      } else {
        mat.opacity = 0.15 + Math.sin(t * 0.7) * 0.07
        mat.color.set('#00d4ff')
      }
    }
  })

  return (
    <>
      {/* Ground ring + CPU corona sit outside the group so they aren't y-scaled */}
      <BaseRing riseProgress={spring.current.pos} />
      <CPUCorona cpuPercent={metrics.cpu.overall} />

      <group ref={groupRef}>
        {/* ── Dark glass shell ── */}
        <mesh position={[0, TOTAL_H / 2, 0]}>
          <boxGeometry args={[BLDG_W, TOTAL_H, BLDG_D]} />
          <meshStandardMaterial
            ref={shellMatRef}
            color="#08081a"
            emissive="#001133"
            emissiveIntensity={0.03}
            transparent
            opacity={0.82}
            metalness={0.55}
            roughness={0.18}
          />
        </mesh>

        {/* ── Glowing edge lines ── */}
        <lineSegments ref={edgeRef} position={[0, TOTAL_H / 2, 0]} geometry={_edgeGeo} material={_edgeMat} />

        {/* ── Thin cyan floor separator lines ── */}
        {Array.from({ length: FLOORS + 1 }).map((_, i) => (
          <mesh key={i} position={[0, i * FLOOR_H, 0]}>
            <boxGeometry args={[BLDG_W + 0.04, 0.022, BLDG_D + 0.04]} />
            <meshStandardMaterial color="#00d4ff" emissive="#00d4ff" emissiveIntensity={0.65} />
          </mesh>
        ))}

        <WaterFill
          memPercent={metrics.memory.usedPercent}
          swapUsedMb={metrics.swap?.usedMb}
          swapTotalMb={metrics.swap?.totalMb}
        />

        {Array.from({ length: FLOORS }).map((_, i) => (
          <DiskFloor
            key={i}
            disk={floorData[i] ?? null}
            floor={i}
            maxUsedGb={maxUsedGb}
            selected={selectedFloor === i}
          />
        ))}

        {Array.from({ length: FLOORS }).map((_, i) => (
          <FloorWindows key={i} cpuPercent={metrics.cpu.overall} floor={i} />
        ))}

        <NetworkBeams bytesIn={metrics.network.bytesIn} bytesOut={metrics.network.bytesOut} />
      </group>
    </>
  )
}
