import { Routes, Route, Navigate } from 'react-router-dom'
import { useServerStore } from './store/useServerStore'
import { useWebSocket } from './hooks/useWebSocket'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useAlerts } from './hooks/useAlerts'
import { ConnectForm } from './components/ConnectForm'
import { Scene } from './components/Scene'
import { HUD } from './components/HUD'
import { FingerprintModal } from './components/FingerprintModal'
import { HttpWarningBanner } from './components/HttpWarningBanner'
import { FloorDetailPanel } from './components/FloorDetailPanel'
import { AlertToast } from './components/AlertToast'
import { ProcessPanel } from './components/ProcessPanel'
import { CommandBar } from './components/CommandBar'
import { FilePanel } from './components/FilePanel'
import { DockerPage } from './pages/DockerPage'
import { ConnectionConfig, DockerContainer } from '@servercity/shared'

function BuildingView() {
  const { status, metrics, errorMessage, reset, fingerprintChallenge, setCommandBarVisible } = useServerStore()
  const { connect, reconnect, disconnect, sendFingerprintResponse, requestSubdirs, requestPs,
          explorePath, requestFileContent } = useWebSocket()
  useKeyboardShortcuts()
  useAlerts(metrics)

  const isConnected  = status === 'connected'
  const isConnecting = status === 'connecting'
  const showForm     = status === 'idle' || status === 'error' || status === 'connecting'
  const showScene    = !showForm || isConnecting
  const showHUD      = isConnected || status === 'disconnected' || status === 'reconnecting'

  const subdirsByMount = useServerStore(s => s.subdirsByMount)
  const allSubdirs = metrics
    ? metrics.disk
        .flatMap(disk =>
          (subdirsByMount[disk.mount] ?? []).map(sub => ({
            mount: sub.path,
            usedGb: sub.usedGb,
            totalGb: disk.totalGb,
            usedPercent: Math.min(100, Math.round((sub.usedGb / disk.totalGb) * 100)),
          }))
        )
        .sort((a, b) => b.usedGb - a.usedGb)
        .slice(0, 5)
    : []

  const floorData = allSubdirs.length > 0
    ? allSubdirs
    : (metrics?.disk.slice(0, 5) ?? [])

  const handleConnect = (config: ConnectionConfig) => connect(config)
  const handleDisconnect = () => { disconnect(); reset() }
  const handleReconnect = () => reconnect()

  return (
    <div className="w-full h-full relative">
      <HttpWarningBanner />

      {fingerprintChallenge && (
        <FingerprintModal
          challenge={fingerprintChallenge}
          onApprove={() => sendFingerprintResponse(true)}
          onReject={() => sendFingerprintResponse(false)}
        />
      )}

      <div
        className="absolute inset-0 transition-opacity duration-700"
        style={{ opacity: showScene ? 1 : 0, pointerEvents: showScene ? 'auto' : 'none' }}
      >
        <Scene
          metrics={metrics}
          connected={isConnected}
          isConnecting={isConnecting}
          onExplorePath={explorePath}
          onRequestFileContent={requestFileContent}
          onSelectContainer={(_c: DockerContainer) => {}}
        />

        {showHUD && (
          <>
            <HUD
              onDisconnect={handleDisconnect}
              onReconnect={handleReconnect}
              onOpenExplorer={() => setCommandBarVisible(true)}
            />
            <FloorDetailPanel floorData={floorData} onRequestSubdirs={requestSubdirs} />
            <ProcessPanel onRequestPs={requestPs} />
            <AlertToast />
            <CommandBar onExplorePath={explorePath} />
            <FilePanel />
          </>
        )}
      </div>

      <div
        className="absolute inset-0 transition-opacity duration-700"
        style={{ opacity: showForm ? 1 : 0, pointerEvents: showForm ? 'auto' : 'none' }}
      >
        <ConnectForm
          onConnect={handleConnect}
          error={errorMessage}
          isConnecting={isConnecting}
        />
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<BuildingView />} />
      <Route path="/docker" element={<DockerPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
