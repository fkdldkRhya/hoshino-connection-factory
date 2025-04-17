/* eslint-disable @typescript-eslint/no-explicit-any */
import { DynamicModule, Module, Provider, Type } from '@nestjs/common';
import { DefaultTenantExtractorStrategy } from './default-tenant-extractor.strategy';
import {
  TenantExtractorStrategy,
  TenantResolverStrategy,
} from '../interfaces/tenant-interfaces';

export interface TenantModuleOptions {
  tenantExtractor?: Type<TenantExtractorStrategy>;
  tenantResolver: Type<TenantResolverStrategy>;
  tenantService: Type<any>;
  transactionAdapter?: Type<any>;
  extraProviders?: Provider[];
}

/**
 * Tenant Module
 * This module provides a convenient way to configure tenant-related components
 * Users can supply their own implementations for the various components
 */
@Module({})
export class TenantModule {
  /**
   * Configure the tenant module with custom implementations
   * @param options Module configuration options
   * @returns Dynamic module
   */
  static forRoot(options: TenantModuleOptions): DynamicModule {
    const {
      tenantExtractor = DefaultTenantExtractorStrategy,
      tenantResolver,
      tenantService,
      transactionAdapter,
      extraProviders = [],
    } = options;

    const providers: Provider[] = [
      {
        provide: DefaultTenantExtractorStrategy,
        useClass: tenantExtractor,
      },
      {
        provide: tenantResolver,
        useClass: tenantResolver,
      },
      {
        provide: tenantService,
        useClass: tenantService,
      },
      ...extraProviders,
    ];

    // Add transaction adapter if provided
    if (transactionAdapter) {
      providers.push({
        provide: transactionAdapter,
        useClass: transactionAdapter,
      });
    }

    return {
      module: TenantModule,
      providers,
      exports: [
        DefaultTenantExtractorStrategy,
        tenantResolver,
        tenantService,
        ...(transactionAdapter ? [transactionAdapter] : []),
        ...extraProviders,
      ],
    };
  }

  /**
   * Configure the tenant module with async providers
   * @param options Module configuration options
   * @returns Dynamic module
   */
  static forRootAsync(options: {
    tenantExtractorFactory?: {
      useFactory: (
        ...args: any[]
      ) => Type<TenantExtractorStrategy> | TenantExtractorStrategy;
      inject?: any[];
    };
    tenantResolverFactory: {
      useFactory: (
        ...args: any[]
      ) => Type<TenantResolverStrategy> | TenantResolverStrategy;
      inject?: any[];
    };
    tenantServiceFactory: {
      useFactory: (...args: any[]) => any;
      inject?: any[];
    };
    transactionAdapterFactory?: {
      useFactory: (...args: any[]) => any;
      inject?: any[];
    };
    extraProviders?: Provider[];
  }): DynamicModule {
    const {
      tenantExtractorFactory,
      tenantResolverFactory,
      tenantServiceFactory,
      transactionAdapterFactory,
      extraProviders = [],
    } = options;

    const providers: Provider[] = [
      {
        provide: DefaultTenantExtractorStrategy,
        useFactory:
          tenantExtractorFactory?.useFactory ||
          (() => new DefaultTenantExtractorStrategy()),
        inject: tenantExtractorFactory?.inject || [],
      },
      {
        provide: 'TENANT_RESOLVER',
        useFactory: tenantResolverFactory.useFactory,
        inject: tenantResolverFactory.inject || [],
      },
      {
        provide: 'TENANT_SERVICE',
        useFactory: tenantServiceFactory.useFactory,
        inject: tenantServiceFactory.inject || [],
      },
      ...extraProviders,
    ];

    // Add transaction adapter if provided
    if (transactionAdapterFactory) {
      providers.push({
        provide: 'TRANSACTION_ADAPTER',
        useFactory: transactionAdapterFactory.useFactory,
        inject: transactionAdapterFactory.inject || [],
      });
    }

    return {
      module: TenantModule,
      providers,
      exports: [
        DefaultTenantExtractorStrategy,
        'TENANT_RESOLVER',
        'TENANT_SERVICE',
        ...(transactionAdapterFactory ? ['TRANSACTION_ADAPTER'] : []),
        ...extraProviders,
      ],
    };
  }
}
