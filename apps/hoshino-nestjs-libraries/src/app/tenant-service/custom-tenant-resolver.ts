import { Inject, Injectable } from '@nestjs/common';
import {
  getServiceToken,
  HoshinoConnectionFactoryService,
  TenantConnectionInfo,
  TenantResolverStrategy,
} from '@hoshino-nestjs-libraries/hoshino-connection-factory';
import { PrismaClient as PrismaClientMaster } from '@prisma/client/master_mysql_db/index.js';

/**
 * Custom Tenant Resolver Strategy
 * Resolves tenant connections by querying the master database
 */
@Injectable()
export class CustomTenantResolverStrategy
  implements TenantResolverStrategy<PrismaClientMaster>
{
  constructor(
    @Inject(getServiceToken('master'))
    private readonly masterDbConnection: HoshinoConnectionFactoryService<PrismaClientMaster>
  ) {}

  /**
   * Resolve tenant connection information based on tenant identifier
   * @param tenantIdentifier The tenant group code
   * @returns Connection information for all tenants matching the identifier
   */
  async resolveTenantConnections(
    tenantIdentifier: string
  ): Promise<TenantConnectionInfo[]> {
    const masterClient = this.masterDbConnection.getClient();

    // Query master database for tenant connection information
    const tenantInfo = await masterClient.tenant.findMany({
      where: { tenantGroupCode: tenantIdentifier },
    });

    if (!tenantInfo || tenantInfo.length === 0) {
      throw new Error(
        `No tenant information found for group code: ${tenantIdentifier}`
      );
    }

    // Map database results to connection info objects
    return tenantInfo.map((tenant) => ({
      tenantType: tenant.tenantConnectionType,
      tenantCode: tenant.tenantCode,
      tenantIdentifier: tenantIdentifier,
      tenantDbUrl: tenant.tenantConnectionUrl,
    }));
  }
}
