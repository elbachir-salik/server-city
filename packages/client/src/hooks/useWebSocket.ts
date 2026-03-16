import { useEffect, useRef, useCallback } from 'react'
import { WSMessage, WSClientMessage, ConnectionConfig } from '@servercity/shared'
import { useServerStore } from '../store/useServerStore'

const WS_URL = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null)
  const staleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { setStatus, setHostname, setMetrics, setMetricsStale, setError } = useServerStore()

  const resetStaleTimer = useCallback(() => {
    if (staleTimerRef.current) clearTimeout(staleTimerRef.current)
    staleTimerRef.current = setTimeout(() => setMetricsStale(true), 6000)
  }, [setMetricsStale])

  const connect = useCallback(
    (config: ConnectionConfig) => {
      if (wsRef.current) {
        wsRef.current.close()
      }

      setStatus('connecting')
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        const msg: WSClientMessage = { type: 'connect', payload: config }
        ws.send(JSON.stringify(msg))
      }

      ws.onmessage = (event) => {
        let msg: WSMessage
        try {
          msg = JSON.parse(event.data) as WSMessage
        } catch {
          return
        }

        if (msg.type === 'connected') {
          setStatus('connected')
          setHostname(msg.payload.hostname)
        } else if (msg.type === 'metrics') {
          setMetrics(msg.payload)
          resetStaleTimer()
        } else if (msg.type === 'error') {
          setError(msg.payload.message)
        } else if (msg.type === 'disconnected') {
          setStatus('disconnected')
          if (staleTimerRef.current) clearTimeout(staleTimerRef.current)
        }
      }

      ws.onerror = () => {
        setError('WebSocket connection failed')
      }

      ws.onclose = () => {
        const { status } = useServerStore.getState()
        if (status === 'connecting' || status === 'connected') {
          setStatus('disconnected')
        }
        if (staleTimerRef.current) clearTimeout(staleTimerRef.current)
      }
    },
    [setStatus, setHostname, setMetrics, setMetricsStale, setError, resetStaleTimer],
  )

  const disconnect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const msg: WSClientMessage = { type: 'disconnect' }
      wsRef.current.send(JSON.stringify(msg))
      wsRef.current.close()
    }
    wsRef.current = null
    if (staleTimerRef.current) clearTimeout(staleTimerRef.current)
  }, [])

  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  return { connect, disconnect }
}
