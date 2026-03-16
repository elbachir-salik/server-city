import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Procedural grid using a LineSegments mesh — no texture needed
function GridLines() {
  const geometry = useMemo(() => {
    const size = 30
    const divisions = 30
    const step = (size * 2) / divisions
    const positions: number[] = []

    for (let i = 0; i <= divisions; i++) {
      const p = -size + i * step
      // Lines parallel to Z
      positions.push(p, 0, -size, p, 0, size)
      // Lines parallel to X
      positions.push(-size, 0, p, size, 0, p)
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    return geo
  }, [])

  const matRef = useRef<THREE.LineBasicMaterial>(null)

  useFrame(({ clock }) => {
    if (matRef.current) {
      // Subtle pulse on the grid
      matRef.current.opacity = 0.06 + Math.sin(clock.getElapsedTime() * 0.4) * 0.015
    }
  })

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial ref={matRef} color="#6366f1" transparent opacity={0.06} depthWrite={false} />
    </lineSegments>
  )
}

export function Ground() {
  return (
    <group position={[0, 0.001, 0]}>
      {/* Dark base plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]}>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#07070f" />
      </mesh>

      {/* Grid overlay */}
      <GridLines />
    </group>
  )
}
