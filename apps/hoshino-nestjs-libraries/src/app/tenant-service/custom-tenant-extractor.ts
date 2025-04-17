/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable } from '@nestjs/common';
import { DefaultTenantExtractorStrategy } from '@hoshino-nestjs-libraries/hoshino-connection-factory';

/**
 * Custom Tenant Extractor Strategy
 * Extracts tenant identifier from request headers using x-tenant-group-code header
 */
@Injectable()
export class CustomTenantExtractorStrategy extends DefaultTenantExtractorStrategy {
  /**
   * Extract tenant identifier from request headers using x-tenant-group-code header
   * @param request The request object
   * @returns The tenant identifier
   */
  extractTenantIdentifier(request: { headers: Record<string, any> }): string {
    if (!request || !request.headers) {
      throw new Error('Invalid request object provided to tenant extractor');
    }

    const tenantId = request.headers['x-tenant-group-code'];

    if (!tenantId) {
      throw new Error(
        'Tenant identifier not found in request header: x-tenant-group-code'
      );
    }

    return tenantId as string;
  }
}
