import { Logger } from '@nestjs/common';
import {
  BasePrismaClient,
  TenantClientInfo,
  TenantTransactionOptions,
} from '../interfaces/tenant-interfaces';
import { TransactionalAdapter } from '@nestjs-cls/transactional';

/**
 * Base Tenant Transaction Adapter
 * This class provides a foundation for implementing transaction management across multiple tenants
 * Users can extend this class to implement their own transaction strategies
 */
export abstract class BaseTenantTransactionAdapter<
  TService extends { getClients(): Promise<TenantClientInfo<TClient>[]> },
  TClient extends BasePrismaClient = BasePrismaClient,
  TOptions = TenantTransactionOptions
> implements
    TransactionalAdapter<TService, TenantClientInfo<TClient>[], TOptions>
{
  protected readonly logger = new Logger(this.constructor.name);
  public defaultTxOptions?: Partial<TOptions>;
  public connectionToken: any;

  constructor(
    protected readonly tenantServiceToken: any,
    defaultTxOptions?: Partial<TOptions>
  ) {
    this.defaultTxOptions = defaultTxOptions;
    this.connectionToken = tenantServiceToken;
  }

  /**
   * Execute a function within a transaction
   * This method must be implemented by subclasses
   */
  abstract wrapWithTransaction(
    instance: TService,
    options: TOptions,
    businessLogic: () => Promise<any>,
    setTx: (clients?: TenantClientInfo<TClient>[]) => void
  ): Promise<any>;

  /**
   * Get fallback instance in case transaction setup fails
   * @returns Fallback instance
   */
  getFallbackInstance(): TenantClientInfo<TClient>[] {
    return [] as TenantClientInfo<TClient>[];
  }

  /**
   * Create options factory for transaction library integration
   * @returns Options factory function
   */
  optionsFactory = (connection: TService) => {
    return {
      wrapWithTransaction: async (
        options: TOptions,
        businessLogic: () => Promise<any>,
        setTx: (txClients?: TenantClientInfo<TClient>[]) => void
      ) => {
        // Delegate to the implementation in the subclass
        return this.wrapWithTransaction(
          connection,
          options,
          businessLogic,
          setTx
        );
      },
      getFallbackInstance: () => this.getFallbackInstance(),
    };
  };

  /**
   * Helper method to set up nested transactions
   * @param tenantClients List of tenant clients
   * @param businessLogic Business logic to execute within transaction
   * @returns Result of business logic
   */
  protected async executeNestedTransactions(
    tenantClients: TenantClientInfo<TClient>[],
    businessLogic: () => Promise<any>,
    setTx: (txClients?: TenantClientInfo<TClient>[]) => void
  ): Promise<any> {
    const txClients: TenantClientInfo<TClient>[] = [];

    // Recursive function to set up nested transactions
    async function runTx(depth: number): Promise<any> {
      if (depth === tenantClients.length) {
        // All transactions are set up, execute business logic
        setTx(txClients);
        return businessLogic();
      }

      const entry = tenantClients[depth];
      // Get actual client from HoshinoConnectionFactoryService
      const client: TClient = entry?.txClient
        ? entry.txClient
        : entry.client.getClient();

      // Create transaction and continue to next depth
      return client.$transaction(async (tx) => {
        // Store this level's transaction session
        txClients.push({ ...entry, txClient: tx });

        // Go to next depth for nested transaction
        return runTx(depth + 1);
      });
    }

    // Start the nested transaction chain - nested $transaction calls handle rollback automatically
    return runTx(0);
  }
}
