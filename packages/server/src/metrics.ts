import { ServerMetrics, SubdirEntry } from '@servercity/shared'

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
