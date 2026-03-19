import { ServerMetrics, SubdirEntry, ProcessEntry, ServerInfo, DirectoryNode, FileContent, DockerContainer, DockerVolume, DockerNetwork, DockerInfo, ContainerStatus, DockerPort, DockerMount } from '@servercity/shared'

// ── CPU ───────────────────────────────────────────────────────────────────────
export function parseCPU(raw: string): { overall: number; cores: number[] } {
  // Modern top (most Linux distros):
  //   %Cpu(s):  5.0 us,  2.0 sy,  0.0 ni, 92.0 id, ...
  // Older top format:
  //   Cpu(s): 5.0%us,  2.0%sy, ... 92.0%id, ...
  let idle: number | null = null

  const modernMatch = raw.match(/(\d+\.?\d*)\s*id/)
  if (modernMatch) {
    idle = parseFloat(modernMatch[1])
  } else {
    // Older format: look for number immediately before %id or id,
    const legacyMatch = raw.match(/(\d+\.?\d*)%?\s*id/)
    if (legacyMatch) idle = parseFloat(legacyMatch[1])
  }

  // No match or NaN → report 0 rather than a misleading 100%
  const overall = idle === null || isNaN(idle) ? 0 : Math.max(0, Math.min(100, 100 - idle))
  return { overall, cores: [] }
}

// ── Memory ────────────────────────────────────────────────────────────────────
export function parseMemory(raw: string): {
  usedMb: number
  totalMb: number
  usedPercent: number
  swap: { usedMb: number; totalMb: number }
} {
  // free -m:
  //               total  used  free  shared  buff/cache  available
  // Mem:           7982  1234  4567    123        2181       6500
  // Swap:          2047     0  2047
  const lines = raw.split('\n')
  const memLine = lines.find((l) => l.startsWith('Mem:'))
  const swapLine = lines.find((l) => l.startsWith('Swap:'))

  let usedMb = 0, totalMb = 0, swapUsed = 0, swapTotal = 0

  if (memLine) {
    const parts = memLine.trim().split(/\s+/)
    if (parts.length >= 3) {
      const t = parseInt(parts[1], 10)
      const u = parseInt(parts[2], 10)
      // Guard against NaN — keep zeros rather than corrupt state
      if (!isNaN(t) && t > 0) totalMb = t
      if (!isNaN(u) && u >= 0) usedMb = u
    }
  }

  if (swapLine) {
    const parts = swapLine.trim().split(/\s+/)
    if (parts.length >= 3) {
      const t = parseInt(parts[1], 10)
      const u = parseInt(parts[2], 10)
      if (!isNaN(t) && t >= 0) swapTotal = t
      if (!isNaN(u) && u >= 0) swapUsed = u
    }
  }

  const usedPercent = totalMb > 0 ? Math.min(100, (usedMb / totalMb) * 100) : 0
  return { usedMb, totalMb, usedPercent, swap: { usedMb: swapUsed, totalMb: swapTotal } }
}

// ── Disk ──────────────────────────────────────────────────────────────────────
// Pseudo/virtual filesystems that produce noise in the disk view
const VIRTUAL_FS = new Set([
  'tmpfs', 'devtmpfs', 'sysfs', 'proc', 'devpts', 'cgroup', 'cgroup2',
  'overlay', 'nsfs', 'hugetlbfs', 'mqueue', 'pstore', 'securityfs',
  'configfs', 'binfmt_misc', 'fusectl', 'debugfs', 'tracefs',
])

function parseSizeToGb(s: string): number {
  const num = parseFloat(s)
  if (isNaN(num) || num < 0) return 0
  const unit = s.slice(-1).toUpperCase()
  if (unit === 'T') return num * 1024
  if (unit === 'G') return num
  if (unit === 'M') return num / 1024
  if (unit === 'K') return num / (1024 * 1024)
  // No unit suffix — treat as bytes
  return num / (1024 * 1024 * 1024)
}

export function parseDisk(raw: string): ServerMetrics['disk'] {
  // df -h:
  // Filesystem  Size  Used Avail Use% Mounted on
  // /dev/sda1    50G   20G   30G  40% /
  const lines = raw.split('\n').slice(1) // drop header
  const result: ServerMetrics['disk'] = []

  for (const line of lines) {
    if (!line.trim()) continue
    const parts = line.trim().split(/\s+/)
    if (parts.length < 6) continue

    const filesystem = parts[0]
    const mount = parts[5]

    // Skip virtual/pseudo filesystems
    if (VIRTUAL_FS.has(filesystem)) continue
    // Skip mounts that look like kernel/system paths (optional – comment out if you want them)
    if (mount.startsWith('/sys') || mount.startsWith('/proc') || mount.startsWith('/dev/pts')) continue

    const totalGb = parseSizeToGb(parts[1])
    const usedGb = parseSizeToGb(parts[2])
    // Use% field — strip trailing % before parsing (Fix from code review)
    const usedPercent = parseInt(parts[4].replace('%', ''), 10)

    // Skip entries where size is 0 or percent is not a valid number
    if (totalGb <= 0 || isNaN(usedPercent)) continue

    result.push({
      mount,
      usedGb: Math.min(usedGb, totalGb), // can't use more than total
      totalGb,
      usedPercent: Math.max(0, Math.min(100, usedPercent)),
    })
  }

  return result
}

