# syntax=docker/dockerfile:1
# Production image for the API. Build from the repository root:
#   docker build -f apps/api/Dockerfile -t klin-app-api .

FROM node:24-alpine AS base
WORKDIR /app
ENV TURBO_TELEMETRY_DISABLED=1
# klin:if pnpm
RUN corepack enable
# klin:elif bun
#? RUN npm install --global bun@1
# klin:endif

# 1. Keep only the API and the workspace packages it depends on.
FROM base AS prune
COPY . .
RUN npx --yes turbo@2 prune @repo/api --docker

# 2. Install, build, then reinstall production dependencies only.
FROM base AS build
COPY --from=prune /app/out/json/ .
# klin:if pnpm
RUN pnpm install --frozen-lockfile
# klin:elif bun
#? RUN bun install --frozen-lockfile
# klin:elif npm
#? RUN npm ci
# klin:endif
COPY --from=prune /app/out/full/ .
RUN npx turbo run build --filter=@repo/api
RUN find . -name node_modules -type d -prune -exec rm -rf {} +
# klin:if pnpm
RUN pnpm install --frozen-lockfile --prod
# klin:elif bun
#? RUN bun install --frozen-lockfile --production
# klin:elif npm
#? RUN npm ci --omit=dev
# klin:endif

# 3. Small runtime image: built API + production node_modules + migrations.
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app .
COPY --chown=node:node apps/api/docker-entrypoint.sh /usr/local/bin/docker-entrypoint
RUN chmod +x /usr/local/bin/docker-entrypoint
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s CMD wget -qO- "http://127.0.0.1:${API_PORT:-3000}/api/health" > /dev/null || exit 1
ENTRYPOINT ["docker-entrypoint"]
