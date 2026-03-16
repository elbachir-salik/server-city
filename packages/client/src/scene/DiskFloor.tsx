import { BLDG_D, BLDG_W, FLOOR_H } from './constants'

export interface DiskFloorProps {
  usedPercent: number
  floor: number
}

export function DiskFloor({ usedPercent, floor }: DiskFloorProps) {
  const fillW = (usedPercent / 100) * (BLDG_W - 0.2)
  const color = usedPercent > 90 ? '#ef4444' : usedPercent > 70 ? '#f59e0b' : '#22c55e'
  const y = floor * FLOOR_H + 0.05

  if (fillW <= 0) return null

  return (
    <mesh position={[-(BLDG_W - 0.2 - fillW) / 2, y, 0]}>
      <boxGeometry args={[fillW, 0.06, BLDG_D - 0.2]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} />
    </mesh>
  )
}
