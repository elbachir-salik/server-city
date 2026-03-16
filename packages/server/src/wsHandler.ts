import { WebSocket } from 'ws'
import { WSMessage, WSClientMessage } from '@servercity/shared'
import { SSHSession } from './ssh'

export function handleWSConnection(ws: WebSocket) {
  let session: SSHSession | null = null

  const send = (msg: WSMessage) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg))
    }
  }

  ws.on('message', (data) => {
    let msg: WSClientMessage
    try {
      msg = JSON.parse(data.toString()) as WSClientMessage
    } catch {
      return
    }

    if (msg.type === 'connect') {
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
