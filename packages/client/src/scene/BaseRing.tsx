import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BLDG_W, BLDG_D } from './constants'

interface BaseRingProps {
  /** 0–1 progress of the building rise */
  riseProgress: number
}

const RING_RADIUS = Math.sqrt((BLDG_W / 2) ** 2 + (BLDG_D / 2) ** 2) + 0.4

export function BaseRing({ riseProgress }: BaseRingProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const matRef = useRef<THREE.MeshStandardMaterial>(null)
  const currentScale = useRef(riseProgress)

  useFrame(({ clock }) => {
    // Track the rise progress with its own smooth lerp
    currentScale.current += (riseProgress - currentScale.current) * 0.06

    const s = currentScale.current
    if (!meshRef.current || !matRef.current) return

    // Ring expands outward as the building rises
    const ringScale = 0.3 + s * 0.7
    meshRef.current.scale.set(ringScale, 1, ringScale)

    // Opacity fades in with rise, then settles to a gentle pulse
    const t = clock.getElapsedTime()
    const basePulse = Math.sin(t * 1.8) * 0.08
    matRef.current.opacity = s * (0.35 + basePulse)
    matRef.current.emissiveIntensity = s * (0.6 + basePulse * 1.5)
  })

  if (riseProgress < 0.01) return null

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
      {/* Torus: ring radius, tube radius, radial segs, tubular segs */}
      <torusGeometry args={[RING_RADIUS, 0.08, 8, 64]} />
      <meshStandardMaterial
        ref={matRef}
        color="#6366f1"
        emissive="#6366f1"
        emissiveIntensity={0.6}
        transparent
        opacity={0.35}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}
