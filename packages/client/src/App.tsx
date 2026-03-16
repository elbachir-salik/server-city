import { useServerStore } from './store/useServerStore'
import { useWebSocket } from './hooks/useWebSocket'
import { ConnectForm } from './components/ConnectForm'
import { Scene } from './components/Scene'
import { HUD } from './components/HUD'
import { FingerprintModal } from './components/FingerprintModal'
import { ConnectionConfig } from '@servercity/shared'

export default function App() {
  const { status, metrics, errorMessage, reset, fingerprintChallenge } = useServerStore()
  const { connect, reconnect, disconnect, sendFingerprintResponse } = useWebSocket()

  const isConnected = status === 'connected'
  const isConnecting = status === 'connecting'
  const showForm = status === 'idle' || status === 'error' || status === 'connecting'
  const showScene = !showForm || isConnecting
  // Show HUD whenever the scene is visible and we're past the initial connecting state
  const showHUD = isConnected || status === 'disconnected' || status === 'reconnecting'

  const handleConnect = (config: ConnectionConfig) => connect(config)
  const handleDisconnect = () => { disconnect(); reset() }
  const handleReconnect = () => reconnect()

  return (
    <div className="w-full h-full relative">
      {/* TOFU fingerprint modal — blocks SSH handshake until user decides */}
      {fingerprintChallenge && (
        <FingerprintModal
          challenge={fingerprintChallenge}
          onApprove={() => sendFingerprintResponse(true)}
          onReject={() => sendFingerprintResponse(false)}
        />
      )}
      {/* 3D scene — mounts as soon as connecting starts */}
      <div
        className="absolute inset-0 transition-opacity duration-700"
        style={{ opacity: showScene ? 1 : 0, pointerEvents: showScene ? 'auto' : 'none' }}
      >
        <Scene metrics={metrics} connected={isConnected} isConnecting={isConnecting} />
        {showHUD && (
          <HUD onDisconnect={handleDisconnect} onReconnect={handleReconnect} />
        )}
      </div>

      {/* Connect form — fades out when scene takes over */}
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
