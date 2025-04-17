# HoshinoNestjsLibraries/hoshino-connection-factory

## Hoshino CF (Connection-Factory)

<div align="center" text-align="center">

> **(주) 디알밸류** <br/> **개발기간: 2025.04.14 ~ 현재**

## 개발자 소개

|                                              최시훈                                              |                                              강 준                                               |
| :----------------------------------------------------------------------------------------------: | :----------------------------------------------------------------------------------------------: |
|                  <img width="160px" src="https://github.com/fkdldkrhya.png" />                   |                    <img width="160px" src="https://github.com/leenuu.png" />                     |
| [@fkdldkrhya](https://github.com/fkdldkrhya) <br> 한양대학교 ERICA 3학년<br>(주) 디알밸류 연구원 | [@leenuu](https://github.com/leenuu) <br> 건국대학교 글로컬 캠퍼스 2학년<br>(주) 디알밸류 연구원 |

</div>

## What is Hoshino CF (Connection-Factory) ???

해당 라이브러리는 NestJS 전용 멀티 테넌시 구현을 위한 Connection 풀 관리 및 트렌젝션 관리 기능을 포함하고 있습니다.
MySQL, MongoDB 2가지 데이터베이스를 지원하고 중첩 트렌젝션을 통한 다중 데이터베이스에 대한 트렌젝션을 수행합니다. (단, MongoDB의 경우 레플리케이션이 되어 있어야 합니다.)

The library includes connection pool management and transmission management capabilities for NestJS-only multi-tenancy implementations.
It supports two databases, MySQL and MongoDB, and performs the projection on multiple databases with overlapping transmissions (but MongoDB requires replication)

예제 데이터는 `exam-nestjs.zip` 파일을 참고해주세요.

For example data, refer to the file `exam-nestjs.zip`.

## 시작 가이드

### Requirements

<a alt="Nx logo" href="https://nx.dev" target="_blank" rel="noreferrer"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-logo.png" width="45"></a>

A collection of NestJS libraries to facilitate common development patterns.

For building and running the application you need:

- [Node.js 22.12.0](https://nodejs.org/)
- [Pnpm 9.15.1](https://pnpm.io/ko/)

## Libraries

### Hoshino Connection Factory

A NestJS library for creating database connections for MySQL and MongoDB using Prisma with support for multi-tenancy and single-tenancy.

#### Installation

```sh
npm install @drvaluecrop/hoshino-connection-factory
```

or

```sh
pnpm add @drvaluecrop/hoshino-connection-factory
```

#### Required Dependencies

Make sure you have the following packages installed:

```json
{
  "@drvaluecrop/hoshino-connection-factory": "^0.0.1",
  "@nestjs-cls/transactional": "^2.6.1",
  "@nestjs/common": "^10.0.0",
  "@prisma/client": "6.6.0",
  "nestjs-cls": "^5.4.2",
  "prisma": "^6.6.0"
}
```

You can install these dependencies with:

```sh
npm install @drvaluecrop/hoshino-connection-factory @nestjs-cls/transactional @nestjs/common @prisma/client nestjs-cls prisma
```

or with pnpm:

```sh
pnpm add @drvaluecrop/hoshino-connection-factory @nestjs-cls/transactional @nestjs/common @prisma/client nestjs-cls prisma
```

## API Usage

### Hoshino Connection Factory

#### Module Registration

Register the module in your NestJS application:

```typescript
// For root module (app.module.ts)
import { HoshinoConnectionFactoryModule } from '@drvaluecrop/hoshino-connection-factory';
import { PrismaClient } from './generated/client';

@Module({
  imports: [
    HoshinoConnectionFactoryModule.forRoot({
      connectionOptions: {
        type: 'mysql', // or 'mongodb'
        url: 'mysql://user:password@localhost:3306/mydb',
        multiTenancy: false, // Set to true for multi-tenancy support
        clientFactory: async () => {
          const prisma = new PrismaClient({
            datasources: {
              db: {
                url: 'mysql://user:password@localhost:3306/mydb',
              },
            },
          });
          await prisma.$connect();
          return prisma;
        },
      },
      isGlobal: true, // Make the module global (optional)
    }),
  ],
})
export class AppModule {}
```

```typescript
// For feature modules
import { HoshinoConnectionFactoryModule } from '@drvaluecrop/hoshino-connection-factory';
import { PrismaClient } from './generated/client';

@Module({
  imports: [
    HoshinoConnectionFactoryModule.forFeature({
      connectionOptions: {
        type: 'mysql',
        url: 'mysql://user:password@localhost:3306/mydb',
        clientFactory: async () => {
          const prisma = new PrismaClient();
          await prisma.$connect();
          return prisma;
        },
      },
    }),
  ],
})
export class FeatureModule {}
```

#### Managing Connections

Create and manage connections using ConnectionService:

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConnectionService } from '@drvaluecrop/hoshino-connection-factory';
import { PrismaClient } from './generated/client';

@Injectable()
export class DatabaseService implements OnModuleInit {
  constructor(private readonly connectionService: ConnectionService) {}

  async onModuleInit() {
    // Create a named connection
    await this.connectionService.createConnection('secondary', {
      type: 'mysql',
      url: 'mysql://user:password@localhost:3306/secondarydb',
      clientFactory: async () => {
        const client = new PrismaClient({
          datasources: {
            db: {
              url: 'mysql://user:password@localhost:3306/secondarydb',
            },
          },
        });
        await client.$connect();
        return client;
      },
    });
  }

  // Get the default connection
  getDefaultClient() {
    return this.connectionService.getConnection().getClient();
  }

  // Get a named connection
  getSecondaryClient() {
    return this.connectionService.getConnection('secondary').getClient();
  }
}
```

#### Connection Pool

The library provides a robust connection pool implementation that handles connection creation, health checks, and lifecycle management:

```typescript
import { Injectable } from '@nestjs/common';
import { HoshinoConnectionFactoryPoolService } from '@drvaluecrop/hoshino-connection-factory';
import { PrismaClient } from './generated/client';

@Injectable()
export class ConnectionPoolDemo {
  constructor(private readonly connectionPool: HoshinoConnectionFactoryPoolService) {}

  async createConnections() {
    // Create a connection with the connection pool
    await this.connectionPool.createConnection({
      name: 'main-db',
      type: 'mysql',
      clientFactory: async () => {
        const client = new PrismaClient();
        await client.$connect();
        return client;
      },
    });

    // Get a connection from the pool
    const connection = await this.connectionPool.getConnection('main-db');

    // Use the connection client
    const client = connection.getClient();

    // Check if a connection exists
    const hasConnection = this.connectionPool.hasConnection('main-db');

    // Remove a connection when no longer needed
    await this.connectionPool.removeConnection('main-db');

    // Get connection metrics
    const metrics = this.connectionPool.getMetrics();
    // metrics includes: totalConnections, activeConnections, failedConnections, connectionErrors
  }

  // Listen for connection events
  setupEventListeners() {
    this.connectionPool.events.on('connection.created', (name) => {
      console.log(`Connection created: ${name}`);
    });

    this.connectionPool.events.on('connection.error', (error) => {
      console.error('Connection error:', error);
    });
  }
}
```

The connection pool supports the following configuration options:

```typescript
// Module registration with connection pool configuration
HoshinoConnectionFactoryModule.forRoot({
  poolConfig: {
    maxRetries: 3,               // Maximum retries for connection creation
    healthCheckInterval: 15000,  // Health check interval in milliseconds (15s)
    maxConnectionAge: 3600000,   // Maximum connection age in milliseconds (1h)
    cleanupInterval: 60000,      // Cleanup interval for old connections (1m)
  },
  // ... other options
}),
```

#### CLS-based Transactions

The library supports Continuation Local Storage (CLS) based transactions using [@nestjs-cls/transactional](https://www.npmjs.com/package/@nestjs-cls/transactional). This enables multi-tenant transactions where operations across multiple tenants are run in a single atomic transaction.

##### Setup Transaction Support

1. **Create a custom tenant adapter**:

```typescript
// custom-tenant-prisma-adapter.adapter.ts
import { BaseTenantTransactionAdapter, TenantClientInfo, TenantTransactionOptions } from '@drvaluecrop/hoshino-connection-factory';
import { CustomTenantPrismaService, FullPrismaClient } from './custom-tenant-prisma-client.service';

export class MyTransactionalAdapterPrisma extends BaseTenantTransactionAdapter<CustomTenantPrismaService, FullPrismaClient, TenantTransactionOptions> {
  constructor(tenantServiceToken: any, defaultTxOptions?: Partial<TenantTransactionOptions>) {
    super(tenantServiceToken, defaultTxOptions);
  }

  /**
   * Execute a function within a transaction
   */
  async wrapWithTransaction(instance: CustomTenantPrismaService, options: TenantTransactionOptions, businessLogic: () => Promise<any>, setTx: (clients?: TenantClientInfo<FullPrismaClient>[]) => void): Promise<any> {
    try {
      const tenantClients = await instance.getClients();

      // Execute nested transactions
      return await this.executeNestedTransactions(tenantClients, businessLogic, setTx);
    } catch (error) {
      this.logger.error(`Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
}
```

2. **Configure the CLS module in your app.module.ts**:

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { ClsModule } from 'nestjs-cls';
import { ClsPluginTransactional } from '@nestjs-cls/transactional';
import { CustomTenantPrismaService } from './tenant-service/custom-tenant-prisma-client.service';
import { CustomTenantModule } from './tenant-service/custom-tenant.module';
import { MyTransactionalAdapterPrisma } from './tenant-service/custom-tenant-prisma-adapter.adapter';

@Module({
  imports: [
    // Import module that provides tenant services
    CustomTenantModule,

    // Configure CLS for transaction management
    ClsModule.forRoot({
      middleware: {
        mount: true,
        setup: (cls, req, res) => {
          // Store tenant information in CLS context
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
```

3. **Implement a tenant client service**:

```typescript
// custom-tenant-prisma-client.service.ts
import { Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { BaseTenantClientService, CONNECTION_POOL_SERVICE, HoshinoConnectionFactoryPoolService, TenantClientInfo, TenantConnectionInfo, TenantExtractorStrategy, TenantResolverStrategy } from '@drvaluecrop/hoshino-connection-factory';
import { CustomTenantExtractorStrategy } from './custom-tenant-extractor';
import { CustomTenantResolverStrategy } from './custom-tenant-resolver';

export type FullPrismaClient = PrismaClientMysql | PrismaClientMongo;
export type TenantPrismaClient = TenantClientInfo<FullPrismaClient>;

@Injectable({ scope: Scope.REQUEST })
export class CustomTenantPrismaService extends BaseTenantClientService<FullPrismaClient> {
  constructor(
    @Inject(CONNECTION_POOL_SERVICE)
    connectionPool: HoshinoConnectionFactoryPoolService,
    @Inject(CustomTenantExtractorStrategy)
    tenantExtractor: TenantExtractorStrategy,
    @Inject(CustomTenantResolverStrategy)
    tenantResolver: TenantResolverStrategy,
    @Inject(REQUEST) context: Request
  ) {
    super(connectionPool, tenantExtractor, tenantResolver, context);
  }

  /**
   * Create a Prisma client instance for the tenant
   */
  protected async createClientInstance(connectionInfo: TenantConnectionInfo): Promise<FullPrismaClient> {
    switch (connectionInfo.tenantType) {
      case 'MYSQL':
        return new PrismaClientMysql({
          datasources: { db: { url: connectionInfo.tenantDbUrl } },
        });
      case 'MONGO':
        return new PrismaClientMongo({
          datasources: { db: { url: connectionInfo.tenantDbUrl } },
        });
      default:
        throw new Error(`Unsupported tenant type: ${connectionInfo.tenantType}`);
    }
  }
}
```

##### Using Transactions

Use the `@Transactional()` decorator to automatically handle transactions:

```typescript
// app.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Transactional, TransactionHost } from '@nestjs-cls/transactional';
import { MyTransactionalAdapterPrisma } from './tenant-service/custom-tenant-prisma-adapter.adapter';
import { TenantPrismaClient } from './tenant-service/custom-tenant-prisma-client.service';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(private readonly tenantPrismaService: TransactionHost<MyTransactionalAdapterPrisma>) {}

  @Transactional()
  async getData(): Promise<{ message: string }> {
    try {
      // Get all tenant clients in the transaction context
      const tenantClients = await this.tenantPrismaService.tx;
      this.logger.log(`Processing ${tenantClients.length} tenant clients`);

      // Prepare operations for all tenants
      const operations = [];

      // Add operations for each tenant
      for (const tenant of tenantClients) {
        const prismaClient = tenant.txClient;

        if (tenant.tenantType === 'MYSQL') {
          operations.push(async () => {
            // Execute query within transaction context
            const result = await prismaClient.user.findMany();
            this.logger.log(`Found ${result.length} users for tenant ${tenant.tenantCode}`);
            return result;
          });
        } else if (tenant.tenantType === 'MONGO') {
          operations.push(async () => {
            const result = await prismaClient.user.findMany();
            this.logger.log(`Found ${result.length} users for tenant ${tenant.tenantCode}`);
            return result;
          });
        }
      }

      // Execute all operations
      const results = await Promise.all(operations.map((op) => op()));

      // Execute another transactional method
      await this.createUser();

      return { message: 'Hello API' };
    } catch (error) {
      this.logger.error('Operation failed, all transactions will be rolled back');
      throw error; // This will trigger a rollback of all transactions
    }
  }

  @Transactional()
  async createUser() {
    const tenantClients = await this.tenantPrismaService.tx;

    const operations = [];

    for (const tenant of tenantClients) {
      const prismaClient = tenant.txClient;

      if (tenant.tenantType === 'MYSQL') {
        operations.push(async () => {
          const result = await prismaClient.user.create({
            data: {
              email: `test-${tenant.tenantCode}${new Date().getTime()}@test.com`,
              name: `test-${tenant.tenantCode}`,
            },
          });
          return result;
        });
      }
    }

    return Promise.all(operations.map((op) => op()));
  }
}
```

##### Controller Setup

```typescript
// app.controller.ts
import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getData() {
    return this.appService.getData();
  }
}
```

##### Key Benefits of CLS-based Transactions

1. **Automatic Transaction Management**: The `@Transactional()` decorator handles transaction boundaries automatically.
2. **Multi-tenant Support**: Transactions can span multiple tenant databases.
3. **Nested Transactions**: Supports calling transactional methods from within other transactional methods.
4. **Automatic Rollback**: If an exception occurs, all transactions are rolled back.
5. **Request Scoping**: Tenant information can be extracted from the request context.

#### Tenant Module and Interfaces

The library provides specialized tenant support through the TenantModule:

```typescript
import { Module } from '@nestjs/common';
import { TenantModule } from '@drvaluecrop/hoshino-connection-factory';
import { MyTenantResolver } from './my-tenant-resolver';
import { MyTenantService } from './my-tenant-service';
import { MyTransactionAdapter } from './my-transaction-adapter';

@Module({
  imports: [
    TenantModule.forRoot({
      // Custom tenant extractor (optional, default provided)
      // tenantExtractor: MyTenantExtractor,

      // Required: Resolver for tenant connections
      tenantResolver: MyTenantResolver,

      // Required: Service for tenant operations
      tenantService: MyTenantService,

      // Optional: Custom transaction adapter
      transactionAdapter: MyTransactionAdapter,

      // Optional: Additional providers
      extraProviders: [],
    }),
  ],
})
export class AppModule {}
```

The TenantModule also supports async configuration:

```typescript
TenantModule.forRootAsync({
  tenantResolverFactory: {
    useFactory: (configService) => new MyTenantResolver(configService),
    inject: [ConfigService],
  },
  tenantServiceFactory: {
    useFactory: (configService) => new MyTenantService(configService),
    inject: [ConfigService],
  },
  // ... other options
}),
```

Key tenant interfaces provided by the library:

1. **TenantExtractorStrategy**: Extract tenant identifier from requests

   ```typescript
   import { TenantExtractorStrategy } from '@drvaluecrop/hoshino-connection-factory';

   export class MyTenantExtractor implements TenantExtractorStrategy {
     extractTenantIdentifier(context: any): string | Promise<string> {
       // Extract tenant ID from request headers, JWT, etc.
       return context.headers['x-tenant-id'];
     }
   }
   ```

2. **TenantResolverStrategy**: Resolve tenant connection information

   ```typescript
   import { TenantResolverStrategy, TenantConnectionInfo } from '@drvaluecrop/hoshino-connection-factory';

   export class MyTenantResolver implements TenantResolverStrategy {
     async resolveTenantConnections(tenantId: string): Promise<TenantConnectionInfo[]> {
       // Resolve tenant connection info from a repository, config, etc.
       return [
         {
           tenantType: 'mysql',
           tenantCode: 'primary',
           tenantIdentifier: tenantId,
           tenantDbUrl: `mysql://user:password@localhost:3306/tenant_${tenantId}`,
         },
       ];
     }
   }
   ```

3. **BaseTenantClientService**: Base class for tenant-specific client services

   ```typescript
   import { BaseTenantClientService } from '@drvaluecrop/hoshino-connection-factory';

   export class MyTenantClientService extends BaseTenantClientService {
     // Add custom tenant-specific methods
     async findUsersByTenant(userId: string) {
       const client = this.getTenantClient();
       return client.user.findMany({
         where: { id: userId },
       });
     }
   }
   ```

## Run tasks

To run the dev server for your app, use:

```sh
npx nx serve hoshino-nestjs-libraries
```

To create a production bundle:

```sh
npx nx build hoshino-nestjs-libraries
```

To see all available targets to run for a project, run:

```sh
npx nx show project hoshino-nestjs-libraries
```

These targets are either [inferred automatically](https://nx.dev/concepts/inferred-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) or defined in the `project.json` or `package.json` files.

[More about running tasks in the docs &raquo;](https://nx.dev/features/run-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Add new projects

While you could add new projects to your workspace manually, you might want to leverage [Nx plugins](https://nx.dev/concepts/nx-plugins?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) and their [code generation](https://nx.dev/features/generate-code?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) feature.

Use the plugin's generator to create new projects.

To generate a new application, use:

```sh
npx nx g @nx/nest:app demo
```

To generate a new library, use:

```sh
npx nx g @nx/node:lib mylib
```

You can use `npx nx list` to get a list of installed plugins. Then, run `npx nx list <plugin-name>` to learn about more specific capabilities of a particular plugin. Alternatively, [install Nx Console](https://nx.dev/getting-started/editor-setup?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) to browse plugins and generators in your IDE.

[Learn more about Nx plugins &raquo;](https://nx.dev/concepts/nx-plugins?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) | [Browse the plugin registry &raquo;](https://nx.dev/plugin-registry?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

[Learn more about Nx on CI](https://nx.dev/ci/intro/ci-with-nx#ready-get-started-with-your-provider?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Install Nx Console

Nx Console is an editor extension that enriches your developer experience. It lets you run tasks, generate code, and improves code autocompletion in your IDE. It is available for VSCode and IntelliJ.

[Install Nx Console &raquo;](https://nx.dev/getting-started/editor-setup?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Useful links

Learn more:

- [Learn more about this workspace setup](https://nx.dev/nx-api/nest?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Learn about Nx on CI](https://nx.dev/ci/intro/ci-with-nx?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Releasing Packages with Nx release](https://nx.dev/features/manage-releases?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [What are Nx plugins?](https://nx.dev/concepts/nx-plugins?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

And join the Nx community:

- [Discord](https://go.nx.dev/community)
- [Follow us on X](https://twitter.com/nxdevtools) or [LinkedIn](https://www.linkedin.com/company/nrwl)
- [Our Youtube channel](https://www.youtube.com/@nxdevtools)
- [Our blog](https://nx.dev/blog?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
