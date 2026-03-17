import { useEffect, useRef } from 'react'
import { ServerMetrics } from '@servercity/shared'
import { useServerStore } from '../store/useServerStore'

const THRESHOLDS = { cpu: 90, mem: 85, disk: 85 }
const COOLDOWN_MS = 5 * 60 * 1000  // 5 minutes per metric key

export function useAlerts(metrics: ServerMetrics | null) {
  const addAlert = useServerStore(s => s.addAlert)
  const lastFired = useRef<Record<string, number>>({})

  useEffect(() => {
    if (!metrics) return

    const now = Date.now()

    const maybeAlert = (key: string, message: string) => {
      const last = lastFired.current[key] ?? 0
      if (now - last >= COOLDOWN_MS) {
        lastFired.current[key] = now
        addAlert({ id: `${key}-${now}`, message, timestamp: now })
      }
    }

    if (metrics.cpu.overall > THRESHOLDS.cpu) {
      maybeAlert('cpu', `CPU at ${metrics.cpu.overall.toFixed(0)}% — server under heavy load`)
    }

    if (metrics.memory.usedPercent > THRESHOLDS.mem) {
      maybeAlert('mem', `Memory at ${metrics.memory.usedPercent.toFixed(0)}% — approaching limit`)
    }

    const critDisk = metrics.disk.find(d => d.usedPercent > THRESHOLDS.disk)
    if (critDisk) {
      maybeAlert(
        `disk-${critDisk.mount}`,
        `Disk ${critDisk.mount} at ${critDisk.usedPercent}% — low space`,
      )
    }
  }, [metrics, addAlert])
}
