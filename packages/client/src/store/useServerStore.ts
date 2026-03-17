import { create } from 'zustand'
import { ServerMetrics, ConnectionConfig, SubdirEntry } from '@servercity/shared'

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error'

// Credential-free snapshot — password and privateKey are never stored in state
export type SafeConfig = Pick<ConnectionConfig, 'host' | 'port' | 'username'>

export interface FingerprintChallenge {
  fingerprint: string
  host: string
  port: number
}

// Saved connection entry — no passwords, no keys
export interface SavedConnection {
  id: string
  label: string
  host: string
  port: number
  username: string
}

const SAVED_KEY = 'servercity:connections'

function loadSaved(): SavedConnection[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY)
    if (!raw) return []
    return JSON.parse(raw) as SavedConnection[]
  } catch {
    return []
  }
}

function persistSaved(list: SavedConnection[]) {
  try { localStorage.setItem(SAVED_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

interface ServerStore {
  status: ConnectionStatus
  hostname: string
  metrics: ServerMetrics | null
  metricsStale: boolean
  errorMessage: string
  lastConfig: SafeConfig | null
  retryAttempt: number       // 0 = not retrying
  retryCountdown: number     // seconds until next retry
  fingerprintChallenge: FingerprintChallenge | null
  selectedFloor: number | null
  subdirsByMount: Record<string, SubdirEntry[]>
  cameraResetToken: number
  diskSidebarVisible: boolean
  savedConnections: SavedConnection[]

  setStatus: (s: ConnectionStatus) => void
  setHostname: (h: string) => void
  setMetrics: (m: ServerMetrics) => void
  setMetricsStale: (stale: boolean) => void
  setError: (msg: string) => void
  setLastConfig: (c: ConnectionConfig) => void
  setRetry: (attempt: number, countdown: number) => void
  setFingerprintChallenge: (c: FingerprintChallenge | null) => void
  setSelectedFloor: (floor: number | null) => void
  setSubdirs: (mount: string, subdirs: SubdirEntry[]) => void
  resetCamera: () => void
  toggleDiskSidebar: () => void
  saveConnection: (cfg: SavedConnection) => void
  deleteConnection: (id: string) => void
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
  fingerprintChallenge: null,
  selectedFloor: null,
  subdirsByMount: {},
  cameraResetToken: 0,
  diskSidebarVisible: true,
  savedConnections: loadSaved(),

  setStatus: (status) => set({ status }),
  setHostname: (hostname) => set({ hostname }),
  setMetrics: (metrics) => set({ metrics, metricsStale: false }),
  setMetricsStale: (metricsStale) => set({ metricsStale }),
  setError: (errorMessage) => set({ errorMessage, status: 'error' }),
  setLastConfig: ({ host, port, username }) => set({ lastConfig: { host, port, username } }),
  setRetry: (retryAttempt, retryCountdown) => set({ retryAttempt, retryCountdown }),
  setFingerprintChallenge: (fingerprintChallenge) => set({ fingerprintChallenge }),
  setSelectedFloor: (selectedFloor) => set({ selectedFloor }),
  setSubdirs: (mount, subdirs) =>
    set((s) => ({ subdirsByMount: { ...s.subdirsByMount, [mount]: subdirs } })),
  resetCamera: () => set((s) => ({ cameraResetToken: s.cameraResetToken + 1, selectedFloor: null })),
  toggleDiskSidebar: () => set((s) => ({ diskSidebarVisible: !s.diskSidebarVisible })),
  saveConnection: (conn) =>
    set((s) => {
      // Upsert by id
      const existing = s.savedConnections.findIndex(c => c.id === conn.id)
      const next = existing >= 0
        ? s.savedConnections.map(c => c.id === conn.id ? conn : c)
        : [...s.savedConnections, conn]
      persistSaved(next)
      return { savedConnections: next }
    }),
  deleteConnection: (id) =>
    set((s) => {
      const next = s.savedConnections.filter(c => c.id !== id)
      persistSaved(next)
      return { savedConnections: next }
    }),
  reset: () =>
    set({
      status: 'idle',
      hostname: '',
      metrics: null,
      metricsStale: false,
      errorMessage: '',
      retryAttempt: 0,
      retryCountdown: 0,
      fingerprintChallenge: null,
      selectedFloor: null,
      subdirsByMount: {},
      cameraResetToken: 0,
      // intentionally keep lastConfig so reconnect can still work
      // intentionally keep diskSidebarVisible — user preference
      // intentionally keep savedConnections — they persist across sessions
    }),
}))
