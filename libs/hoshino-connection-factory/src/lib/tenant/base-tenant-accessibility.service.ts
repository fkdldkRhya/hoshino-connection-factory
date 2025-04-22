/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  TenantAccessibilityChecker,
  TenantAccessibilityResult,
  TenantConnectionInfo,
  TenantResolverStrategy,
} from '../interfaces/tenant-interfaces';
import { DatabaseType } from '../hoshino-connection-factory.types';

/**
 * Base Tenant Accessibility Service
 *
 * This service provides core functionality for checking the accessibility of tenant connections.
 * It is designed to be run at server startup to validate that all tenant databases are accessible.
 *
 * Users should extend this class to implement their own tenant-specific accessibility checks.
 */
@Injectable()
export abstract class BaseTenantAccessibilityService<T = any>
  implements TenantAccessibilityChecker<T>, OnModuleInit
{
  protected readonly logger = new Logger(this.constructor.name);

  constructor(protected readonly tenantResolver: TenantResolverStrategy) {}

  /**
   * Initialize module - checks all tenant accessibility on startup
   * This is automatically called when the NestJS application starts
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

        this.logger.warn(
          `Warning: ${inaccessibleCount} tenant(s) are inaccessible: ${inaccessibleTenants.join(
            ', '
          )}`
        );
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to check tenant accessibility: ${error.message}`,
        error.stack
      );
    }
  }

  /**
   * Check if all tenant connections are accessible
   * @returns Array of accessibility check results
   */
  async checkAllTenantsAccessibility(): Promise<TenantAccessibilityResult[]> {
    try {
      // Get all tenant connection information
      const connections = await this.getAllTenantConnectionInfo();

      if (!connections || connections.length === 0) {
        this.logger.warn('No tenant connections found to check');
        return [];
      }

      this.logger.log(
        `Checking accessibility for ${connections.length} tenant connections`
      );

      // Test each connection and collect results
      const results: TenantAccessibilityResult[] = [];

      for (const connection of connections) {
        try {
          const isAccessible = await this.testTenantConnection(connection);

          results.push({
            tenantCode: connection.tenantCode,
            tenantIdentifier: connection.tenantIdentifier,
            tenantType: connection.tenantType,
            accessible: isAccessible,
            error: isAccessible ? undefined : 'Connection test failed',
          });
        } catch (error: any) {
          results.push({
            tenantCode: connection.tenantCode,
            tenantIdentifier: connection.tenantIdentifier,
            tenantType: connection.tenantType,
            accessible: false,
            error: error.message || 'Unknown error',
          });
        }
      }

      return results;
    } catch (error: any) {
      this.logger.error(
        `Failed to check tenant accessibility: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  /**
   * Get all available tenant connection information
   *
   * This method should be implemented by subclasses to return all tenant connections
   * that should be checked for accessibility.
   */
  abstract getAllTenantConnectionInfo(): Promise<TenantConnectionInfo[]>;

  /**
   * Create a temporary connection to a tenant's database to test accessibility
   *
   * This method should be implemented by subclasses to create a temporary connection
   * to the specified tenant's database, perform a basic operation to confirm it works,
   * and then close the connection.
   *
   * @param connectionInfo The tenant connection information
   * @returns A promise that resolves to true if the connection is accessible, false otherwise
   */
  abstract testTenantConnection(
    connectionInfo: TenantConnectionInfo
  ): Promise<boolean>;

  /**
   * Map tenant type string to database type
   *
   * Users can override this method to implement their own mapping logic
   *
   * @param tenantType The tenant type string from connection info
   */
  protected mapTenantTypeToDbType(tenantType: string): DatabaseType {
    // Simple default implementation - can be overridden by subclasses
    const normalizedType = tenantType.toUpperCase();

    // Check if the normalized type is one of the valid database types
    if (normalizedType === 'MONGO' || normalizedType === 'MONGODB') {
      return 'MONGO';
    }

    return 'MYSQL';
  }
}
