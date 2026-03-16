import { Client } from 'ssh2'
import { ConnectionConfig, ServerMetrics } from '@servercity/shared'
import { buildMetrics } from './metrics'
import { friendlySSHError } from './errorMessages'

const POLL_INTERVAL = 2000
const SEP = '---SEP---'

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

export class SSHSession {
  private client: Client
  private pollTimer: NodeJS.Timeout | null = null
  private lastMetrics: ServerMetrics | null = null
  private alive = false

  constructor(
    private config: ConnectionConfig,
    private onMetrics: (m: ServerMetrics, stale?: boolean) => void,
    private onConnected: (hostname: string) => void,
    private onError: (msg: string) => void,
    private onDisconnect: () => void,
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
        readyTimeout: 10000,
      })
  }

  private execCommand(cmd: string, cb: (err: Error | null, output: string) => void) {
    this.client.exec(cmd, (err, stream) => {
      if (err) return cb(err, '')
      let output = ''
      stream.on('data', (chunk: Buffer) => {
        output += chunk.toString()
      })
      stream.stderr.on('data', (chunk: Buffer) => {
        output += chunk.toString()
      })
      stream.on('close', () => cb(null, output))
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

  disconnect() {
    this.alive = false
    this.stopPolling()
    this.client.end()
  }
}
