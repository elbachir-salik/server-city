import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { TOTAL_H } from './constants'

interface SceneLightsProps {
  cpuPercent: number
  memPercent: number
}

// Rim light hue shifts from cool blue (low CPU) → orange-red (high CPU)
function cpuRimColor(cpu: number): THREE.Color {
  const t = Math.min(1, cpu / 100)
  // blue #3b82f6 → red #ef4444
  return new THREE.Color().lerpColors(
    new THREE.Color('#3b82f6'),
    new THREE.Color('#ef4444'),
    t,
  )
}

export function SceneLights({ cpuPercent, memPercent }: SceneLightsProps) {
  const rimRef = useRef<THREE.PointLight>(null)
  const innerRef = useRef<THREE.PointLight>(null)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()

    // Rim light: update color every frame based on CPU
    if (rimRef.current) {
      rimRef.current.color = cpuRimColor(cpuPercent)
      // High CPU → stronger rim pulse
      const baseIntensity = 0.4 + (cpuPercent / 100) * 0.8
      rimRef.current.intensity = baseIntensity + Math.sin(t * 3) * 0.1 * (cpuPercent / 100)
    }

    // Inner light: pulses with memory usage
    if (innerRef.current) {
      const memT = memPercent / 100
      const pulse = Math.sin(t * (1 + memT * 4)) * 0.15
      innerRef.current.intensity = 0.3 + memT * 0.7 + pulse
      // Color: blue → red as memory fills
      innerRef.current.color = new THREE.Color().lerpColors(
        new THREE.Color('#4466ff'),
        new THREE.Color('#ff2244'),
        Math.max(0, (memPercent - 70) / 30), // starts shifting at 70%
      )
    }
  })

  return (
    <>
      {/* Static lights */}
      <ambientLight intensity={0.25} />
      <directionalLight position={[5, 10, 5]} intensity={0.6} castShadow />

      {/* Rim light — orbits behind/above, reacts to CPU */}
      <pointLight
        ref={rimRef}
        position={[-6, TOTAL_H + 2, -4]}
        intensity={0.5}
        distance={20}
        color="#3b82f6"
      />

      {/* Inner building light — pulses with memory */}
      <pointLight
        ref={innerRef}
        position={[0, TOTAL_H * 0.4, 0]}
        intensity={0.3}
        distance={8}
        color="#4466ff"
      />

      {/* Accent top light */}
      <pointLight position={[0, TOTAL_H + 1, 0]} intensity={0.4} color="#6366f1" distance={12} />
    </>
  )
}
