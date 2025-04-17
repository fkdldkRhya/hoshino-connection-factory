/* eslint-disable @typescript-eslint/no-explicit-any */
import { Inject, Injectable, Logger, Scope } from '@nestjs/common';
import { CONNECTION_POOL_SERVICE } from '../hoshino-connection-factory.types';
import { HoshinoConnectionFactoryPoolService } from '../hoshino-connection-factory-pool.service';
import {
  TenantClientInfo,
  TenantConnectionInfo,
  TenantExtractorStrategy,
  TenantResolverStrategy,
} from '../interfaces/tenant-interfaces';

/**
 * Base Tenant Client Service
 * This service provides core functionality for managing tenant connections
 * Users can extend this class to implement their own tenant-specific logic
 */
@Injectable({ scope: Scope.REQUEST })
export abstract class BaseTenantClientService<T = any> {
  protected readonly logger = new Logger(this.constructor.name);
  protected tenantClients: TenantClientInfo<T>[] = [];

  constructor(
    @Inject(CONNECTION_POOL_SERVICE)
    protected readonly connectionPool: HoshinoConnectionFactoryPoolService,
    protected readonly tenantExtractor: TenantExtractorStrategy,
    protected readonly tenantResolver: TenantResolverStrategy,
    protected readonly context: any
  ) {}

  /**
   * Get tenant clients for the current request context
   * This method will extract tenant identifier, resolve connections, and create clients
   */
  async getClients(): Promise<TenantClientInfo<T>[]> {
    if (this.tenantClients.length === 0) {
      // 1. Extract tenant identifier from context (e.g., HTTP request headers)
      const tenantIdentifier =
        await this.tenantExtractor.extractTenantIdentifier(this.context);

      if (!tenantIdentifier) {
        throw new Error('No tenant identifier found in the request context');
      }

      // 2. Resolve tenant connection information
      const connectionInfoList =
        await this.tenantResolver.resolveTenantConnections(tenantIdentifier);

      if (!connectionInfoList || connectionInfoList.length === 0) {
        throw new Error(
          `No tenant connection information found for identifier: ${tenantIdentifier}`
        );
      }

      // 3. Create connections for all tenants
      this.tenantClients = await this.createConnections(connectionInfoList);
    }

    return this.tenantClients;
  }

  /**
   * Get a specific tenant client by tenant code
   * @param tenantCode The tenant code to filter by
   */
  async getClientByCode(
    tenantCode: string
  ): Promise<TenantClientInfo<T> | undefined> {
    const clients = await this.getClients();
    return clients.find((client) => client.tenantCode === tenantCode);
  }

  /**
   * Get tenant clients filtered by tenant identifier
   * @param tenantIdentifier The tenant identifier to filter by
   */
  async getClientsByIdentifier(
    tenantIdentifier: string
  ): Promise<TenantClientInfo<T>[]> {
    const clients = await this.getClients();
    return clients.filter(
      (client) => client.tenantIdentifier === tenantIdentifier
    );
  }

  /**
   * Create connections for each tenant connection info
   * @param connectionInfoList List of tenant connection information
   */
  protected async createConnections(
    connectionInfoList: TenantConnectionInfo[]
  ): Promise<TenantClientInfo<T>[]> {
    return Promise.all(
      connectionInfoList.map(async (connectionInfo) => {
        const { tenantCode } = connectionInfo;

        // Check if connection already exists
        if (!this.connectionPool.hasConnection(tenantCode)) {
          this.logger.debug(`Creating new tenant connection: ${tenantCode}`);

          // Create connection using connection factory
          await this.connectionPool.createConnection<T>({
            type: this.mapTenantTypeToDbType(connectionInfo.tenantType),
            name: tenantCode,
            clientFactory: async () => {
              return this.createClientInstance(connectionInfo);
            },
          });
        }

        // Get tenant connection
        const tenantConnection = await this.connectionPool.getConnection<T>(
          tenantCode
        );

        this.logger.debug(`Tenant connection established: ${tenantCode}`);

        // Return tenant client info
        return {
          ...connectionInfo,
          client: tenantConnection,
        };
      })
    );
  }

  /**
   * Map tenant type string to database type
   * Users can override this method to implement their own mapping logic
   * @param tenantType The tenant type string from connection info
   */
  protected mapTenantTypeToDbType(tenantType: string): 'MYSQL' | 'MONGO' {
    // Simple default implementation - can be overridden by subclasses
    const normalizedType = tenantType.toUpperCase();
    return normalizedType === 'MONGO' || normalizedType === 'MONGODB'
      ? 'MONGO'
      : 'MYSQL';
  }

  /**
   * Create a client instance for the tenant
   * Users must implement this method in their own service
   * @param connectionInfo The tenant connection information
   */
  protected abstract createClientInstance(
    connectionInfo: TenantConnectionInfo
  ): Promise<T>;
}
