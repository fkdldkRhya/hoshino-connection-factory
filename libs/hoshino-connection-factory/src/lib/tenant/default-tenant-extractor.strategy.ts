/* eslint-disable @typescript-eslint/no-explicit-any */
import { TenantExtractorStrategy } from '../interfaces/tenant-interfaces';
import { Injectable } from '@nestjs/common';

/**
 * Default Tenant Extractor Strategy
 * This class provides a default implementation that extracts tenant information from request headers
 * Users can extend or replace this with their own implementation
 */
@Injectable()
export class DefaultTenantExtractorStrategy implements TenantExtractorStrategy {
  /**
   * The header name to use for tenant identification
   * Default is 'x-tenant-id'
   */
  protected readonly headerName = 'x-tenant-id';

  /**
   * Extract tenant identifier from request headers
   * @param request The request object
   * @returns The tenant identifier
   */
  extractTenantIdentifier(request: { headers: Record<string, any> }): string {
    if (!request || !request.headers) {
      throw new Error('Invalid request object provided to tenant extractor');
    }

    const tenantId = request.headers[this.headerName];

    if (!tenantId) {
      throw new Error(
        `Tenant identifier not found in request header: ${this.headerName}`
      );
    }

    return tenantId as string;
  }
}
