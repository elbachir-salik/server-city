import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BLDG_D, BLDG_W, FLOOR_H } from './constants'
import { useServerStore } from '../store/useServerStore'

export interface DiskData {
  mount: string
  usedGb: number
  totalGb: number
  usedPercent: number
}

export interface DiskFloorProps {
  disk: DiskData | null
  floor: number
  maxUsedGb: number
  selected?: boolean
}

function diskColor(pct: number): string {
  if (pct > 90) return '#ef4444'
  if (pct > 70) return '#f59e0b'
  return '#22c55e'
}

// Front face placement — same as FloorWindows
const FACE_Z   = BLDG_D / 2 + 0.014
const BAND_W   = BLDG_W - 0.12
const ACCENT_H = 0.025
const BG_COLOR = new THREE.Color('#04040f')

export function DiskFloor({ disk, floor, maxUsedGb, selected = false }: DiskFloorProps) {
  const fillRef      = useRef<THREE.Mesh>(null)
  const fillMatRef   = useRef<THREE.MeshStandardMaterial>(null)
  const accentMatRef = useRef<THREE.MeshStandardMaterial>(null)
  const bgRef        = useRef<THREE.Mesh>(null)

  const isHovered  = useRef(false)
  const hoverProg  = useRef(0)
  const animPct    = useRef(0)

  const setSelectedFloor = useServerStore(s => s.setSelectedFloor)
  const selectedFloor    = useServerStore(s => s.selectedFloor)

  const pct   = disk ? Math.max(0, Math.min(100, disk.usedPercent)) : 0
  const color = diskColor(pct)

  // Band height scales proportionally with this floor's usedGb vs the largest floor
  const sizeRatio = disk ? Math.max(0.25, disk.usedGb / maxUsedGb) : 0.25
  const BAND_H = FLOOR_H * (0.14 + sizeRatio * 0.34)

  // Y center of band within this floor's slot
  const y = floor * FLOOR_H + FLOOR_H * 0.5

  useEffect(() => {
    if (selected) animPct.current = 0
  }, [selected])

  useFrame(({ clock }) => {
    hoverProg.current += ((isHovered.current ? 1 : 0) - hoverProg.current) * 0.10

    // Fill animation
    const speed = selected ? 0.020 : 0.060
    animPct.current += (pct - animPct.current) * speed
    const s = Math.max(0.0001, animPct.current / 100)

    // Left-edge pinned fill
    if (fillRef.current) {
      fillRef.current.scale.x = s
      fillRef.current.position.x = BAND_W * (s - 1) / 2
    }

    // Fill emissive intensity
    if (fillMatRef.current && disk) {
      const pulse = selected
        ? 1.4 + Math.abs(Math.sin(clock.getElapsedTime() * 3)) * 1.2
        : 1.5
      fillMatRef.current.emissiveIntensity = pulse + hoverProg.current * 0.7
    }

    // Accent strip intensity
    if (accentMatRef.current && disk) {
      const base = pct > 90 ? 2.2 : pct > 70 ? 1.6 : 1.1
      accentMatRef.current.emissiveIntensity = base + Math.sin(clock.getElapsedTime() * 2.5) * 0.2
    }

    // Hover lift on background band
    if (bgRef.current) {
      bgRef.current.position.z = FACE_Z + hoverProg.current * 0.008
    }
  })

  const handleClick = (e: THREE.Event) => {
    (e as unknown as { stopPropagation: () => void }).stopPropagation()
    setSelectedFloor(selectedFloor === floor ? null : floor)
  }

  return (
    <>
      {/* ── BACKGROUND BAND ── */}
      <mesh ref={bgRef} position={[0, y, FACE_Z]}>
        <planeGeometry args={[BAND_W, BAND_H]} />
        <meshStandardMaterial color={BG_COLOR} emissive={BG_COLOR} emissiveIntensity={0.3} />
      </mesh>

      {/* ── ACCENT LINE — top of band ── */}
      {disk && (
        <mesh position={[0, y + BAND_H / 2 + ACCENT_H / 2, FACE_Z]}>
          <planeGeometry args={[BAND_W, ACCENT_H]} />
          <meshStandardMaterial
            ref={accentMatRef}
            color={color}
            emissive={color}
            emissiveIntensity={1.5}
          />
        </mesh>
      )}

      {/* ── FILL — left-pinned colored bar ── */}
      {disk && (
        <mesh ref={fillRef} position={[0, y, FACE_Z + 0.001]}>
          <planeGeometry args={[BAND_W, BAND_H - 0.015]} />
          <meshStandardMaterial
            ref={fillMatRef}
            color={color}
            emissive={color}
            emissiveIntensity={1.5}
          />
        </mesh>
      )}

      {/* ── HIT AREA — pointer events, also clickable ── */}
      {disk && (
        <mesh
          position={[0, y, FACE_Z + 0.002]}
          onClick={handleClick}
          onPointerOver={(e) => {
            e.stopPropagation()
            document.body.style.cursor = 'pointer'
            isHovered.current = true
          }}
          onPointerOut={() => {
            document.body.style.cursor = 'default'
            isHovered.current = false
          }}
        >
          <planeGeometry args={[BAND_W, BAND_H + 0.4]} />
          <meshStandardMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}

      {/* ── SELECTED HIGHLIGHT — thin outline frame ── */}
      {selected && disk && (
        <mesh position={[0, y, FACE_Z - 0.001]}>
          <planeGeometry args={[BAND_W + 0.06, BAND_H + 0.06]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.5}
            transparent
            opacity={0.18}
            depthWrite={false}
          />
        </mesh>
      )}
    </>
  )
}
