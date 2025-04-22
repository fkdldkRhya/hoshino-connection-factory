# Hoshino Tenant Connection Management

This directory contains classes and utilities for handling multi-tenant database connections in NestJS applications.

## Features

- Multi-tenancy support with dynamic connection management
- Transaction adapter for tenant-specific database transactions
- Tenant extractor strategy to identify tenants from request context
- Tenant resolver strategy to get connection information for tenants
- **Tenant accessibility checker** to verify all tenant connections are accessible

## Tenant Accessibility Checker

The tenant accessibility checker provides functionality to validate that all tenant databases in a multi-tenant application are accessible. This check runs once at application startup.

### Key Features

- Runs automatically at application startup (via `OnModuleInit`)
- Tests each tenant connection without adding them to the connection pool
- Closes connections immediately after testing to avoid resource consumption
- Logs detailed results of accessibility checks
- Customizable to work with your specific tenant configuration

### How to Use

1. **Create your own implementation** by extending `BaseTenantAccessibilityService`

```typescript
import { Injectable } from '@nestjs/common';
import { BaseTenantAccessibilityService } from '@hoshino/connection-factory';
import { TenantConnectionInfo, TenantResolverStrategy } from '@hoshino/connection-factory';
import { YourDatabaseClient } from './your-database-client';

@Injectable()
export class YourTenantAccessibilityService extends BaseTenantAccessibilityService<YourDatabaseClient> {
  constructor(tenantResolver: TenantResolverStrategy) {
    super(tenantResolver);
  }

  // Implement method to get all tenant connection information
  async getAllTenantConnectionInfo(): Promise<TenantConnectionInfo[]> {
    // Your implementation to get all tenant connection info
    // This might involve reading from config, database, etc.
  }

  // Implement method to test a tenant connection
  async testTenantConnection(connectionInfo: TenantConnectionInfo): Promise<boolean> {
    // Your implementation to test a connection to a tenant database
    // Should create a temporary connection, test it, and close it
  }
}
```

2. **Register your service** in your module

```typescript
import { Module } from '@nestjs/common';
import { YourTenantAccessibilityService } from './your-tenant-accessibility.service';
import { YourTenantResolverStrategy } from './your-tenant-resolver.strategy';

@Module({
  providers: [
    YourTenantAccessibilityService,
    {
      provide: 'TenantResolverStrategy',
      useClass: YourTenantResolverStrategy,
    },
  ],
})
export class YourModule {}
```

### Example Implementation

An example implementation for Prisma is provided in `examples/prisma-tenant-accessibility.service.ts`. You can use this as a reference for implementing your own tenant accessibility checker.

## Other Components

- `BaseTenantClientService`: Base service for managing tenant clients
- `BaseTenantTransactionAdapter`: Adapter for handling tenant-specific transactions
- `DefaultTenantExtractorStrategy`: Default implementation of tenant extractor
- `TenantModule`: Module for tenant client management

## Custom Configuration

All the components in this library are designed to be extended and customized according to your specific needs. You can implement your own strategies by extending the base classes and interfaces.
