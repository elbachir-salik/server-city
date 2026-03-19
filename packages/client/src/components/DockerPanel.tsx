import { useCallback } from 'react'
import { useServerStore } from '../store/useServerStore'
import { DockerContainer } from '@servercity/shared'
import { DockerDiagram } from './DockerDiagram'
import { ContainerPanel } from './ContainerPanel'

interface DockerPanelProps {
  onRequestLogs: (id: string) => void
  onStopLogs: (id: string) => void
}

export function DockerPanel({ onRequestLogs, onStopLogs }: DockerPanelProps) {
  const dockerInfo        = useServerStore(s => s.dockerInfo)
  const dockerView        = useServerStore(s => s.dockerView)
  const selectedContainer = useServerStore(s => s.selectedContainer)
  const setDockerView     = useServerStore(s => s.setDockerView)
  const toggleDockerPanel = useServerStore(s => s.toggleDockerPanel)
  const setSelectedContainer = useServerStore(s => s.setSelectedContainer)

  const handleClose = useCallback(() => {
    toggleDockerPanel()
    setSelectedContainer(null)
  }, [toggleDockerPanel, setSelectedContainer])

  const handleSelectContainer = useCallback((c: DockerContainer) => {
    setSelectedContainer(c)
  }, [setSelectedContainer])

  if (!dockerInfo) return null

  const running = dockerInfo.containers.filter(c => c.status === 'running').length
  const total   = dockerInfo.containers.length

  return (
    <div style={{
      position: 'absolute',
      right: 0,
      top: 0,
      bottom: 0,
      width: selectedContainer ? 860 : 460,
      background: 'rgba(2,4,24,0.97)',
      borderLeft: '1px solid #1e293b',
      display: 'flex',
      flexDirection: 'row',
      fontFamily: 'monospace',
      fontSize: 12,
      zIndex: 40,
      transition: 'width 0.2s ease',
    }}>
      {/* Main docker panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Header */}
        <div style={{
          padding: '10px 14px',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexShrink: 0,
        }}>
          {/* Title */}
          <span style={{ color: '#60a5fa', fontSize: 13, fontWeight: 700, letterSpacing: '0.08em' }}>⬡ DOCKER</span>
          <span style={{ color: '#374151', fontSize: 10 }}>
            {running}/{total} running
          </span>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* 2D / 3D toggle */}
          <div style={{ display: 'flex', gap: 2 }}>
            {(['2d', '3d'] as const).map(v => (
              <button
                key={v}
                onClick={() => setDockerView(v)}
                style={{
                  background: dockerView === v ? 'rgba(59,130,246,0.22)' : 'none',
                  border: `1px solid ${dockerView === v ? 'rgba(59,130,246,0.55)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 4,
                  padding: '2px 9px',
                  cursor: 'pointer',
                  color: dockerView === v ? '#7dd3fc' : '#4b5563',
                  fontSize: 10,
                  fontFamily: 'monospace',
                  fontWeight: dockerView === v ? 700 : 400,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}
              >
                {v}
              </button>
            ))}
          </div>

          {/* Close */}
          <button
            onClick={handleClose}
            style={{ background: 'none', border: 'none', color: '#4b5563', cursor: 'pointer', fontSize: 17, lineHeight: 1, padding: '0 2px' }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {dockerView === '2d' ? (
            dockerInfo.containers.length === 0 ? (
              <div style={{ color: '#374151', fontSize: 11, padding: '32px 16px', textAlign: 'center' }}>
                No containers found.
              </div>
            ) : (
              <DockerDiagram
                dockerInfo={dockerInfo}
                onSelectContainer={handleSelectContainer}
                selectedId={selectedContainer?.id}
              />
            )
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: 10,
              color: '#374151',
              fontSize: 11,
              padding: 24,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 28, opacity: 0.4 }}>⬡</div>
              <div style={{ color: '#4b5563' }}>3D view active</div>
              <div style={{ color: '#374151', fontSize: 10, lineHeight: 1.6 }}>
                Click container blocks in the scene to inspect them.<br />
                The Docker wing extends to the right of the building.
              </div>
              <button
                onClick={() => setDockerView('2d')}
                style={{
                  marginTop: 8,
                  background: 'rgba(59,130,246,0.1)',
                  border: '1px solid rgba(59,130,246,0.3)',
                  borderRadius: 4,
                  padding: '4px 14px',
                  color: '#60a5fa',
                  fontSize: 10,
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                }}
              >
                Switch to 2D
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Container detail panel — slides in alongside */}
      {selectedContainer && (
        <div style={{ width: 400, borderLeft: '1px solid #1e293b', position: 'relative', flexShrink: 0 }}>
          <ContainerPanel
            onRequestLogs={onRequestLogs}
            onStopLogs={onStopLogs}
          />
        </div>
      )}
    </div>
  )
}
