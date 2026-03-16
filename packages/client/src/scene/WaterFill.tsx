import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BLDG_D, BLDG_W, TOTAL_H } from './constants'

export interface WaterFillProps {
  memPercent: number
}

// Pre-allocated — no GC in render loop
const _colorNormal = new THREE.Color('#1a55ff')
const _colorDanger = new THREE.Color('#ff1133')
const _tmpColor = new THREE.Color()

const WAVE_SEGS = 24 // subdivisions for the surface plane

// ── Animated wave surface sitting at the water line ──────────────────────────
function WaveSurface({ fillHeight, danger }: { fillHeight: number; danger: boolean }) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null)

  // Geometry stays constant — we mutate its vertices each frame
  const geometry = useMemo(() => {
    return new THREE.PlaneGeometry(BLDG_W - 0.12, BLDG_D - 0.12, WAVE_SEGS, WAVE_SEGS)
  }, [])

  // Snapshot of the rest positions (XY plane before rotation)
  const origPos = useMemo(
    () => Float32Array.from(geometry.attributes.position.array as Float32Array),
    [geometry],
  )

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    const arr = geometry.attributes.position.array as Float32Array

    for (let i = 0; i < arr.length; i += 3) {
      const ox = origPos[i]     // local X
      const oy = origPos[i + 1] // local Y (depth axis, becomes Z after rotation)
      // Two sine waves with different frequencies/directions → interference pattern
      arr[i + 2] = Math.sin(ox * 3.0 + t * 2.2) * 0.025
                 + Math.sin(oy * 4.0 + t * 1.6) * 0.018
                 + Math.sin((ox + oy) * 2.0 + t * 1.1) * 0.012
    }

    geometry.attributes.position.needsUpdate = true
    geometry.computeVertexNormals()

    // Smooth color transition toward target
    if (matRef.current) {
      _tmpColor.lerpColors(_colorNormal, _colorDanger, danger ? 1 : 0)
      matRef.current.color.lerp(_tmpColor, 0.04)
      matRef.current.emissive.copy(matRef.current.color)
      // Pulse emissive intensity slightly
      matRef.current.emissiveIntensity = 0.25 + Math.sin(t * 2) * 0.05
    }
  })

  return (
    // Rotated so XY plane becomes XZ (horizontal)
    <mesh geometry={geometry} position={[0, fillHeight, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <meshStandardMaterial
        ref={matRef}
        color="#1a55ff"
        emissive="#1a55ff"
        emissiveIntensity={0.25}
        transparent
        opacity={0.75}
        roughness={0.05}
        metalness={0.4}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

// ── Volume fill box + wave surface ───────────────────────────────────────────
export function WaterFill({ memPercent }: WaterFillProps) {
  const fillHeight = (memPercent / 100) * TOTAL_H
  const isDanger = memPercent > 85

  if (fillHeight < 0.05) return null

  return (
    <group>
      {/* Translucent body */}
      <mesh position={[0, fillHeight / 2, 0]}>
        <boxGeometry args={[BLDG_W - 0.1, fillHeight, BLDG_D - 0.1]} />
        <meshStandardMaterial
          color={isDanger ? '#ff1133' : '#1a55ff'}
          transparent
          opacity={0.18}
          roughness={0.1}
          metalness={0.1}
          depthWrite={false}
        />
      </mesh>

      {/* Animated wave surface at water line */}
      <WaveSurface fillHeight={fillHeight} danger={isDanger} />
    </group>
  )
}
