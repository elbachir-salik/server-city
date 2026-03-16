import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { ServerMetrics } from '@servercity/shared'
import { Ground } from '../scene/Ground'
import { Building } from '../scene/Building'
import { IdleBuilding } from '../scene/IdleBuilding'

interface SceneProps {
  metrics: ServerMetrics | null
  connected: boolean
}

export function Scene({ metrics, connected }: SceneProps) {
  return (
    <Canvas camera={{ position: [8, 7, 10], fov: 45 }} gl={{ antialias: true }} shadows>
      <color attach="background" args={['#0a0a0f']} />
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 10, 5]} intensity={0.6} castShadow />
      <pointLight position={[0, 8, 0]} intensity={0.5} color="#6366f1" />

      <Ground />

      {metrics && connected ? (
        <Building metrics={metrics} connected={connected} />
      ) : (
        <IdleBuilding />
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
