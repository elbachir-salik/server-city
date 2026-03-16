import { FingerprintChallenge } from '../store/useServerStore'

interface Props {
  challenge: FingerprintChallenge
  onApprove: () => void
  onReject: () => void
}

const LS_KEY = (host: string, port: number) => `servercity:fp:${host}:${port}`

export function useFingerprintDecision(challenge: FingerprintChallenge): {
  storedFingerprint: string | null
  isChanged: boolean
} {
  const stored = localStorage.getItem(LS_KEY(challenge.host, challenge.port))
  return {
    storedFingerprint: stored,
    isChanged: stored !== null && stored !== challenge.fingerprint,
  }
}

export function storeFingerprintTrust(host: string, port: number, fingerprint: string) {
  localStorage.setItem(LS_KEY(host, port), fingerprint)
}

export function FingerprintModal({ challenge, onApprove, onReject }: Props) {
  const { storedFingerprint, isChanged } = useFingerprintDecision(challenge)
  const isFirstTime = storedFingerprint === null
  const isMatch = storedFingerprint === challenge.fingerprint

  // Known + unchanged fingerprint — auto-approve silently (no modal rendered)
  if (isMatch) {
    storeFingerprintTrust(challenge.host, challenge.port, challenge.fingerprint)
    onApprove()
    return null
  }

  const handleApprove = () => {
    storeFingerprintTrust(challenge.host, challenge.port, challenge.fingerprint)
    onApprove()
  }

  if (isChanged) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="w-full max-w-lg mx-4 bg-gray-950 border-2 border-red-500 rounded-2xl p-6 shadow-2xl">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">🚨</span>
            <div>
              <h2 className="text-red-400 font-bold text-lg">Host Key Changed</h2>
              <p className="text-gray-400 text-xs">{challenge.host}:{challenge.port}</p>
            </div>
          </div>

          <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-3 mb-4 text-sm text-red-300 leading-relaxed">
            <strong>WARNING:</strong> The server's host key has changed since your last connection.
            This could indicate a <strong>man-in-the-middle attack</strong> or a server rebuild.
            Do not proceed unless you know why the key changed.
          </div>

          <div className="space-y-2 mb-5 text-xs font-mono">
            <div>
              <span className="text-gray-500">Previously trusted:</span>
              <div className="mt-1 bg-black/40 rounded px-2 py-1 text-gray-400 break-all">{storedFingerprint}</div>
            </div>
            <div>
              <span className="text-gray-500">New fingerprint:</span>
              <div className="mt-1 bg-black/40 rounded px-2 py-1 text-red-400 break-all">{challenge.fingerprint}</div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={onReject}
              className="w-full py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold text-sm transition-colors"
            >
              Cancel connection (safe)
            </button>
            <button
              onClick={handleApprove}
              className="w-full py-2 rounded-lg border border-gray-700 hover:border-gray-500 text-gray-400 hover:text-white text-xs transition-colors"
            >
              I understand the risk — update trusted fingerprint
            </button>
          </div>
        </div>
      </div>
    )
  }

  // First time connecting to this host
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4 bg-gray-950 border border-city-border rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">🔑</span>
          <div>
            <h2 className="text-white font-bold text-lg">Verify Server Identity</h2>
            <p className="text-gray-400 text-xs">First connection to {challenge.host}:{challenge.port}</p>
          </div>
        </div>

        <p className="text-gray-300 text-sm mb-4">
          You are connecting to this server for the first time. Verify the fingerprint below
          matches what your server admin provided before trusting it.
        </p>

        <div className="bg-black/40 border border-gray-700 rounded-lg px-3 py-2.5 mb-5">
          <div className="text-gray-500 text-xs mb-1">SHA-256 host key fingerprint</div>
          <div className="text-indigo-300 font-mono text-xs break-all">{challenge.fingerprint}</div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleApprove}
            className="flex-1 py-2.5 rounded-lg bg-city-accent hover:bg-indigo-500 text-white font-semibold text-sm transition-colors"
          >
            Trust &amp; Connect
          </button>
          <button
            onClick={onReject}
            className="flex-1 py-2.5 rounded-lg border border-gray-700 hover:border-gray-500 text-gray-400 hover:text-white text-sm transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
