import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { TOTAL_H } from './constants'

const PARTICLE_COUNT = 140
const SPREAD_R = 3.5    // horizontal radius
const RISE_SPEED = 0.18 // units/sec average

// Each particle: [x, z, phase, speed, size]
interface Particle {
  x: number
  z: number
  phase: number   // initial Y phase offset
  speed: number   // rise speed multiplier
  size: number
  color: THREE.Color
}

const COLORS = [
  new THREE.Color('#00d4ff'),
  new THREE.Color('#6366f1'),
  new THREE.Color('#22c55e'),
  new THREE.Color('#a855f7'),
]

export function AmbientParticles() {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const particles = useMemo<Particle[]>(() => {
    const list: Particle[] = []
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Distribute in an annulus around the building (avoid center)
      const angle = Math.random() * Math.PI * 2
      const r = 1.2 + Math.random() * SPREAD_R
      list.push({
        x: Math.cos(angle) * r,
        z: Math.sin(angle) * r,
        phase: Math.random() * TOTAL_H,
        speed: 0.6 + Math.random() * 0.9,
        size: 0.018 + Math.random() * 0.028,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      })
    }
    return list
  }, [])

  // Pre-allocate color array for instanced mesh
  const colors = useMemo(() => {
    const arr = new Float32Array(PARTICLE_COUNT * 3)
    particles.forEach((p, i) => {
      arr[i * 3]     = p.color.r
      arr[i * 3 + 1] = p.color.g
      arr[i * 3 + 2] = p.color.b
    })
    return arr
  }, [particles])

  useFrame(({ clock }) => {
    const mesh = meshRef.current
    if (!mesh) return
    const t = clock.getElapsedTime()

    // Set per-instance colors once on first frame
    if (!mesh.instanceColor) {
      const colorAttr = new THREE.InstancedBufferAttribute(colors, 3)
      mesh.instanceColor = colorAttr
    }

    particles.forEach((p, i) => {
      // Y rises continuously, wraps back to 0 at TOTAL_H + 1
      const rawY = (p.phase + t * RISE_SPEED * p.speed) % (TOTAL_H + 1.5)
      // Fade: 0 at bottom/top, bright in middle
      const fadeT = rawY / (TOTAL_H + 1.5)
      const fade = Math.sin(fadeT * Math.PI)

      // Gentle horizontal drift
      const driftX = Math.sin(t * 0.4 + p.phase) * 0.15
      const driftZ = Math.cos(t * 0.35 + p.phase * 1.3) * 0.12

      dummy.position.set(p.x + driftX, rawY, p.z + driftZ)
      dummy.scale.setScalar(p.size * (0.5 + fade * 0.5))
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)

      // Vary opacity via scale (opacity not directly settable per instance)
    })

    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, PARTICLE_COUNT]}>
      <sphereGeometry args={[1, 4, 4]} />
      <meshStandardMaterial
        color="#00d4ff"
        emissive="#00d4ff"
        emissiveIntensity={2.5}
        transparent
        opacity={0.55}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        vertexColors
      />
    </instancedMesh>
  )
}
