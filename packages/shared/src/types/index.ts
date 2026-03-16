export interface ServerMetrics {
  timestamp: number
  cpu: {
    overall: number
    cores: number[]
  }
  memory: {
    usedMb: number
    totalMb: number
    usedPercent: number
  }
  swap: {
    usedMb: number
    totalMb: number
  }
  disk: Array<{
    mount: string
    usedGb: number
    totalGb: number
    usedPercent: number
  }>
  network: {
    bytesIn: number
    bytesOut: number
  }
}

export interface ConnectionConfig {
  host: string
  port: number
  username: string
  password?: string
  privateKey?: string
  /** Passphrase to decrypt an encrypted private key. Used once in memory then discarded. */
  passphrase?: string
  /** SHA-256 or MD5 hex fingerprint of the server's host key (e.g. "SHA256:abc123...").
   *  When provided the connection is rejected if the key doesn't match.
   *  When absent a warning is sent to the client. */
  hostFingerprint?: string
}

export type WSMessage =
  | { type: 'metrics'; payload: ServerMetrics; stale?: boolean }
  | { type: 'connected'; payload: { hostname: string } }
  | { type: 'error'; payload: { message: string } }
  | { type: 'disconnected' }

export type WSClientMessage =
  | { type: 'connect'; payload: ConnectionConfig }
  | { type: 'disconnect' }
