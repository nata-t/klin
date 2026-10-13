import { randomUUID } from "node:crypto"
import { auth } from "@repo/auth"
import { isProduction } from "@repo/env" // klin:only !cors
//? import { env, isProduction } from "@repo/env" // klin:only cors
import { toNodeHandler } from "better-auth/node"
import cors from "cors" // klin:only cors
import express from "express"
import { rateLimit } from "express-rate-limit" // klin:only rate-limit
import helmet from "helmet" // klin:only helmet
import { pinoHttp } from "pino-http"
import { tooManyRequests } from "./lib/http" // klin:only rate-limit
import { logger } from "./lib/logger"
import { errorHandler, notFoundHandler } from "./middleware/errors"
import { adminRouter } from "./routes/admin" // klin:only admin
import { healthRouter } from "./routes/health"
import { jobsRouter } from "./routes/jobs" // klin:only queues
import { meRouter } from "./routes/me"
import { notesRouter } from "./routes/notes"
import { organizationRouter } from "./routes/organization" // klin:only organizations
import { uploadsRouter } from "./routes/uploads" // klin:only uploads
// klin-anchor:route-imports

/**
 * The Express app. Order matters:
 *
 *   logging → security headers → CORS → Better Auth (raw body) → JSON body
 *   → rate limit → routes → 404 → error envelope
 */
export function createApp() {
  const app = express()

  // Behind a reverse proxy (nginx, a PaaS router) so rate limits see real IPs.
  if (isProduction) app.set("trust proxy", 1)
  app.disable("x-powered-by")

  app.use(
    pinoHttp({
      logger,
      // Reuse the caller's x-request-id, so logs and error responses line up.
      genReqId: (req, res) => {
        const header = req.headers["x-request-id"]
        const id = typeof header === "string" && header ? header : randomUUID()
        res.setHeader("x-request-id", id)
        return id
      },
      customLogLevel: (_req, res, error) => (error || res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info"),
      customSuccessMessage: (req, res) => `${req.method} ${req.url} → ${res.statusCode}`,
      customErrorMessage: (req, res) => `${req.method} ${req.url} → ${res.statusCode}`,
      autoLogging: { ignore: (req) => req.url === "/api/health" },
    })
  )
  // klin:if helmet
  // Secure headers on every response (no sniffing, no framing, strict referrer, …).
  app.use(helmet())
  // klin:endif
  // klin:if cors
  // Browsers may call the API only from the web app, cookies included.
  app.use(cors({ origin: env.WEB_URL, credentials: true }))
  // klin:endif

  // Better Auth reads the raw body, so it's mounted before express.json().
  app.all("/api/auth/*splat", toNodeHandler(auth))
  app.use(express.json({ limit: "1mb" }))
  // klin:if rate-limit
  // 120 requests per minute per IP. Health checks don't count.
  app.use(
    "/api",
    rateLimit({
      windowMs: 60_000,
      limit: 120,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      skip: (req) => req.originalUrl === "/api/health",
      handler: (_req, _res, next) => next(tooManyRequests()),
    })
  )
  // klin:endif

  app.use("/api/health", healthRouter)
  app.use("/api/me", meRouter)
  app.use("/api/notes", notesRouter)
  app.use("/api/admin", adminRouter) // klin:only admin
  app.use("/api/organization", organizationRouter) // klin:only organizations
  app.use("/api/uploads", uploadsRouter) // klin:only uploads
  app.use("/api/jobs", jobsRouter) // klin:only queues
  // klin-anchor:routes

  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}
