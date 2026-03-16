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
}

export type WSMessage =
  | { type: 'metrics'; payload: ServerMetrics }
  | { type: 'connected'; payload: { hostname: string } }
  | { type: 'error'; payload: { message: string } }
  | { type: 'disconnected' }

export type WSClientMessage =
  | { type: 'connect'; payload: ConnectionConfig }
  | { type: 'disconnect' }
