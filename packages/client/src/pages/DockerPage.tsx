import { useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useServerStore } from '../store/useServerStore'
import { useWebSocket } from '../hooks/useWebSocket'
import { DockerCanvas2D } from '../components/docker/DockerCanvas2D'
import { ContainerDetail } from '../components/ContainerDetail'
import { DockerWing } from '../scene/DockerWing'
import { Canvas } from '@react-three/fiber'
import { SceneLights } from '../scene/SceneLights'
import { Ground } from '../scene/Ground'
import { CameraRig } from '../scene/CameraRig'
import { DockerContainer } from '@servercity/shared'

// ── Stat pill ─────────────────────────────────────────────────────────────────
function Pill({ label, value, color = '#4b5563' }: { label: string; value: number | string; color?: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      background: 'rgba(255,255,255,0.04)',
      border: `1px solid rgba(255,255,255,0.08)`,
      borderRadius: 20,
      padding: '3px 10px',
      fontSize: 10,
      fontFamily: 'monospace',
    }}>
      <span style={{ color: '#4b5563' }}>{label}</span>
      <span style={{ color, fontWeight: 700 }}>{value}</span>
    </div>
  )
}

// ── Docker3DScene ─────────────────────────────────────────────────────────────
function Docker3DScene({ onSelectContainer }: { onSelectContainer: (c: DockerContainer) => void }) {
  return (
    <Canvas camera={{ position: [12, 8, 12], fov: 45 }} gl={{ antialias: true }} shadows>
      <color attach="background" args={['#07070f']} />
      <SceneLights cpuPercent={0} memPercent={0} />
      <CameraRig connected={true} selectedFloor={null} />
      <Ground />
      <DockerWing onSelectContainer={onSelectContainer} />
      <fog attach="fog" args={['#07070f', 22, 55]} />
    </Canvas>
  )
}

// ── DockerPage ────────────────────────────────────────────────────────────────
export function DockerPage() {
  const navigate   = useNavigate()
  const status     = useServerStore(s => s.status)
  const hostname   = useServerStore(s => s.hostname)
  const dockerInfo = useServerStore(s => s.dockerInfo)
  const dockerView = useServerStore(s => s.dockerView)
  const selectedContainer = useServerStore(s => s.selectedContainer)
  const setDockerView     = useServerStore(s => s.setDockerView)
  const setSelectedContainer = useServerStore(s => s.setSelectedContainer)

  const { requestDocker, requestContainerLogs, stopContainerLogs } = useWebSocket()

  // Redirect if not connected
  if (status !== 'connected') {
    return (
      <div style={{
        width: '100%', height: '100%',
        background: '#0d0f1a',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'monospace', color: '#4b5563', gap: 16,
      }}>
        <div style={{ fontSize: 11 }}>Connect to a server first.</div>
        <button
          onClick={() => navigate('/')}
          style={{
            background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)',
            borderRadius: 6, padding: '6px 18px', color: '#60a5fa',
            fontSize: 10, cursor: 'pointer', fontFamily: 'monospace',
          }}
        >
          ← Back to ServerCity
        </button>
      </div>
    )
  }

  // Auto-refresh every 5s
  useEffect(() => {
    requestDocker()
    const id = setInterval(requestDocker, 5000)
    return () => clearInterval(id)
  }, [requestDocker])

  // Escape key → close detail or go back
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedContainer) setSelectedContainer(null)
        else navigate('/')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedContainer, setSelectedContainer, navigate])

  const handleSelectContainer = useCallback((c: DockerContainer) => {
    setSelectedContainer(c)
  }, [setSelectedContainer])

  const running  = dockerInfo?.containers.filter(c => c.status === 'running').length ?? 0
  const total    = dockerInfo?.containers.length ?? 0
  const paused   = dockerInfo?.containers.filter(c => c.status === 'paused').length ?? 0
  const exited   = dockerInfo?.containers.filter(c => c.status === 'exited').length ?? 0
  const volumes  = dockerInfo?.volumes.length ?? 0
  const networks = dockerInfo?.networks.length ?? 0

  return (
    <div style={{
      width: '100%', height: '100%',
      background: '#0d0f1a',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'monospace',
      overflow: 'hidden',
    }}>
      {/* ── Header ── */}
      <div style={{
        padding: '10px 18px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        flexShrink: 0,
        background: 'rgba(2,4,24,0.8)',
        backdropFilter: 'blur(8px)',
      }}>
        {/* Back */}
        <button
          onClick={() => navigate('/')}
          style={{
            background: 'none', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
            color: '#6b7280', fontSize: 11, fontFamily: 'monospace',
          }}
        >
          ← back
        </button>

        {/* Center: hostname + label */}
        <div style={{ flex: 1, textAlign: 'center' }}>
          <span style={{ color: '#374151', fontSize: 10 }}>{hostname} · </span>
          <span style={{ color: '#60a5fa', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em' }}>⬡ DOCKER</span>
        </div>

        {/* Right: count + 2D/3D toggle + refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: '#374151', fontSize: 10, fontFamily: 'monospace' }}>
            {running} running / {total} total
          </span>

          {/* 2D / 3D toggle */}
          <div style={{ display: 'flex', gap: 2 }}>
            {(['2d', '3d'] as const).map(v => (
              <button
                key={v}
                onClick={() => setDockerView(v)}
                style={{
                  background: dockerView === v ? 'rgba(59,130,246,0.2)' : 'none',
                  border: `1px solid ${dockerView === v ? 'rgba(59,130,246,0.5)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 4,
                  padding: '3px 10px',
                  cursor: 'pointer',
                  color: dockerView === v ? '#7dd3fc' : '#4b5563',
                  fontSize: 10,
                  fontFamily: 'monospace',
                  fontWeight: dockerView === v ? 700 : 400,
                  textTransform: 'uppercase',
                }}
              >
                {v}
              </button>
            ))}
          </div>

          {/* Refresh */}
          <button
            onClick={requestDocker}
            style={{
              background: 'none', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 6, padding: '3px 8px', cursor: 'pointer',
              color: '#4b5563', fontSize: 12, fontFamily: 'monospace',
            }}
            title="Refresh"
          >
            ↻
          </button>
        </div>
      </div>

      {/* ── Stats bar ── */}
      <div style={{
        padding: '8px 18px',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexShrink: 0,
        flexWrap: 'wrap',
      }}>
        <Pill label="containers" value={total} />
        <Pill label="running"    value={running}  color="#22c55e" />
        {paused > 0  && <Pill label="paused"  value={paused}  color="#f59e0b" />}
        {exited > 0  && <Pill label="exited"  value={exited}  color="#6b7280" />}
        <Pill label="volumes"  value={volumes}  color="#a78bfa" />
        <Pill label="networks" value={networks} color="#38bdf8" />
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {dockerView === '2d' ? (
          <div style={{ width: '100%', height: '100%', overflow: 'auto' }}>
            {!dockerInfo || dockerInfo.containers.length === 0 ? (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: '100%', color: '#374151', fontSize: 11,
              }}>
                {!dockerInfo ? 'Loading…' : 'No containers found.'}
              </div>
            ) : (
              <DockerCanvas2D
                dockerInfo={dockerInfo}
                onSelectContainer={handleSelectContainer}
                selectedId={selectedContainer?.id}
              />
            )}
          </div>
        ) : (
          <Docker3DScene onSelectContainer={handleSelectContainer} />
        )}

        {/* ContainerDetail overlay */}
        {selectedContainer && (
          <ContainerDetail
            onRequestLogs={requestContainerLogs}
            onStopLogs={stopContainerLogs}
          />
        )}
      </div>
    </div>
  )
}
