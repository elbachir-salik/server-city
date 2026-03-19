import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { DockerContainer, DockerNetwork } from '@servercity/shared'
import { useServerStore } from '../store/useServerStore'
import { BLDG_W, BLDG_D, TOTAL_H } from './constants'

// Wing starts to the right of the main building
const WING_GAP   = 0.5
const WING_START = BLDG_W / 2 + WING_GAP
const ROOM_W     = 1.8
const ROOM_H     = 1.0
const ROOM_D     = BLDG_D
const ROOM_GAP   = 0.12

function containerColor(status: DockerContainer['status']): string {
  if (status === 'running')    return '#22c55e'
  if (status === 'paused')     return '#f59e0b'
  if (status === 'restarting') return '#3b82f6'
  if (status === 'dead')       return '#7f1d1d'
  return '#374151'  // exited / created
}

function containerEmissive(status: DockerContainer['status']): string {
  if (status === 'running')    return '#16a34a'
  if (status === 'paused')     return '#d97706'
  if (status === 'restarting') return '#2563eb'
  if (status === 'dead')       return '#450a0a'
  return '#111827'
}

interface ContainerRoomProps {
  container: DockerContainer
  index: number
  selected: boolean
  onClick: (c: DockerContainer) => void
}

function ContainerRoom({ container, index, selected, onClick }: ContainerRoomProps) {
  const meshRef  = useRef<THREE.Mesh>(null)
  const matRef   = useRef<THREE.MeshStandardMaterial>(null)
  const edgeRef  = useRef<THREE.LineSegments>(null)
  const scaleRef = useRef(0.01)

  const color    = containerColor(container.status)
  const emissive = containerEmissive(container.status)

  // Center X: WING_START + ROOM_W/2
  const posX = WING_START + ROOM_W / 2
  const posY = index * (ROOM_H + ROOM_GAP) + ROOM_H / 2
  const posZ = 0

  useFrame(({ clock }) => {
    scaleRef.current += (1 - scaleRef.current) * 0.10
    if (meshRef.current) meshRef.current.scale.y = scaleRef.current

    if (matRef.current) {
      const isRunning = container.status === 'running'
      const pulse = isRunning
        ? 0.6 + Math.abs(Math.sin(clock.getElapsedTime() * 1.5 + index)) * 0.4
        : 0.3
      const target = selected ? pulse * 1.8 : pulse
      matRef.current.emissiveIntensity += (target - matRef.current.emissiveIntensity) * 0.12
    }

    if (edgeRef.current) {
      const mat = edgeRef.current.material as THREE.LineBasicMaterial
      mat.opacity = selected ? 0.9 : 0.35
    }
  })

  // CPU indicator bar at top of room
  const cpuFrac = Math.min(1, container.cpuPercent / 100)

  return (
    <group position={[posX, posY, posZ]}>
      {/* Shell */}
      <mesh
        ref={meshRef}
        onClick={(e) => { e.stopPropagation(); onClick(container) }}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { document.body.style.cursor = 'default' }}
      >
        <boxGeometry args={[ROOM_W, ROOM_H, ROOM_D]} />
        <meshStandardMaterial
          ref={matRef}
          color={color}
          emissive={emissive}
          emissiveIntensity={0.6}
          transparent
          opacity={0.78}
          metalness={0.4}
          roughness={0.45}
        />
      </mesh>

      {/* Edge glow */}
      <lineSegments
        ref={edgeRef}
        geometry={new THREE.EdgesGeometry(new THREE.BoxGeometry(ROOM_W + 0.01, ROOM_H + 0.01, ROOM_D + 0.01))}
      >
        <lineBasicMaterial color={color} transparent opacity={0.35} />
      </lineSegments>

      {/* CPU usage bar at top */}
      {container.status === 'running' && cpuFrac > 0 && (
        <mesh position={[-(ROOM_W / 2) + (cpuFrac * ROOM_W) / 2, ROOM_H / 2 - 0.04, ROOM_D / 2 + 0.005]}>
          <planeGeometry args={[cpuFrac * ROOM_W, 0.06]} />
          <meshStandardMaterial
            color="#60a5fa"
            emissive="#60a5fa"
            emissiveIntensity={2}
          />
        </mesh>
      )}

      {/* Hover label */}
      <Html position={[0, ROOM_H / 2 + 0.14, 0]} center style={{ pointerEvents: 'none' }}>
        <div style={{
          background: 'rgba(0,0,0,0.88)',
          border: `1px solid ${color}44`,
          borderRadius: 3,
          padding: '3px 7px',
          fontFamily: 'monospace',
          fontSize: 11,
          whiteSpace: 'nowrap',
          color: '#e2e8f0',
          boxShadow: `0 0 8px ${color}33`,
        }}>
          <span style={{ color }}>{container.status === 'running' ? '●' : '○'}</span>
          {' '}
          <strong>{container.name}</strong>
          <span style={{ color: '#6b7280', marginLeft: 6 }}>{container.image.split(':')[0]}</span>
          {container.status === 'running' && (
            <span style={{ color: '#60a5fa', marginLeft: 6 }}>{container.cpuPercent.toFixed(1)}%</span>
          )}
        </div>
      </Html>
    </group>
  )
}

