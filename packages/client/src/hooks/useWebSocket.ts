import { useEffect, useRef, useCallback } from 'react'
import { WSMessage, WSClientMessage, ConnectionConfig } from '@servercity/shared'
import { useServerStore } from '../store/useServerStore'

const WS_URL =
  import.meta.env.VITE_WS_URL ??
  `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`

const MAX_RETRIES = 3
const RETRY_BASE_MS = 1500 // 1.5s, 3s, 6s

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null)
  const staleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const retryCountRef = useRef(0)
  const intentionalRef = useRef(false) // true when user explicitly disconnects
  // Full credentials kept in memory only — never written to Zustand or localStorage
  const credentialsRef = useRef<ConnectionConfig | null>(null)

  const {
    setStatus, setHostname, setMetrics, setMetricsStale,
    setError, setLastConfig, setRetry, setFingerprintChallenge, setSubdirs,
  } = useServerStore()

  const clearTimers = useCallback(() => {
    if (staleTimerRef.current) { clearTimeout(staleTimerRef.current); staleTimerRef.current = null }
    if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
  }, [])

  const resetStaleTimer = useCallback(() => {
    if (staleTimerRef.current) clearTimeout(staleTimerRef.current)
    staleTimerRef.current = setTimeout(() => setMetricsStale(true), 6000)
  }, [setMetricsStale])

  // Core open-a-websocket function (no retry logic here)
  const openWS = useCallback((config: ConnectionConfig) => {
    if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close() }

    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      const msg: WSClientMessage = { type: 'connect', payload: config }
      ws.send(JSON.stringify(msg))
    }

    ws.onmessage = (event) => {
      let msg: WSMessage
      try { msg = JSON.parse(event.data) as WSMessage } catch { return }

      if (msg.type === 'connected') {
        retryCountRef.current = 0
        setRetry(0, 0)
        setStatus('connected')
        setHostname(msg.payload.hostname)
      } else if (msg.type === 'metrics') {
        setMetrics(msg.payload)
        if (msg.stale) setMetricsStale(true)
        else resetStaleTimer()
      } else if (msg.type === 'error') {
        setError(msg.payload.message)
      } else if (msg.type === 'disconnected') {
        setStatus('disconnected')
        clearTimers()
      } else if (msg.type === 'fingerprint_challenge') {
        setFingerprintChallenge(msg.payload)
      } else if (msg.type === 'subdirs_result') {
        setSubdirs(msg.payload.mount, msg.payload.subdirs)
      }
    }

    ws.onerror = () => {
      // onerror always fires before onclose; actual retry happens in onclose
    }

    ws.onclose = () => {
      if (staleTimerRef.current) { clearTimeout(staleTimerRef.current); staleTimerRef.current = null }

      if (intentionalRef.current) return // user-initiated, do nothing

      const { status } = useServerStore.getState()
      if (status === 'error') return   // SSH auth failure — don't retry

      // Unexpected disconnect: attempt auto-retry
      const attempt = retryCountRef.current + 1
      if (attempt > MAX_RETRIES) {
        setStatus('disconnected')
        setRetry(0, 0)
        return
      }

      retryCountRef.current = attempt
      const delayMs = RETRY_BASE_MS * Math.pow(2, attempt - 1)
      const delaySec = Math.round(delayMs / 1000)

      setStatus('reconnecting')
      setRetry(attempt, delaySec)

      // Tick down the countdown
      let remaining = delaySec
      countdownRef.current = setInterval(() => {
        remaining -= 1
        setRetry(attempt, remaining)
        if (remaining <= 0) {
          if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
        }
      }, 1000)

      // Use full in-memory credentials (never stored in Zustand)
      if (credentialsRef.current) {
        const creds = credentialsRef.current
        retryTimerRef.current = setTimeout(() => {
          setStatus('connecting')
          openWS(creds)
        }, delayMs)
      }
    }
  }, [setStatus, setHostname, setMetrics, setMetricsStale, setError, setRetry, resetStaleTimer, clearTimers, setFingerprintChallenge, setSubdirs])

  const connect = useCallback((config: ConnectionConfig) => {
    intentionalRef.current = false
    retryCountRef.current = 0
    clearTimers()
    credentialsRef.current = config          // hold full creds in memory only
    setLastConfig(config)                    // stores host/port/username only (S3)
    setStatus('connecting')
    openWS(config)
  }, [openWS, clearTimers, setLastConfig, setStatus])

  const reconnect = useCallback(() => {
    if (!credentialsRef.current) return   // no in-memory creds — user must re-enter
    intentionalRef.current = false
    retryCountRef.current = 0
    clearTimers()
    setStatus('connecting')
    openWS(credentialsRef.current)
  }, [openWS, clearTimers, setStatus])

  const disconnect = useCallback(() => {
    intentionalRef.current = true
    clearTimers()
    retryCountRef.current = 0
    credentialsRef.current = null            // wipe credentials from memory
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const msg: WSClientMessage = { type: 'disconnect' }
      wsRef.current.send(JSON.stringify(msg))
      wsRef.current.close()
    }
    wsRef.current = null
  }, [clearTimers])

  const sendFingerprintResponse = useCallback((approved: boolean) => {
    setFingerprintChallenge(null)
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const msg: WSClientMessage = { type: 'fingerprint_response', payload: { approved } }
      wsRef.current.send(JSON.stringify(msg))
    }
  }, [setFingerprintChallenge])

  const requestSubdirs = useCallback((mount: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const msg: WSClientMessage = { type: 'request_subdirs', payload: { mount } }
      wsRef.current.send(JSON.stringify(msg))
    }
  }, [])

  useEffect(() => () => disconnect(), [disconnect])

  return { connect, reconnect, disconnect, sendFingerprintResponse, requestSubdirs }
}
