import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BLDG_W, TOTAL_H } from './constants'

export interface NetworkBeamsProps {
  bytesIn: number
  bytesOut: number
}

export function NetworkBeams({ bytesIn, bytesOut }: NetworkBeamsProps) {
  const inRef = useRef<THREE.Mesh>(null)
  const outRef = useRef<THREE.Mesh>(null)

  const inScale = Math.min(1, bytesIn / 1_000_000)
  const outScale = Math.min(1, bytesOut / 1_000_000)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (inRef.current) {
      inRef.current.position.y = (t * 2) % TOTAL_H
    }
    if (outRef.current) {
      outRef.current.position.y = (t * 1.5 + TOTAL_H / 2) % TOTAL_H
    }
  })

  return (
    <>
      {inScale > 0.01 && (
        <mesh ref={inRef} position={[-(BLDG_W / 2 + 0.15), TOTAL_H / 2, 0]}>
          <boxGeometry args={[0.06 + inScale * 0.1, 0.6 + inScale * 0.4, 0.06]} />
          <meshStandardMaterial
            color="#60a5fa"
            emissive="#3b82f6"
            emissiveIntensity={1.5}
            transparent
            opacity={0.8}
          />
        </mesh>
      )}
      {outScale > 0.01 && (
        <mesh ref={outRef} position={[BLDG_W / 2 + 0.15, TOTAL_H / 2, 0]}>
          <boxGeometry args={[0.06 + outScale * 0.1, 0.6 + outScale * 0.4, 0.06]} />
          <meshStandardMaterial
            color="#4ade80"
            emissive="#22c55e"
            emissiveIntensity={1.5}
            transparent
            opacity={0.8}
          />
        </mesh>
      )}
    </>
  )
}
