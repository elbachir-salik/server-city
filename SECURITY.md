# Security model

This document describes how ServerCity handles authentication, what is stored
where, and what the threat model is.

---

## Threat model

ServerCity is a **local tool** — the backend is intended to run on the same
machine as the browser. Its threat model is:

| Threat | Mitigated? | How |
|--------|-----------|-----|
| Network eavesdropping of credentials | ✅ (local) / ⚠️ (remote) | Credentials only travel over the WebSocket. When served locally they never leave the machine. When served remotely, HTTPS/WSS is required (see Transport section). |
| Man-in-the-middle on the SSH connection | ✅ | TOFU fingerprint verification — first-connect modal + localStorage-cached fingerprints. Changed fingerprint blocks connection with a loud warning. |
| Credential persistence / leakage | ✅ | Passwords and private keys are never written to localStorage, sessionStorage, Zustand state, or any persistent store. See Credentials section. |
| Malicious web page hijacking the local backend | ✅ | WebSocket `Origin` header is checked; only `localhost` / `127.0.0.1` / `::1` and an explicit `ALLOWED_ORIGIN` env var are accepted. |
| Oversized message DoS | ✅ | `maxPayload: 64 KB` on the WebSocket server. |
| SSH session flood / DoS | ✅ | Max 5 concurrent WebSocket connections per IP; max 3 `connect` messages per socket per 10 s window. |
| Memory exhaustion from remote command output | ✅ | `execCommand` output capped at 512 KB; stream destroyed on overflow. |
| Shell injection via user input | ✅ | All SSH metric commands are hardcoded. No user-supplied data is ever interpolated into a shell command. |
| Connecting to a non-Linux server | ✅ | `uname -s` is run on connect; a warning is emitted if the target is not Linux. |

---

## Authentication

### Password
- Entered in the connect form, sent over the WebSocket to the backend
  in the `connect` message payload.
- Used once to open the SSH session via `ssh2`.
- **Never stored** beyond the in-memory `credentialsRef` in `useWebSocket`
  (a React `useRef`; cleared on disconnect and on component unmount).

### Private key (PEM / OpenSSH)
- Pasted into the form or loaded via the file-upload button.
- Transmitted in the `connect` message payload (same path as password).
- Passed directly to `ssh2`'s `privateKey` option; never written to disk
  or any persistent storage on either client or server.
- If the key has a passphrase, the passphrase is provided alongside the key
  in the same message and passed to `ssh2`'s `passphrase` option.
  The passphrase is discarded from the form state on auth-mode change
  and on disconnect.

### What IS stored (non-sensitive)
| Store | Contents |
|-------|---------|
| Zustand (`lastConfig`) | `{ host, port, username }` only — no password, no key, no passphrase |
| `useWebSocket` `credentialsRef` | Full `ConnectionConfig` including credentials — **in React memory only**, cleared on disconnect |
| `localStorage` `servercity:fp:host:port` | The SHA-256 host key fingerprint accepted by the user for that host/port |

---

## Host fingerprint verification (TOFU)

ServerCity implements **Trust On First Use (TOFU)**, the same model used by
OpenSSH and PuTTY:

1. **First connection** — the SSH handshake is paused. A modal shows the
   server's SHA-256 host key fingerprint. The user must click
   **Trust & Connect** to proceed. The fingerprint is stored in
   `localStorage` keyed by `host:port`.

2. **Subsequent connections** — the live fingerprint is compared to the stored
   one. If they match, the connection proceeds silently.

3. **Fingerprint changed** — a loud red warning modal blocks the connection.
   The user must explicitly click *"I understand the risk — update fingerprint"*
   to override. This protects against man-in-the-middle attacks and unexpected
   server key rotation.

4. **Pre-supplied fingerprint** — advanced users can supply a known fingerprint
   in the connect form (`hostFingerprint` field). If provided, the TOFU modal
   is skipped and the fingerprint is verified directly. A mismatch blocks the
   connection with an error.

The fingerprint challenge/response is implemented as a new WebSocket message
pair (`fingerprint_challenge` server→client, `fingerprint_response`
client→server) that pauses the `ssh2` `hostVerifier` callback until the user
decides.

---

## Transport security

### Local development
The Vite dev server proxies `/ws` to the backend. All traffic stays on
`localhost` and is never transmitted over the network.

### Docker
nginx terminates HTTP and proxies `/ws` to the backend container on an
internal bridge network. The backend port (3001) is **not exposed** to the
host.

**For production deployments** where the app is accessible over a network,
configure TLS on nginx:

```nginx
server {
    listen 443 ssl;
    ssl_certificate     /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location /ws {
        proxy_pass         http://server:3001;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade    $http_upgrade;
        proxy_set_header   Connection "upgrade";
    }

    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
    }
}
```

A **visible warning banner** is shown in the UI when the app is accessed over
plain HTTP from a non-localhost origin, alerting users that credentials may be
exposed on the network.

---

## Input validation

All connection parameters are validated on the **server** before the SSH
client is invoked:

| Field | Rule |
|-------|------|
| `host` | Valid RFC 1123 hostname, IPv4 (octets ≤ 255), or IPv6 |
| `port` | Integer 1–65535 |
| `username` | 1–32 characters: letters, digits, `-`, `_`, `.` |
| `password` | Non-empty string, max 1 KB |
| `privateKey` | Must begin with `-----BEGIN`, max 16 KB |

Client-side validation mirrors these rules for immediate feedback, but the
server is always authoritative.

---

## Session lifecycle

```
Browser                      Backend                    Remote server
  │                              │                            │
  │──connect {host,user,pass}───>│                            │
  │                              │──fingerprint_challenge────>│ (ssh2 hostVerifier paused)
  │<──fingerprint_challenge──────│                            │
  │──fingerprint_response(true)─>│                            │
  │                              │──hostVerifier(true)───────>│
  │                              │<─────SSH ready─────────────│
  │<──connected {hostname}───────│                            │
  │                              │◄──poll every 2s────────────│
  │<──metrics (every ~2s)────────│                            │
  │                              │                            │
  │──disconnect──────────────────│                            │
  │                              │──SSH end()─────────────────│
  │                              │  credentialsRef = null     │
```

- Credentials exist in `credentialsRef` from the moment `connect()` is called
  until `disconnect()` is called or the component unmounts.
- The `SSHSession` object (which holds `config` including credentials) is
  destroyed when the WebSocket closes (`ws.on('close')`).
- Auto-retry reuses `credentialsRef.current` — credentials are never
  re-fetched from Zustand state or localStorage.
