import { Module } from '@nestjs/common';
import { HoshinoConnectionFactoryModule } from '@hoshino-nestjs-libraries/hoshino-connection-factory';
import { CustomTenantPrismaService } from './custom-tenant-prisma-client.service';
import { CustomTenantExtractorStrategy } from './custom-tenant-extractor';
import { CustomTenantResolverStrategy } from './custom-tenant-resolver';

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
    HoshinoConnectionFactoryModule.forRoot({
      type: 'MYSQL',
      // Default connection name is 'default'
      // But we need to use 'master' connection name for the master database
      // because the master database is the default connection
      name: 'master',
      clientFactory: createMasterClient,
    }),
  ],
  providers: [
    CustomTenantPrismaService,
    CustomTenantExtractorStrategy,
    CustomTenantResolverStrategy,
  ],
  exports: [
    CustomTenantPrismaService,
    CustomTenantExtractorStrategy,
    HoshinoConnectionFactoryModule,
  ],
})
export class CustomTenantModule {}
