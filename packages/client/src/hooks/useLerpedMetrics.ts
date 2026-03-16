import { useRef, useEffect, useState } from 'react'
import { ServerMetrics } from '@servercity/shared'

// Returns a smoothly interpolated copy of the latest metrics.
// Numbers lerp toward the real value each animation frame so cards
// never jump — they slide.

const LERP = 0.12 // per frame, ~60fps → ~1s to close most of the gap
const SNAP = 0.05 // snap to target when this close — prevents infinite micro-jitter

function lerpNum(a: number, b: number): number {
  if (Math.abs(b - a) < SNAP) return b   // close enough — snap and stop updating
  return a + (b - a) * LERP
}

export function useLerpedMetrics(metrics: ServerMetrics | null): ServerMetrics | null {
  const [displayed, setDisplayed] = useState<ServerMetrics | null>(metrics)
  const frameRef = useRef<number>(0)
  const latestRef = useRef(metrics)
  const displayedRef = useRef(displayed)

  // Keep refs in sync without triggering extra effects
  useEffect(() => { latestRef.current = metrics }, [metrics])
  useEffect(() => { displayedRef.current = displayed }, [displayed])

  useEffect(() => {
    const tick = () => {
      const target = latestRef.current
      const current = displayedRef.current

      if (!target) {
        frameRef.current = requestAnimationFrame(tick)
        return
      }

      if (!current) {
        setDisplayed(target)
        frameRef.current = requestAnimationFrame(tick)
        return
      }

      const next: ServerMetrics = {
        timestamp: target.timestamp,
        cpu: {
          overall: lerpNum(current.cpu.overall, target.cpu.overall),
          cores: target.cpu.cores,
        },
        memory: {
          usedMb: lerpNum(current.memory.usedMb, target.memory.usedMb),
          totalMb: target.memory.totalMb,
          usedPercent: lerpNum(current.memory.usedPercent, target.memory.usedPercent),
        },
        swap: {
          usedMb: lerpNum(current.swap.usedMb, target.swap.usedMb),
          totalMb: target.swap.totalMb,
        },
        disk: target.disk.map((d, i) => {
          const c = current.disk[i]
          if (!c) return d
          return {
            ...d,
            usedGb: lerpNum(c.usedGb, d.usedGb),
            usedPercent: lerpNum(c.usedPercent, d.usedPercent),
          }
        }),
        network: {
          bytesIn: lerpNum(current.network.bytesIn, target.network.bytesIn),
          bytesOut: lerpNum(current.network.bytesOut, target.network.bytesOut),
        },
      }

      setDisplayed(next)
      frameRef.current = requestAnimationFrame(tick)
    }

    frameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameRef.current)
  }, []) // intentionally empty — reads via refs

  return displayed
}
