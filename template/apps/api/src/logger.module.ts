import { randomUUID } from "node:crypto"
import { env, isDevelopment } from "@repo/env"
import { Module } from "@nestjs/common"
import { LoggerModule as PinoLoggerModule } from "nestjs-pino"

/**
 * Structured JSON logs (pino) in production, pretty single-line logs in dev.
 * Every request gets an id — returned as `x-request-id` and included in error
 * responses — so a user's bug report can be matched to a log line.
 */
@Module({
  imports: [
    PinoLoggerModule.forRoot({
      pinoHttp: {
        level: env.LOG_LEVEL,
        transport: isDevelopment
          ? {
              target: "pino-pretty",
              options: {
                singleLine: true,
                colorize: true,
                translateTime: "HH:MM:ss",
                ignore: "pid,hostname,context,req,res,responseTime",
                messageFormat: "{if context}[{context}] {end}{msg}{if responseTime} ({responseTime}ms){end}",
              },
            }
          : undefined,
        genReqId: (req, res) => {
          // On Fastify the request already carries Fastify's id; reuse it.
          const existing = (req as { id?: unknown }).id
          const header = req.headers["x-request-id"]
          const id =
            typeof existing === "string" && existing
              ? existing
              : typeof header === "string" && header
                ? header
                : randomUUID()
          res.setHeader("x-request-id", id)
          return id
        },
        customLogLevel: (_req, res, error) => {
          if (error || res.statusCode >= 500) return "error"
          if (res.statusCode >= 400) return "warn"
          return "info"
        },
        customSuccessMessage: (req, res) => `${req.method} ${req.url} → ${res.statusCode}`,
        customErrorMessage: (req, res) => `${req.method} ${req.url} → ${res.statusCode}`,
        autoLogging: {
          ignore: (req) => ((req as { originalUrl?: string }).originalUrl ?? req.url) === "/api/health",
        },
        redact: {
          paths: [
            "req.headers.cookie",
            "req.headers.authorization",
            'req.headers["x-api-key"]',
            'res.headers["set-cookie"]',
          ],
          censor: "[redacted]",
        },
      },
    }),
  ],
})
export class LoggerModule {}
