# ==============================================================================
# 车店云管家 — Multi-stage Dockerfile
# Targets:
#   - api : NestJS backend (Node 18 Alpine)
#   - web : Vue 3 admin panel served by Nginx Alpine
# ==============================================================================
# Build usage:
#   docker build --target api -t car-api .
#   docker build --target web -t car-web .
# Or via docker-compose.prod.yml which sets the target automatically.
# ==============================================================================

# ============== Stage: base ==============
# Base image shared by all Node stages. Installs pnpm 9 (matches lockfile v9).
FROM node:18-alpine AS base
RUN apk add --no-cache libc6-compat openssl \
    && corepack enable \
    && corepack prepare pnpm@9 --activate
WORKDIR /app

# ============== Stage: deps ==============
# Installs the full dependency tree for the monorepo (hoisted via pnpm workspaces).
# Only package manifests are copied here to maximize Docker layer cache hits.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile

# ============== Stage: build-api ==============
# Compiles the NestJS backend and generates the Prisma client.
FROM deps AS build-api
COPY apps/api/ apps/api/
COPY packages/shared/ packages/shared/
RUN pnpm --filter @car/api run prisma:generate \
    && pnpm --filter @car/api run build

# ============== Stage: api (final image) ==============
# Runtime image for the API. Reuses the full /app tree from build-api to preserve
# pnpm's symlink layout (node_modules/@car/shared -> ../../packages/shared),
# then overlays the compiled dist/ directory. Source files are stripped to keep
# the image small.
FROM base AS api
COPY --from=build-api /app/ ./
COPY --from=build-api /app/apps/api/dist ./apps/api/dist
# Strip non-runtime files to reduce image size. Keep: dist, prisma schema +
# migrations, node_modules, package manifests.
RUN rm -rf apps/api/src apps/api/test \
           apps/web \
           packages/shared/src packages/shared/tsconfig.json \
           .git docs research .qoder .mimocode \
    && find . -type d -name ".git" -prune -exec rm -rf {} + || true
ENV NODE_ENV=production
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "apps/api/dist/apps/api/src/main.js"]

# ============== Stage: build-web ==============
# Builds the Vue 3 admin panel via Vite.
FROM deps AS build-web
COPY apps/web/ apps/web/
COPY packages/shared/ packages/shared/
RUN pnpm --filter @car/web run build

# ============== Stage: web (final image) ==============
# Nginx serves the compiled Vite assets. API is reached through the reverse
# proxy defined in nginx/default.conf (upstream api:3000).
FROM nginx:alpine AS web
RUN rm -f /etc/nginx/conf.d/default.conf
COPY --from=build-web /app/apps/web/dist /usr/share/nginx/html
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
EXPOSE 80 443
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:80/ || exit 1
