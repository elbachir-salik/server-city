/**
 * Shown when the app is served over plain HTTP (not HTTPS/localhost).
 * Credentials sent over an unencrypted connection are visible on the network.
 */
export function HttpWarningBanner() {
  const isInsecure =
    window.location.protocol === 'http:' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1' &&
    window.location.hostname !== '::1'

  if (!isInsecure) return null

  return (
    <div className="fixed top-0 inset-x-0 z-50 bg-amber-900/90 border-b border-amber-500/60 backdrop-blur px-4 py-2 flex items-center gap-3">
      <span className="text-amber-300 text-base shrink-0">⚠</span>
      <p className="text-amber-200 text-xs leading-snug">
        <strong>Insecure connection:</strong> this page is served over HTTP. SSH credentials
        (passwords, private keys) may be visible to anyone on your network.
        Use HTTPS or run locally to protect your credentials.
      </p>
    </div>
  )
}
