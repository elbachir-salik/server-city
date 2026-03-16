import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { ServerMetrics } from '@servercity/shared'
import { Ground } from '../scene/Ground'
import { Building } from '../scene/Building'
import { IdleBuilding } from '../scene/IdleBuilding'
import { CameraRig } from '../scene/CameraRig'
import { SceneLights } from '../scene/SceneLights'
import { Skyline } from '../scene/Skyline'

interface SceneProps {
  metrics: ServerMetrics | null
  connected: boolean
  isConnecting?: boolean
}

export function Scene({ metrics, connected, isConnecting = false }: SceneProps) {
  const cpuPercent = metrics?.cpu.overall ?? 0
  const memPercent = metrics?.memory.usedPercent ?? 0

  return (
    <Canvas camera={{ position: [10, 9, 13], fov: 45 }} gl={{ antialias: true }} shadows>
      <color attach="background" args={['#0a0a0f']} />

      <SceneLights cpuPercent={cpuPercent} memPercent={memPercent} />
      <CameraRig connected={connected} />

      <Ground />
      <Skyline />

      {metrics && connected ? (
        <Building metrics={metrics} connected={connected} />
      ) : (
        <IdleBuilding connecting={isConnecting} />
      )}

      <OrbitControls
        enablePan={false}
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI / 2.2}
        minDistance={5}
        maxDistance={25}
      />
      <fog attach="fog" args={['#0a0a0f', 20, 50]} />
    </Canvas>
  )
}
