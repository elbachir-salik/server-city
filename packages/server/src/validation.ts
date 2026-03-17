import { WSClientMessage } from '@servercity/shared'

// RFC 1123 hostname or IPv4/IPv6
const HOSTNAME_RE = /^[a-zA-Z0-9]([a-zA-Z0-9\-_]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-_]*[a-zA-Z0-9])?)*$/
const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/
const IPV6_RE = /^[0-9a-fA-F:]+$/

function isValidHost(host: unknown): host is string {
  if (typeof host !== 'string' || host.trim().length === 0) return false
  const h = host.trim()
  if (IPV4_RE.test(h)) {
    return h.split('.').every((o) => parseInt(o, 10) <= 255)
  }
  if (IPV6_RE.test(h)) return true
  return HOSTNAME_RE.test(h)
}

function isValidPort(port: unknown): port is number {
  return typeof port === 'number' && Number.isInteger(port) && port >= 1 && port <= 65535
}

// Alphanumeric, dash, underscore, dot — same set accepted by most Linux distros
const USERNAME_RE = /^[a-zA-Z0-9._-]+$/

function isValidUsername(username: unknown): username is string {
  return (
    typeof username === 'string' &&
    username.length > 0 &&
    username.length <= 32 &&
    USERNAME_RE.test(username)
  )
}

const MAX_PASSWORD_LEN = 1024        // 1 KB
const MAX_PRIVATE_KEY_LEN = 16384    // 16 KB

export interface ValidationError {
  field: string
  message: string
}

export function validateConnectionConfig(payload: unknown): ValidationError[] {
  const errors: ValidationError[] = []

  if (typeof payload !== 'object' || payload === null) {
    return [{ field: 'payload', message: 'Invalid connect payload.' }]
  }

  const p = payload as Record<string, unknown>

  if (!isValidHost(p.host)) {
    errors.push({ field: 'host', message: 'Host must be a valid hostname or IP address.' })
  }

  if (!isValidPort(p.port)) {
    errors.push({ field: 'port', message: 'Port must be an integer between 1 and 65535.' })
  }

  if (!isValidUsername(p.username)) {
    errors.push({ field: 'username', message: 'Username must be 1–32 characters: letters, numbers, dash, underscore, dot.' })
  }

  const hasPassword = typeof p.password === 'string' && p.password.length > 0
  const hasKey = typeof p.privateKey === 'string' && p.privateKey.trim().startsWith('-----BEGIN')

  if (!hasPassword && !hasKey) {
    errors.push({
      field: 'auth',
      message: 'Provide either a password or a PEM private key.',
    })
  }

  if (typeof p.privateKey === 'string' && p.privateKey.length > 0 && !hasKey) {
    errors.push({
      field: 'privateKey',
      message: 'Private key must be a PEM-encoded key starting with "-----BEGIN".',
    })
  }

  if (typeof p.password === 'string' && p.password.length > MAX_PASSWORD_LEN) {
    errors.push({ field: 'password', message: 'Password exceeds maximum allowed length.' })
  }

  if (typeof p.privateKey === 'string' && p.privateKey.length > MAX_PRIVATE_KEY_LEN) {
    errors.push({ field: 'privateKey', message: 'Private key exceeds maximum allowed length (16 KB).' })
  }

  return errors
}

// Absolute path: starts with /, only word chars, dots, dashes, slashes — no ..
const MOUNT_PATH_RE = /^\/[a-zA-Z0-9._\-/]*$/
const MAX_MOUNT_LEN = 256

export function isValidMountPath(mount: unknown): mount is string {
  return (
    typeof mount === 'string' &&
    mount.length > 0 &&
    mount.length <= MAX_MOUNT_LEN &&
    MOUNT_PATH_RE.test(mount) &&
    !mount.includes('..')
  )
}

export function validateWSClientMessage(raw: unknown): raw is WSClientMessage {
  if (typeof raw !== 'object' || raw === null) return false
  const msg = raw as Record<string, unknown>
  if (msg.type === 'request_subdirs') {
    return typeof msg.payload === 'object' && msg.payload !== null &&
      isValidMountPath((msg.payload as Record<string, unknown>).mount)
  }
  return msg.type === 'connect' || msg.type === 'disconnect' || msg.type === 'fingerprint_response'
}
