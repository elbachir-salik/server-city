import { WebSocket } from 'ws'
import { WSMessage, WSClientMessage } from '@servercity/shared'
import { SSHSession } from './ssh'
import { validateConnectionConfig, validateWSClientMessage } from './validation'

// Max connect messages allowed per window per socket
const RATE_LIMIT_MAX = 3
const RATE_LIMIT_WINDOW_MS = 10_000

// How long (ms) to wait for the client to respond to a fingerprint challenge
const FINGERPRINT_TIMEOUT_MS = 30_000

export function handleWSConnection(ws: WebSocket) {
  let session: SSHSession | null = null

  // Per-socket connect rate limiter — resets after each window
  let connectCount = 0
  let rateLimitTimer: ReturnType<typeof setTimeout> | null = null

  // Pending fingerprint challenge — at most one at a time per socket
  let pendingFingerprintCb: ((approved: boolean) => void) | null = null
  let fingerprintTimeoutTimer: ReturnType<typeof setTimeout> | null = null

  function resetRateLimit() {
    connectCount = 0
    rateLimitTimer = null
  }

  function clearFingerprintPending() {
    if (fingerprintTimeoutTimer) { clearTimeout(fingerprintTimeoutTimer); fingerprintTimeoutTimer = null }
    pendingFingerprintCb = null
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
        // TOFU fingerprint challenge — pause SSH handshake until client responds
        (fingerprint, cb) => {
          clearFingerprintPending()
          pendingFingerprintCb = cb
          send({
            type: 'fingerprint_challenge',
            payload: { fingerprint, host: msg.payload.host, port: msg.payload.port },
          })
          // Auto-reject if client doesn't respond within timeout
          fingerprintTimeoutTimer = setTimeout(() => {
            if (pendingFingerprintCb) {
              pendingFingerprintCb(false)
              clearFingerprintPending()
            }
          }, FINGERPRINT_TIMEOUT_MS)
        },
      )

      session.connect()
    }

    if (msg.type === 'disconnect') {
      session?.disconnect()
      session = null
    }

    if (msg.type === 'fingerprint_response') {
      if (pendingFingerprintCb) {
        const approved = msg.payload.approved
        pendingFingerprintCb(approved)
        clearFingerprintPending()
      }
    }

    if (msg.type === 'request_subdirs') {
      if (!session) {
        send({ type: 'error', payload: { message: 'Not connected to a server.' } })
        return
      }
      const { mount } = msg.payload
      session.getSubdirUsage(mount, (subdirs) => {
        send({ type: 'subdirs_result', payload: { mount, subdirs } })
      })
    }

    if (msg.type === 'request_ps') {
      if (!session) {
        send({ type: 'error', payload: { message: 'Not connected to a server.' } })
        return
      }
      session.getProcessList((processes) => {
        send({ type: 'ps_result', payload: { processes } })
      })
    }

    if (msg.type === 'request_server_info') {
      if (!session) return
      session.getServerInfo((info) => {
        send({ type: 'server_info', payload: info })
      })
    }

    if (msg.type === 'explore_path') {
      if (!session) {
        send({ type: 'error', payload: { message: 'Not connected to a server.' } })
        return
      }
      const { path } = msg.payload
      session.exploreDirectory(path, (result) => {
        if (result.error) {
          const err = result.error as 'not_found' | 'permission_denied' | 'is_file'
          send({ type: 'explore_error', payload: { path, error: err } })
        } else {
          send({ type: 'explore_result', payload: { path, nodes: result.nodes ?? [] } })
        }
      })
    }

    if (msg.type === 'request_file_content') {
      if (!session) {
        send({ type: 'error', payload: { message: 'Not connected to a server.' } })
        return
      }
      const { path } = msg.payload
      session.getFileContent(path, (result) => {
        if (result.error) {
          const err = result.error as 'not_found' | 'permission_denied' | 'is_dir'
          send({ type: 'file_content_error', payload: { path, error: err } })
        } else if (result.content) {
          send({ type: 'file_content_result', payload: result.content })
        }
      })
    }

    if (msg.type === 'request_docker') {
      if (!session) {
        send({ type: 'error', payload: { message: 'Not connected to a server.' } })
        return
      }
      session.getDockerInfo((info) => {
        send({ type: 'docker_result', payload: info })
      })
    }

    if (msg.type === 'request_container_logs') {
      if (!session) return
      const { id } = msg.payload
      session.streamContainerLogs(
        id,
        (line, isError) => send({ type: 'container_log_line', payload: { id, line, isError } }),
        () => send({ type: 'container_logs_end', payload: { id } }),
      )
    }

    if (msg.type === 'stop_container_logs') {
      session?.stopContainerLogs(msg.payload.id)
    }
  })

  ws.on('close', () => {
    session?.disconnect()
    session = null
    clearFingerprintPending()
    if (rateLimitTimer) {
      clearTimeout(rateLimitTimer)
      rateLimitTimer = null
    }
  })
}
