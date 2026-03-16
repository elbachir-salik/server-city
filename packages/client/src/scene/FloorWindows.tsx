import { BLDG_D, BLDG_W, FLOOR_H } from './constants'

export interface FloorWindowsProps {
  cpuPercent: number
  floor: number
}

const COLS = 6

export function FloorWindows({ cpuPercent, floor }: FloorWindowsProps) {
  const litCount = Math.round((cpuPercent / 100) * COLS)
  const isHot = cpuPercent > 90

  return (
    <>
      {Array.from({ length: COLS }).map((_, i) => {
        const lit = i < litCount
        const x = (i - (COLS - 1) / 2) * (BLDG_W / COLS)
        const y = floor * FLOOR_H + FLOOR_H * 0.5
        const color = isHot ? '#ff4400' : lit ? '#fffbe6' : '#111'
        const emissive = isHot ? '#ff2200' : lit ? '#ffd700' : '#000'
        const intensity = lit ? (isHot ? 2 : 1.2) : 0
        return (
          <mesh key={i} position={[x, y, BLDG_D / 2 + 0.01]}>
            <planeGeometry args={[BLDG_W / COLS - 0.08, FLOOR_H * 0.45]} />
            <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={intensity} />
          </mesh>
        )
      })}
    </>
  )
}
