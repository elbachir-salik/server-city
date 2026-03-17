import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BLDG_D, BLDG_W, FLOOR_H } from './constants'

export interface FloorWindowsProps {
  cpuPercent: number
  floor: number
}

// Pre-allocated color cache
const _off   = new THREE.Color('#0d1a2e')
const _dim   = new THREE.Color('#a8c4e8')
const _white = new THREE.Color('#e8f4ff')
const _amber = new THREE.Color('#f59e0b')
const _red   = new THREE.Color('#ef4444')
const _tmp   = new THREE.Color()

function windowColor(cpuPercent: number): THREE.Color {
  if (cpuPercent >= 90) return _red
  if (cpuPercent >= 80) return _amber
  if (cpuPercent >= 50) return _white
  return _dim
}

// Small glowing window pane
interface PaneProps {
  position: [number, number, number]
  rotation: [number, number, number]
  lit: boolean
  cpuPercent: number
  phase: number
}

function Pane({ position, rotation, lit, cpuPercent, phase }: PaneProps) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null)
  const isHot = cpuPercent > 90
  const isWarm = cpuPercent > 80

  useFrame(({ clock }) => {
    const mat = matRef.current
    if (!mat) return
    if (!lit) return
    const t = clock.getElapsedTime()

    if (isHot) {
      // Red flicker — each window independently
      const flicker = Math.abs(Math.sin(t * 12 + phase))
      _tmp.lerpColors(_amber, _red, flicker)
      mat.color.copy(_tmp)
      mat.emissive.copy(_tmp)
      mat.emissiveIntensity = 1.8 + flicker * 1.4
    } else if (isWarm) {
      mat.emissiveIntensity = 1.4 + Math.sin(t * 3 + phase) * 0.3
    } else {
      // Subtle shimmer
      mat.emissiveIntensity = 0.9 + Math.sin(t * 1.2 + phase) * 0.15
    }
  })

  const col = lit ? windowColor(cpuPercent) : _off
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[0.19, 0.22]} />
      <meshStandardMaterial
        ref={matRef}
        color={col}
        emissive={col}
        emissiveIntensity={lit ? 0.9 : 0}
        depthWrite={false}
      />
    </mesh>
  )
}

// Grid layout: COLS columns × ROWS rows per face
const FRONT_COLS = 9
const SIDE_COLS  = 4
const ROWS       = 2
const TOTAL_FRONT = FRONT_COLS * ROWS
const TOTAL_SIDE  = SIDE_COLS * ROWS

// Column/row spacings
const COL_STEP_F = BLDG_W / (FRONT_COLS + 1)
const COL_STEP_S = BLDG_D / (SIDE_COLS + 1)
const ROW_STEP   = FLOOR_H / (ROWS + 1)
const FACE_OFFSET = 0.012  // slightly proud of the shell face

export function FloorWindows({ cpuPercent, floor }: FloorWindowsProps) {
  const baseY = floor * FLOOR_H

  const litFront = Math.round((cpuPercent / 100) * TOTAL_FRONT)
  const litSide  = Math.round((cpuPercent / 100) * TOTAL_SIDE)

  // Stable random phase offsets per window (memoized)
  const phases = useMemo(() => {
    const arr: number[] = []
    // front+back = TOTAL_FRONT * 2, sides = TOTAL_SIDE * 2
    const total = TOTAL_FRONT * 2 + TOTAL_SIDE * 2
    for (let i = 0; i < total; i++) arr.push((floor * 97 + i * 13.7) % (Math.PI * 2))
    return arr
  }, [floor])

  let phaseIdx = 0
  const panes: JSX.Element[] = []

  // ── Front face (+Z) ──────────────────────────────────────────────────────
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < FRONT_COLS; c++) {
      const idx = r * FRONT_COLS + c
      const x = -BLDG_W / 2 + (c + 1) * COL_STEP_F
      const y = baseY + (r + 1) * ROW_STEP
      panes.push(
        <Pane
          key={`f-${r}-${c}`}
          position={[x, y, BLDG_D / 2 + FACE_OFFSET]}
          rotation={[0, 0, 0]}
          lit={idx < litFront}
          cpuPercent={cpuPercent}
          phase={phases[phaseIdx++]}
        />
      )
    }
  }

  // ── Back face (−Z) ───────────────────────────────────────────────────────
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < FRONT_COLS; c++) {
      const idx = r * FRONT_COLS + c
      const x = BLDG_W / 2 - (c + 1) * COL_STEP_F
      const y = baseY + (r + 1) * ROW_STEP
      panes.push(
        <Pane
          key={`b-${r}-${c}`}
          position={[x, y, -(BLDG_D / 2 + FACE_OFFSET)]}
          rotation={[0, Math.PI, 0]}
          lit={idx < litFront}
          cpuPercent={cpuPercent}
          phase={phases[phaseIdx++]}
        />
      )
    }
  }

  // ── Left face (−X) ───────────────────────────────────────────────────────
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < SIDE_COLS; c++) {
      const idx = r * SIDE_COLS + c
      const z = -BLDG_D / 2 + (c + 1) * COL_STEP_S
      const y = baseY + (r + 1) * ROW_STEP
      panes.push(
        <Pane
          key={`l-${r}-${c}`}
          position={[-(BLDG_W / 2 + FACE_OFFSET), y, z]}
          rotation={[0, -Math.PI / 2, 0]}
          lit={idx < litSide}
          cpuPercent={cpuPercent}
          phase={phases[phaseIdx++]}
        />
      )
    }
  }

  // ── Right face (+X) ──────────────────────────────────────────────────────
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < SIDE_COLS; c++) {
      const idx = r * SIDE_COLS + c
      const z = BLDG_D / 2 - (c + 1) * COL_STEP_S
      const y = baseY + (r + 1) * ROW_STEP
      panes.push(
        <Pane
          key={`r-${r}-${c}`}
          position={[BLDG_W / 2 + FACE_OFFSET, y, z]}
          rotation={[0, Math.PI / 2, 0]}
          lit={idx < litSide}
          cpuPercent={cpuPercent}
          phase={phases[phaseIdx++]}
        />
      )
    }
  }

  return <>{panes}</>
}
