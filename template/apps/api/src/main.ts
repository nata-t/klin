import "reflect-metadata"
import { env, isProduction } from "@repo/env"
import { NestFactory } from "@nestjs/core"
import type { NestExpressApplication } from "@nestjs/platform-express"
import helmet from "helmet"
import { Logger } from "nestjs-pino"
import { AppModule } from "./app.module"

async function bootstrap() {
  // Better Auth needs the raw request body on /api/auth/*; the auth module
  // re-enables JSON parsing for every other route.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
    bufferLogs: true,
  })

  app.useLogger(app.get(Logger))
  app.setGlobalPrefix("api")
  app.enableShutdownHooks()
  app.use(helmet())
  app.enableCors({
    origin: env.WEB_URL,
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
  // Behind a reverse proxy (nginx, a PaaS router) so rate limits see real IPs.
  if (isProduction) app.set("trust proxy", 1)

  await app.listen(env.API_PORT)
  app.get(Logger).log(`✨ API ready → http://localhost:${env.API_PORT}/api`, "Bootstrap")
}

void bootstrap()
