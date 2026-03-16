import { WebSocket } from 'ws'
import { WSMessage, WSClientMessage } from '@servercity/shared'
import { SSHSession } from './ssh'
import { validateConnectionConfig, validateWSClientMessage } from './validation'

export function handleWSConnection(ws: WebSocket) {
  let session: SSHSession | null = null

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
      // 3. Validate ConnectionConfig before touching SSH
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
  })
}
