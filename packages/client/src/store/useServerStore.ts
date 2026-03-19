import { create } from 'zustand'
import { ServerMetrics, ConnectionConfig, SubdirEntry, ProcessEntry, ServerInfo, DirectoryNode, FileContent, DockerInfo, DockerContainer } from '@servercity/shared'

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

export interface Alert {
  id: string
  message: string
  timestamp: number
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
  retryAttempt: number
  retryCountdown: number
  fingerprintChallenge: FingerprintChallenge | null
  selectedFloor: number | null
  subdirsByMount: Record<string, SubdirEntry[]>
  cameraResetToken: number
  diskSidebarVisible: boolean
  savedConnections: SavedConnection[]
  processes: ProcessEntry[]
  serverInfo: ServerInfo | null
  alertLog: Alert[]
  processPanelVisible: boolean

  // ── Docker ────────────────────────────────────────────────────────────────
  dockerInfo: DockerInfo | null
  dockerPanelVisible: boolean
  selectedContainer: DockerContainer | null
  containerLogs: Record<string, string[]>   // id → lines[]
  containerLogsActive: string | null         // id currently streaming

  // ── Spatial File Explorer ──────────────────────────────────────────────────
  explorerPath: string | null
  explorerNodes: DirectoryNode[]
  explorerBreadcrumbs: string[]
  explorerLoading: boolean
  explorerError: string | null
  filePanel: FileContent | null
  filePanelLoading: boolean
  commandBarVisible: boolean

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
  setProcesses: (p: ProcessEntry[]) => void
  setServerInfo: (info: ServerInfo) => void
  addAlert: (a: Alert) => void
  removeAlert: (id: string) => void
  toggleProcessPanel: () => void

  // ── Docker ────────────────────────────────────────────────────────────────
  setDockerInfo: (info: DockerInfo) => void
  toggleDockerPanel: () => void
  setSelectedContainer: (c: DockerContainer | null) => void
  appendContainerLog: (id: string, line: string, isError: boolean) => void
  clearContainerLogs: (id: string) => void
  setContainerLogsActive: (id: string | null) => void

  // ── Spatial File Explorer ──────────────────────────────────────────────────
  setExplorerPath: (path: string | null) => void
  setExplorerNodes: (path: string, nodes: DirectoryNode[]) => void
  setExplorerLoading: (loading: boolean) => void
  setExplorerError: (error: string | null) => void
  pushBreadcrumb: (path: string) => void
  popBreadcrumb: () => void
  clearExplorer: () => void
  setFilePanel: (fp: FileContent | null) => void
  setFilePanelLoading: (loading: boolean) => void
  setCommandBarVisible: (visible: boolean) => void

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
  diskSidebarVisible: false,   // off by default — floor info via 3D click
  savedConnections: loadSaved(),
  processes: [],
  serverInfo: null,
  alertLog: [],
  processPanelVisible: false,

  dockerInfo: null,
  dockerPanelVisible: false,
  selectedContainer: null,
  containerLogs: {},
  containerLogsActive: null,

  explorerPath: null,
  explorerNodes: [],
  explorerBreadcrumbs: [],
  explorerLoading: false,
  explorerError: null,
  filePanel: null,
  filePanelLoading: false,
  commandBarVisible: false,

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
  setProcesses: (processes) => set({ processes }),
  setServerInfo: (serverInfo) => set({ serverInfo }),
  addAlert: (a) => set((s) => ({ alertLog: [...s.alertLog.slice(-19), a] })),
  removeAlert: (id) => set((s) => ({ alertLog: s.alertLog.filter(a => a.id !== id) })),
  toggleProcessPanel: () => set((s) => ({ processPanelVisible: !s.processPanelVisible })),

  setDockerInfo: (dockerInfo) => set({ dockerInfo }),
  toggleDockerPanel: () => set((s) => ({ dockerPanelVisible: !s.dockerPanelVisible })),
  setSelectedContainer: (selectedContainer) => set({ selectedContainer }),
  appendContainerLog: (id, line, isError) =>
    set((s) => {
      const prev = s.containerLogs[id] ?? []
      const formatted = isError ? `\x1b[31m${line}\x1b[0m` : line
      // Keep max 200 lines
      const next = [...prev, formatted].slice(-200)
      return { containerLogs: { ...s.containerLogs, [id]: next } }
    }),
  clearContainerLogs: (id) =>
    set((s) => ({ containerLogs: { ...s.containerLogs, [id]: [] } })),
  setContainerLogsActive: (containerLogsActive) => set({ containerLogsActive }),

  setExplorerPath: (explorerPath) => set({ explorerPath, explorerError: null }),
  setExplorerNodes: (path, nodes) =>
    set((s) => ({
      explorerPath: path,
      explorerNodes: nodes,
      explorerLoading: false,
      explorerError: null,
      explorerBreadcrumbs: s.explorerBreadcrumbs.includes(path)
        ? s.explorerBreadcrumbs
        : [...s.explorerBreadcrumbs, path],
    })),
  setExplorerLoading: (explorerLoading) => set({ explorerLoading }),
  setExplorerError: (explorerError) => set({ explorerError, explorerLoading: false }),
  pushBreadcrumb: (path) =>
    set((s) => ({
      explorerBreadcrumbs: s.explorerBreadcrumbs.includes(path)
        ? s.explorerBreadcrumbs
        : [...s.explorerBreadcrumbs, path],
    })),
  popBreadcrumb: () =>
    set((s) => {
      const crumbs = s.explorerBreadcrumbs.slice(0, -1)
      return { explorerBreadcrumbs: crumbs, explorerPath: crumbs[crumbs.length - 1] ?? null }
    }),
  clearExplorer: () =>
    set({
      explorerPath: null,
      explorerNodes: [],
      explorerBreadcrumbs: [],
      explorerLoading: false,
      explorerError: null,
      filePanel: null,
      commandBarVisible: false,
    }),
  setFilePanel: (filePanel) => set({ filePanel, filePanelLoading: false }),
  setFilePanelLoading: (filePanelLoading) => set({ filePanelLoading }),
  setCommandBarVisible: (commandBarVisible) => set({ commandBarVisible }),

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
      processes: [],
      serverInfo: null,
      processPanelVisible: false,
      dockerInfo: null,
      dockerPanelVisible: false,
      selectedContainer: null,
      containerLogs: {},
      containerLogsActive: null,
      explorerPath: null,
      explorerNodes: [],
      explorerBreadcrumbs: [],
      explorerLoading: false,
      explorerError: null,
      filePanel: null,
      commandBarVisible: false,
      // keep: lastConfig (reconnect), diskSidebarVisible, savedConnections, alertLog
    }),
}))
