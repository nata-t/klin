# syntax=docker/dockerfile:1
# Production image for the web app: the Next.js server, which also forwards
# /api to the API (same origin → first-party auth cookies).
#   docker build -f apps/web/Dockerfile -t klin-app-web .
#   docker run -p 8080:3000 -e API_URL=http://api:3000 klin-app-web

FROM node:24-alpine AS base
WORKDIR /app
ENV TURBO_TELEMETRY_DISABLED=1 NEXT_TELEMETRY_DISABLED=1
# klin:if pnpm
RUN corepack enable
# klin:elif bun
#? RUN npm install --global bun@1
# klin:endif

FROM base AS prune
COPY . .
RUN npx --yes turbo@2 prune @repo/web --docker

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
# The /api rewrite is fixed when the app is built, so the build needs to know
# where the API is. The server reads API_URL again at runtime for session checks.
ARG API_URL=http://api:3000
ENV API_URL=$API_URL NEXT_OUTPUT=standalone
RUN npx turbo run build --filter=@repo/web

# A small runtime: Next's standalone server plus the static files it serves.
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
