import { env, isDevelopment } from "@repo/env"
import { pino } from "pino"

/**
 * Structured JSON logs in production, pretty single-line logs in development.
 * Request logs carry the request id that's also returned as `x-request-id`
 * and included in error responses, so a bug report maps to a log line.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  transport: isDevelopment
    ? {
        target: "pino-pretty",
        options: {
          singleLine: true,
          colorize: true,
          translateTime: "HH:MM:ss",
          ignore: "pid,hostname,req,res,reqId,responseTime",
          messageFormat: "{msg}{if responseTime} ({responseTime}ms){end}",
        },
      }
    : undefined,
  redact: {
    paths: [
      "req.headers.cookie",
      "req.headers.authorization",
      'req.headers["x-api-key"]',
      'res.headers["set-cookie"]',
    ],
    censor: "[redacted]",
  },
})
