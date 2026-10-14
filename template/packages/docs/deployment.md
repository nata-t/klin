# Deployment

<!-- klin:if next -->
The app is two processes: the **API** and the **web app** (a Next.js server),
both Node.js. The Next.js server forwards `/api` to the API, so `/api` is
same-origin and auth cookies just work wherever the API lives.
<!-- klin:else -->
The app is two processes: the **API** (Node.js) and the **web app** (static
files). Put them behind one domain so `/api` is same-origin and auth cookies
just work.
<!-- klin:endif -->

## Before you ship: environment checklist

| Variable | Production value |
| --- | --- |
| `NODE_ENV` | `production` (turns on secure cookies, required email verification, hidden error details) |
| `BETTER_AUTH_SECRET` | a new 32+ character secret, never reused from dev (`openssl rand -base64 32`) |
| `WEB_URL`, `BETTER_AUTH_URL` | your public origin, e.g. `https://app.example.com` |
| `DATABASE_URL` | your managed database |
<!-- klin:if next -->
| `API_URL` | where the Next.js server reaches the API, e.g. `http://api:3000`. Needed when building (the `/api` rewrite is fixed then) and when running (session checks) |
<!-- klin:endif -->
<!-- klin:if oauth -->
| OAuth credentials | production client ids, with callback `https://app.example.com/api/auth/callback/<provider>` |
<!-- klin:endif -->
<!-- klin:if email -->
| `RESEND_API_KEY`, `EMAIL_FROM` | a verified sending domain in Resend |
<!-- klin:endif -->
<!-- klin:if uploads -->
| `S3_*` | your bucket (see [uploads](./uploads.md) for R2/S3 + CORS) |
<!-- klin:endif -->
<!-- klin:if queues -->
| `REDIS_URL` | a managed Redis/Valkey (`rediss://` for TLS) |
<!-- klin:endif -->

The API validates all of this on boot and exits with a clear message if
anything is missing.

Migrations: the API image runs `prisma migrate deploy` before starting (set
`SKIP_MIGRATIONS=1` to run them as a separate release step instead). Commit the
migrations that `pnpm db:migrate` creates.
<!-- klin:if docker -->

## Option A: Docker, one machine

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

<!-- klin:if next -->
That runs the database, the API, the Next.js server, and nginx in front of it
on port 8080. nginx records each visitor's address (`X-Forwarded-For`), which
the API's rate limits and logs rely on, and sends `/api` straight to the API.
Set `PUBLIC_URL=https://your-domain` in `.env` and put a TLS-terminating proxy
(Caddy, Traefik, a load balancer) in front.
<!-- klin:else -->
That runs the database, the API, and nginx serving the web app on port 8080
with `/api` proxied to the API. Set `PUBLIC_URL=https://your-domain` in `.env`
and put a TLS-terminating proxy (Caddy, Traefik, a load balancer) in front.
<!-- klin:endif -->

## Option B: build the images, run them anywhere

```bash
docker build -f apps/api/Dockerfile -t my-app-api .
<!-- klin:if next -->
docker build -f apps/web/Dockerfile --build-arg API_URL=http://api:3000 -t my-app-web .
<!-- klin:else -->
docker build -f apps/web/Dockerfile -t my-app-web .
<!-- klin:endif -->
```

- **API image:** listens on `$API_PORT` (3000), runs migrations, has a
  `HEALTHCHECK` on `/api/health`. Give it every server env variable.
<!-- klin:if next -->
- **Web image:** the Next.js standalone server on port 3000. Run it with the
  same `API_URL` it was built with. Next.js doesn't record visitors' addresses
  itself, so keep a proxy or load balancer in front that sets
  `X-Forwarded-For` — the API's rate limits count requests per address.
<!-- klin:else -->
- **Web image:** nginx on port 80. Set `API_UPSTREAM` to wherever the API is
  reachable from the web container (e.g. `http://api:3000`).
<!-- klin:endif -->

These work as-is on Fly.io, Railway, Render, Google Cloud Run, AWS
ECS/App Runner, DigitalOcean App Platform and Kubernetes.
<!-- klin:endif -->

## Option C: platform builds, no Docker

Any Node host can run the API:

```bash
pnpm install --frozen-lockfile
pnpm turbo run build --filter=@repo/api
pnpm db:deploy
node apps/api/dist/main.js
```

<!-- klin:if next -->
The web app runs on any Node host too:

```bash
pnpm turbo run build --filter=@repo/web
pnpm --dir apps/web start
```

…or on Vercel: import the repository with `apps/web` as the root directory and
set `API_URL` to the API's public URL. The `/api` rewrite keeps auth cookies on
the web app's domain.
<!-- klin:else -->
The web app is static (`pnpm turbo run build --filter=@repo/web` → `apps/web/dist`).
Host it anywhere that can rewrite `/api/*` to the API and every other path to
`index.html` (Vercel/Netlify rewrites, Cloudflare Pages + a proxy rule, or
nginx).
<!-- klin:endif -->

<!-- klin:if next -->
## API on another host

The browser only ever talks to the web app's origin: Next.js forwards `/api` to
`API_URL`, so the API can live anywhere without CORS or third-party cookies.
Keep `WEB_URL` and `BETTER_AUTH_URL` set to the web app's origin.
<!-- klin:else -->
## Separate origins

If the web app and the API **can't** share an origin:

1. Build the web app with `VITE_API_URL=https://api.example.com`.
2. Set `WEB_URL=https://app.example.com` on the API (CORS and trusted origins
   use it) and `BETTER_AUTH_URL=https://api.example.com`.
3. **Same site** (`app.example.com` + `api.example.com`): cookies keep working
   with `SameSite=Lax`. Optionally enable
   `advanced.crossSubDomainCookies` in `packages/auth/src/auth.ts`.
4. **Different sites** (`myapp.com` + `myapi.net`): browsers treat the cookies
   as third-party. Set `defaultCookieAttributes.sameSite` to `"none"` (requires
   HTTPS) and expect some browsers to block them, so prefer a shared domain.
<!-- klin:endif -->

## After deploying

- `GET https://your-domain/api/health` should return `{"status":"ok"}`.
- Logs are JSON (pino) with a `reqId` that's also returned as `x-request-id`
  and included in error responses. Ship them to your log tool of choice.
