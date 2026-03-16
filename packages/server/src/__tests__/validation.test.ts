import { describe, it, expect } from 'vitest'
import { validateConnectionConfig, validateWSClientMessage } from '../validation'

// ── helpers ─────────────────────────────────────────────────────────────────

const validBase = {
  host: '192.168.1.1',
  port: 22,
  username: 'admin',
  password: 'secret',
}

function fieldsWithErrors(errors: { field: string }[]) {
  return errors.map((e) => e.field)
}

// ── validateConnectionConfig ─────────────────────────────────────────────────

describe('validateConnectionConfig', () => {
  describe('non-object payloads', () => {
    it.each([null, undefined, 'string', 42, true])(
      'rejects %s with a single payload error',
      (v) => {
        const errors = validateConnectionConfig(v)
        expect(errors).toHaveLength(1)
        expect(errors[0].field).toBe('payload')
      },
    )

    it('treats an array as an object and returns field-level errors', () => {
      // typeof [] === 'object' — it passes the null check and is validated as a record
      const errors = validateConnectionConfig([])
      expect(errors.length).toBeGreaterThan(0)
      expect(errors.some((e) => e.field !== 'payload')).toBe(true)
    })
  })

  describe('host validation', () => {
    it('accepts a valid IPv4 address', () => {
      const errors = validateConnectionConfig({ ...validBase, host: '10.0.0.1' })
      expect(fieldsWithErrors(errors)).not.toContain('host')
    })

    it('accepts 0.0.0.0', () => {
      expect(fieldsWithErrors(validateConnectionConfig({ ...validBase, host: '0.0.0.0' }))).not.toContain('host')
    })

    it('rejects an IPv4 address with an octet > 255', () => {
      expect(fieldsWithErrors(validateConnectionConfig({ ...validBase, host: '192.168.1.256' }))).toContain('host')
    })

    it('accepts a valid hostname', () => {
      expect(fieldsWithErrors(validateConnectionConfig({ ...validBase, host: 'my-server.example.com' }))).not.toContain('host')
    })

    it('accepts a single-label hostname', () => {
      expect(fieldsWithErrors(validateConnectionConfig({ ...validBase, host: 'myserver' }))).not.toContain('host')
    })

    it('accepts an IPv6 address', () => {
      expect(fieldsWithErrors(validateConnectionConfig({ ...validBase, host: '::1' }))).not.toContain('host')
    })

    it('rejects an empty host', () => {
      expect(fieldsWithErrors(validateConnectionConfig({ ...validBase, host: '   ' }))).toContain('host')
    })

    it('rejects a host with invalid characters', () => {
      expect(fieldsWithErrors(validateConnectionConfig({ ...validBase, host: 'bad host!' }))).toContain('host')
    })

    it('rejects a non-string host', () => {
      expect(fieldsWithErrors(validateConnectionConfig({ ...validBase, host: 12345 }))).toContain('host')
    })
  })

  describe('port validation', () => {
    it('accepts port 22', () => {
      expect(fieldsWithErrors(validateConnectionConfig(validBase))).not.toContain('port')
    })

    it('accepts port 1 (minimum)', () => {
      expect(fieldsWithErrors(validateConnectionConfig({ ...validBase, port: 1 }))).not.toContain('port')
    })

    it('accepts port 65535 (maximum)', () => {
      expect(fieldsWithErrors(validateConnectionConfig({ ...validBase, port: 65535 }))).not.toContain('port')
    })

    it('rejects port 0', () => {
      expect(fieldsWithErrors(validateConnectionConfig({ ...validBase, port: 0 }))).toContain('port')
    })

    it('rejects port 65536', () => {
      expect(fieldsWithErrors(validateConnectionConfig({ ...validBase, port: 65536 }))).toContain('port')
    })

    it('rejects a float port', () => {
      expect(fieldsWithErrors(validateConnectionConfig({ ...validBase, port: 22.5 }))).toContain('port')
    })

    it('rejects a string port', () => {
      expect(fieldsWithErrors(validateConnectionConfig({ ...validBase, port: '22' }))).toContain('port')
    })
  })

  describe('username validation', () => {
    it('accepts a normal username', () => {
      expect(fieldsWithErrors(validateConnectionConfig(validBase))).not.toContain('username')
    })

    it('rejects an empty username', () => {
      expect(fieldsWithErrors(validateConnectionConfig({ ...validBase, username: '' }))).toContain('username')
    })

    it('rejects a whitespace-only username', () => {
      expect(fieldsWithErrors(validateConnectionConfig({ ...validBase, username: '   ' }))).toContain('username')
    })

    it('rejects a username longer than 32 characters', () => {
      expect(
        fieldsWithErrors(validateConnectionConfig({ ...validBase, username: 'a'.repeat(33) })),
      ).toContain('username')
    })

    it('accepts a username of exactly 32 characters', () => {
      expect(
        fieldsWithErrors(validateConnectionConfig({ ...validBase, username: 'a'.repeat(32) })),
      ).not.toContain('username')
    })

    it('rejects a username with invalid characters', () => {
      expect(
        fieldsWithErrors(validateConnectionConfig({ ...validBase, username: 'root user' })),
      ).toContain('username')
    })

    it('accepts username with dash, underscore, dot', () => {
      expect(
        fieldsWithErrors(validateConnectionConfig({ ...validBase, username: 'deploy_user.1-dev' })),
      ).not.toContain('username')
    })
  })

  describe('auth validation — password', () => {
    it('accepts password-only auth', () => {
      expect(validateConnectionConfig(validBase)).toHaveLength(0)
    })

    it('rejects when neither password nor key is provided', () => {
      const { password: _pw, ...noAuth } = validBase
      expect(fieldsWithErrors(validateConnectionConfig(noAuth))).toContain('auth')
    })

    it('rejects an empty-string password with no key', () => {
      expect(
        fieldsWithErrors(validateConnectionConfig({ ...validBase, password: '' })),
      ).toContain('auth')
    })

    it('rejects a password longer than 1 KB', () => {
      expect(
        fieldsWithErrors(validateConnectionConfig({ ...validBase, password: 'x'.repeat(1025) })),
      ).toContain('password')
    })

    it('accepts a password of exactly 1024 characters', () => {
      expect(
        fieldsWithErrors(validateConnectionConfig({ ...validBase, password: 'x'.repeat(1024) })),
      ).not.toContain('password')
    })
  })

  describe('auth validation — private key', () => {
    const validKey = '-----BEGIN OPENSSH PRIVATE KEY-----\nABCD\n-----END OPENSSH PRIVATE KEY-----'

    it('accepts key-only auth', () => {
      const { password: _pw, ...noPassword } = validBase
      const errors = validateConnectionConfig({ ...noPassword, privateKey: validKey })
      expect(errors).toHaveLength(0)
    })

    it('accepts both password and key (password takes precedence)', () => {
      expect(validateConnectionConfig({ ...validBase, privateKey: validKey })).toHaveLength(0)
    })

    it('rejects a key that does not start with -----BEGIN', () => {
      const { password: _pw, ...noPassword } = validBase
      const fields = fieldsWithErrors(validateConnectionConfig({ ...noPassword, privateKey: 'not-a-pem-key' }))
      expect(fields).toContain('privateKey')
    })

    it('rejects a private key longer than 16 KB', () => {
      const oversized = '-----BEGIN RSA PRIVATE KEY-----\n' + 'A'.repeat(16384)
      expect(
        fieldsWithErrors(validateConnectionConfig({ ...validBase, privateKey: oversized })),
      ).toContain('privateKey')
    })

    it('accepts a private key of exactly 16384 characters', () => {
      const atLimit = '-----BEGIN RSA PRIVATE KEY-----\n' + 'A'.repeat(16384 - 32)
      // Total length is just under 16384 — should not trigger the length error
      expect(
        fieldsWithErrors(validateConnectionConfig({ ...validBase, privateKey: atLimit })),
      ).not.toContain('privateKey')
    })
  })

  describe('multiple errors', () => {
    it('returns errors for all invalid fields at once', () => {
      const fields = fieldsWithErrors(
        validateConnectionConfig({ host: '', port: 0, username: '', }),
      )
      expect(fields).toContain('host')
      expect(fields).toContain('port')
      expect(fields).toContain('username')
      expect(fields).toContain('auth')
    })
  })
})

// ── validateWSClientMessage ──────────────────────────────────────────────────

describe('validateWSClientMessage', () => {
  it('accepts type "connect"', () => {
    expect(validateWSClientMessage({ type: 'connect', payload: {} })).toBe(true)
  })

  it('accepts type "disconnect"', () => {
    expect(validateWSClientMessage({ type: 'disconnect' })).toBe(true)
  })

  it('rejects an unknown type', () => {
    expect(validateWSClientMessage({ type: 'ping' })).toBe(false)
  })

  it('rejects a missing type field', () => {
    expect(validateWSClientMessage({ payload: {} })).toBe(false)
  })

  it('rejects null', () => {
    expect(validateWSClientMessage(null)).toBe(false)
  })

  it('rejects a plain string', () => {
    expect(validateWSClientMessage('connect')).toBe(false)
  })

  it('rejects an array', () => {
    expect(validateWSClientMessage(['connect'])).toBe(false)
  })

  it('rejects a number', () => {
    expect(validateWSClientMessage(42)).toBe(false)
  })
})
