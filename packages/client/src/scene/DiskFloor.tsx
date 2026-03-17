import { useRef, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
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
  selected?: boolean
}

function diskColor(pct: number): string {
  if (pct > 90) return '#ef4444'
  if (pct > 70) return '#f59e0b'
  return '#22c55e'
}

// Place panels ON the exterior shell faces — same pattern as FloorWindows
const FACE_Z    = BLDG_D / 2 + 0.012   // front face (+Z)
const BAND_W    = BLDG_W - 0.14        // 2.86  — full front face width minus margin
const BAND_H    = FLOOR_H * 0.30       // horizontal band height
const ACCENT_H  = 0.03                 // thin accent strip at top of band
const BG_COLOR  = new THREE.Color('#0b0b1c')

export function DiskFloor({ disk, floor, selected = false }: DiskFloorProps) {
  const fillRef     = useRef<THREE.Mesh>(null)
  const fillMatRef  = useRef<THREE.MeshStandardMaterial>(null)
  const accentMatRef = useRef<THREE.MeshStandardMaterial>(null)

  const isHovered = useRef(false)
  const hoverProg = useRef(0)
  const [showPanel, setShowPanel] = useState(false)
  const animPct   = useRef(0)   // 0 → pct, resets on select

  const pct   = disk ? Math.max(0, Math.min(100, disk.usedPercent)) : 0
  const color = diskColor(pct)
  // Band sits centered vertically in each floor slot
  const y     = floor * FLOOR_H + FLOOR_H * 0.5

  useEffect(() => {
    if (selected) animPct.current = 0
  }, [selected])

  useFrame(({ clock }) => {
    hoverProg.current += ((isHovered.current ? 1 : 0) - hoverProg.current) * 0.10

    // Fill animation: selected = slow dramatic reveal, otherwise quick on mount
    const speed = selected ? 0.022 : 0.055
    animPct.current += (pct - animPct.current) * speed

    const s = Math.max(0.0001, animPct.current / 100)

    // Left-edge pinned: scale fill in X, shift center to keep left side fixed
    if (fillRef.current) {
      fillRef.current.scale.x = s
      fillRef.current.position.x = BAND_W * (s - 1) / 2
    }

    // Emissive intensity
    if (fillMatRef.current && disk) {
      const pulse = selected
        ? 1.3 + Math.abs(Math.sin(clock.getElapsedTime() * 3)) * 1.4
        : 1.6
      fillMatRef.current.emissiveIntensity = pulse + hoverProg.current * 0.6
    }

    // Accent line intensity varies with urgency
    if (accentMatRef.current && disk) {
      const base = pct > 90 ? 2.0 : pct > 70 ? 1.5 : 1.1
      accentMatRef.current.emissiveIntensity =
        base + Math.sin(clock.getElapsedTime() * 2.5) * 0.25
    }
  })

  const freeGb = disk ? disk.totalGb - disk.usedGb : 0
  const panelVisible = showPanel || selected
  const subdirs = useServerStore(s => disk ? (s.subdirsByMount[disk.mount] ?? []) : [])

  return (
    <>
      {/* ── BACKGROUND BAND — dark strip showing the "empty" portion ── */}
      <mesh position={[0, y, FACE_Z]}>
        <planeGeometry args={[BAND_W, BAND_H]} />
        <meshStandardMaterial
          color={BG_COLOR}
          emissive={BG_COLOR}
          emissiveIntensity={0.25}
        />
      </mesh>

      {/* ── ACCENT LINE — thin colored strip at top of band, usage color ── */}
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

      {/* ── FILL — left-pinned, width = animPct% of BAND_W, usage color ── */}
      {disk && (
        <mesh
          ref={fillRef}
          position={[0, y, FACE_Z + 0.001]}   // fractionally in front of bg
        >
          <planeGeometry args={[BAND_W, BAND_H - 0.02]} />
          <meshStandardMaterial
            ref={fillMatRef}
            color={color}
            emissive={color}
            emissiveIntensity={1.6}
          />
        </mesh>
      )}

      {/* ── HIT AREA — pointer events on front face ── */}
      {disk && (
        <mesh
          position={[0, y, FACE_Z + 0.002]}
          onPointerOver={(e) => {
            e.stopPropagation()
            document.body.style.cursor = 'pointer'
            isHovered.current = true
            setShowPanel(true)
          }}
          onPointerOut={() => {
            document.body.style.cursor = 'default'
            isHovered.current = false
            setShowPanel(false)
          }}
        >
          <planeGeometry args={[BAND_W, BAND_H + 0.3]} />
          <meshStandardMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}

      {/* ── DETAIL PANEL ── */}
      {panelVisible && disk && (
        <Html
          position={[BLDG_W / 2 + 0.45, y, FACE_Z]}
          center={false}
          occlude={false}
          style={{ pointerEvents: 'none' }}
        >
          <div
            style={{
              background: selected ? 'rgba(12,12,28,0.97)' : 'rgba(8,8,18,0.93)',
              border: `1px solid ${color}${selected ? 'cc' : '66'}`,
              borderRadius: 7,
              padding: '7px 11px',
              whiteSpace: 'nowrap',
              fontFamily: 'monospace',
              fontSize: 11,
              color,
              minWidth: 158,
              lineHeight: 1.7,
              boxShadow: selected ? `0 0 20px ${color}44` : 'none',
            }}
          >
            <div style={{ fontSize: 10, opacity: 0.6, marginBottom: 4 }}>
              FLOOR {floor + 1} — {disk.mount}
            </div>

            {/* Mini bar */}
            <div style={{ height: 5, background: '#0b0b1c', borderRadius: 3, overflow: 'hidden', marginBottom: 7 }}>
              <div
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  background: color,
                  borderRadius: 3,
                  transition: 'width 0.15s ease',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <div style={{ opacity: 0.55, fontSize: 9, marginBottom: 1 }}>USED</div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{disk.usedGb.toFixed(1)} GB</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ opacity: 0.55, fontSize: 9, marginBottom: 1, color: '#6b7280' }}>FREE</div>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#6b7280' }}>{freeGb.toFixed(1)} GB</div>
              </div>
            </div>

            <div style={{ fontSize: 19, fontWeight: 800, marginTop: 5, letterSpacing: '-0.02em' }}>
              {pct}%
            </div>

            {/* Subdirectory breakdown — populated when floor is selected */}
            {selected && subdirs.length > 0 && (
              <div style={{ marginTop: 8, borderTop: `1px solid ${color}33`, paddingTop: 7 }}>
                <div style={{ fontSize: 9, opacity: 0.55, marginBottom: 5, letterSpacing: '0.06em' }}>
                  TOP SUBDIRECTORIES
                </div>
                {subdirs.map((d) => {
                  const dirPct = disk ? Math.min(100, (d.usedGb / disk.totalGb) * 100) : 0
                  const name = d.path.split('/').pop() || d.path
                  return (
                    <div key={d.path} style={{ marginBottom: 5 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}>
                        <span style={{ opacity: 0.85, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          /{name}
                        </span>
                        <span style={{ opacity: 0.7 }}>{d.usedGb >= 1 ? `${d.usedGb.toFixed(1)} GB` : `${(d.usedGb * 1024).toFixed(0)} MB`}</span>
                      </div>
                      <div style={{ height: 3, background: '#0b0b1c', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${dirPct}%`, height: '100%', background: color, opacity: 0.75, borderRadius: 2 }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {selected && subdirs.length === 0 && (
              <div style={{ marginTop: 8, borderTop: `1px solid ${color}22`, paddingTop: 6, fontSize: 9, opacity: 0.4 }}>
                Loading subdirectories…
              </div>
            )}
          </div>
        </Html>
      )}
    </>
  )
}
