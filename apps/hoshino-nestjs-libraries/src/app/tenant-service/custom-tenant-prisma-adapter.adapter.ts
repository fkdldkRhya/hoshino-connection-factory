/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  BaseTenantTransactionAdapter,
  TenantClientInfo,
  TenantTransactionOptions,
} from '@hoshino-nestjs-libraries/hoshino-connection-factory';
import {
  CustomTenantPrismaService,
  FullPrismaClient,
} from './custom-tenant-prisma-client.service';

export class MyTransactionalAdapterPrisma extends BaseTenantTransactionAdapter<
  CustomTenantPrismaService,
  FullPrismaClient,
  TenantTransactionOptions
> {
  constructor(
    tenantServiceToken: any,
    defaultTxOptions?: Partial<TenantTransactionOptions>
  ) {
    super(tenantServiceToken, defaultTxOptions);
  }

  /**
   * Execute a function within a transaction
   * @param options Transaction options
   * @param businessLogic Business logic to execute
   * @param setTx Function to set transaction clients
   * @returns Result of business logic
   */
  async wrapWithTransaction(
    instance: CustomTenantPrismaService,
    options: TenantTransactionOptions,
    businessLogic: () => Promise<any>,
    setTx: (clients?: TenantClientInfo<FullPrismaClient>[]) => void
  ): Promise<any> {
    try {
      const tenantClients = await instance.getClients();

      // Execute nested transactions
      return await this.executeNestedTransactions(
        tenantClients,
        businessLogic,
        setTx
      );
    } catch (error) {
      this.logger.error(
        `Transaction failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        error instanceof Error ? error.stack : undefined
      );

      throw error;
    }
  }
}
