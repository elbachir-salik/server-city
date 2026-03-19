import { createHash } from 'crypto'
import { Client } from 'ssh2'
import { ConnectionConfig, ServerMetrics, ProcessEntry, ServerInfo, DirectoryNode, FileContent } from '@servercity/shared'
import { buildMetrics, parseDirUsage, parseProcessList, parseServerInfo, parseExploreResult, parseFileContent } from './metrics'
import { friendlySSHError } from './errorMessages'
import { SubdirEntry } from '@servercity/shared'

const POLL_INTERVAL = 2000
const SEP = '---SEP---'
const MAX_OUTPUT_BYTES = 512 * 1024  // 512 KB — protects against rogue remote output

// Runs all 4 metric commands in one exec, separated by a sentinel string
const METRICS_CMD = [
  'top -bn1 | grep "Cpu(s)"',
  `echo "${SEP}"`,
  'free -m',
  `echo "${SEP}"`,
  'df -h',
  `echo "${SEP}"`,
  'cat /proc/net/dev',
].join(' && ')

const EXPLORE_CACHE_TTL = 30_000 // 30 seconds

export class SSHSession {
  private client: Client
  private pollTimer: NodeJS.Timeout | null = null
  private lastMetrics: ServerMetrics | null = null
  private alive = false
  private readonly exploreCache = new Map<string, { nodes: DirectoryNode[]; timestamp: number }>()

  constructor(
    private config: ConnectionConfig,
    private onMetrics: (m: ServerMetrics, stale?: boolean) => void,
    private onConnected: (hostname: string) => void,
    private onError: (msg: string) => void,
    private onDisconnect: () => void,
    private onFingerprintChallenge: (fingerprint: string, cb: (approved: boolean) => void) => void,
  ) {
    this.client = new Client()
  }

  connect() {
    this.client
      .on('ready', () => {
        this.alive = true
        // Check OS before starting — metric commands require Linux
        this.execCommand('uname -s', (err, out) => {
          const os = out.trim()
          if (!err && os !== 'Linux') {
            this.onError(
              `Warning: target OS is "${os}", not Linux — metric commands (top, free, df, /proc/net/dev) may not work correctly.`,
            )
          }
        })
        this.execCommand('hostname', (err, out) => {
          if (!err) this.onConnected(out.trim())
        })
        this.startPolling()
      })
      .on('error', (err) => {
        this.onError(friendlySSHError(err.message))
      })
      .on('close', () => {
        this.alive = false
        this.stopPolling()
        this.onDisconnect()
      })
      .connect({
        host: this.config.host,
        port: this.config.port,
        username: this.config.username,
        password: this.config.password,
        privateKey: this.config.privateKey,
        passphrase: this.config.passphrase,
        readyTimeout: 10000,
        // Async hostVerifier — pauses the SSH handshake until the client approves
        hostVerifier: (keyHash: Buffer | string, callback: (valid: boolean) => void) => {
          // Compute SHA-256 fingerprint in OpenSSH format (SHA256:<base64>)
          const raw = Buffer.isBuffer(keyHash) ? keyHash : Buffer.from(String(keyHash), 'hex')
          const fingerprint = `SHA256:${createHash('sha256').update(raw).digest('base64')}`

          // If caller pre-supplied a fingerprint, short-circuit — no modal needed
          const provided = this.config.hostFingerprint?.trim()
          if (provided) {
            const match = fingerprint.toLowerCase() === provided.toLowerCase()
            if (!match) this.onError(`Host key fingerprint mismatch. Expected "${provided}", got "${fingerprint}". Connection blocked.`)
            callback(match)
            return
          }

          // Interactive TOFU: ask the client to approve/reject
          this.onFingerprintChallenge(fingerprint, callback)
        },
      })
  }

  private execCommand(cmd: string, cb: (err: Error | null, output: string) => void) {
    this.client.exec(cmd, (err, stream) => {
      if (err) return cb(err, '')
      let output = ''
      let byteCount = 0
      let overflow = false

      const onData = (chunk: Buffer) => {
        if (overflow) return
        byteCount += chunk.byteLength
        if (byteCount > MAX_OUTPUT_BYTES) {
          overflow = true
          stream.destroy()
          cb(new Error(`Command output exceeded ${MAX_OUTPUT_BYTES} bytes`), '')
          return
        }
        output += chunk.toString()
      }

      stream.on('data', onData)
      stream.stderr.on('data', onData)
      stream.on('close', () => {
        if (!overflow) cb(null, output)
      })
    })
  }

  private poll() {
    if (!this.alive) return
    this.execCommand(METRICS_CMD, (err, output) => {
      if (err) {
        console.error('[ssh] metrics exec error:', err.message)
        if (this.lastMetrics) this.onMetrics(this.lastMetrics, true)
        return
      }
      try {
        const parts = output.split(SEP)
        if (parts.length < 4) throw new Error('Unexpected output segments: ' + parts.length)
        const metrics = buildMetrics(parts[0], parts[1], parts[2], parts[3])
        this.lastMetrics = metrics
        this.onMetrics(metrics, false)
      } catch (e) {
        console.error('[ssh] parse error:', e)
        if (this.lastMetrics) this.onMetrics(this.lastMetrics, true)
      }
    })
  }

