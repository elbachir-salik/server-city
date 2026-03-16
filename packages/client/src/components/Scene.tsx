import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Environment } from '@react-three/drei'
import * as THREE from 'three'
import { ServerMetrics } from '@servercity/shared'

// ──────────────────────────────────────────────
// CPU Windows
// ──────────────────────────────────────────────
interface WindowsProps {
  cpuPercent: number
  floor: number
  buildingWidth: number
  buildingDepth: number
  floorHeight: number
}

function FloorWindows({ cpuPercent, floor, buildingWidth, buildingDepth, floorHeight }: WindowsProps) {
  const COLS = 6
  const litCount = Math.round((cpuPercent / 100) * COLS)
  const isHot = cpuPercent > 90

  return (
    <>
      {Array.from({ length: COLS }).map((_, i) => {
        const lit = i < litCount
        const x = (i - (COLS - 1) / 2) * (buildingWidth / COLS)
        const y = floor * floorHeight + floorHeight * 0.5
        const color = isHot ? '#ff4400' : lit ? '#fffbe6' : '#111'
        const emissive = isHot ? '#ff2200' : lit ? '#ffd700' : '#000'
        const intensity = lit ? (isHot ? 2 : 1.2) : 0
        return (
          <mesh key={i} position={[x, y, buildingDepth / 2 + 0.01]}>
            <planeGeometry args={[buildingWidth / COLS - 0.08, floorHeight * 0.45]} />
            <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={intensity} />
          </mesh>
        )
      })}
    </>
  )
}

// ──────────────────────────────────────────────
// Memory Water Level
// ──────────────────────────────────────────────
interface WaterProps {
  memPercent: number
  buildingWidth: number
  buildingDepth: number
  totalHeight: number
}

function WaterFill({ memPercent, buildingWidth, buildingDepth, totalHeight }: WaterProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const fillHeight = (memPercent / 100) * totalHeight
  const isDanger = memPercent > 85
  const color = isDanger ? '#ff2244' : '#2266ff'

  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.position.y = fillHeight / 2 + Math.sin(clock.getElapsedTime() * 1.5) * 0.02
    }
  })

  if (fillHeight < 0.05) return null

  return (
    <mesh ref={meshRef} position={[0, fillHeight / 2, 0]}>
      <boxGeometry args={[buildingWidth - 0.1, fillHeight, buildingDepth - 0.1]} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={0.35}
        roughness={0.1}
        metalness={0.1}
      />
    </mesh>
  )
}

// ──────────────────────────────────────────────
// Disk Floor Fill
// ──────────────────────────────────────────────
interface DiskFloorProps {
  usedPercent: number
  floor: number
  buildingWidth: number
  buildingDepth: number
  floorHeight: number
}

function DiskFloor({ usedPercent, floor, buildingWidth, buildingDepth, floorHeight }: DiskFloorProps) {
  const fillW = (usedPercent / 100) * (buildingWidth - 0.2)
  const color = usedPercent > 90 ? '#ef4444' : usedPercent > 70 ? '#f59e0b' : '#22c55e'
  const y = floor * floorHeight + 0.05

  return (
    <mesh position={[-(buildingWidth - 0.2 - fillW) / 2, y, 0]}>
      <boxGeometry args={[fillW, 0.06, buildingDepth - 0.2]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} />
    </mesh>
  )
}

// ──────────────────────────────────────────────
// Network Beams
// ──────────────────────────────────────────────
interface BeamProps {
  bytesIn: number
  bytesOut: number
  buildingWidth: number
  totalHeight: number
}

function NetworkBeams({ bytesIn, bytesOut, buildingWidth, totalHeight }: BeamProps) {
  const beamRef = useRef<THREE.Mesh>(null)
  const beamRef2 = useRef<THREE.Mesh>(null)

  const inScale = Math.min(1, bytesIn / 1_000_000)
  const outScale = Math.min(1, bytesOut / 1_000_000)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (beamRef.current) {
      beamRef.current.position.y = ((t * 2) % totalHeight)
    }
    if (beamRef2.current) {
      beamRef2.current.position.y = ((t * 1.5 + totalHeight / 2) % totalHeight)
    }
  })

  return (
    <>
      {/* Bytes In — blue beam, left side */}
      {inScale > 0.01 && (
        <mesh ref={beamRef} position={[-(buildingWidth / 2 + 0.15), totalHeight / 2, 0]}>
          <boxGeometry args={[0.06 + inScale * 0.1, 0.6 + inScale * 0.4, 0.06]} />
          <meshStandardMaterial color="#60a5fa" emissive="#3b82f6" emissiveIntensity={1.5} transparent opacity={0.8} />
        </mesh>
      )}
      {/* Bytes Out — green beam, right side */}
      {outScale > 0.01 && (
        <mesh ref={beamRef2} position={[buildingWidth / 2 + 0.15, totalHeight / 2, 0]}>
          <boxGeometry args={[0.06 + outScale * 0.1, 0.6 + outScale * 0.4, 0.06]} />
          <meshStandardMaterial color="#4ade80" emissive="#22c55e" emissiveIntensity={1.5} transparent opacity={0.8} />
        </mesh>
      )}
    </>
  )
}

