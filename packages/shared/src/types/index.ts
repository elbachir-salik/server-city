export interface SubdirEntry {
  path: string
  usedGb: number
}

export interface DirectoryNode {
  name: string
  path: string
  sizeMb: number
  isDirectory: boolean
  lastModifiedDays: number
}

export interface FileContent {
  path: string
  sizeMb: number
  mtimeSec: number
  content: string
}

// ── Docker ────────────────────────────────────────────────────────────────────
export type ContainerStatus = 'running' | 'paused' | 'exited' | 'dead' | 'created' | 'restarting'

export interface DockerPort {
  host: number
  container: number
  protocol: string
}

export interface DockerMount {
  name: string        // volume name (or bind path)
  destination: string // mount point inside container, e.g. /data
}

export interface DockerContainer {
  id: string
  name: string
  image: string
  status: ContainerStatus
  cpuPercent: number
  memoryMb: number
  memoryLimitMb: number
  ports: DockerPort[]
  mounts: DockerMount[]   // full mount info (replaces old volumes: string[])
  networks: string[]      // network names
  restartCount: number
  envVars: Array<{ key: string; value: string }>
}

export interface DockerVolume {
  name: string
  mountpoint: string
  sizeMb: number
}

export interface DockerNetwork {
  name: string
  driver: string
  containers: string[]   // container ids
}

export interface DockerInfo {
  available: boolean
  reason?: string
  containers: DockerContainer[]
  volumes: DockerVolume[]
  networks: DockerNetwork[]
}

export interface ProcessEntry {
  pid: number
  user: string
  cpu: number
  mem: number
  cmd: string
}

export interface ServerInfo {
  kernel: string
  os: string
  uptime: string
}

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
  | { type: 'subdirs_result'; payload: { mount: string; subdirs: SubdirEntry[] } }
  | { type: 'ps_result'; payload: { processes: ProcessEntry[] } }
  | { type: 'server_info'; payload: ServerInfo }
  | { type: 'explore_result'; payload: { path: string; nodes: DirectoryNode[] } }
  | { type: 'explore_error'; payload: { path: string; error: 'not_found' | 'permission_denied' | 'is_file' } }
  | { type: 'file_content_result'; payload: FileContent }
  | { type: 'file_content_error'; payload: { path: string; error: 'not_found' | 'permission_denied' | 'is_dir' } }
  | { type: 'docker_result'; payload: DockerInfo }
  | { type: 'container_log_line'; payload: { id: string; line: string; isError: boolean } }
  | { type: 'container_logs_end'; payload: { id: string } }

export type WSClientMessage =
  | { type: 'connect'; payload: ConnectionConfig }
  | { type: 'disconnect' }
  | { type: 'fingerprint_response'; payload: { approved: boolean } }
  | { type: 'request_subdirs'; payload: { mount: string } }
  | { type: 'request_ps' }
  | { type: 'request_server_info' }
  | { type: 'explore_path'; payload: { path: string } }
  | { type: 'request_file_content'; payload: { path: string } }
  | { type: 'request_docker' }
  | { type: 'request_container_logs'; payload: { id: string } }
  | { type: 'stop_container_logs'; payload: { id: string } }
