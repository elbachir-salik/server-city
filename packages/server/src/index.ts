import express from 'express'
import http from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import { handleWSConnection } from './wsHandler'

const app = express()
const server = http.createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', connections: wss.clients.size })
})

wss.on('connection', (ws: WebSocket, req) => {
  const ip = req.socket.remoteAddress
  console.log(`[ws] client connected from ${ip}`)
  handleWSConnection(ws)
  ws.on('close', () => console.log(`[ws] client disconnected from ${ip}`))
})

const PORT = process.env.PORT ?? 3001
server.listen(PORT, () => {
  console.log(`ServerCity backend listening on http://localhost:${PORT}`)
  console.log(`WebSocket endpoint: ws://localhost:${PORT}/ws`)
})
