import 'dotenv/config'
import express from 'express'
import http from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import { handleWSConnection } from './wsHandler'

const app = express()
const server = http.createServer(app)
// 64 KB is far more than any valid client message needs
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 64 * 1024 })

// Track open WS connections so we can close them on shutdown
const activeSessions = new Set<WebSocket>()

// ── Origin check ───────────────────────────────────────────────────────────
// Allowed origins: localhost variants + optional override via env var.
// Prevents malicious web pages from silently connecting to the local backend.
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? ''

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true // non-browser clients (curl, desktop apps) have no Origin
  try {
    const { hostname } = new URL(origin)
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return true
  } catch {
    return false
  }
  if (ALLOWED_ORIGIN && origin === ALLOWED_ORIGIN) return true
  return false
}

app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', connections: wss.clients.size })
})

wss.on('connection', (ws: WebSocket, req) => {
  const origin = req.headers.origin
  if (!isAllowedOrigin(origin)) {
    console.warn(`[ws] rejected connection from untrusted origin: ${origin}`)
    ws.close(1008, 'Origin not allowed')
    return
  }

  const ip = req.socket.remoteAddress
  console.log(`[ws] client connected from ${ip}`)
  activeSessions.add(ws)
  handleWSConnection(ws)
  ws.on('close', () => {
    activeSessions.delete(ws)
    console.log(`[ws] client disconnected from ${ip}`)
  })
})

const PORT = process.env.PORT ?? 3001
server.listen(PORT, () => {
  console.log(`ServerCity backend listening on http://localhost:${PORT}`)
  console.log(`WebSocket endpoint: ws://localhost:${PORT}/ws`)
})

// ── Graceful shutdown ──────────────────────────────────────────────────────
function shutdown(signal: string) {
  console.log(`\n[server] ${signal} received — shutting down gracefully`)

  // Close all WebSocket connections (triggers SSH session cleanup in wsHandler)
  for (const ws of activeSessions) {
    ws.close(1001, 'Server shutting down')
  }
  activeSessions.clear()

  server.close((err) => {
    if (err) {
      console.error('[server] error during close:', err)
      process.exit(1)
    }
    console.log('[server] closed cleanly')
    process.exit(0)
  })

  // Force-exit after 5s if something hangs
  setTimeout(() => {
    console.error('[server] forced exit after timeout')
    process.exit(1)
  }, 5000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT',  () => shutdown('SIGINT'))
