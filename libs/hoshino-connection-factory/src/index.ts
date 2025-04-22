import { WelcomeMessageService } from './lib/welcome/welcome-message.func';

WelcomeMessageService();

export * from './lib/hoshino-connection-factory.module';
export * from './lib/hoshino-connection-factory.service';
export * from './lib/hoshino-connection-factory-pool.service';
export * from './lib/hoshino-connection-factory.exception';
export * from './lib/hoshino-connection-factory.types';

// Export tenant-related interfaces and classes
export * from './lib/interfaces/tenant-interfaces';
export * from './lib/tenant/base-tenant-client.service';
export * from './lib/tenant/base-tenant-transaction.adapter';
export * from './lib/tenant/default-tenant-extractor.strategy';
export * from './lib/tenant/tenant.module';

// Export tenant accessibility checker
export * from './lib/tenant/base-tenant-accessibility.service';
