import { Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import {
  BaseTenantClientService,
  CONNECTION_POOL_SERVICE,
  HoshinoConnectionFactoryPoolService,
  TenantClientInfo,
  TenantConnectionInfo,
  TenantExtractorStrategy,
  TenantResolverStrategy,
} from '@hoshino-nestjs-libraries/hoshino-connection-factory';
import { TenantType } from '@prisma/client/master_mysql_db/index.js';
import { PrismaClient as PrismaClientMysql } from '@prisma/client/tenant_mysql_db/index.js';
import { PrismaClient as PrismaClientMongo } from '@prisma/client/tenant_mongo_db/index.js';
import { CustomTenantExtractorStrategy } from './custom-tenant-extractor';
import { CustomTenantResolverStrategy } from './custom-tenant-resolver';

export type FullPrismaClient = PrismaClientMysql | PrismaClientMongo;
export type TenantPrismaClient = TenantClientInfo<FullPrismaClient>;

@Injectable({ scope: Scope.REQUEST })
export class CustomTenantPrismaService extends BaseTenantClientService<FullPrismaClient> {
  constructor(
    @Inject(CONNECTION_POOL_SERVICE)
    connectionPool: HoshinoConnectionFactoryPoolService,
    @Inject(CustomTenantExtractorStrategy)
    tenantExtractor: TenantExtractorStrategy,
    @Inject(CustomTenantResolverStrategy)
    tenantResolver: TenantResolverStrategy,
    @Inject(REQUEST) context: Request
  ) {
    super(connectionPool, tenantExtractor, tenantResolver, context);
  }

  /**
   * Create a Prisma client instance for the tenant
   * @param connectionInfo The tenant connection information
   */
  protected async createClientInstance(
    connectionInfo: TenantConnectionInfo
  ): Promise<FullPrismaClient> {
    this.logger.debug(
      `Creating Prisma client for tenant: ${connectionInfo.tenantCode}`
    );

    switch (connectionInfo.tenantType) {
      case TenantType.MYSQL:
        return new PrismaClientMysql({
          datasources: { db: { url: connectionInfo.tenantDbUrl } },
        });
      case TenantType.MONGO:
        return new PrismaClientMongo({
          datasources: { db: { url: connectionInfo.tenantDbUrl } },
        });
      default:
        throw new Error(
          `Unsupported tenant type: ${connectionInfo.tenantType}`
        );
    }
  }
}
