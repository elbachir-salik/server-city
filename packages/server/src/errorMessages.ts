/** Maps raw ssh2 error messages to user-friendly strings. */
export function friendlySSHError(raw: string): string {
  const msg = raw.toLowerCase()

  if (msg.includes('all configured authentication methods failed') ||
      msg.includes('authentication failed') ||
      msg.includes('permission denied')) {
    return 'Authentication failed — check your username, password, or private key.'
  }

  if (msg.includes('econnrefused') || msg.includes('connection refused')) {
    return 'Connection refused — is SSH running on that host and port?'
  }

  if (msg.includes('etimedout') || msg.includes('timed out') || msg.includes('timeout')) {
    return 'Connection timed out — check the host address and firewall rules.'
  }

  if (msg.includes('enotfound') || msg.includes('getaddrinfo')) {
    return 'Host not found — check the hostname or IP address.'
  }

  if (msg.includes('enetunreach') || msg.includes('network unreachable')) {
    return 'Network unreachable — check your network connection.'
  }

  if (msg.includes('econnreset') || msg.includes('connection reset')) {
    return 'Connection reset — the server unexpectedly closed the connection.'
  }

  if (msg.includes('handshake failed') || msg.includes('kex')) {
    return 'SSH handshake failed — the server may use an incompatible algorithm.'
  }

  if (msg.includes('cannot parse privatekey') || msg.includes('invalid private key') ||
      msg.includes('privatekey')) {
    return 'Invalid private key — make sure it is a valid PEM-encoded key.'
  }

  if (msg.includes('eacces') || msg.includes('permission')) {
    return 'Permission denied — the user may lack shell access on this server.'
  }

  // Fall back to the raw message, stripped of Node.js internals
  return raw.replace(/\s*\(.*?\)\s*/g, '').trim() || 'SSH connection failed.'
}
