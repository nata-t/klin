import { auth } from "@repo/auth"
import { Module } from "@nestjs/common"
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from "@nestjs/core"
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler"
import { AuthModule } from "@thallesp/nestjs-better-auth"
import { ZodSerializerInterceptor, ZodValidationPipe } from "nestjs-zod"
import { ApiExceptionFilter } from "./common/filters/api-exception.filter"
import { ApiResponseInterceptor } from "./common/interceptors/api-response.interceptor"
import { HealthModule } from "./health/health.module"
import { LoggerModule } from "./logger.module"
import { AdminModule } from "./modules/admin/admin.module" // klin:only admin
import { JobsModule } from "./modules/jobs/jobs.module" // klin:only queues
import { MeModule } from "./modules/me/me.module"
import { NotesModule } from "./modules/notes/notes.module"
import { OrganizationModule } from "./modules/organization/organization.module" // klin:only organizations
import { UploadsModule } from "./modules/uploads/uploads.module" // klin:only uploads
// klin-anchor:module-imports
import { PrismaModule } from "./prisma/prisma.module"

@Module({
  imports: [
    LoggerModule,
    PrismaModule,
    // Mounts Better Auth on /api/auth/* and registers a global AuthGuard:
    // every route requires a session unless marked @Public().
    AuthModule.forRoot({ auth, disableTrustedOriginsCors: true }),
    // 120 requests per minute per IP. Tune per route with @Throttle()/@SkipThrottle().
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    HealthModule,
    MeModule,
    NotesModule,
    AdminModule, // klin:only admin
    OrganizationModule, // klin:only organizations
    UploadsModule, // klin:only uploads
    JobsModule, // klin:only queues
    // klin-anchor:modules
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // nestjs-zod: @Body()/@Query() parameters typed with a DTO made by
    // createZodDto(schema) are validated against that schema (→ 422 on failure).
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
    // Interceptors run outermost-first: wrap in the envelope *after*
    // @ZodSerializerDto has shaped the data.
    { provide: APP_INTERCEPTOR, useClass: ApiResponseInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
  ],
})
export class AppModule {}
