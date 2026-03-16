import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BLDG_D, BLDG_W, FLOORS, FLOOR_H, TOTAL_H } from './constants'

interface IdleBuildingProps {
  connecting?: boolean
}

export function IdleBuilding({ connecting = false }: IdleBuildingProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const wireRef = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()

    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = connecting
        ? 0.08 + Math.abs(Math.sin(t * 1.2)) * 0.12  // brighter, faster pulse while connecting
        : 0.04 + Math.sin(t) * 0.02                   // slow ambient idle
    }

    if (wireRef.current) {
      const mat = wireRef.current.material as THREE.MeshBasicMaterial
      // Wireframe fades in when connecting, fades out when idle
      const targetOpacity = connecting ? 0.25 + Math.abs(Math.sin(t * 2)) * 0.2 : 0
      mat.opacity += (targetOpacity - mat.opacity) * 0.05
    }
  })

  return (
    <>
      {/* Solid body */}
      <mesh ref={meshRef} position={[0, TOTAL_H / 2, 0]}>
        <boxGeometry args={[BLDG_W, TOTAL_H, BLDG_D]} />
        <meshStandardMaterial color="#1a1a2e" emissive="#2233aa" emissiveIntensity={0.04} />
      </mesh>

      {/* Wireframe overlay — pulses when connecting */}
      <mesh ref={wireRef} position={[0, TOTAL_H / 2, 0]}>
        <boxGeometry args={[BLDG_W + 0.01, TOTAL_H + 0.01, BLDG_D + 0.01]} />
        <meshBasicMaterial
          color="#6366f1"
          wireframe
          transparent
          opacity={0}
        />
      </mesh>

      {/* Floor separators */}
      {Array.from({ length: FLOORS }).map((_, i) => (
        <mesh key={i} position={[0, i * FLOOR_H, 0]}>
          <boxGeometry args={[BLDG_W + 0.02, 0.04, BLDG_D + 0.02]} />
          <meshStandardMaterial color="#2a2a4e" />
        </mesh>
      ))}
    </>
  )
}
