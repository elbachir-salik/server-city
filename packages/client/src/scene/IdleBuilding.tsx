import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BLDG_D, BLDG_W, FLOORS, FLOOR_H, TOTAL_H } from './constants'

export function IdleBuilding() {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = 0.05 + Math.sin(clock.getElapsedTime()) * 0.03
    }
  })

  return (
    <>
      <mesh ref={meshRef} position={[0, TOTAL_H / 2, 0]}>
        <boxGeometry args={[BLDG_W, TOTAL_H, BLDG_D]} />
        <meshStandardMaterial color="#1a1a2e" emissive="#2233aa" emissiveIntensity={0.05} />
      </mesh>

      {Array.from({ length: FLOORS }).map((_, i) => (
        <mesh key={i} position={[0, i * FLOOR_H, 0]}>
          <boxGeometry args={[BLDG_W + 0.02, 0.04, BLDG_D + 0.02]} />
          <meshStandardMaterial color="#2a2a4e" />
        </mesh>
      ))}
    </>
  )
}
