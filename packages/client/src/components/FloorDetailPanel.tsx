import { useState, useEffect } from 'react'
import { useServerStore } from '../store/useServerStore'
import { SubdirEntry } from '@servercity/shared'

interface DiskData {
  mount: string
  usedGb: number
  totalGb: number
  usedPercent: number
}

interface FloorDetailPanelProps {
  floorData: DiskData[]
  onRequestSubdirs: (path: string) => void
}

function diskColor(pct: number): string {
  if (pct > 90) return '#ef4444'
  if (pct > 70) return '#f59e0b'
  return '#22c55e'
}

function fmtGb(gb: number): string {
  if (gb >= 1) return `${gb.toFixed(1)} GB`
  return `${(gb * 1024).toFixed(0)} MB`
}

// Mini bar chart for a directory entry
function DirBar({ usedGb, totalGb, color }: { usedGb: number; totalGb: number; color: string }) {
  const pct = Math.min(100, (usedGb / totalGb) * 100)
  return (
    <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, opacity: 0.8 }} />
    </div>
  )
}

export function FloorDetailPanel({ floorData, onRequestSubdirs }: FloorDetailPanelProps) {
  const selectedFloor    = useServerStore(s => s.selectedFloor)
  const setSelectedFloor = useServerStore(s => s.setSelectedFloor)
  const subdirsByMount   = useServerStore(s => s.subdirsByMount)

  // Breadcrumb stack: array of paths navigated into (root not included)
  const [crumbs, setCrumbs] = useState<string[]>([])

  const floor = selectedFloor !== null ? (floorData[selectedFloor] ?? null) : null
  const rootMount = floor?.mount ?? null

  // Current path = deepest breadcrumb, or root mount
  const currentPath = crumbs.length > 0 ? crumbs[crumbs.length - 1] : rootMount

  // Reset crumbs when selected floor changes
  useEffect(() => {
    setCrumbs([])
  }, [selectedFloor, rootMount])

  // Request subdirs for the current path if not yet cached
  useEffect(() => {
    if (currentPath && subdirsByMount[currentPath] === undefined) {
      onRequestSubdirs(currentPath)
    }
  }, [currentPath, subdirsByMount, onRequestSubdirs])

  if (selectedFloor === null || !floor) return null

  const entries: SubdirEntry[] | null = subdirsByMount[currentPath ?? ''] ?? null
  const isLoading = currentPath !== null && entries === null

  const drillInto = (path: string) => {
    setCrumbs(prev => [...prev, path])
  }

  const navigateToCrumb = (index: number) => {
    // index -1 = root mount, 0..n = crumbs[0..n]
    setCrumbs(prev => index < 0 ? [] : prev.slice(0, index + 1))
  }

  // Build breadcrumb display: root → subdir1 → subdir2 …
  const crumbSegments = [
    { label: rootMount ?? '/', active: crumbs.length === 0 },
    ...crumbs.map((p, i) => ({
      label: p.split('/').pop() || p,
      active: i === crumbs.length - 1,
    })),
  ]

  const color = diskColor(floor.usedPercent)
  const freeGb = floor.totalGb - floor.usedGb

  return (
    <div
      style={{
        position: 'absolute',
        right: 16,
        top: '50%',
        transform: 'translateY(-50%)',
        width: 300,
        maxHeight: '80vh',
        overflowY: 'auto',
        background: 'rgba(6,6,18,0.96)',
        border: `1px solid ${color}44`,
        borderRadius: 12,
        padding: '14px 16px',
        fontFamily: 'monospace',
        fontSize: 12,
        color,
        zIndex: 30,
        backdropFilter: 'blur(12px)',
        boxShadow: `0 0 28px ${color}22`,
      }}
    >
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 9, opacity: 0.5, letterSpacing: '0.1em', marginBottom: 2 }}>
            FLOOR {selectedFloor + 1}
          </div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{floor.mount}</div>
        </div>
        <button
          onClick={() => setSelectedFloor(null)}
          style={{
            background: 'none', border: 'none', color: '#666', cursor: 'pointer',
            fontSize: 16, padding: '0 4px', lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>

      {/* ── Usage summary ── */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden', marginBottom: 6 }}>
          <div style={{ width: `${floor.usedPercent}%`, height: '100%', background: color, borderRadius: 3 }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
          <span style={{ fontWeight: 700, fontSize: 18 }}>{floor.usedPercent}%</span>
          <div style={{ textAlign: 'right', fontSize: 10, opacity: 0.7 }}>
            <div>{fmtGb(floor.usedGb)} used</div>
            <div style={{ color: '#6b7280' }}>{fmtGb(freeGb)} free of {fmtGb(floor.totalGb)}</div>
          </div>
        </div>
      </div>

      {/* ── Breadcrumb trail ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 0', marginBottom: 10, fontSize: 10 }}>
        {crumbSegments.map((seg, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center' }}>
            {i > 0 && <span style={{ color: '#444', margin: '0 3px' }}>›</span>}
            <button
              onClick={() => navigateToCrumb(i - 1)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: seg.active ? 'default' : 'pointer',
                color: seg.active ? color : '#6b7280',
                fontFamily: 'monospace',
                fontSize: 10,
                fontWeight: seg.active ? 700 : 400,
                textDecoration: seg.active ? 'none' : 'underline',
              }}
            >
              {seg.label}
            </button>
          </span>
        ))}
      </div>

      {/* ── Directory listing ── */}
      <div style={{ fontSize: 9, opacity: 0.5, letterSpacing: '0.08em', marginBottom: 8 }}>
        {isLoading ? 'SCANNING…' : entries && entries.length > 0 ? 'TOP DIRECTORIES' : 'NO SUBDIRECTORIES'}
      </div>

      {isLoading && (
        <div style={{ textAlign: 'center', padding: '16px 0', opacity: 0.4 }}>
          <div style={{ fontSize: 11 }}>loading…</div>
        </div>
      )}

      {!isLoading && entries && entries.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {entries.map((entry) => {
            const name = entry.path.split('/').pop() || entry.path
            const dirPct = Math.min(100, (entry.usedGb / floor.totalGb) * 100)
            const entryColor = diskColor(Math.round(dirPct))
            return (
              <div key={entry.path}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                    <span style={{
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      maxWidth: 160, opacity: 0.9, fontSize: 11,
                    }}>
                      /{name}
                    </span>
                    <button
                      onClick={() => drillInto(entry.path)}
                      title="Drill into this directory"
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: `1px solid ${color}33`,
                        borderRadius: 3,
                        padding: '1px 5px',
                        cursor: 'pointer',
                        color: '#9ca3af',
                        fontSize: 9,
                        fontFamily: 'monospace',
                        flexShrink: 0,
                      }}
                    >
                      ›
                    </button>
                  </div>
                  <span style={{ opacity: 0.7, fontSize: 10, flexShrink: 0, marginLeft: 4 }}>
                    {fmtGb(entry.usedGb)}
                  </span>
                </div>
                <DirBar usedGb={entry.usedGb} totalGb={floor.totalGb} color={entryColor} />
              </div>
            )
          })}
        </div>
      )}

      {!isLoading && entries && entries.length === 0 && (
        <div style={{ opacity: 0.35, fontSize: 10, textAlign: 'center', padding: '12px 0' }}>
          This directory has no subdirectories or they are all empty.
        </div>
      )}
    </div>
  )
}
