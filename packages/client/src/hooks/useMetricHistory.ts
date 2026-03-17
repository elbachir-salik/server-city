import { useRef, useEffect } from 'react'

const HISTORY_LEN = 60  // 60 samples ≈ 60 seconds at 1 Hz

export function useMetricHistory(value: number): number[] {
  const buf = useRef<number[]>(new Array(HISTORY_LEN).fill(0))

  useEffect(() => {
    buf.current.push(value)
    if (buf.current.length > HISTORY_LEN) buf.current.shift()
  }, [value])

  return buf.current
}
