/* eslint-disable @typescript-eslint/no-explicit-any */
import { Inject, Injectable } from '@nestjs/common';
import {
  BaseTenantAccessibilityService,
  TenantConnectionInfo,
} from '@hoshino-nestjs-libraries/hoshino-connection-factory';
import { CustomTenantResolverStrategy } from './custom-tenant-resolver';
import { PrismaClient as PrismaClientMysql } from '@prisma/client/tenant_mysql_db/index.js';
import { PrismaClient as PrismaClientMongo } from '@prisma/client/tenant_mongo_db/index.js';
import { TenantType } from '@prisma/client/master_mysql_db/index.js';

/**
 * Custom implementation of the tenant accessibility checker service.
 * This service checks if all tenant databases are accessible at application startup.
 * If any tenant is inaccessible, it will prevent the server from starting.
 */
@Injectable()
export class CustomTenantAccessibilityService extends BaseTenantAccessibilityService<
  PrismaClientMysql | PrismaClientMongo
> {
  constructor(
    @Inject(CustomTenantResolverStrategy)
    tenantResolver: CustomTenantResolverStrategy
  ) {
    super(tenantResolver);
  }

  /**
   * Override onModuleInit to prevent server startup if any tenant is inaccessible
   */
  async onModuleInit(): Promise<void> {
    this.logger.log(
      'Checking accessibility of all tenant connections on startup...'
    );

    try {
      const results = await this.checkAllTenantsAccessibility();

      const accessibleCount = results.filter((r) => r.accessible).length;
      const inaccessibleCount = results.length - accessibleCount;

      this.logger.log(
        `Tenant accessibility check completed: ${accessibleCount}/${results.length} tenants accessible`
      );

      if (inaccessibleCount > 0) {
        const inaccessibleTenants = results
          .filter((r) => !r.accessible)
          .map((r) => `${r.tenantCode} (${r.error || 'unknown error'})`);

        const errorMessage = `Server startup aborted: ${inaccessibleCount} tenant(s) are inaccessible: ${inaccessibleTenants.join(
          ', '
        )}`;
        this.logger.error(errorMessage);

        // Throw error to prevent server startup
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to check tenant accessibility: ${error.message}`,
        error.stack
      );
      // Re-throw to prevent server startup
      throw error;
    }
  }

  /**
   * Get all available tenant connection information by querying the master database
   */
  async getAllTenantConnectionInfo(): Promise<TenantConnectionInfo[]> {
    try {
      // Get all tenant group codes from the master database
      const tenantGroupCodes = await this.getAllTenantGroupCodes();

      // Collect connection info for all tenants across all tenant groups
      const allConnections: TenantConnectionInfo[] = [];

      for (const groupCode of tenantGroupCodes) {
        try {
          // Use the tenant resolver to get connection info for each tenant group
          const connections =
            await this.tenantResolver.resolveTenantConnections(groupCode);
          allConnections.push(...connections);
        } catch (error: any) {
          this.logger.warn(
            `Failed to resolve connections for tenant group ${groupCode}: ${error.message}`
          );
        }
      }

      this.logger.log(
        `Found ${allConnections.length} tenant connections to check`
      );
      return allConnections;
    } catch (error: any) {
      this.logger.error(
        `Failed to get tenant connection info: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  /**
   * Test a tenant connection by creating a temporary Prisma client
   *
   * This method creates a temporary connection to the tenant's database,
   * performs a simple query to confirm it works, and then disconnects.
   */
  async testTenantConnection(
    connectionInfo: TenantConnectionInfo
  ): Promise<boolean> {
    let client: PrismaClientMysql | PrismaClientMongo | null = null;

    try {
      // Create a temporary client instance based on tenant type
      client = await this.createTemporaryClient(connectionInfo);

      // Connect to the database
      await client.$connect();

      // Execute a simple query to verify the connection works
      if (connectionInfo.tenantType === TenantType.MONGO) {
        // MongoDB query
        await (client as PrismaClientMongo).$runCommandRaw({ ping: 1 });
      } else {
        // MySQL query
        await (client as PrismaClientMysql).$queryRaw`SELECT 1`;
      }

      this.logger.debug(
        `Successfully connected to tenant: ${connectionInfo.tenantCode}`
      );
      return true;
    } catch (error: any) {
      this.logger.warn(
        `Failed to connect to tenant ${connectionInfo.tenantCode}: ${error.message}`,
        error.stack
      );
      return false;
    } finally {
      // Ensure connection is closed
      if (client) {
        try {
          await client.$disconnect();
        } catch (err: any) {
          this.logger.warn(
            `Error disconnecting from tenant ${connectionInfo.tenantCode}: ${err.message}`
          );
        }
      }
    }
  }

  /**
   * Query master database to get all tenant group codes
   */
  private async getAllTenantGroupCodes(): Promise<string[]> {
    try {
      // Type cast the tenant resolver to access the masterDbConnection
      const customResolver = this
        .tenantResolver as CustomTenantResolverStrategy;
      const masterClient = customResolver['masterDbConnection'].getClient();

      // Get all unique tenant group codes
      const tenantGroups = await masterClient.tenant.groupBy({
        by: ['tenantGroupCode'],
      });

      return tenantGroups.map((group) => group.tenantGroupCode);
    } catch (error: any) {
      this.logger.error(
        `Failed to get tenant group codes: ${error.message}`,
        error.stack
      );
      throw error; // Throw error to prevent server startup
    }
  }

  /**
   * Create a temporary Prisma client instance based on tenant type
   */
  private async createTemporaryClient(
    connectionInfo: TenantConnectionInfo
  ): Promise<PrismaClientMysql | PrismaClientMongo> {
    const { tenantDbUrl, tenantType } = connectionInfo;

    switch (tenantType) {
      case TenantType.MYSQL:
        return new PrismaClientMysql({
          datasources: { db: { url: tenantDbUrl } },
        });
      case TenantType.MONGO:
        return new PrismaClientMongo({
          datasources: { db: { url: tenantDbUrl } },
        });
      default:
        throw new Error(`Unsupported tenant type: ${tenantType}`);
    }
  }
}
