import { useState, FormEvent, useRef } from 'react'
import { ConnectionConfig } from '@servercity/shared'

interface Props {
  onConnect: (config: ConnectionConfig) => void
  error: string
  isConnecting: boolean
}

interface FieldErrors {
  host?: string
  port?: string
  username?: string
  auth?: string
}

// Mirrors server-side rules — server is still authoritative
const HOSTNAME_RE = /^[a-zA-Z0-9]([a-zA-Z0-9\-_.]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-_.]*[a-zA-Z0-9])?)*$/
const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/
const IPV6_RE = /^[0-9a-fA-F:]+$/

function validateHost(h: string): string | undefined {
  if (!h.trim()) return 'Host is required.'
  const host = h.trim()
  if (IPV4_RE.test(host)) {
    const valid = host.split('.').every((o) => parseInt(o, 10) <= 255)
    return valid ? undefined : 'Invalid IPv4 address.'
  }
  if (IPV6_RE.test(host)) return undefined
  if (!HOSTNAME_RE.test(host)) return 'Invalid hostname or IP address.'
  return undefined
}

function validatePort(p: string): string | undefined {
  const n = parseInt(p, 10)
  if (isNaN(n) || n < 1 || n > 65535) return 'Port must be between 1 and 65535.'
  return undefined
}

// ── Key encryption detection ─────────────────────────────────────────────────
// Returns true = encrypted, false = plaintext, null = unknown (OpenSSH format)
function detectKeyEncryption(pem: string): boolean | null {
  if (pem.includes('Proc-Type: 4,ENCRYPTED')) return true
  if (pem.match(/BEGIN (?:RSA|DSA|EC) PRIVATE KEY/)) return false // traditional PEM, no encryption header
  return null // OpenSSH format — can't tell without binary parsing
}

// ── Reusable styled input ────────────────────────────────────────────────────
interface FieldProps {
  label: string
  error?: string
  children: React.ReactNode
}

function Field({ label, error, children }: FieldProps) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      {children}
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  )
}

const inputCls = (err?: string) =>
  `w-full bg-black/40 border rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-city-accent ${
    err ? 'border-red-500/70' : 'border-gray-700'
  }`

