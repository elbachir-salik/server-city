import { Canvas } from '@react-three/fiber'
import { ServerMetrics } from '@servercity/shared'
import { useServerStore } from '../store/useServerStore'
import { Ground } from '../scene/Ground'
import { Building } from '../scene/Building'
import { IdleBuilding } from '../scene/IdleBuilding'
import { CameraRig } from '../scene/CameraRig'
import { SceneLights } from '../scene/SceneLights'
import { Skyline } from '../scene/Skyline'
import { AmbientParticles } from '../scene/AmbientParticles'
import { FloorExplorer } from '../scene/FloorExplorer'

interface SceneProps {
  metrics: ServerMetrics | null
  connected: boolean
  isConnecting?: boolean
  onExplorePath: (path: string) => void
  onRequestFileContent: (path: string) => void
}

export function Scene({ metrics, connected, isConnecting = false, onExplorePath, onRequestFileContent }: SceneProps) {
  const cpuPercent    = metrics?.cpu.overall ?? 0
  const memPercent    = metrics?.memory.usedPercent ?? 0
  const selectedFloor = useServerStore(s => s.selectedFloor)

  return (
    <Canvas camera={{ position: [10, 9, 13], fov: 45 }} gl={{ antialias: true }} shadows>
      <color attach="background" args={['#07070f']} />

      <SceneLights cpuPercent={cpuPercent} memPercent={memPercent} />
      <CameraRig connected={connected} selectedFloor={selectedFloor} />

      <Ground />
      <Skyline />

      {connected && metrics ? (
        <>
          <Building metrics={metrics} connected={connected} />
          <AmbientParticles />
          <FloorExplorer
            onExplorePath={onExplorePath}
            onRequestFileContent={onRequestFileContent}
          />
        </>
      ) : (
        <IdleBuilding connecting={isConnecting} />
      )}

      <fog attach="fog" args={['#07070f', 22, 55]} />
    </Canvas>
  )
}
