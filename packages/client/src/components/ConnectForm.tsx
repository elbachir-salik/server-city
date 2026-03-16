import { useState, FormEvent } from 'react'
import { ConnectionConfig } from '@servercity/shared'

interface Props {
  onConnect: (config: ConnectionConfig) => void
  error: string
  isConnecting: boolean
}

export function ConnectForm({ onConnect, error, isConnecting }: Props) {
  const [host, setHost] = useState('')
  const [port, setPort] = useState('22')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [privateKey, setPrivateKey] = useState('')
  const [authMode, setAuthMode] = useState<'password' | 'key'>('password')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    onConnect({
      host,
      port: parseInt(port) || 22,
      username,
      password: authMode === 'password' ? password : undefined,
      privateKey: authMode === 'key' ? privateKey : undefined,
    })
  }

  return (
    <div className="min-h-screen bg-city-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
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
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1">Host / IP</label>
              <input
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="192.168.1.1"
                required
                className="w-full bg-black/40 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-city-accent"
              />
            </div>
            <div className="w-20">
              <label className="block text-xs text-gray-400 mb-1">Port</label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="22"
                className="w-full bg-black/40 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-city-accent"
              />
            </div>
          </div>

          {/* Username */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="root"
              required
              className="w-full bg-black/40 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-city-accent"
            />
          </div>

          {/* Auth mode toggle */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAuthMode('password')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                authMode === 'password'
                  ? 'bg-city-accent border-city-accent text-white'
                  : 'bg-transparent border-gray-700 text-gray-400 hover:border-gray-500'
              }`}
            >
              Password
            </button>
            <button
              type="button"
              onClick={() => setAuthMode('key')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                authMode === 'key'
                  ? 'bg-city-accent border-city-accent text-white'
                  : 'bg-transparent border-gray-700 text-gray-400 hover:border-gray-500'
              }`}
            >
              SSH Private Key
            </button>
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
                className="w-full bg-black/40 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-city-accent"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs text-gray-400 mb-1">Private Key (PEM)</label>
              <textarea
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;..."
                rows={5}
                className="w-full bg-black/40 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs font-mono placeholder-gray-600 focus:outline-none focus:border-city-accent resize-none"
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-900/30 border border-red-500/50 rounded-lg px-3 py-2 text-red-400 text-xs">
              {error}
            </div>
          )}

          {/* Submit */}
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
