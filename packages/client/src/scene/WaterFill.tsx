import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BLDG_D, BLDG_W, TOTAL_H } from './constants'

export interface WaterFillProps {
  memPercent: number
}

export function WaterFill({ memPercent }: WaterFillProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const fillHeight = (memPercent / 100) * TOTAL_H
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
      <boxGeometry args={[BLDG_W - 0.1, fillHeight, BLDG_D - 0.1]} />
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
