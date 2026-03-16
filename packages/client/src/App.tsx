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
  const showForm = status === 'idle' || status === 'error' || status === 'connecting'

  const handleConnect = (config: ConnectionConfig) => {
    connect(config)
  }

  const handleDisconnect = () => {
    disconnect()
    reset()
  }

  if (showForm) {
    return (
      <ConnectForm
        onConnect={handleConnect}
        error={errorMessage}
        isConnecting={status === 'connecting'}
      />
    )
  }

  return (
    <div className="w-full h-full relative">
      <Scene metrics={metrics} connected={isConnected} />
      <HUD onDisconnect={handleDisconnect} />
    </div>
  )
}
