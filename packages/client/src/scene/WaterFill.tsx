import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BLDG_D, BLDG_W, TOTAL_H } from './constants'

export interface WaterFillProps {
  memPercent: number
  swapUsedMb?: number
  swapTotalMb?: number
}

// Pre-allocated — no GC in render loop
const _colorBlue   = new THREE.Color('#1a55ff')
const _colorPurple = new THREE.Color('#a855f7')
const _colorRed    = new THREE.Color('#ff1133')
const _tmpColor    = new THREE.Color()

const WAVE_SEGS = 24

// ── Animated wave surface sitting at the water line ──────────────────────────
function WaveSurface({ fillHeight, memPercent }: { fillHeight: number; memPercent: number }) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null)

  const geometry = useMemo(() => {
    return new THREE.PlaneGeometry(BLDG_W - 0.12, BLDG_D - 0.12, WAVE_SEGS, WAVE_SEGS)
  }, [])

  const origPos = useMemo(
    () => Float32Array.from(geometry.attributes.position.array as Float32Array),
    [geometry],
  )

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    const arr = geometry.attributes.position.array as Float32Array

    for (let i = 0; i < arr.length; i += 3) {
      const ox = origPos[i]
      const oy = origPos[i + 1]
      arr[i + 2] = Math.sin(ox * 3.0 + t * 2.2) * 0.025
                 + Math.sin(oy * 4.0 + t * 1.6) * 0.018
                 + Math.sin((ox + oy) * 2.0 + t * 1.1) * 0.012
    }

    geometry.attributes.position.needsUpdate = true
    geometry.computeVertexNormals()

    // Color: blue → purple (>75%) → red (>90%)
    if (matRef.current) {
      if (memPercent >= 90) {
        const s = Math.min(1, (memPercent - 90) / 10)
        _tmpColor.lerpColors(_colorPurple, _colorRed, s)
      } else if (memPercent >= 75) {
        const s = (memPercent - 75) / 15
        _tmpColor.lerpColors(_colorBlue, _colorPurple, s)
      } else {
        _tmpColor.copy(_colorBlue)
      }
      matRef.current.color.lerp(_tmpColor, 0.04)
      matRef.current.emissive.copy(matRef.current.color)
      matRef.current.emissiveIntensity = 0.28 + Math.sin(t * 2) * 0.06
    }
  })

  return (
    <mesh geometry={geometry} position={[0, fillHeight, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <meshStandardMaterial
        ref={matRef}
        color="#1a55ff"
        emissive="#1a55ff"
        emissiveIntensity={0.25}
        transparent
        opacity={0.78}
        roughness={0.05}
        metalness={0.4}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

// ── Swap band — thin purple layer above the RAM fill ─────────────────────────
function SwapBand({ ramFillHeight, swapUsedMb, swapTotalMb }: { ramFillHeight: number; swapUsedMb: number; swapTotalMb: number }) {
  const swapPct = Math.min(1, swapUsedMb / swapTotalMb)
  const bandH = swapPct * TOTAL_H * 0.08
  if (bandH < 0.02) return null

  return (
    <mesh position={[0, ramFillHeight + bandH / 2, 0]}>
      <boxGeometry args={[BLDG_W - 0.1, bandH, BLDG_D - 0.1]} />
      <meshStandardMaterial
        color="#a855f7"
        emissive="#a855f7"
        emissiveIntensity={0.4}
        transparent
        opacity={0.28}
        depthWrite={false}
      />
    </mesh>
  )
}

// ── Volume fill box + wave surface ───────────────────────────────────────────
export function WaterFill({ memPercent, swapUsedMb = 0, swapTotalMb = 0 }: WaterFillProps) {
  const fillHeight = (memPercent / 100) * TOTAL_H

  if (fillHeight < 0.05) return null

  // Body color matches wave surface color
  let bodyColor = '#1a55ff'
  if (memPercent >= 90) bodyColor = '#cc1133'
  else if (memPercent >= 75) bodyColor = '#7c3aed'

  return (
    <group>
      <mesh position={[0, fillHeight / 2, 0]}>
        <boxGeometry args={[BLDG_W - 0.1, fillHeight, BLDG_D - 0.1]} />
        <meshStandardMaterial
          color={bodyColor}
          transparent
          opacity={0.16}
          roughness={0.1}
          metalness={0.1}
          depthWrite={false}
        />
      </mesh>

      <WaveSurface fillHeight={fillHeight} memPercent={memPercent} />

      {swapTotalMb > 0 && (
        <SwapBand ramFillHeight={fillHeight} swapUsedMb={swapUsedMb} swapTotalMb={swapTotalMb} />
      )}
    </group>
  )
}