// ── Network ───────────────────────────────────────────────────────────────────
export function parseNetwork(raw: string): { bytesIn: number; bytesOut: number } {
  // /proc/net/dev — skip 2 header lines, skip loopback
  const lines = raw.split('\n').slice(2)
  let bytesIn = 0, bytesOut = 0

  for (const line of lines) {
    if (!line.trim()) continue
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const iface = line.substring(0, colonIdx).trim()
    if (iface === 'lo') continue
    const parts = line.substring(colonIdx + 1).trim().split(/\s+/)
    // Need at least 9 fields (bytes_in is [0], bytes_out is [8])
    if (parts.length < 9) continue
    const bIn = parseInt(parts[0], 10)
    const bOut = parseInt(parts[8], 10)
    if (!isNaN(bIn) && bIn >= 0) bytesIn += bIn
    if (!isNaN(bOut) && bOut >= 0) bytesOut += bOut
  }

  return { bytesIn, bytesOut }
}

// ── Subdirectory usage (from `du -k -x --max-depth=1 <mount>`) ───────────────

// Directories that are system noise — never useful to show as "full" indicators
const SKIP_DIRS = new Set([
  'lost+found', 'proc', 'sys', 'dev', 'run', 'tmp', 'snap',
  'mnt', 'media', 'cdrom', 'srv', 'selinux',
])

export function parseDirUsage(raw: string, mount: string): SubdirEntry[] {
  // du output: "<KB>\t<path>" per line, first line is the total for the mount itself
  return raw
    .trim()
    .split('\n')
    .slice(1) // drop the first line (total for the mount itself)
    .map((line) => {
      const tab = line.indexOf('\t')
      if (tab === -1) return null
      const kb = parseInt(line.slice(0, tab), 10)
      const path = line.slice(tab + 1).trim()
      if (isNaN(kb) || kb <= 0 || !path || path === mount) return null
      const name = path.split('/').pop() ?? ''
      // Skip hidden dirs (starting with .) and known system noise
      if (name.startsWith('.') || SKIP_DIRS.has(name)) return null
      return { path, usedGb: kb / (1024 * 1024) }
    })
    .filter((e): e is SubdirEntry => e !== null)
    .sort((a, b) => b.usedGb - a.usedGb)
    .slice(0, 8)
}

// ── Process list (from `ps aux --sort=-%cpu | head -16`) ──────────────────────
export function parseProcessList(raw: string): ProcessEntry[] {
  const lines = raw.trim().split('\n').slice(1) // drop header
  const result: ProcessEntry[] = []
  for (const line of lines) {
    if (!line.trim()) continue
    const parts = line.trim().split(/\s+/)
    if (parts.length < 11) continue
    const pid = parseInt(parts[1], 10)
    const cpu = parseFloat(parts[2])
    const mem = parseFloat(parts[3])
    if (isNaN(pid) || isNaN(cpu) || isNaN(mem)) continue
    result.push({
      user: parts[0].slice(0, 12),
      pid,
      cpu,
      mem,
      cmd: parts.slice(10).join(' ').slice(0, 48),
    })
  }
  return result.slice(0, 15)
}

// ── Server info (from uname + uptime) ────────────────────────────────────────
export function parseServerInfo(raw: string): ServerInfo {
  const lines = raw.trim().split('\n')
  // Expected: line 0 = kernel (uname -r), line 1 = OS (uname -s), line 2+ = uptime
  const kernel = lines[0]?.trim() ?? ''
  const os = lines[1]?.trim() ?? 'Linux'
  const uptime = lines.slice(2).join(' ').trim()
  return { kernel, os, uptime }
}

