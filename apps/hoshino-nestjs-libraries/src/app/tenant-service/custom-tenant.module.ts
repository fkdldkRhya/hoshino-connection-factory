import { Module } from '@nestjs/common';
import { HoshinoConnectionFactoryModule } from '@hoshino-nestjs-libraries/hoshino-connection-factory';
import { CustomTenantPrismaService } from './custom-tenant-prisma-client.service';
import { CustomTenantExtractorStrategy } from './custom-tenant-extractor';
import { CustomTenantResolverStrategy } from './custom-tenant-resolver';
import { CustomTenantAccessibilityService } from './custom-tenant-accessibility.service';

// Master DB Prisma Client 생성 함수
const createMasterClient = async () => {
  const { PrismaClient } = await import(
    '@prisma/client/master_mysql_db/index.js'
  );
  return new PrismaClient();
};

@Module({
  imports: [
    // Configure connection factory for master database
    HoshinoConnectionFactoryModule.forFeatureAsync({
      global: true,
      connection: {
        type: 'MYSQL',
        // Default connection name is 'default'
        // But we need to use 'master' connection name for the master database
        // because the master database is the default connection
        name: 'master',
        useFactory: createMasterClient,
      },
      poolConfig: {
        useFactory: () => ({
          maxRetries: 3,
          healthCheckInterval: 5000,
          maxConnectionAge: 30000,
          cleanupInterval: 10000,
        }),
      },
    }),
  ],
  providers: [
    CustomTenantPrismaService,
    CustomTenantExtractorStrategy,
    CustomTenantResolverStrategy,
    CustomTenantAccessibilityService,
  ],
  exports: [
    CustomTenantPrismaService,
    CustomTenantExtractorStrategy,
    HoshinoConnectionFactoryModule,
    CustomTenantAccessibilityService,
  ],
})
export class CustomTenantModule {}
