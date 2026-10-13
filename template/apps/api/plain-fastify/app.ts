import { randomUUID } from "node:crypto"
import fastifyCors from "@fastify/cors" // klin:only cors
import fastifyHelmet from "@fastify/helmet" // klin:only helmet
import fastifyRateLimit from "@fastify/rate-limit" // klin:only rate-limit
import type { AuthSession } from "@repo/auth"
import { isProduction } from "@repo/env" // klin:only !cors
//? import { env, isProduction } from "@repo/env" // klin:only cors
import Fastify from "fastify"
import { authRoutes } from "./hooks/auth"
import { errorBody, notFound, toErrorShape, tooManyRequests } from "./lib/http" // klin:only rate-limit
//? import { errorBody, notFound, toErrorShape } from "./lib/http" // klin:only !rate-limit
import { logger } from "./lib/logger"
import { type ZodTypeProvider, zodValidatorCompiler } from "./lib/zod"
import { adminRoutes } from "./routes/admin" // klin:only admin
import { healthRoutes } from "./routes/health"
import { jobsRoutes } from "./routes/jobs" // klin:only queues
import { meRoutes } from "./routes/me"
import { notesRoutes } from "./routes/notes"
import { organizationRoutes } from "./routes/organization" // klin:only organizations
import { uploadsRoutes } from "./routes/uploads" // klin:only uploads
// klin-anchor:route-imports

/**
 * The Fastify app: security plugins, Better Auth on /api/auth/*, one plugin
 * per resource under /api, and the shared response/error envelope.
 */
export async function buildApp() {
  const app = Fastify({
    loggerInstance: logger,
    disableRequestLogging: true,
    // Behind one reverse proxy (nginx, a PaaS router) so rate limits see real IPs.
    trustProxy: isProduction ? (_address: string, hop: number) => hop === 0 : false,
    // Reuse the caller's x-request-id, so logs and error responses line up.
    requestIdHeader: "x-request-id",
    genReqId: () => randomUUID(),
  }).withTypeProvider<ZodTypeProvider>()

  // Route schemas (body, querystring, params) are Zod schemas.
  app.setValidatorCompiler(zodValidatorCompiler)
  // Every request has the same shape; requireAuth fills `request.auth` in.
  app.decorateRequest("auth", null as unknown as AuthSession)

  // Every error leaves the API as an `ApiErrorResponse`, so handlers can just
  // throw. Set before any route is registered: plugins capture the handler.
  app.setErrorHandler((error, request, reply) => {
    const shape = toErrorShape(error)
    if (shape.status >= 500) request.log.error({ err: error }, shape.message)
    return reply.code(shape.status).send(errorBody(shape, request, error))
  })
  app.setNotFoundHandler((request, reply) => {
    const shape = toErrorShape(notFound(`No route for ${request.method} ${request.url}`))
    return reply.code(shape.status).send(errorBody(shape, request))
  })

  app.addHook("onRequest", async (request, reply) => {
    reply.header("x-request-id", request.id)
  })
  app.addHook("onResponse", async (request, reply) => {
    if (request.url === "/api/health") return
    const level = reply.statusCode >= 500 ? "error" : reply.statusCode >= 400 ? "warn" : "info"
    request.log[level]({ responseTime: Math.round(reply.elapsedTime) }, `${request.method} ${request.url} → ${reply.statusCode}`)
  })

  // klin:if helmet
  // Secure headers on every response (no sniffing, no framing, strict referrer, …).
  await app.register(fastifyHelmet)
  // klin:endif
  // klin:if cors
  // Browsers may call the API only from the web app, cookies included.
  await app.register(fastifyCors, {
    origin: env.WEB_URL,
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
  // klin:endif
  // klin:if rate-limit
  // 120 requests per minute per IP. Routes opt out with `config: { rateLimit: false }`.
  await app.register(fastifyRateLimit, {
    max: 120,
    timeWindow: 60_000,
    errorResponseBuilder: () => tooManyRequests(),
  })
  // klin:endif

  await app.register(authRoutes, { prefix: "/api/auth" })
  await app.register(healthRoutes, { prefix: "/api/health" })
  await app.register(meRoutes, { prefix: "/api/me" })
  await app.register(notesRoutes, { prefix: "/api/notes" })
  await app.register(adminRoutes, { prefix: "/api/admin" }) // klin:only admin
  await app.register(organizationRoutes, { prefix: "/api/organization" }) // klin:only organizations
  await app.register(uploadsRoutes, { prefix: "/api/uploads" }) // klin:only uploads
  await app.register(jobsRoutes, { prefix: "/api/jobs" }) // klin:only queues
  // klin-anchor:routes

  return app
}
