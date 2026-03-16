import { useState, useEffect, useRef } from 'react'
import { ServerMetrics } from '@servercity/shared'

/** Returns how many seconds ago the last metrics packet arrived, ticking every second. */
export function useLastUpdated(metrics: ServerMetrics | null): number | null {
  const [secondsAgo, setSecondsAgo] = useState<number | null>(null)
  const timestampRef = useRef<number | null>(null)

  // Extract primitive so the effect dep is a number, not an object reference
  const timestamp = metrics?.timestamp ?? null

  useEffect(() => {
    if (timestamp !== null) {
      timestampRef.current = timestamp
      setSecondsAgo(0)
    }
  }, [timestamp])

  useEffect(() => {
    const id = setInterval(() => {
      if (timestampRef.current === null) return
      setSecondsAgo(Math.floor((Date.now() - timestampRef.current) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [])

  return secondsAgo
}
