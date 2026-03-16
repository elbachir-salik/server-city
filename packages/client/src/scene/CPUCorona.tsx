import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BLDG_D, BLDG_W, TOTAL_H } from './constants'

interface CPUCoronaProps {
  cpuPercent: number
}

// Corona sits just outside the building shell
const CORONA_W = BLDG_W + 0.18
const CORONA_D = BLDG_D + 0.18

const _orange = new THREE.Color('#ff6600')
const _red = new THREE.Color('#ff0000')
const _tmp = new THREE.Color()

export function CPUCorona({ cpuPercent }: CPUCoronaProps) {
  const outerRef = useRef<THREE.Mesh>(null)
  const innerRef = useRef<THREE.Mesh>(null)

  // Only meaningful above 70%
  const visible = cpuPercent > 70
  const t70 = Math.max(0, (cpuPercent - 70) / 30) // 0→1 as cpu goes 70→100%

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    const freq = 1.5 + t70 * 4.5 // 1.5 Hz at 70%, 6 Hz at 100%

    // Color cycles orange→red, faster at higher CPU
    const cycle = Math.abs(Math.sin(t * freq))
    _tmp.lerpColors(_orange, _red, cycle)

    if (outerRef.current) {
      const mat = outerRef.current.material as THREE.MeshStandardMaterial
      mat.color.copy(_tmp)
      mat.emissive.copy(_tmp)
      mat.emissiveIntensity = t70 * (0.3 + cycle * 0.5)
      mat.opacity = t70 * (0.04 + cycle * 0.06)
      outerRef.current.visible = visible
    }

    if (innerRef.current) {
      const mat = innerRef.current.material as THREE.MeshStandardMaterial
      mat.emissive.copy(_tmp)
      mat.emissiveIntensity = t70 * (0.5 + cycle * 0.8)
      mat.opacity = t70 * (0.06 + cycle * 0.08)
      innerRef.current.visible = visible
    }
  })

  return (
    <>
      {/* Outer diffuse corona */}
      <mesh ref={outerRef} position={[0, TOTAL_H / 2, 0]} visible={visible}>
        <boxGeometry args={[CORONA_W + 0.12, TOTAL_H + 0.12, CORONA_D + 0.12]} />
        <meshStandardMaterial
          color="#ff6600"
          emissive="#ff6600"
          emissiveIntensity={0}
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Inner tight corona — sharper edge */}
      <mesh ref={innerRef} position={[0, TOTAL_H / 2, 0]} visible={visible}>
        <boxGeometry args={[CORONA_W, TOTAL_H, CORONA_D]} />
        <meshStandardMaterial
          color="#ff3300"
          emissive="#ff3300"
          emissiveIntensity={0}
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
        />
      </mesh>
    </>
  )
}
