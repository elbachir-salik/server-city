import * as THREE from 'three'

// Each entry: [x, z, width, depth, height]
const BUILDINGS: [number, number, number, number, number][] = [
  [-14, -16, 1.8, 1.4, 4.5],
  [-11, -17, 1.2, 1.0, 6.5],
  [-8.5, -16, 2.0, 1.6, 3.8],
  [-6,  -18, 1.4, 1.2, 7.2],
  [-3.5,-16, 1.0, 0.9, 5.0],
  [ 0,  -17, 1.6, 1.3, 3.2],
  [ 3,  -16, 1.2, 1.0, 5.8],
  [ 5.5,-18, 2.2, 1.5, 4.4],
  [ 8,  -17, 1.0, 0.9, 6.8],
  [ 11, -16, 1.8, 1.4, 3.6],
  [ 13.5,-17, 1.4, 1.1, 5.2],
  // Second ring — further back
  [-16, -22, 2.0, 1.6, 5.5],
  [-10, -23, 2.4, 1.8, 8.0],
  [-4,  -22, 1.6, 1.2, 4.8],
  [ 2,  -24, 1.8, 1.4, 9.0],
  [ 9,  -22, 2.2, 1.7, 6.2],
  [ 15, -23, 1.6, 1.2, 7.5],
]

const silhouetteMat = new THREE.MeshStandardMaterial({
  color: '#0d0d1a',
  emissive: '#0d0d1a',
  emissiveIntensity: 0.1,
  roughness: 1,
  metalness: 0,
})

export function Skyline() {
  return (
    <group>
      {BUILDINGS.map(([x, z, w, d, h], i) => (
        <mesh key={i} position={[x, h / 2, z]} material={silhouetteMat}>
          <boxGeometry args={[w, h, d]} />
        </mesh>
      ))}
    </group>
  )
}
