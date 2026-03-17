import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

function GridLines() {
  const geometry = useMemo(() => {
    const size = 30
    const divisions = 30
    const step = (size * 2) / divisions
    const positions: number[] = []

    for (let i = 0; i <= divisions; i++) {
      const p = -size + i * step
      positions.push(p, 0, -size, p, 0, size)
      positions.push(-size, 0, p, size, 0, p)
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    return geo
  }, [])

  const matRef = useRef<THREE.LineBasicMaterial>(null)

  useFrame(({ clock }) => {
    if (matRef.current) {
      matRef.current.opacity = 0.055 + Math.sin(clock.getElapsedTime() * 0.35) * 0.012
    }
  })

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial ref={matRef} color="#6366f1" transparent opacity={0.055} depthWrite={false} />
    </lineSegments>
  )
}

// Soft glowing disc beneath the building — pulses gently
function BuildingHalo() {
  const matRef = useRef<THREE.MeshStandardMaterial>(null)

  useFrame(({ clock }) => {
    if (matRef.current) {
      matRef.current.opacity = 0.18 + Math.sin(clock.getElapsedTime() * 0.6) * 0.07
      matRef.current.emissiveIntensity = 0.5 + Math.sin(clock.getElapsedTime() * 0.6) * 0.2
    }
  })

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]}>
      <circleGeometry args={[2.8, 48]} />
      <meshStandardMaterial
        ref={matRef}
        color="#00d4ff"
        emissive="#00d4ff"
        emissiveIntensity={0.5}
        transparent
        opacity={0.18}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}

// Outer diffuse ring — slightly larger, fainter
function OuterGlow() {
  const matRef = useRef<THREE.MeshStandardMaterial>(null)

  useFrame(({ clock }) => {
    if (matRef.current) {
      matRef.current.opacity = 0.07 + Math.sin(clock.getElapsedTime() * 0.4 + 1.2) * 0.03
    }
  })

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
      <ringGeometry args={[2.4, 5.5, 64]} />
      <meshStandardMaterial
        ref={matRef}
        color="#6366f1"
        emissive="#6366f1"
        emissiveIntensity={0.4}
        transparent
        opacity={0.07}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}

export function Ground() {
  return (
    <group position={[0, 0.001, 0]}>
      {/* Dark base plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]}>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#05050e" />
      </mesh>

      <GridLines />
      <BuildingHalo />
      <OuterGlow />
    </group>
  )
}