  private startPolling() {
    this.poll()
    this.pollTimer = setInterval(() => this.poll(), POLL_INTERVAL)
  }

  private stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  }

  /** Run `du --max-depth=1` on a mount and return the top subdirectories by size. */
  getSubdirUsage(mount: string, cb: (subdirs: SubdirEntry[]) => void) {
    if (!this.alive) { cb([]); return }
    // -k: kilobyte blocks  -x: stay on same filesystem  --max-depth=1: one level only
    // Quote the mount with single quotes (validated to contain only safe chars upstream)
    const cmd = `du -k -x --max-depth=1 '${mount}' 2>/dev/null | sort -rn | head -11`
    this.execCommand(cmd, (err, output) => {
      if (err) { cb([]); return }
      cb(parseDirUsage(output, mount))
    })
  }

  /** Run `ps aux` and return the top processes sorted by CPU usage. */
  getProcessList(cb: (processes: ProcessEntry[]) => void) {
    if (!this.alive) { cb([]); return }
    // Try GNU sort flag first; fall back to plain ps if not available
    const cmd = `ps aux --sort=-%cpu 2>/dev/null | head -16 || ps aux | head -16`
    this.execCommand(cmd, (err, output) => {
      cb(err ? [] : parseProcessList(output))
    })
  }

  /** Fetch kernel version, OS name, and uptime for the server info overlay. */
  getServerInfo(cb: (info: ServerInfo) => void) {
    if (!this.alive) { cb({ kernel: '', os: 'Linux', uptime: '' }); return }
    const cmd = `uname -r && uname -s && uptime -p 2>/dev/null || uptime`
    this.execCommand(cmd, (err, output) => {
      cb(err ? { kernel: '', os: 'Linux', uptime: '' } : parseServerInfo(output))
    })
  }

  /** Explore a directory path: returns DirectoryNode[] or an error string. */
  exploreDirectory(
    path: string,
    cb: (result: { nodes?: DirectoryNode[]; error?: string }) => void,
  ) {
    if (!this.alive) { cb({ error: 'not_found' }); return }

    const cached = this.exploreCache.get(path)
    if (cached && Date.now() - cached.timestamp < EXPLORE_CACHE_TTL) {
      cb({ nodes: cached.nodes })
      return
    }

    // Single-quoted path is safe — upstream validation blocks everything except [a-zA-Z0-9._-/]
    const SEP = '---SEP---'
    const cmd = [
      `if [ ! -e '${path}' ]; then echo "ERROR:not_found"`,
      `elif [ ! -r '${path}' ]; then echo "ERROR:permission_denied"`,
      `elif [ ! -d '${path}' ]; then echo "ERROR:is_file"`,
      `else du -k --max-depth=1 '${path}' 2>/dev/null | sort -rn | head -33`,
      `printf '\\n${SEP}\\n'`,
      `find '${path}' -maxdepth 1 ! -name '.' -printf "%f\\t%y\\t%T@\\n" 2>/dev/null | head -50`,
      `fi`,
    ].join('; ')

    this.execCommand(cmd, (err, output) => {
      if (err) { cb({ error: 'not_found' }); return }
      const trimmed = output.trim()
      if (trimmed.startsWith('ERROR:')) {
        cb({ error: trimmed.slice(6) })
        return
      }
      const parts = trimmed.split(SEP)
      const nodes = parseExploreResult(parts[0] ?? '', parts[1] ?? '')
      this.exploreCache.set(path, { nodes, timestamp: Date.now() })
      cb({ nodes })
    })
  }

  /** Fetch file metadata + tail content for a path. */
  getFileContent(
    path: string,
    cb: (result: { content?: FileContent; error?: string }) => void,
  ) {
    if (!this.alive) { cb({ error: 'not_found' }); return }

    const SEP = '---SEP---'
    const cmd = [
      `if [ ! -e '${path}' ]; then echo "ERROR:not_found"`,
      `elif [ ! -r '${path}' ]; then echo "ERROR:permission_denied"`,
      `elif [ -d '${path}' ]; then echo "ERROR:is_dir"`,
      `else stat -c '%s %Y' '${path}' 2>/dev/null`,
      `printf '\\n${SEP}\\n'`,
      `tail -c 32768 '${path}' 2>/dev/null | head -120`,
      `fi`,
    ].join('; ')

    this.execCommand(cmd, (err, output) => {
      if (err) { cb({ error: 'not_found' }); return }
      const trimmed = output.trim()
      if (trimmed.startsWith('ERROR:')) {
        cb({ error: trimmed.slice(6) })
        return
      }
      cb({ content: parseFileContent(output, path) })
    })
  }

  disconnect() {
    this.alive = false
    this.stopPolling()
    this.client.end()
  }
}
