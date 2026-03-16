# ── Stage 1: build ────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Copy manifests first for layer caching
COPY package.json package-lock.json ./
COPY packages/shared/package.json  ./packages/shared/
COPY packages/client/package.json  ./packages/client/
COPY packages/server/package.json  ./packages/server/
RUN npm ci

# Copy source and build static assets
COPY tsconfig.base.json ./
COPY packages/shared    ./packages/shared
COPY packages/client    ./packages/client
RUN npm run build -w @servercity/client

# ── Stage 2: serve with nginx ─────────────────────────────────────────────
FROM nginx:alpine

COPY --from=builder /app/packages/client/dist /usr/share/nginx/html
COPY packages/client/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
