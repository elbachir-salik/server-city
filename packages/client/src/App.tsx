import { useServerStore } from './store/useServerStore'
import { useWebSocket } from './hooks/useWebSocket'
import { ConnectForm } from './components/ConnectForm'
import { Scene } from './components/Scene'
import { HUD } from './components/HUD'
import { ConnectionConfig } from '@servercity/shared'

export default function App() {
  const { status, metrics, errorMessage, reset } = useServerStore()
  const { connect, disconnect } = useWebSocket()

  const isConnected = status === 'connected'
  const isConnecting = status === 'connecting'
  const showForm = status === 'idle' || status === 'error' || status === 'connecting'
  // Keep scene mounted during connecting so the wireframe pulse plays;
  // only truly unmount it when we're back to idle/error
  const showScene = !showForm || isConnecting

  const handleConnect = (config: ConnectionConfig) => connect(config)
  const handleDisconnect = () => { disconnect(); reset() }

  return (
    <div className="w-full h-full relative">
      {/* 3D scene — always mounted once connecting starts; fades in */}
      <div
        className="absolute inset-0 transition-opacity duration-700"
        style={{ opacity: showScene ? 1 : 0, pointerEvents: showScene ? 'auto' : 'none' }}
      >
        <Scene metrics={metrics} connected={isConnected} isConnecting={isConnecting} />
        {isConnected && <HUD onDisconnect={handleDisconnect} />}
        {status === 'disconnected' && <HUD onDisconnect={handleDisconnect} />}
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
