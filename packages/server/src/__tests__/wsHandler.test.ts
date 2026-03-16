import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleWSConnection } from '../wsHandler'

// ── Minimal WebSocket mock ───────────────────────────────────────────────────

function makeWS() {
  const listeners: Record<string, ((...args: unknown[]) => void)[]> = {}
  const sent: string[] = []

  const ws = {
    readyState: 1, // WebSocket.OPEN
    send: vi.fn((data: string) => sent.push(data)),
    on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      listeners[event] = listeners[event] ?? []
      listeners[event].push(cb)
    }),
    // helpers for tests
    _emit: (event: string, ...args: unknown[]) => {
      for (const cb of listeners[event] ?? []) cb(...args)
    },
    _sent: sent,
    _parsed: () => sent.map((s) => JSON.parse(s)),
  }
  return ws
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const validConnectMsg = JSON.stringify({
  type: 'connect',
  payload: {
    host: '10.0.0.1',
    port: 22,
    username: 'root',
    password: 'secret',
  },
})

// Mock SSHSession so tests never touch real SSH
vi.mock('../ssh', () => ({
  SSHSession: vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
  })),
}))

// ── Tests ────────────────────────────────────────────────────────────────────

describe('handleWSConnection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends an error for invalid JSON', () => {
    const ws = makeWS()
    handleWSConnection(ws as never)
    ws._emit('message', 'not-json')
    expect(ws._parsed()[0]).toMatchObject({ type: 'error', payload: { message: 'Invalid JSON message.' } })
  })

  it('sends an error for an unknown message type', () => {
    const ws = makeWS()
    handleWSConnection(ws as never)
    ws._emit('message', JSON.stringify({ type: 'ping' }))
    expect(ws._parsed()[0]).toMatchObject({ type: 'error', payload: { message: expect.stringContaining('malformed') } })
  })

  it('sends an error when connect payload fails validation', () => {
    const ws = makeWS()
    handleWSConnection(ws as never)
    ws._emit('message', JSON.stringify({ type: 'connect', payload: { host: '', port: 0, username: '' } }))
    const msgs = ws._parsed()
    expect(msgs[0].type).toBe('error')
  })

  it('does not create an SSH session when validation fails', async () => {
    const { SSHSession } = await import('../ssh')
    const ws = makeWS()
    handleWSConnection(ws as never)
    ws._emit('message', JSON.stringify({ type: 'connect', payload: { host: '', port: 0, username: '' } }))
    expect(SSHSession).not.toHaveBeenCalled()
  })

  it('creates an SSH session for a valid connect message', async () => {
    const { SSHSession } = await import('../ssh')
    const ws = makeWS()
    handleWSConnection(ws as never)
    ws._emit('message', validConnectMsg)
    expect(SSHSession).toHaveBeenCalledOnce()
  })

  it('disconnects the previous session on a second connect', async () => {
    const { SSHSession } = await import('../ssh')
    const ws = makeWS()
    handleWSConnection(ws as never)
    ws._emit('message', validConnectMsg)
    ws._emit('message', validConnectMsg)
    // First instance should have been disconnected
    const firstInstance = (SSHSession as ReturnType<typeof vi.fn>).mock.results[0].value
    expect(firstInstance.disconnect).toHaveBeenCalled()
  })

  it('disconnects the session on a disconnect message', async () => {
    const { SSHSession } = await import('../ssh')
    const ws = makeWS()
    handleWSConnection(ws as never)
    ws._emit('message', validConnectMsg)
    ws._emit('message', JSON.stringify({ type: 'disconnect' }))
    const instance = (SSHSession as ReturnType<typeof vi.fn>).mock.results[0].value
    expect(instance.disconnect).toHaveBeenCalled()
  })

  it('disconnects the session when the socket closes', async () => {
    const { SSHSession } = await import('../ssh')
    const ws = makeWS()
    handleWSConnection(ws as never)
    ws._emit('message', validConnectMsg)
    ws._emit('close')
    const instance = (SSHSession as ReturnType<typeof vi.fn>).mock.results[0].value
    expect(instance.disconnect).toHaveBeenCalled()
  })

  it('does nothing on close when no session exists', () => {
    const ws = makeWS()
    handleWSConnection(ws as never)
    // No connect — just close; should not throw
    expect(() => ws._emit('close')).not.toThrow()
  })

  describe('rate limiting', () => {
    it('allows up to 3 connect messages per window', async () => {
      const { SSHSession } = await import('../ssh')
      const ws = makeWS()
      handleWSConnection(ws as never)
      ws._emit('message', validConnectMsg)
      ws._emit('message', validConnectMsg)
      ws._emit('message', validConnectMsg)
      // All 3 should have created/replaced sessions — no rate-limit error
      const errorsSent = ws._parsed().filter((m) => m.type === 'error')
      expect(errorsSent).toHaveLength(0)
      expect(SSHSession).toHaveBeenCalledTimes(3)
    })

    it('rejects the 4th connect in the same window with a rate-limit error', async () => {
      const { SSHSession } = await import('../ssh')
      const ws = makeWS()
      handleWSConnection(ws as never)
      ws._emit('message', validConnectMsg)
      ws._emit('message', validConnectMsg)
      ws._emit('message', validConnectMsg)
      ws._emit('message', validConnectMsg) // 4th — should be rejected
      const errors = ws._parsed().filter((m) => m.type === 'error')
      expect(errors).toHaveLength(1)
      expect(errors[0].payload.message).toMatch(/too many/i)
      // SSHSession should only have been constructed 3 times, not 4
      expect(SSHSession).toHaveBeenCalledTimes(3)
    })
  })
})