interface NetworkBridgeProps {
  yA: number
  yB: number
  color: string
}

function NetworkBridge({ yA, yB, color }: NetworkBridgeProps) {
  const midY  = (yA + yB) / 2
  const height = Math.abs(yB - yA)
  if (height < 0.01) return null
  return (
    <mesh position={[WING_START - 0.08, midY, 0]}>
      <boxGeometry args={[0.04, height, 0.04]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} transparent opacity={0.7} />
    </mesh>
  )
}

interface DockerWingProps {
  onSelectContainer: (c: DockerContainer) => void
}

export function DockerWing({ onSelectContainer }: DockerWingProps) {
  const dockerInfo         = useServerStore(s => s.dockerInfo)
  const selectedContainer  = useServerStore(s => s.selectedContainer)
  const riseRef            = useRef(0)
  const groupRef           = useRef<THREE.Group>(null)

  useFrame(() => {
    riseRef.current += (1 - riseRef.current) * 0.06
    if (groupRef.current) groupRef.current.scale.y = riseRef.current
  })

  const networkColors: Record<string, string> = useMemo(() => ({
    bridge: '#3b82f6',
    host:   '#f9fafb',
    none:   '#374151',
    overlay:'#a855f7',
  }), [])

  if (!dockerInfo?.available || dockerInfo.containers.length === 0) return null

  const containers = dockerInfo.containers
  const networks   = dockerInfo.networks

  // Build network bridges between containers sharing a network
  const bridges: { yA: number; yB: number; color: string; key: string }[] = []
  for (const net of networks) {
    if (net.containers.length < 2) continue
    const color = networkColors[net.driver] ?? '#6b7280'
    const indices = net.containers
      .map(id => containers.findIndex(c => c.id === id))
      .filter(i => i >= 0)
      .sort((a, b) => a - b)
    for (let i = 0; i < indices.length - 1; i++) {
      const yA = indices[i] * (ROOM_H + ROOM_GAP) + ROOM_H / 2
      const yB = indices[i + 1] * (ROOM_H + ROOM_GAP) + ROOM_H / 2
      bridges.push({ yA, yB, color, key: `${net.name}-${i}` })
    }
  }

  // Wing nameplate position
  const wingTopY = containers.length * (ROOM_H + ROOM_GAP) + 0.3

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* Wing base platform */}
      <mesh position={[WING_START + ROOM_W / 2, -0.04, 0]}>
        <boxGeometry args={[ROOM_W + 0.2, 0.08, ROOM_D + 0.2]} />
        <meshStandardMaterial color="#0f172a" emissive="#1e3a5f" emissiveIntensity={0.4} />
      </mesh>

      {/* Wing label */}
      <Html position={[WING_START + ROOM_W / 2, wingTopY, 0]} center style={{ pointerEvents: 'none' }}>
        <div style={{
          fontFamily: 'monospace',
          fontSize: 10,
          color: '#60a5fa',
          background: 'rgba(0,0,0,0.7)',
          padding: '2px 8px',
          borderRadius: 3,
          border: '1px solid #1e40af55',
          letterSpacing: '0.1em',
        }}>
          DOCKER · {containers.filter(c => c.status === 'running').length}/{containers.length} running
        </div>
      </Html>

      {/* Network bridges */}
      {bridges.map(b => (
        <NetworkBridge key={b.key} yA={b.yA} yB={b.yB} color={b.color} />
      ))}

      {/* Container rooms */}
      {containers.map((c, i) => (
        <ContainerRoom
          key={c.id}
          container={c}
          index={i}
          selected={selectedContainer?.id === c.id}
          onClick={onSelectContainer}
        />
      ))}

      {/* Volumes as basement slabs */}
      {/* Volumes = unique mount names across all containers */}
      {Array.from(new Set(containers.flatMap(c => c.mounts.map(m => m.name)))).slice(0, 6).map((volName, i) => (
        <mesh key={volName} position={[WING_START + ROOM_W / 2, -0.25 - i * 0.18, 0]}>
          <boxGeometry args={[ROOM_W * 0.9, 0.12, ROOM_D * 0.6]} />
          <meshStandardMaterial color="#1e293b" emissive="#334155" emissiveIntensity={0.5} transparent opacity={0.9} />
        </mesh>
      ))}
    </group>
  )
}

// Suppress unused imports — TOTAL_H used for bounds check in parent
void TOTAL_H
