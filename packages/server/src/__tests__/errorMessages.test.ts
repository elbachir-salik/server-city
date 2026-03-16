import { describe, it, expect } from 'vitest'
import { friendlySSHError } from '../errorMessages'

describe('friendlySSHError', () => {
  const cases: [string, string][] = [
    // raw ssh2 message                                    // expected substring in friendly output
    ['All configured authentication methods failed',      'Authentication failed'],
    ['Authentication failed',                             'Authentication failed'],
    ['Permission denied (publickey)',                     'Authentication failed'],
    ['ECONNREFUSED 127.0.0.1:22',                        'Connection refused'],
    ['connect ECONNREFUSED 192.168.1.1:2222',            'Connection refused'],
    ['ETIMEDOUT',                                         'timed out'],
    ['Connection timed out',                              'timed out'],
    ['Timed out while waiting for handshake',             'timed out'],
    ['getaddrinfo ENOTFOUND example.invalid',             'not found'],
    ['getaddrinfo failed',                                'not found'],
    ['ENETUNREACH',                                       'unreachable'],
    ['Network unreachable',                               'unreachable'],
    ['ECONNRESET',                                        'reset'],
    ['Connection reset by peer',                         'reset'],
    ['Handshake failed: no matching key exchange method', 'handshake failed'],
    ['kex_exchange_identification: Connection closed',    'handshake failed'],
    ['Cannot parse privatekey',                           'private key'],
    ['Invalid private key format',                        'private key'],
    ['privatekey passphrase wrong',                       'private key'],
    ['EACCES /home/user/.ssh',                            'Permission denied'],
  ]

  it.each(cases)('maps "%s" → contains "%s"', (raw, expected) => {
    expect(friendlySSHError(raw).toLowerCase()).toContain(expected.toLowerCase())
  })

  it('falls back to stripped raw message for unknown errors', () => {
    const result = friendlySSHError('Something completely unexpected happened')
    expect(result).toBe('Something completely unexpected happened')
  })

  it('falls back to default message when raw is empty after stripping', () => {
    const result = friendlySSHError('  (some internal node detail)  ')
    expect(result).toBe('SSH connection failed.')
  })
})
