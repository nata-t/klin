// klin:file organizations
import { Module } from "@nestjs/common"
import { OrganizationController } from "./organization.controller"

@Module({ controllers: [OrganizationController] })
export class OrganizationModule {}
