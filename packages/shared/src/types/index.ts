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
  /** Optional: pre-known host fingerprint for headless/scripted use.
   *  Interactive users rely on the TOFU modal instead. */
  hostFingerprint?: string
}

export type WSMessage =
  | { type: 'metrics'; payload: ServerMetrics; stale?: boolean }
  | { type: 'connected'; payload: { hostname: string } }
  | { type: 'error'; payload: { message: string } }
  | { type: 'disconnected' }
  | { type: 'fingerprint_challenge'; payload: { fingerprint: string; host: string; port: number } }

export type WSClientMessage =
  | { type: 'connect'; payload: ConnectionConfig }
  | { type: 'disconnect' }
  | { type: 'fingerprint_response'; payload: { approved: boolean } }
