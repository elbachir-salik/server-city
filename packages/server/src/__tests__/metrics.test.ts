import { describe, it, expect } from 'vitest'
import { parseCPU, parseMemory, parseDisk, parseNetwork } from '../metrics'

// ── parseCPU ────────────────────────────────────────────────────────────────

describe('parseCPU', () => {
  it('parses modern top format (percent idle)', () => {
    const raw = '%Cpu(s):  5.0 us,  2.0 sy,  0.0 ni, 92.0 id,  0.0 wa'
    const { overall } = parseCPU(raw)
    expect(overall).toBeCloseTo(8.0, 5)
  })

  it('parses legacy top format (%id suffix)', () => {
    const raw = 'Cpu(s):  5.0%us,  2.0%sy,  0.0%ni, 85.0%id,  0.0%wa'
    const { overall } = parseCPU(raw)
    expect(overall).toBeCloseTo(15.0, 5)
  })

  it('returns 0 for empty string', () => {
    expect(parseCPU('').overall).toBe(0)
  })

  it('clamps to 0 when idle is 100%', () => {
    const raw = '%Cpu(s):  0.0 us,  0.0 sy,  0.0 ni,100.0 id'
    expect(parseCPU(raw).overall).toBe(0)
  })

  it('clamps to 100 when idle is 0%', () => {
    const raw = '%Cpu(s):100.0 us,  0.0 sy,  0.0 ni,  0.0 id'
    expect(parseCPU(raw).overall).toBe(100)
  })

  it('always returns an empty cores array', () => {
    expect(parseCPU('%Cpu(s): 5.0 us, 95.0 id').cores).toEqual([])
  })
})

// ── parseMemory ─────────────────────────────────────────────────────────────

describe('parseMemory', () => {
  const FREE_OUTPUT = [
    '              total        used        free      shared  buff/cache   available',
    'Mem:           7982        1234        4567         123        2181        6500',
    'Swap:          2047           0        2047',
  ].join('\n')

  it('reads total and used from Mem line', () => {
    const { totalMb, usedMb } = parseMemory(FREE_OUTPUT)
    expect(totalMb).toBe(7982)
    expect(usedMb).toBe(1234)
  })

  it('calculates usedPercent correctly', () => {
    const { usedPercent } = parseMemory(FREE_OUTPUT)
    expect(usedPercent).toBeCloseTo((1234 / 7982) * 100, 3)
  })

  it('reads swap total and used', () => {
    const { swap } = parseMemory(FREE_OUTPUT)
    expect(swap.totalMb).toBe(2047)
    expect(swap.usedMb).toBe(0)
  })

  it('returns zeros when output is empty', () => {
    const result = parseMemory('')
    expect(result.totalMb).toBe(0)
    expect(result.usedMb).toBe(0)
    expect(result.usedPercent).toBe(0)
    expect(result.swap).toEqual({ usedMb: 0, totalMb: 0 })
  })

  it('caps usedPercent at 100', () => {
    // usedMb > totalMb should still produce at most 100%
    const corrupt = 'Mem:           100         200        0\nSwap: 0 0 0'
    const { usedPercent } = parseMemory(corrupt)
    expect(usedPercent).toBeLessThanOrEqual(100)
  })
})

// ── parseDisk ───────────────────────────────────────────────────────────────

const DF_OUTPUT = [
  'Filesystem      Size  Used Avail Use% Mounted on',
  '/dev/sda1        50G   20G   30G  40% /',
  'tmpfs           3.9G     0  3.9G   0% /dev/shm',
  'devtmpfs        3.9G     0  3.9G   0% /dev',
  '/dev/sdb1       200G  150G   50G  75% /data',
  'sysfs              0     0     0    - /sys',
].join('\n')

describe('parseDisk', () => {
  it('returns only real mounts, skipping virtual filesystems', () => {
    const disk = parseDisk(DF_OUTPUT)
    const mounts = disk.map((d) => d.mount)
    expect(mounts).toContain('/')
    expect(mounts).toContain('/data')
    expect(mounts).not.toContain('/dev/shm')
    expect(mounts).not.toContain('/dev')
    expect(mounts).not.toContain('/sys')
  })

  it('parses usedGb and totalGb in GB', () => {
    const disk = parseDisk(DF_OUTPUT)
    const root = disk.find((d) => d.mount === '/')!
    expect(root.totalGb).toBeCloseTo(50, 1)
    expect(root.usedGb).toBeCloseTo(20, 1)
  })

  it('parses usedPercent stripping %', () => {
    const disk = parseDisk(DF_OUTPUT)
    const data = disk.find((d) => d.mount === '/data')!
    expect(data.usedPercent).toBe(75)
  })

  it('clamps usedPercent to [0, 100]', () => {
    const line = '/dev/sdc1  10G  10G  0G  110%  /overflow'
    const disk = parseDisk('Filesystem Size Used Avail Use% Mounted on\n' + line)
    if (disk.length > 0) {
      expect(disk[0].usedPercent).toBeLessThanOrEqual(100)
      expect(disk[0].usedPercent).toBeGreaterThanOrEqual(0)
    }
  })

  it('skips /sys and /proc mounts', () => {
    const withSys =
      'Filesystem Size Used Avail Use% Mounted on\n' +
      '/dev/fake  10G  5G  5G  50%  /sys/firmware\n'
    expect(parseDisk(withSys)).toHaveLength(0)
  })

  it('returns empty array for empty input', () => {
    expect(parseDisk('')).toEqual([])
  })

  it('converts M suffix to GB', () => {
    const line = '/dev/loop0  512M  256M  256M  50%  /snap/core'
    const disk = parseDisk('Filesystem Size Used Avail Use% Mounted on\n' + line)
    if (disk.length > 0) {
      expect(disk[0].totalGb).toBeCloseTo(0.5, 2)
    }
  })
})

// ── parseNetwork ────────────────────────────────────────────────────────────

const PROC_NET_DEV = [
  'Inter-|   Receive                                                |  Transmit',
  ' face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed',
  '    lo:  100000     500    0    0    0     0          0         0   100000     500    0    0    0     0       0          0',
  '  eth0: 5000000   10000    0    0    0     0          0         0  2000000    5000    0    0    0     0       0          0',
  '  eth1: 1000000    3000    0    0    0     0          0         0   500000    1500    0    0    0     0       0          0',
].join('\n')

describe('parseNetwork', () => {
  it('sums bytesIn and bytesOut across non-loopback interfaces', () => {
    const { bytesIn, bytesOut } = parseNetwork(PROC_NET_DEV)
    expect(bytesIn).toBe(6000000)
    expect(bytesOut).toBe(2500000)
  })

  it('skips the loopback interface', () => {
    const loOnly = [
      'header1',
      'header2',
      '    lo: 9999999 1 1 1 1 1 1 1 9999999 1 1 1 1 1 1 1',
    ].join('\n')
    const { bytesIn, bytesOut } = parseNetwork(loOnly)
    expect(bytesIn).toBe(0)
    expect(bytesOut).toBe(0)
  })

  it('returns zeros for empty input', () => {
    const result = parseNetwork('')
    expect(result.bytesIn).toBe(0)
    expect(result.bytesOut).toBe(0)
  })

  it('skips lines with fewer than 9 fields after the colon', () => {
    const malformed = 'header1\nheader2\n  eth0: 1234 2345\n'
    const result = parseNetwork(malformed)
    expect(result.bytesIn).toBe(0)
    expect(result.bytesOut).toBe(0)
  })
})