// ── Form ─────────────────────────────────────────────────────────────────────
export function ConnectForm({ onConnect, error, isConnecting }: Props) {
  const [host, setHost] = useState('')
  const [port, setPort] = useState('22')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [privateKey, setPrivateKey] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [authMode, setAuthMode] = useState<'password' | 'key'>('password')
  const [hostFingerprint, setHostFingerprint] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const keyEncrypted = authMode === 'key' && privateKey.trim() ? detectKeyEncryption(privateKey) : null

  const handleKeyFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result
      if (typeof text === 'string') { setPrivateKey(text); revalidate() }
    }
    reader.readAsText(file)
    // Reset so the same file can be re-selected if needed
    e.target.value = ''
  }
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [touched, setTouched] = useState<Partial<Record<keyof FieldErrors, boolean>>>({})

  const touch = (field: keyof FieldErrors) =>
    setTouched((t) => ({ ...t, [field]: true }))

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {}
    const hostErr = validateHost(host)
    if (hostErr) errors.host = hostErr
    const portErr = validatePort(port)
    if (portErr) errors.port = portErr
    if (!/^[a-zA-Z0-9._-]{1,32}$/.test(username.trim()))
      errors.username = 'Username must be 1–32 characters: letters, numbers, dash, underscore, dot.'
    if (authMode === 'key' && !privateKey.trim().startsWith('-----BEGIN')) {
      errors.auth = 'Key must be a PEM key starting with "-----BEGIN".'
    }
    return errors
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    // Mark all fields as touched so errors show
    setTouched({ host: true, port: true, username: true, auth: true })
    const errors = validate()
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    onConnect({
      host: host.trim(),
      port: parseInt(port, 10),
      username: username.trim(),
      password: authMode === 'password' ? password : undefined,
      privateKey: authMode === 'key' ? privateKey : undefined,
      passphrase: authMode === 'key' && passphrase ? passphrase : undefined,
      hostFingerprint: hostFingerprint.trim() || undefined,
    })
  }

  // Re-validate on change once a field has been touched
  const revalidate = () => {
    if (Object.keys(touched).length > 0) setFieldErrors(validate())
  }

  return (
    <div className="min-h-screen bg-city-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white tracking-tight">
            Server<span className="text-city-accent">City</span>
          </h1>
          <p className="text-gray-400 mt-2 text-sm">Connect to your server to begin visualization</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-city-border bg-city-panel backdrop-blur p-6 space-y-4"
        >
          {/* Host + Port */}
          <div className="flex gap-3 items-start">
            <Field label="Host / IP" error={touched.host ? fieldErrors.host : undefined}>
              <input
                type="text"
                value={host}
                onChange={(e) => { setHost(e.target.value); revalidate() }}
                onBlur={() => { touch('host'); revalidate() }}
                placeholder="192.168.1.1"
                className={inputCls(touched.host ? fieldErrors.host : undefined)}
              />
            </Field>
            <div className="w-24 shrink-0">
              <Field label="Port" error={touched.port ? fieldErrors.port : undefined}>
                <input
                  type="number"
                  value={port}
                  onChange={(e) => { setPort(e.target.value); revalidate() }}
                  onBlur={() => { touch('port'); revalidate() }}
                  placeholder="22"
                  className={inputCls(touched.port ? fieldErrors.port : undefined)}
                />
              </Field>
            </div>
          </div>

          {/* Username */}
          <Field label="Username" error={touched.username ? fieldErrors.username : undefined}>
            <input
              type="text"
              value={username}
              onChange={(e) => { setUsername(e.target.value); revalidate() }}
              onBlur={() => { touch('username'); revalidate() }}
              placeholder="root"
              className={inputCls(touched.username ? fieldErrors.username : undefined)}
            />
          </Field>

          {/* Auth mode toggle */}
          <div className="flex gap-2">
            {(['password', 'key'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => { setAuthMode(mode); setFieldErrors({}); setTouched({}); setPassphrase('') }}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  authMode === mode
                    ? 'bg-city-accent border-city-accent text-white'
                    : 'bg-transparent border-gray-700 text-gray-400 hover:border-gray-500'
                }`}
              >
                {mode === 'password' ? 'Password' : 'SSH Private Key'}
              </button>
            ))}
          </div>

          {/* Auth fields */}
          {authMode === 'password' ? (
            <div>
              <label className="block text-xs text-gray-400 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={inputCls()}
              />
            </div>
          ) : (
            <>
              {/* Hidden file input — triggered by the button below */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pem,.key,.ppk,text/plain"
                className="hidden"
                onChange={handleKeyFile}
              />

              <Field label="Private Key (PEM)" error={touched.auth ? fieldErrors.auth : undefined}>
                <div className="flex gap-2 mb-1.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-city-accent hover:text-indigo-300 border border-gray-700 hover:border-city-accent rounded-lg px-2.5 py-1 transition-colors"
                  >
                    Upload key file
                  </button>
                  <span className="text-gray-600 text-xs self-center">or paste below</span>
                </div>
                <textarea
                  value={privateKey}
                  onChange={(e) => { setPrivateKey(e.target.value); revalidate() }}
                  onBlur={() => { touch('auth'); revalidate() }}
                  placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;..."
                  rows={5}
                  className={`w-full bg-black/40 border rounded-lg px-3 py-2 text-white text-xs font-mono placeholder-gray-600 focus:outline-none focus:border-city-accent resize-none ${
                    touched.auth && fieldErrors.auth ? 'border-red-500/70' : 'border-gray-700'
                  }`}
                />
              </Field>

              {/* Unencrypted key warning */}
              {keyEncrypted === false && (
                <div className="bg-amber-900/30 border border-amber-500/50 rounded-lg px-3 py-2 text-amber-400 text-xs">
                  Your private key has no passphrase. Anyone who obtains this file can use it immediately. Consider protecting it with a passphrase.
                </div>
              )}

              {/* Passphrase field — shown when key is present */}
              {privateKey.trim() && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Key Passphrase <span className="text-gray-600">(if encrypted)</span>
                  </label>
                  <input
                    type="password"
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    placeholder="Leave blank if key has no passphrase"
                    className={inputCls()}
                  />
                </div>
              )}
            </>
          )}

          {/* Optional host fingerprint */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              Host Fingerprint <span className="text-gray-600">(optional — recommended)</span>
            </label>
            <input
              type="text"
              value={hostFingerprint}
              onChange={(e) => setHostFingerprint(e.target.value)}
              placeholder="SHA256:abc123..."
              className={inputCls()}
            />
            <p className="text-gray-600 text-xs mt-1">
              Paste the server&apos;s host key fingerprint to prevent MITM attacks. Leave blank to connect without verification.
            </p>
          </div>

          {/* Server-side error */}
          {error && (
            <div className="bg-red-900/30 border border-red-500/50 rounded-lg px-3 py-2 text-red-400 text-xs">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isConnecting}
            className="w-full py-3 rounded-lg bg-city-accent hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
          >
            {isConnecting ? 'Connecting...' : 'Connect'}
          </button>
        </form>
      </div>
    </div>
  )
}
