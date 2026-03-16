import { ServerMetrics } from '@servercity/shared'

export function parseCPU(raw: string): { overall: number; cores: number[] } {
  // top -bn1 | grep "Cpu(s)" →
  // %Cpu(s):  5.0 us,  2.0 sy,  0.0 ni, 92.0 id,  0.0 wa ...
  const match = raw.match(/(\d+\.?\d*)\s*id/)
  const idle = match ? parseFloat(match[1]) : 0
  const overall = Math.max(0, Math.min(100, 100 - idle))
  return { overall, cores: [] }
}

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

  let usedMb = 0,
    totalMb = 0,
    swapUsed = 0,
    swapTotal = 0

  if (memLine) {
    const parts = memLine.trim().split(/\s+/)
    totalMb = parseInt(parts[1]) || 0
    usedMb = parseInt(parts[2]) || 0
  }

  if (swapLine) {
    const parts = swapLine.trim().split(/\s+/)
    swapTotal = parseInt(parts[1]) || 0
    swapUsed = parseInt(parts[2]) || 0
  }

  const usedPercent = totalMb > 0 ? (usedMb / totalMb) * 100 : 0
  return { usedMb, totalMb, usedPercent, swap: { usedMb: swapUsed, totalMb: swapTotal } }
}

function parseSizeToGb(s: string): number {
  const num = parseFloat(s)
  if (isNaN(num)) return 0
  if (s.endsWith('T')) return num * 1024
  if (s.endsWith('G')) return num
  if (s.endsWith('M')) return num / 1024
  if (s.endsWith('K')) return num / (1024 * 1024)
  return num / (1024 * 1024 * 1024)
}

export function parseDisk(raw: string): ServerMetrics['disk'] {
  // df -h:
  // Filesystem  Size  Used Avail Use% Mounted on
  // /dev/sda1    50G   20G   30G  40% /
  const lines = raw.split('\n').slice(1)
  const result: ServerMetrics['disk'] = []

  for (const line of lines) {
    if (!line.trim()) continue
    const parts = line.trim().split(/\s+/)
    if (parts.length < 6) continue

    result.push({
      mount: parts[5],
      usedGb: parseSizeToGb(parts[2]),
      totalGb: parseSizeToGb(parts[1]),
      usedPercent: parseInt(parts[4]) || 0,
    })
  }

  return result
}

export function parseNetwork(raw: string): { bytesIn: number; bytesOut: number } {
  // /proc/net/dev — skip 2 header lines, skip loopback
  const lines = raw.split('\n').slice(2)
  let bytesIn = 0,
    bytesOut = 0

  for (const line of lines) {
    if (!line.trim()) continue
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const iface = line.substring(0, colonIdx).trim()
    if (iface === 'lo') continue
    const parts = line.substring(colonIdx + 1).trim().split(/\s+/)
    bytesIn += parseInt(parts[0]) || 0
    bytesOut += parseInt(parts[8]) || 0
  }

  return { bytesIn, bytesOut }
}

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
    memory: {
      usedMb: mem.usedMb,
      totalMb: mem.totalMb,
      usedPercent: mem.usedPercent,
    },
    swap: mem.swap,
    disk,
    network,
  }
}
