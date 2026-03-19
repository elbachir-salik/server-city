import { useRef, useMemo, useState, useCallback } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { useServerStore } from '../store/useServerStore'
import { squarify, nodeColor, nodeEmissive } from '../utils/treemap'
import { BLDG_W, BLDG_D, FLOOR_H, FLOORS } from './constants'
import { DirectoryNode } from '@servercity/shared'

const PAD = 0.08            // padding within floor area
const ROOM_H = FLOOR_H * 0.55  // room box height

interface RoomProps {
  x: number
  z: number
  w: number
  d: number
  node: DirectoryNode
  floorY: number
  onClickDir: (path: string) => void
  onClickFile: (path: string) => void
}

function Room({ x, z, w, d, node, floorY, onClickDir, onClickFile }: RoomProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const matRef = useRef<THREE.MeshStandardMaterial>(null)
  const [hovered, setHovered] = useState(false)

  const color = nodeColor(node.lastModifiedDays)
  const emissive = nodeEmissive(node.lastModifiedDays)

  // Spring scale for entry animation
  const scale = useRef(0.01)
  useFrame(() => {
    scale.current += (1 - scale.current) * 0.12
    if (meshRef.current) {
      meshRef.current.scale.setScalar(scale.current)
    }
    if (matRef.current) {
      const targetIntensity = hovered ? 1.8 : node.isDirectory ? 0.9 : 0.5
      matRef.current.emissiveIntensity += (targetIntensity - matRef.current.emissiveIntensity) * 0.15
    }
  })

  // Convert treemap local coords to world coords:
  // treemap x is in [0, BLDG_W-PAD*2], z is in [0, BLDG_D-PAD*2]
  // world X: -BLDG_W/2 + PAD + treemapX
  // world Z: -BLDG_D/2 + PAD + treemapZ
  const worldX = -BLDG_W / 2 + PAD + x
  const worldZ = -BLDG_D / 2 + PAD + z
  const worldY = floorY + ROOM_H / 2

  const handleClick = useCallback(
    (e: THREE.Event) => {
      (e as unknown as { stopPropagation: () => void }).stopPropagation()
      if (node.isDirectory) {
        onClickDir(node.path)
      } else {
        onClickFile(node.path)
      }
    },
    [node, onClickDir, onClickFile],
  )

  const GAP = 0.025
  const rw = Math.max(0.05, w - GAP)
  const rd = Math.max(0.05, d - GAP)

  return (
    <mesh
      ref={meshRef}
      position={[worldX, worldY, worldZ]}
      onClick={handleClick}
      onPointerOver={(e) => {
        e.stopPropagation()
        document.body.style.cursor = 'pointer'
        setHovered(true)
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'default'
        setHovered(false)
      }}
    >
      <boxGeometry args={[rw, ROOM_H, rd]} />
      <meshStandardMaterial
        ref={matRef}
        color={color}
        emissive={emissive}
        emissiveIntensity={node.isDirectory ? 0.9 : 0.5}
        transparent
        opacity={node.isDirectory ? 0.88 : 0.70}
        metalness={0.3}
        roughness={0.5}
      />

      {/* Label on hover */}
      {hovered && (
        <Html
          position={[0, ROOM_H / 2 + 0.12, 0]}
          center
          style={{ pointerEvents: 'none' }}
        >
          <div
            style={{
              background: 'rgba(0,0,0,0.85)',
              border: '1px solid #374151',
              borderRadius: '3px',
              padding: '3px 6px',
              fontFamily: 'monospace',
              fontSize: '11px',
              whiteSpace: 'nowrap',
              color: node.isDirectory ? '#60a5fa' : '#9ca3af',
            }}
          >
            {node.isDirectory ? '📁 ' : '📄 '}
            {node.name}
            <span style={{ color: '#4b5563', marginLeft: '6px' }}>
              {node.sizeMb >= 1024
                ? `${(node.sizeMb / 1024).toFixed(1)}G`
                : node.sizeMb >= 1
                ? `${node.sizeMb.toFixed(1)}M`
                : `${(node.sizeMb * 1024).toFixed(0)}K`}
            </span>
          </div>
        </Html>
      )}
    </mesh>
  )
}

interface FloorExplorerProps {
  onExplorePath: (path: string) => void
  onRequestFileContent: (path: string) => void
}

export function FloorExplorer({ onExplorePath, onRequestFileContent }: FloorExplorerProps) {
  const { explorerNodes, explorerPath, selectedFloor } = useServerStore()

  const floorIndex = selectedFloor ?? Math.min(2, FLOORS - 1)
  const floorY = floorIndex * FLOOR_H

  const bounds = useMemo(
    () => ({
      x: 0,
      z: 0,
      w: BLDG_W - PAD * 2,
      d: BLDG_D - PAD * 2,
    }),
    [],
  )

  const rects = useMemo(
    () => squarify(explorerNodes, bounds),
    [explorerNodes, bounds],
  )

  if (!explorerPath || explorerNodes.length === 0) return null

  return (
    <group>
      {rects.map((rect, i) => (
        <Room
          key={`${rect.node.path}-${i}`}
          x={rect.x}
          z={rect.z}
          w={rect.w}
          d={rect.d}
          node={rect.node}
          floorY={floorY}
          onClickDir={onExplorePath}
          onClickFile={onRequestFileContent}
        />
      ))}
    </group>
  )
}
