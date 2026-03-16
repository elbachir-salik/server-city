export function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
      <planeGeometry args={[40, 40]} />
      <meshStandardMaterial color="#080810" />
    </mesh>
  )
}
