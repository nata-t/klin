# syntax=docker/dockerfile:1
# Production image for the web app: static files served by nginx, which also
# proxies /api to the API (same origin → first-party auth cookies).
#   docker build -f apps/web/Dockerfile -t klin-app-web .
#   docker run -p 8080:80 -e API_UPSTREAM=http://api:3000 klin-app-web

FROM node:24-alpine AS base
WORKDIR /app
ENV TURBO_TELEMETRY_DISABLED=1
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
# Only needed when the API lives on a different origin (see docs/deployment.md).
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL
RUN npx turbo run build --filter=@repo/web

FROM nginx:1-alpine AS runner
ENV API_UPSTREAM=http://api:3000
COPY apps/web/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