// ── Directory explore (from du -k + find -printf) ────────────────────────────
export function parseExploreResult(duRaw: string, findRaw: string): DirectoryNode[] {
  const nowSec = Date.now() / 1000

  // find output: name\ttype\tepoch_float per line
  const findMap = new Map<string, { isDirectory: boolean; mtime: number }>()
  for (const line of findRaw.trim().split('\n')) {
    if (!line.trim()) continue
    const parts = line.split('\t')
    if (parts.length < 3) continue
    const name = parts[0].trim()
    const type = parts[1].trim()
    const mtime = parseFloat(parts[2])
    if (!name || isNaN(mtime)) continue
    findMap.set(name, { isDirectory: type === 'd', mtime })
  }

  // du output: KB\tpath per line — first line is total for the dir itself (skip)
  const nodes: DirectoryNode[] = []
  const lines = duRaw.trim().split('\n').slice(1)
  for (const line of lines) {
    const tab = line.indexOf('\t')
    if (tab === -1) continue
    const kb = parseInt(line.slice(0, tab), 10)
    const fullPath = line.slice(tab + 1).trim()
    if (isNaN(kb) || !fullPath) continue
    const name = fullPath.split('/').pop() ?? ''
    if (!name || name === '.' || name === '..') continue
    const findInfo = findMap.get(name)
    const lastModifiedDays = findInfo ? (nowSec - findInfo.mtime) / 86400 : 30
    nodes.push({
      name,
      path: fullPath,
      sizeMb: kb / 1024,
      isDirectory: findInfo?.isDirectory ?? false,
      lastModifiedDays: Math.max(0, lastModifiedDays),
    })
  }

  // Fill in items from find that weren't in du (size=0 files)
  for (const [name, info] of findMap) {
    if (!nodes.find(n => n.name === name) && name !== '.' && name !== '..') {
      nodes.push({
        name,
        path: '', // will be set by caller if needed
        sizeMb: 0,
        isDirectory: info.isDirectory,
        lastModifiedDays: Math.max(0, (nowSec - info.mtime) / 86400),
      })
    }
  }

  return nodes.sort((a, b) => b.sizeMb - a.sizeMb).slice(0, 40)
}

// ── File content (from stat + tail) ──────────────────────────────────────────
export function parseFileContent(raw: string, path: string): FileContent {
  const sepIdx = raw.indexOf('---SEP---')
  const statLine = sepIdx >= 0 ? raw.slice(0, sepIdx).trim() : ''
  const content = sepIdx >= 0 ? raw.slice(sepIdx + 9).trim() : raw.trim()

  const statParts = statLine.split(/\s+/)
  const sizeBytes = parseInt(statParts[0], 10) || 0
  const mtime = parseInt(statParts[1], 10) || 0

  return {
    path,
    sizeMb: sizeBytes / (1024 * 1024),
    mtimeSec: mtime,
    content,
  }
}

// ── Docker ────────────────────────────────────────────────────────────────────

function parsePercent(s: string): number {
  return parseFloat(s.replace('%', '')) || 0
}

function parseMiB(s: string): number {
  // "256MiB / 4GiB" → 256 or "1.5GiB" → 1536
  const val = parseFloat(s)
  if (isNaN(val)) return 0
  const u = s.replace(/[0-9. ]/g, '').toLowerCase()
  if (u.startsWith('g')) return val * 1024
  if (u.startsWith('t')) return val * 1024 * 1024
  return val // MiB
}

function parseDockerPorts(raw: string): DockerPort[] {
  // e.g. "0.0.0.0:8080->80/tcp, 0.0.0.0:443->443/tcp"
  const ports: DockerPort[] = []
  if (!raw) return ports
  for (const part of raw.split(',')) {
    const m = part.trim().match(/:(\d+)->(\d+)\/(\w+)/)
    if (m) {
      ports.push({ host: parseInt(m[1], 10), container: parseInt(m[2], 10), protocol: m[3] })
    }
  }
  return ports
}

