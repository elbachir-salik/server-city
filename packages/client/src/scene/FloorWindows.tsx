import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BLDG_D, BLDG_W, FLOOR_H } from './constants'

export interface FloorWindowsProps {
  cpuPercent: number
  floor: number
}

// Pre-allocated to avoid per-frame GC
const _hotA = new THREE.Color('#ff6600')
const _hotB = new THREE.Color('#ff0000')
const _tmp = new THREE.Color()

// ── Single animated window pane ──────────────────────────────────────────────
interface WindowPaneProps {
  position: [number, number, number]
  rotation: [number, number, number]
  paneWidth: number
  lit: boolean
  cpuPercent: number
  /** Phase offset so each window flickers independently */
  phase: number
}

function WindowPane({ position, rotation, paneWidth, lit, cpuPercent, phase }: WindowPaneProps) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null)
  const isHot = cpuPercent > 90

  useFrame(({ clock }) => {
    const mat = matRef.current
    if (!mat || !lit) return
    const t = clock.getElapsedTime()

    if (isHot) {
      // Cycle between orange and red, each window offset by phase
      const cycle = Math.sin(t * 8 + phase) * 0.5 + 0.5
      _tmp.lerpColors(_hotA, _hotB, cycle)
      mat.color.copy(_tmp)
      mat.emissive.copy(_tmp)
      mat.emissiveIntensity = 1.5 + cycle * 1.5
    } else {
      // Subtle gentle shimmer for normal-load windows
      mat.emissiveIntensity = 1.1 + Math.sin(t * 1.5 + phase) * 0.1
    }
  })

  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[paneWidth - 0.08, FLOOR_H * 0.45]} />
      <meshStandardMaterial
        ref={matRef}
        color={lit ? '#fffbe6' : '#111'}
        emissive={lit ? '#ffd700' : '#000'}
        emissiveIntensity={lit ? 1.2 : 0}
      />
    </mesh>
  )
}

// ── One floor's worth of windows on all four faces ───────────────────────────
const FRONT_COLS = 6
const SIDE_COLS = 3
const WIN_W_FRONT = BLDG_W / FRONT_COLS
const WIN_W_SIDE = BLDG_D / SIDE_COLS

export function FloorWindows({ cpuPercent, floor }: FloorWindowsProps) {
  const litFront = Math.round((cpuPercent / 100) * FRONT_COLS)
  const litSide = Math.round((cpuPercent / 100) * SIDE_COLS)
  const y = floor * FLOOR_H + FLOOR_H * 0.5
  const fp = floor * 100 // base phase offset per floor

  return (
    <>
      {/* Front face (+Z) */}
      {Array.from({ length: FRONT_COLS }).map((_, i) => (
        <WindowPane
          key={`f${i}`}
          position={[(i - (FRONT_COLS - 1) / 2) * WIN_W_FRONT, y, BLDG_D / 2 + 0.01]}
          rotation={[0, 0, 0]}
          paneWidth={WIN_W_FRONT}
          lit={i < litFront}
          cpuPercent={cpuPercent}
          phase={fp + i * 0.4}
        />
      ))}

      {/* Back face (−Z) */}
      {Array.from({ length: FRONT_COLS }).map((_, i) => (
        <WindowPane
          key={`b${i}`}
          position={[(i - (FRONT_COLS - 1) / 2) * WIN_W_FRONT, y, -(BLDG_D / 2 + 0.01)]}
          rotation={[0, Math.PI, 0]}
          paneWidth={WIN_W_FRONT}
          lit={i < litFront}
          cpuPercent={cpuPercent}
          phase={fp + i * 0.4 + 0.2}
        />
      ))}

      {/* Left face (−X) */}
      {Array.from({ length: SIDE_COLS }).map((_, i) => (
        <WindowPane
          key={`l${i}`}
          position={[-(BLDG_W / 2 + 0.01), y, (i - (SIDE_COLS - 1) / 2) * WIN_W_SIDE]}
          rotation={[0, -Math.PI / 2, 0]}
          paneWidth={WIN_W_SIDE}
          lit={i < litSide}
          cpuPercent={cpuPercent}
          phase={fp + i * 0.5 + 50}
        />
      ))}

      {/* Right face (+X) */}
      {Array.from({ length: SIDE_COLS }).map((_, i) => (
        <WindowPane
          key={`r${i}`}
          position={[BLDG_W / 2 + 0.01, y, (i - (SIDE_COLS - 1) / 2) * WIN_W_SIDE]}
          rotation={[0, Math.PI / 2, 0]}
          paneWidth={WIN_W_SIDE}
          lit={i < litSide}
          cpuPercent={cpuPercent}
          phase={fp + i * 0.5 + 51}
        />
      ))}
    </>
  )
}
