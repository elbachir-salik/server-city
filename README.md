# ServerCity

A real-time 3D server monitor that connects to any Linux server via SSH and visualizes its resources as a living city building.

- **CPU** — lit windows that flicker and pulse with load; corona glow above 70%
- **Memory** — animated water fill that rises and turns red near 95%; OOM vignette
- **Disk** — per-mount floor bars with animated fill and Gb labels
- **Network** — directional light beams (blue = in, green = out) scaled logarithmically

## Requirements

| Tool | Minimum version |
|------|----------------|
| Node.js | 18 |
| npm | 9 |
| Target server OS | **Linux only** — metric commands (`top`, `free`, `df`, `/proc/net/dev`) are Linux-specific |

## Getting started

### 1. Install dependencies

```bash
# From the repo root — installs all workspace packages in one step
npm install
```

> **npm arborist bug (npm 10.x):** If you see `Cannot set properties of null (setting 'peer')` during install, delete every `node_modules` directory first, then retry:
> ```bash
> # PowerShell
> Get-ChildItem -Recurse -Filter node_modules | Remove-Item -Recurse -Force
> npm install
> ```

### 2. Configure environment variables

```bash
cp .env.example .env
```

The only variable you normally need to change is `PORT` if 3001 is already in use. `VITE_WS_URL` is only needed when the backend runs on a different host (see [Production](#production) below).

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Port the backend WebSocket server listens on |
| `VITE_WS_URL` | _(unset)_ | Explicit WS URL for the client. Leave unset in local dev — Vite proxies `/ws` to the backend automatically |

### 3. Run in development

```bash
npm run dev
```

This starts both packages concurrently:

- **Backend** — `http://localhost:3001` (WebSocket at `ws://localhost:3001/ws`)
- **Frontend** — `http://localhost:5173`

Open `http://localhost:5173` in your browser, enter your server's SSH credentials, and click **Connect**.

## Connecting to a server

The connection form accepts:

- **Host / IP** — hostname or IPv4/IPv6 address of the target Linux server
- **Port** — SSH port (default `22`)
- **Username** — SSH username
- **Auth** — password **or** a PEM-encoded private key (`-----BEGIN ... KEY-----`)

Credentials are sent directly from your browser to the local backend over WebSocket and are never stored or forwarded elsewhere.

> **Security note:** The backend makes an outbound SSH connection from the machine running Node.js — it must have network access to the target server. Do not expose the backend port publicly.

## Running tests

```bash
npm test --workspace=packages/server
```

44 unit tests covering:
- `parseCPU` — modern and legacy `top` formats, NaN guards, clamping
- `parseMemory` — `free -m` parsing, swap, empty-output guards
- `parseDisk` — virtual FS filtering (`tmpfs`, `sysfs`, etc.), size unit conversion, percent clamping
- `parseNetwork` — `/proc/net/dev` parsing, loopback skipping, malformed-line tolerance
- `friendlySSHError` — all error categories and the fallback path

## Linting

```bash
npm run lint         # both packages
```

## Production

### Build

```bash
npm run build
```

Outputs:
- `packages/server/dist/` — compiled Node.js server
- `packages/client/dist/` — static frontend (serve with any HTTP server)

### Running the built server

```bash
# Copy .env or set env vars directly, then:
node packages/server/dist/index.js
```

### Separate hosts

If the frontend is served from a different origin than the backend, set `VITE_WS_URL` **before building the client**:

```bash
VITE_WS_URL=ws://your-backend-host:3001/ws npm run build -w @servercity/client
```

Or add it to `.env` in the client package:

```
VITE_WS_URL=ws://your-backend-host:3001/ws
```

## Project structure

```
servercity/
├── packages/
│   ├── shared/        # Shared TypeScript types (ServerMetrics, WSMessage, …)
│   ├── server/        # Node.js + Express + ws WebSocket server
│   │   └── src/
│   │       ├── index.ts          # HTTP + WS entry point, graceful shutdown
│   │       ├── wsHandler.ts      # WebSocket message handling
│   │       ├── ssh.ts            # SSHSession — connects, polls metrics
│   │       ├── metrics.ts        # Parsers for top / free / df / proc/net/dev
│   │       ├── validation.ts     # Input validation (host, port, auth)
│   │       └── errorMessages.ts  # User-friendly SSH error strings
│   └── client/        # React + Vite + Three.js frontend
│       └── src/
│           ├── components/       # ConnectForm, HUD, Scene
│           ├── scene/            # 3D objects (Building, WaterFill, …)
│           ├── hooks/            # useWebSocket, useLerpedMetrics, useLastUpdated
│           └── store/            # Zustand store
├── .env.example
└── tsconfig.base.json
```
