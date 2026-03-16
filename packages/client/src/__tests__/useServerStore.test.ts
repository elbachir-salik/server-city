import { describe, it, expect, beforeEach } from 'vitest'
import { useServerStore } from '../store/useServerStore'
import type { ServerMetrics } from '@servercity/shared'

// Reset store state before each test
beforeEach(() => {
  useServerStore.getState().reset()
  // reset also needs to clear status back to idle for a full reset
  useServerStore.setState({ status: 'idle', hostname: '', metrics: null, metricsStale: false, errorMessage: '', retryAttempt: 0, retryCountdown: 0 })
})

const sampleMetrics: ServerMetrics = {
  timestamp: 1000,
  cpu: { overall: 50, cores: [] },
  memory: { usedMb: 512, totalMb: 1024, usedPercent: 50 },
  swap: { usedMb: 0, totalMb: 512 },
  disk: [],
  network: { bytesIn: 1000, bytesOut: 500 },
}

const sampleConfig = { host: '10.0.0.1', port: 22, username: 'root', password: 'secret' }

describe('useServerStore', () => {
  describe('initial state', () => {
    it('starts idle with empty fields', () => {
      const s = useServerStore.getState()
      expect(s.status).toBe('idle')
      expect(s.hostname).toBe('')
      expect(s.metrics).toBeNull()
      expect(s.metricsStale).toBe(false)
      expect(s.errorMessage).toBe('')
      expect(s.lastConfig).toBeNull()
      expect(s.retryAttempt).toBe(0)
      expect(s.retryCountdown).toBe(0)
    })
  })

  describe('setStatus', () => {
    it.each(['connecting', 'connected', 'reconnecting', 'disconnected', 'error'] as const)(
      'sets status to %s',
      (status) => {
        useServerStore.getState().setStatus(status)
        expect(useServerStore.getState().status).toBe(status)
      },
    )
  })

  describe('setHostname', () => {
    it('stores the hostname', () => {
      useServerStore.getState().setHostname('prod-server-01')
      expect(useServerStore.getState().hostname).toBe('prod-server-01')
    })
  })

  describe('setMetrics', () => {
    it('stores metrics and clears metricsStale', () => {
      useServerStore.setState({ metricsStale: true })
      useServerStore.getState().setMetrics(sampleMetrics)
      const s = useServerStore.getState()
      expect(s.metrics).toEqual(sampleMetrics)
      expect(s.metricsStale).toBe(false)
    })
  })

  describe('setMetricsStale', () => {
    it('sets metricsStale to true', () => {
      useServerStore.getState().setMetricsStale(true)
      expect(useServerStore.getState().metricsStale).toBe(true)
    })

    it('sets metricsStale to false', () => {
      useServerStore.setState({ metricsStale: true })
      useServerStore.getState().setMetricsStale(false)
      expect(useServerStore.getState().metricsStale).toBe(false)
    })
  })

  describe('setError', () => {
    it('stores the error message', () => {
      useServerStore.getState().setError('Auth failed')
      expect(useServerStore.getState().errorMessage).toBe('Auth failed')
    })

    it('sets status to error', () => {
      useServerStore.getState().setStatus('connected')
      useServerStore.getState().setError('Something went wrong')
      expect(useServerStore.getState().status).toBe('error')
    })
  })

  describe('setLastConfig — credential stripping (S3)', () => {
    it('stores host, port, and username', () => {
      useServerStore.getState().setLastConfig(sampleConfig)
      const lc = useServerStore.getState().lastConfig
      expect(lc?.host).toBe('10.0.0.1')
      expect(lc?.port).toBe(22)
      expect(lc?.username).toBe('root')
    })

    it('does NOT store password', () => {
      useServerStore.getState().setLastConfig(sampleConfig)
      const lc = useServerStore.getState().lastConfig as Record<string, unknown>
      expect(lc.password).toBeUndefined()
    })

    it('does NOT store privateKey', () => {
      const withKey = { ...sampleConfig, privateKey: '-----BEGIN RSA PRIVATE KEY-----\nABC' }
      delete (withKey as Record<string, unknown>).password
      useServerStore.getState().setLastConfig(withKey)
      const lc = useServerStore.getState().lastConfig as Record<string, unknown>
      expect(lc.privateKey).toBeUndefined()
    })
  })

  describe('setRetry', () => {
    it('stores attempt and countdown', () => {
      useServerStore.getState().setRetry(2, 3)
      const s = useServerStore.getState()
      expect(s.retryAttempt).toBe(2)
      expect(s.retryCountdown).toBe(3)
    })
  })

  describe('reset', () => {
    it('clears transient state', () => {
      useServerStore.getState().setMetrics(sampleMetrics)
      useServerStore.getState().setHostname('old-host')
      useServerStore.getState().setError('boom')
      useServerStore.getState().setRetry(3, 6)
      useServerStore.getState().reset()
      const s = useServerStore.getState()
      expect(s.metrics).toBeNull()
      expect(s.hostname).toBe('')
      expect(s.errorMessage).toBe('')
      expect(s.retryAttempt).toBe(0)
      expect(s.retryCountdown).toBe(0)
    })

    it('preserves lastConfig so reconnect still works', () => {
      useServerStore.getState().setLastConfig(sampleConfig)
      useServerStore.getState().reset()
      expect(useServerStore.getState().lastConfig).not.toBeNull()
      expect(useServerStore.getState().lastConfig?.host).toBe('10.0.0.1')
    })
  })
})
