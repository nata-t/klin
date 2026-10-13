import "reflect-metadata"
import { randomUUID } from "node:crypto" // klin:only fastify
import { env, isProduction } from "@repo/env"
import { NestFactory } from "@nestjs/core"
// klin:if express
import type { NestExpressApplication } from "@nestjs/platform-express"
import helmet from "helmet" // klin:only helmet
// klin:else
//? import fastifyHelmet from "@fastify/helmet" // klin:only helmet
//? import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify"
// klin:endif
import { Logger } from "nestjs-pino"
import { AppModule } from "./app.module"

async function bootstrap() {
  // Better Auth needs the raw request body on /api/auth/*; the auth module
  // re-enables body parsing for every other route.
  // klin:if express
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
    bufferLogs: true,
  })
  // Behind a reverse proxy (nginx, a PaaS router) so rate limits see real IPs.
  if (isProduction) app.set("trust proxy", 1)
  // klin:else
  //? const app = await NestFactory.create<NestFastifyApplication>(
  //?   AppModule,
  //?   new FastifyAdapter({
  //?     // Behind one reverse proxy (nginx, a PaaS router) so rate limits see real IPs.
  //?     trustProxy: isProduction ? (_address: string, hop: number) => hop === 0 : false,
  //?     // Reuse the caller's x-request-id, so logs and error responses line up.
  //?     requestIdHeader: "x-request-id",
  //?     genReqId: () => randomUUID(),
  //?   }),
  //?   { bodyParser: false, bufferLogs: true }
  //? )
  //? // Echo the request id (also in the logs and error responses) back to the caller.
  //? app.getHttpAdapter().getInstance().addHook("onRequest", async (request, reply) => {
  //?   reply.header("x-request-id", request.id)
  //? })
  // klin:endif

  app.useLogger(app.get(Logger))
  app.setGlobalPrefix("api")
  app.enableShutdownHooks()
  // klin:if helmet
  // Secure headers on every response (no sniffing, no framing, strict referrer, …).
  app.use(helmet()) // klin:only express
  //? await app.register(fastifyHelmet) // klin:only fastify
  // klin:endif
  // klin:if cors
  // Browsers may call the API only from the web app, cookies included.
  app.enableCors({
    origin: env.WEB_URL,
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
  // klin:endif

  await app.listen(env.API_PORT) // klin:only express
  //? await app.listen(env.API_PORT, "0.0.0.0") // klin:only fastify
  app.get(Logger).log(`✨ API ready → http://localhost:${env.API_PORT}/api`, "Bootstrap")
}

void bootstrap()
