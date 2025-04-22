import { Inject, Injectable, Logger } from '@nestjs/common';
import { TenantPrismaClient } from './tenant-service/custom-tenant-prisma-client.service';
import { TenantType } from '@prisma/client/master_mysql_db/index.js';
import { PrismaClient as PrismaClientMysql } from '@prisma/client/tenant_mysql_db/index.js';
import { PrismaClient as PrismaClientMongo } from '@prisma/client/tenant_mongo_db/index.js';
import { Transactional, TransactionHost } from '@nestjs-cls/transactional';
import { MyTransactionalAdapterPrisma } from './tenant-service/custom-tenant-prisma-adapter.adapter';
import {
  getServiceToken,
  HoshinoConnectionFactoryService,
} from '@hoshino-nestjs-libraries/hoshino-connection-factory';
import { PrismaClient as PrismaClientMaster } from '@prisma/client/master_mysql_db/index.js';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(
    @Inject(getServiceToken('master'))
    private readonly masterDbConnection: HoshinoConnectionFactoryService<PrismaClientMaster>,

    private readonly tenantPrismaService: TransactionHost<MyTransactionalAdapterPrisma>
  ) {}

  @Transactional()
  async getData(): Promise<{ message: string }> {
    try {
      const tenantClients = await this.tenantPrismaService.tx;
      this.logger.log(`Processing ${tenantClients.length} tenant clients`);

      // 원자적 트랜잭션을 보장하기 위해 모든 테넌트 작업을 배치로 준비
      const operations = [];

      // 1. 각 테넌트별 사용자 조회 작업 준비
      for (const tenant of tenantClients) {
        const prismaClient = tenant.txClient;

        if (tenant.tenantType === TenantType.MYSQL) {
          operations.push(async () => {
            // 중요: 여기서는 prismaClient.$transaction을 사용하지 않음
            // 대신 트랜잭션 컨텍스트에서 직접 쿼리 실행
            const result = await (
              prismaClient as PrismaClientMysql
            ).user.findMany();
            this.logger.log(
              `Found ${result.length} users for tenant ${tenant.tenantCode}`
            );
            return result;
          });
        } else if (tenant.tenantType === TenantType.MONGO) {
          operations.push(async () => {
            const result = await (
              prismaClient as PrismaClientMongo
            ).user.findMany();
            this.logger.log(
              `Found ${result.length} users for tenant ${tenant.tenantCode}`
            );
            return result;
          });
        }
      }

      // 2. 준비된 모든 작업 실행
      const results = await Promise.all(operations.map((op) => op()));
      this.logger.log(
        `Successfully executed ${results.length} tenant operations`
      );

      // 3. 사용자 생성 작업 실행
      await this.createUser();

      // 4. 테스트를 위한 오류 발생 - 모든 트랜잭션이 롤백되어야 함
      // throw new Error('test');

      // 5. 성공적으로 완료
      this.logger.log('All operations completed successfully');
      return { message: 'Hello API' };
    } catch (error) {
      this.logger.error(
        'Operation failed, all transactions will be rolled back',
        error
      );
      throw error; // 이 예외가 전파되면 @Transactional() 데코레이터가 롤백을 처리
    }
  }

  @Transactional()
  async createUser() {
    const tenantClients = (await this.tenantPrismaService
      .tx) as TenantPrismaClient[];
    this.logger.log(
      `Creating users for ${tenantClients.length} tenant clients`
    );

    // 원자적 트랜잭션을 위한 작업 배치 준비
    const operations = [];

    for (const tenant of tenantClients) {
      const prismaClient = tenant.txClient;

      if (tenant.tenantType === TenantType.MYSQL) {
        operations.push(async () => {
          // 개별 $transaction을 사용하지 않고 직접 쿼리 실행
          const result = await (prismaClient as PrismaClientMysql).user.create({
            data: {
              email: `test-${
                tenant.tenantCode
              }${new Date().getTime()}@test.com`,
              name: `test-${tenant.tenantCode}`,
            },
          });
          this.logger.log(
            `Created user ${result.id} for tenant ${tenant.tenantCode}`
          );
          return result;
        });
      } else if (tenant.tenantType === TenantType.MONGO) {
        operations.push(async () => {
          const result = await (prismaClient as PrismaClientMongo).user.create({
            data: {
              email: `test-${
                tenant.tenantCode
              }${new Date().getTime()}@test.com`,
              name: `test-${tenant.tenantCode}`,
            },
          });
          this.logger.log(
            `Created user ${result.id} for tenant ${tenant.tenantCode}`
          );
          return result;
        });
      }
    }

    // 모든 작업을 병렬로 실행
    const results = await Promise.all(operations.map((op) => op()));
    this.logger.log(
      `Successfully created ${results.length} users across tenants`
    );

    return results;
  }
}
