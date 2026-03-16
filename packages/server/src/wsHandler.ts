import { WebSocket } from 'ws'
import { WSMessage, WSClientMessage } from '@servercity/shared'
import { SSHSession } from './ssh'
import { validateConnectionConfig, validateWSClientMessage } from './validation'

// Max connect messages allowed per window per socket
const RATE_LIMIT_MAX = 3
const RATE_LIMIT_WINDOW_MS = 10_000

export function handleWSConnection(ws: WebSocket) {
  let session: SSHSession | null = null

  // Per-socket connect rate limiter — resets after each window
  let connectCount = 0
  let rateLimitTimer: ReturnType<typeof setTimeout> | null = null

  function resetRateLimit() {
    connectCount = 0
    rateLimitTimer = null
  }

  const send = (msg: WSMessage) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg))
    }
  }

  ws.on('message', (data) => {
    // 1. Parse JSON
    let raw: unknown
    try {
      raw = JSON.parse(data.toString())
    } catch {
      send({ type: 'error', payload: { message: 'Invalid JSON message.' } })
      return
    }

    // 2. Validate message shape
    if (!validateWSClientMessage(raw)) {
      send({ type: 'error', payload: { message: 'Unknown or malformed message type.' } })
      return
    }

    const msg = raw as WSClientMessage

    if (msg.type === 'connect') {
      // 3. Rate limit: max RATE_LIMIT_MAX connect messages per RATE_LIMIT_WINDOW_MS
      connectCount += 1
      rateLimitTimer ??= setTimeout(resetRateLimit, RATE_LIMIT_WINDOW_MS)
      if (connectCount > RATE_LIMIT_MAX) {
        send({ type: 'error', payload: { message: 'Too many connection attempts. Please wait before retrying.' } })
        return
      }

      // 4. Validate ConnectionConfig before touching SSH
      const errors = validateConnectionConfig(msg.payload)
      if (errors.length > 0) {
        send({ type: 'error', payload: { message: errors[0].message } })
        return
      }

      if (session) {
        session.disconnect()
        session = null
      }

      session = new SSHSession(
        msg.payload,
        (metrics, stale) => send({ type: 'metrics', payload: metrics, stale }),
        (hostname) => send({ type: 'connected', payload: { hostname } }),
        (message) => send({ type: 'error', payload: { message } }),
        () => send({ type: 'disconnected' }),
      )

      session.connect()
    }

    if (msg.type === 'disconnect') {
      session?.disconnect()
      session = null
    }
  })

  ws.on('close', () => {
    session?.disconnect()
    session = null
    if (rateLimitTimer) {
      clearTimeout(rateLimitTimer)
      rateLimitTimer = null
    }
  })
}
