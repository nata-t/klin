import { Global, Module, type OnApplicationShutdown } from "@nestjs/common"
import { prisma } from "@repo/db"
import { PrismaService, prismaProvider } from "./prisma.service"

@Global()
@Module({
  providers: [prismaProvider],
  exports: [PrismaService],
})
export class PrismaModule implements OnApplicationShutdown {
  async onApplicationShutdown() {
    await prisma.$disconnect()
  }
}