// ──────────────────────────────────────────────
// Main Building
// ──────────────────────────────────────────────
const FLOORS = 5
const FLOOR_H = 1.2
const BLDG_W = 3
const BLDG_D = 2
const TOTAL_H = FLOORS * FLOOR_H

interface BuildingProps {
  metrics: ServerMetrics
  connected: boolean
}

function Building({ metrics, connected }: BuildingProps) {
  const groupRef = useRef<THREE.Group>(null)
  const scaleRef = useRef(connected ? 1 : 0)

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const target = connected ? 1 : 0
    scaleRef.current += (target - scaleRef.current) * 0.04
    groupRef.current.scale.y = scaleRef.current

    // OOM shake
    if (metrics.memory.usedPercent > 95) {
      groupRef.current.position.x = Math.sin(clock.getElapsedTime() * 30) * 0.04
    } else {
      groupRef.current.position.x = 0
    }
  })

  const isHighCPU = metrics.cpu.overall > 90
  const cpuGlowColor = isHighCPU ? '#ff3300' : '#3344ff'

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* Building shell — hollow look via wireframe overlay */}
      <mesh position={[0, TOTAL_H / 2, 0]}>
        <boxGeometry args={[BLDG_W, TOTAL_H, BLDG_D]} />
        <meshStandardMaterial
          color="#1a1a2e"
          emissive={cpuGlowColor}
          emissiveIntensity={isHighCPU ? 0.3 : 0.05}
          transparent
          opacity={0.92}
        />
      </mesh>

      {/* Floor separator lines */}
      {Array.from({ length: FLOORS }).map((_, i) => (
        <mesh key={i} position={[0, i * FLOOR_H, 0]}>
          <boxGeometry args={[BLDG_W + 0.02, 0.04, BLDG_D + 0.02]} />
          <meshStandardMaterial color="#2a2a4e" />
        </mesh>
      ))}

      {/* Memory water */}
      <WaterFill
        memPercent={metrics.memory.usedPercent}
        buildingWidth={BLDG_W}
        buildingDepth={BLDG_D}
        totalHeight={TOTAL_H}
      />

      {/* Disk floors */}
      {metrics.disk.slice(0, FLOORS).map((d, i) => (
        <DiskFloor
          key={d.mount}
          usedPercent={d.usedPercent}
          floor={i}
          buildingWidth={BLDG_W}
          buildingDepth={BLDG_D}
          floorHeight={FLOOR_H}
        />
      ))}

      {/* CPU windows (front face only) */}
      {Array.from({ length: FLOORS }).map((_, i) => (
        <FloorWindows
          key={i}
          cpuPercent={metrics.cpu.overall}
          floor={i}
          buildingWidth={BLDG_W}
          buildingDepth={BLDG_D}
          floorHeight={FLOOR_H}
        />
      ))}

      {/* Network beams */}
      <NetworkBeams
        bytesIn={metrics.network.bytesIn}
        bytesOut={metrics.network.bytesOut}
        buildingWidth={BLDG_W}
        totalHeight={TOTAL_H}
      />
    </group>
  )
}

// ──────────────────────────────────────────────
// Ground plane
// ──────────────────────────────────────────────
function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
      <planeGeometry args={[40, 40]} />
      <meshStandardMaterial color="#080810" />
    </mesh>
  )
}

// ──────────────────────────────────────────────
// Idle placeholder building (no connection)
// ──────────────────────────────────────────────
function IdleBuilding() {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (ref.current) (ref.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.05 + Math.sin(clock.getElapsedTime()) * 0.03
  })
  return (
    <mesh ref={ref as React.Ref<THREE.Mesh>} position={[0, TOTAL_H / 2, 0]}>
      <boxGeometry args={[BLDG_W, TOTAL_H, BLDG_D]} />
      <meshStandardMaterial color="#1a1a2e" emissive="#2233aa" emissiveIntensity={0.05} />
    </mesh>
  )
}

// ──────────────────────────────────────────────
// Scene export
// ──────────────────────────────────────────────
interface SceneProps {
  metrics: ServerMetrics | null
  connected: boolean
}

export function Scene({ metrics, connected }: SceneProps) {
  return (
    <Canvas
      camera={{ position: [8, 7, 10], fov: 45 }}
      gl={{ antialias: true }}
      shadows
    >
      <color attach="background" args={['#0a0a0f']} />
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 10, 5]} intensity={0.6} castShadow />
      <pointLight position={[0, 8, 0]} intensity={0.5} color="#6366f1" />

      <Ground />

      {metrics && connected ? (
        <Building metrics={metrics} connected={connected} />
      ) : (
        <>
          <IdleBuilding />
          {/* Floor separator lines for idle state */}
          {Array.from({ length: FLOORS }).map((_, i) => (
            <mesh key={i} position={[0, i * FLOOR_H, 0]}>
              <boxGeometry args={[BLDG_W + 0.02, 0.04, BLDG_D + 0.02]} />
              <meshStandardMaterial color="#2a2a4e" />
            </mesh>
          ))}
        </>
      )}

      <OrbitControls
        enablePan={false}
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI / 2.2}
        minDistance={5}
        maxDistance={25}
      />
      <fog attach="fog" args={['#0a0a0f', 20, 50]} />
    </Canvas>
  )
}
