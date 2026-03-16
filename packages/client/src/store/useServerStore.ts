import { create } from 'zustand'
import { ServerMetrics, ConnectionConfig } from '@servercity/shared'

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error'

// Credential-free snapshot — password and privateKey are never stored in state
export type SafeConfig = Pick<ConnectionConfig, 'host' | 'port' | 'username'>

interface ServerStore {
  status: ConnectionStatus
  hostname: string
  metrics: ServerMetrics | null
  metricsStale: boolean
  errorMessage: string
  lastConfig: SafeConfig | null
  retryAttempt: number       // 0 = not retrying
  retryCountdown: number     // seconds until next retry

  setStatus: (s: ConnectionStatus) => void
  setHostname: (h: string) => void
  setMetrics: (m: ServerMetrics) => void
  setMetricsStale: (stale: boolean) => void
  setError: (msg: string) => void
  setLastConfig: (c: ConnectionConfig) => void
  setRetry: (attempt: number, countdown: number) => void
  reset: () => void
}

export const useServerStore = create<ServerStore>((set) => ({
  status: 'idle',
  hostname: '',
  metrics: null,
  metricsStale: false,
  errorMessage: '',
  lastConfig: null,
  retryAttempt: 0,
  retryCountdown: 0,

  setStatus: (status) => set({ status }),
  setHostname: (hostname) => set({ hostname }),
  setMetrics: (metrics) => set({ metrics, metricsStale: false }),
  setMetricsStale: (metricsStale) => set({ metricsStale }),
  setError: (errorMessage) => set({ errorMessage, status: 'error' }),
  setLastConfig: ({ host, port, username }) => set({ lastConfig: { host, port, username } }),
  setRetry: (retryAttempt, retryCountdown) => set({ retryAttempt, retryCountdown }),
  reset: () =>
    set({
      status: 'idle',
      hostname: '',
      metrics: null,
      metricsStale: false,
      errorMessage: '',
      retryAttempt: 0,
      retryCountdown: 0,
      // intentionally keep lastConfig so "Back to Connect" pre-fills nothing
      // but reconnect can still work if user navigates back manually
    }),
}))
