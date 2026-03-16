import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { TOTAL_H } from './constants'

interface SceneLightsProps {
  cpuPercent: number
  memPercent: number
}

const _rimBlue = new THREE.Color('#3b82f6')
const _rimRed = new THREE.Color('#ef4444')
const _memBlue = new THREE.Color('#4466ff')
const _memRed = new THREE.Color('#ff2244')
const _alarmOrange = new THREE.Color('#ff6600')
const _alarmRed = new THREE.Color('#ff0000')
const _tmp = new THREE.Color()

export function SceneLights({ cpuPercent, memPercent }: SceneLightsProps) {
  const rimRef = useRef<THREE.PointLight>(null)
  const innerRef = useRef<THREE.PointLight>(null)
  const alarmRef = useRef<THREE.PointLight>(null)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    const cpuT = cpuPercent / 100

    // ── Rim light: shifts blue→red with CPU ──────────────────────────────
    if (rimRef.current) {
      _tmp.lerpColors(_rimBlue, _rimRed, cpuT)
      rimRef.current.color.copy(_tmp)
      const base = 0.4 + cpuT * 0.8
      rimRef.current.intensity = base + Math.sin(t * 3) * 0.1 * cpuT
    }

    // ── Inner memory light ───────────────────────────────────────────────
    if (innerRef.current) {
      const memT = memPercent / 100
      const pulse = Math.sin(t * (1 + memT * 4)) * 0.15
      innerRef.current.intensity = 0.3 + memT * 0.7 + pulse
      const shift = Math.max(0, (memPercent - 70) / 30)
      _tmp.lerpColors(_memBlue, _memRed, shift)
      innerRef.current.color.copy(_tmp)
    }

    // ── Orbiting CPU alarm light (kicks in >70%) ─────────────────────────
    if (alarmRef.current) {
      const t70 = Math.max(0, (cpuPercent - 70) / 30)
      alarmRef.current.visible = t70 > 0.01

      if (t70 > 0) {
        // Orbit speed and radius scale with CPU
        const orbitSpeed = 0.6 + t70 * 2.5
        const orbitRadius = 4 + t70 * 2
        const angle = t * orbitSpeed
        alarmRef.current.position.set(
          Math.cos(angle) * orbitRadius,
          TOTAL_H * 0.6,
          Math.sin(angle) * orbitRadius,
        )

        // Pulse intensity — faster at higher CPU
        const pFreq = 2 + t70 * 5
        const pulseCycle = Math.abs(Math.sin(t * pFreq))
        alarmRef.current.intensity = t70 * (1.2 + pulseCycle * 1.5)

        // Color shifts orange→red
        _tmp.lerpColors(_alarmOrange, _alarmRed, pulseCycle)
        alarmRef.current.color.copy(_tmp)
      }
    }
  })

  return (
    <>
      <ambientLight intensity={0.25} />
      <directionalLight position={[5, 10, 5]} intensity={0.6} castShadow />

      {/* Rim light — reacts to CPU */}
      <pointLight ref={rimRef} position={[-6, TOTAL_H + 2, -4]} intensity={0.5} distance={20} color="#3b82f6" />

      {/* Inner building light — pulses with memory */}
      <pointLight ref={innerRef} position={[0, TOTAL_H * 0.4, 0]} intensity={0.3} distance={8} color="#4466ff" />

      {/* Accent top */}
      <pointLight position={[0, TOTAL_H + 1, 0]} intensity={0.4} color="#6366f1" distance={12} />

      {/* CPU alarm — orbits the building above 70% */}
      <pointLight ref={alarmRef} position={[4, TOTAL_H * 0.6, 0]} intensity={0} distance={10} color="#ff6600" visible={false} />
    </>
  )
}
