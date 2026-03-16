# ── Stage 1: build ────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Copy manifests first — lets Docker cache the install layer
COPY package.json package-lock.json ./
COPY packages/shared/package.json  ./packages/shared/
COPY packages/server/package.json  ./packages/server/
COPY packages/client/package.json  ./packages/client/
RUN npm ci

# Copy source and compile
COPY tsconfig.base.json ./
COPY packages/shared    ./packages/shared
COPY packages/server    ./packages/server
RUN npm run build -w @servercity/server

# Prune devDependencies so the runtime layer is lean
RUN npm prune --omit=dev

# ── Stage 2: runtime ──────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production

# Pruned node_modules (express, ws, ssh2, dotenv only)
COPY --from=builder /app/node_modules ./node_modules
# Compiled server JS
COPY --from=builder /app/packages/server/dist ./dist

EXPOSE 3001
CMD ["node", "dist/index.js"]
