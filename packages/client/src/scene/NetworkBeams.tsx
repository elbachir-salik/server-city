import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BLDG_W, TOTAL_H } from './constants'

export interface NetworkBeamsProps {
  bytesIn: number
  bytesOut: number
}

const BEAM_COUNT = 5

// Log scale so even small traffic shows activity, large traffic doesn't overflow
function logScale(bytes: number): number {
  if (bytes <= 0) return 0
  return Math.min(1, Math.log10(1 + bytes / 10_000) / 5)
}

interface SingleBeamProps {
  x: number
  /** 0–1 offset so beams are staggered vertically */
  phaseOffset: number
  speed: number
  /** beam body width */
  bodyW: number
  color: string
  emissive: string
  visible: boolean
}

function SingleBeam({ x, phaseOffset, speed, bodyW, color, emissive, visible }: SingleBeamProps) {
  const groupRef = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    if (!groupRef.current || !visible) return
    const t = clock.getElapsedTime() * speed + phaseOffset * TOTAL_H
    groupRef.current.position.y = t % TOTAL_H
  })

  if (!visible) return null

  return (
    <group ref={groupRef} position={[x, 0, 0]}>
      {/* Core beam — narrow, bright */}
      <mesh>
        <boxGeometry args={[bodyW, 0.55, bodyW]} />
        <meshStandardMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={3}
          transparent
          opacity={0.95}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Inner halo — slightly wider, semi-transparent */}
      <mesh>
        <boxGeometry args={[bodyW * 2.5, 0.7, bodyW * 2.5]} />
        <meshStandardMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={1.2}
          transparent
          opacity={0.25}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Outer diffuse glow — wide, very faint */}
      <mesh>
        <boxGeometry args={[bodyW * 5, 0.9, bodyW * 5]} />
        <meshStandardMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={0.4}
          transparent
          opacity={0.08}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  )
}

export function NetworkBeams({ bytesIn, bytesOut }: NetworkBeamsProps) {
  const inScale = logScale(bytesIn)
  const outScale = logScale(bytesOut)

  const inVisible = inScale > 0.01
  const outVisible = outScale > 0.01

  // Beam body width and speed scale with traffic
  const inBodyW = 0.045 + inScale * 0.07
  const outBodyW = 0.045 + outScale * 0.07
  const inSpeed = 1.5 + inScale * 4
  const outSpeed = 1.5 + outScale * 4

  const xIn = -(BLDG_W / 2 + 0.18)
  const xOut = BLDG_W / 2 + 0.18

  // Stagger offsets so beams don't all start at the same height
  const phases = useMemo(
    () => Array.from({ length: BEAM_COUNT }, (_, i) => i / BEAM_COUNT),
    [],
  )

  return (
    <>
      {phases.map((phase, i) => (
        <SingleBeam
          key={`in-${i}`}
          x={xIn}
          phaseOffset={phase}
          speed={inSpeed * (0.85 + i * 0.08)}
          bodyW={inBodyW}
          color="#93c5fd"
          emissive="#3b82f6"
          visible={inVisible}
        />
      ))}

      {phases.map((phase, i) => (
        <SingleBeam
          key={`out-${i}`}
          x={xOut}
          phaseOffset={phase}
          speed={outSpeed * (0.85 + i * 0.08)}
          bodyW={outBodyW}
          color="#86efac"
          emissive="#22c55e"
          visible={outVisible}
        />
      ))}
    </>
  )
}
