import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ClsModule } from 'nestjs-cls';
import { ClsPluginTransactional } from '@nestjs-cls/transactional';
import { CustomTenantPrismaService } from './tenant-service/custom-tenant-prisma-client.service';
import { CustomTenantModule } from './tenant-service/custom-tenant.module';
import { MyTransactionalAdapterPrisma } from './tenant-service/custom-tenant-prisma-adapter.adapter';
@Module({
  imports: [
    // Import module that provides HoshinoConnectionFactoryService
    CustomTenantModule,

    // Configure CLS for transaction management
    ClsModule.forRoot({
      middleware: {
        mount: true,
        // 필요에 따라 추가 설정 (예: 특정 헤더 등)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        setup: (cls, req, res) => {
          cls.set('tenantCode', req.headers['x-tenant-group-code']);
        },
      },
      plugins: [
        new ClsPluginTransactional({
          enableTransactionProxy: true,
          imports: [CustomTenantModule],
          adapter: new MyTransactionalAdapterPrisma(CustomTenantPrismaService, {
            timeout: 5000,
          }),
        }),
      ],
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