/** Parse combined docker output (4 NDJSON sections separated by ---SEP---). */
export function parseDockerData(
  psRaw: string,
  statsRaw: string,
  volumesRaw: string,
  networksRaw: string,
  inspectRaw: string,
): DockerInfo {
  // Parse docker ps -a --format '{{json .}}'
  const psItems: Record<string, unknown>[] = []
  for (const line of psRaw.trim().split('\n')) {
    const l = line.trim()
    if (!l || !l.startsWith('{')) continue
    try { psItems.push(JSON.parse(l)) } catch { /* skip */ }
  }

  // Parse docker stats --no-stream --format '{{json .}}'
  const statsMap = new Map<string, Record<string, unknown>>()
  for (const line of statsRaw.trim().split('\n')) {
    const l = line.trim()
    if (!l || !l.startsWith('{')) continue
    try {
      const s = JSON.parse(l) as Record<string, unknown>
      const id = (s['ID'] ?? s['Container'] ?? '') as string
      if (id) statsMap.set(id.slice(0, 12), s)
    } catch { /* skip */ }
  }

  // Parse docker inspect JSON array
  const inspectMap = new Map<string, Record<string, unknown>>()
  try {
    const arr = JSON.parse(inspectRaw.trim() || '[]') as Record<string, unknown>[]
    for (const item of arr) {
      const id = (item['Id'] as string ?? '').slice(0, 12)
      if (id) inspectMap.set(id, item)
    }
  } catch { /* ignore */ }

  // Build containers
  const containers: DockerContainer[] = psItems.map(ps => {
    const id = ((ps['ID'] ?? ps['Id'] ?? '') as string).slice(0, 12)
    const statsEntry = statsMap.get(id) ?? {}
    const inspectEntry = inspectMap.get(id)

    const cpuStr = (statsEntry['CPUPerc'] ?? '0%') as string
    const memStr = (statsEntry['MemUsage'] ?? '0MiB / 0MiB') as string
    const [memUsed, memLimit] = memStr.split('/').map(s => parseMiB(s.trim()))

    // Ports from ps output
    const ports = parseDockerPorts((ps['Ports'] ?? '') as string)

    // Networks from ps output
    const networks = ((ps['Networks'] ?? '') as string).split(',').map(s => s.trim()).filter(Boolean)

    // Mounts + env vars from inspect
    const mounts: DockerMount[] = []
    const envVars: Array<{ key: string; value: string }> = []
    let restartCount = 0
    if (inspectEntry) {
      const rawMounts = (inspectEntry['Mounts'] as Array<Record<string, unknown>> | undefined) ?? []
      for (const m of rawMounts) {
        const name = (m['Name'] ?? m['Source'] ?? '') as string
        const destination = (m['Destination'] ?? '') as string
        if (name) mounts.push({ name, destination })
      }
      const env = ((inspectEntry['Config'] as Record<string, unknown> | undefined)?.['Env'] ?? []) as string[]
      for (const e of env) {
        const eq = e.indexOf('=')
        if (eq > 0) envVars.push({ key: e.slice(0, eq), value: e.slice(eq + 1) })
      }
      const state = (inspectEntry['State'] as Record<string, unknown> | undefined) ?? {}
      restartCount = (state['RestartCount'] as number | undefined) ?? 0
    }

    const rawStatus = ((ps['State'] ?? ps['Status'] ?? 'exited') as string).toLowerCase()
    const validStatuses: ContainerStatus[] = ['running', 'paused', 'exited', 'dead', 'created', 'restarting']
    const status: ContainerStatus = validStatuses.includes(rawStatus as ContainerStatus)
      ? (rawStatus as ContainerStatus)
      : 'exited'

    return {
      id,
      name: ((ps['Names'] ?? '') as string).replace(/^\//, ''),
      image: (ps['Image'] ?? '') as string,
      status,
      cpuPercent: parsePercent(cpuStr),
      memoryMb: memUsed,
      memoryLimitMb: memLimit || 0,
      ports,
      mounts,
      networks,
      restartCount,
      envVars,
    }
  })

  // Volumes
  const volumes: DockerVolume[] = []
  for (const line of volumesRaw.trim().split('\n')) {
    const l = line.trim()
    if (!l || !l.startsWith('{')) continue
    try {
      const v = JSON.parse(l) as Record<string, unknown>
      const name = (v['Name'] ?? '') as string
      if (name) {
        volumes.push({
          name,
          mountpoint: (v['Mountpoint'] ?? '') as string,
          sizeMb: 0,
        })
      }
    } catch { /* skip */ }
  }

  // Networks
  const networks: DockerNetwork[] = []
  const netContainers = new Map<string, string[]>()
  for (const c of containers) {
    for (const n of c.networks) {
      if (!netContainers.has(n)) netContainers.set(n, [])
      netContainers.get(n)!.push(c.id)
    }
  }
  for (const line of networksRaw.trim().split('\n')) {
    const l = line.trim()
    if (!l || !l.startsWith('{')) continue
    try {
      const n = JSON.parse(l) as Record<string, unknown>
      const name = (n['Name'] ?? '') as string
      if (name) {
        networks.push({
          name,
          driver: (n['Driver'] ?? 'bridge') as string,
          containers: netContainers.get(name) ?? [],
        })
      }
    } catch { /* skip */ }
  }

  return { available: true, containers, volumes, networks }
}

// ── Builder ───────────────────────────────────────────────────────────────────
export function buildMetrics(
  cpuRaw: string,
  memRaw: string,
  diskRaw: string,
  netRaw: string,
): ServerMetrics {
  const cpu = parseCPU(cpuRaw)
  const mem = parseMemory(memRaw)
  const disk = parseDisk(diskRaw)
  const network = parseNetwork(netRaw)

  return {
    timestamp: Date.now(),
    cpu,
    memory: { usedMb: mem.usedMb, totalMb: mem.totalMb, usedPercent: mem.usedPercent },
    swap: mem.swap,
    disk,
    network,
  }
}
