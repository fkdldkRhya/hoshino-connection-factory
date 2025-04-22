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

## License

Apache License
Version 2.0, January 2004
http://www.apache.org/licenses/

TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

1.  Definitions.

    "License" shall mean the terms and conditions for use, reproduction,
    and distribution as defined by Sections 1 through 9 of this document.

    "Licensor" shall mean the copyright owner or entity authorized by
    the copyright owner that is granting the License.

    "Legal Entity" shall mean the union of the acting entity and all
    other entities that control, are controlled by, or are under common
    control with that entity. For the purposes of this definition,
    "control" means (i) the power, direct or indirect, to cause the
    direction or management of such entity, whether by contract or
    otherwise, or (ii) ownership of fifty percent (50%) or more of the
    outstanding shares, or (iii) beneficial ownership of such entity.

    "You" (or "Your") shall mean an individual or Legal Entity
    exercising permissions granted by this License.

    "Source" form shall mean the preferred form for making modifications,
    including but not limited to software source code, documentation
    source, and configuration files.

    "Object" form shall mean any form resulting from mechanical
    transformation or translation of a Source form, including but
    not limited to compiled object code, generated documentation,
    and conversions to other media types.

    "Work" shall mean the work of authorship, whether in Source or
    Object form, made available under the License, as indicated by a
    copyright notice that is included in or attached to the work
    (an example is provided in the Appendix below).

    "Derivative Works" shall mean any work, whether in Source or Object
    form, that is based on (or derived from) the Work and for which the
    editorial revisions, annotations, elaborations, or other modifications
    represent, as a whole, an original work of authorship. For the purposes
    of this License, Derivative Works shall not include works that remain
    separable from, or merely link (or bind by name) to the interfaces of,
    the Work and Derivative Works thereof.

    "Contribution" shall mean any work of authorship, including
    the original version of the Work and any modifications or additions
    to that Work or Derivative Works thereof, that is intentionally
    submitted to Licensor for inclusion in the Work by the copyright owner
    or by an individual or Legal Entity authorized to submit on behalf of
    the copyright owner. For the purposes of this definition, "submitted"
    means any form of electronic, verbal, or written communication sent
    to the Licensor or its representatives, including but not limited to
    communication on electronic mailing lists, source code control systems,
    and issue tracking systems that are managed by, or on behalf of, the
    Licensor for the purpose of discussing and improving the Work, but
    excluding communication that is conspicuously marked or otherwise
    designated in writing by the copyright owner as "Not a Contribution."

    "Contributor" shall mean Licensor and any individual or Legal Entity
    on behalf of whom a Contribution has been received by Licensor and
    subsequently incorporated within the Work.

2.  Grant of Copyright License. Subject to the terms and conditions of
    this License, each Contributor hereby grants to You a perpetual,
    worldwide, non-exclusive, no-charge, royalty-free, irrevocable
    copyright license to reproduce, prepare Derivative Works of,
    publicly display, publicly perform, sublicense, and distribute the
    Work and such Derivative Works in Source or Object form.

3.  Grant of Patent License. Subject to the terms and conditions of
    this License, each Contributor hereby grants to You a perpetual,
    worldwide, non-exclusive, no-charge, royalty-free, irrevocable
    (except as stated in this section) patent license to make, have made,
    use, offer to sell, sell, import, and otherwise transfer the Work,
    where such license applies only to those patent claims licensable
    by such Contributor that are necessarily infringed by their
    Contribution(s) alone or by combination of their Contribution(s)
    with the Work to which such Contribution(s) was submitted. If You
    institute patent litigation against any entity (including a
    cross-claim or counterclaim in a lawsuit) alleging that the Work
    or a Contribution incorporated within the Work constitutes direct
    or contributory patent infringement, then any patent licenses
    granted to You under this License for that Work shall terminate
    as of the date such litigation is filed.

4.  Redistribution. You may reproduce and distribute copies of the
    Work or Derivative Works thereof in any medium, with or without
    modifications, and in Source or Object form, provided that You
    meet the following conditions:

    (a) You must give any other recipients of the Work or
    Derivative Works a copy of this License; and

    (b) You must cause any modified files to carry prominent notices
    stating that You changed the files; and

    (c) You must retain, in the Source form of any Derivative Works
    that You distribute, all copyright, patent, trademark, and
    attribution notices from the Source form of the Work,
    excluding those notices that do not pertain to any part of
    the Derivative Works; and

    (d) If the Work includes a "NOTICE" text file as part of its
    distribution, then any Derivative Works that You distribute must
    include a readable copy of the attribution notices contained
    within such NOTICE file, excluding those notices that do not
    pertain to any part of the Derivative Works, in at least one
    of the following places: within a NOTICE text file distributed
    as part of the Derivative Works; within the Source form or
    documentation, if provided along with the Derivative Works; or,
    within a display generated by the Derivative Works, if and
    wherever such third-party notices normally appear. The contents
    of the NOTICE file are for informational purposes only and
    do not modify the License. You may add Your own attribution
    notices within Derivative Works that You distribute, alongside
    or as an addendum to the NOTICE text from the Work, provided
    that such additional attribution notices cannot be construed
    as modifying the License.

    You may add Your own copyright statement to Your modifications and
    may provide additional or different license terms and conditions
    for use, reproduction, or distribution of Your modifications, or
    for any such Derivative Works as a whole, provided Your use,
    reproduction, and distribution of the Work otherwise complies with
    the conditions stated in this License.

5.  Submission of Contributions. Unless You explicitly state otherwise,
    any Contribution intentionally submitted for inclusion in the Work
    by You to the Licensor shall be under the terms and conditions of
    this License, without any additional terms or conditions.
    Notwithstanding the above, nothing herein shall supersede or modify
    the terms of any separate license agreement you may have executed
    with Licensor regarding such Contributions.

6.  Trademarks. This License does not grant permission to use the trade
    names, trademarks, service marks, or product names of the Licensor,
    except as required for reasonable and customary use in describing the
    origin of the Work and reproducing the content of the NOTICE file.

7.  Disclaimer of Warranty. Unless required by applicable law or
    agreed to in writing, Licensor provides the Work (and each
    Contributor provides its Contributions) on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
    implied, including, without limitation, any warranties or conditions
    of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A
    PARTICULAR PURPOSE. You are solely responsible for determining the
    appropriateness of using or redistributing the Work and assume any
    risks associated with Your exercise of permissions under this License.

8.  Limitation of Liability. In no event and under no legal theory,
    whether in tort (including negligence), contract, or otherwise,
    unless required by applicable law (such as deliberate and grossly
    negligent acts) or agreed to in writing, shall any Contributor be
    liable to You for damages, including any direct, indirect, special,
    incidental, or consequential damages of any character arising as a
    result of this License or out of the use or inability to use the
    Work (including but not limited to damages for loss of goodwill,
    work stoppage, computer failure or malfunction, or any and all
    other commercial damages or losses), even if such Contributor
    has been advised of the possibility of such damages.

9.  Accepting Warranty or Additional Liability. While redistributing
    the Work or Derivative Works thereof, You may choose to offer,
    and charge a fee for, acceptance of support, warranty, indemnity,
    or other liability obligations and/or rights consistent with this
    License. However, in accepting such obligations, You may act only
    on Your own behalf and on Your sole responsibility, not on behalf
    of any other Contributor, and only if You agree to indemnify,
    defend, and hold each Contributor harmless for any liability
    incurred by, or claims asserted against, such Contributor by reason
    of your accepting any such warranty or additional liability.

END OF TERMS AND CONDITIONS

APPENDIX: How to apply the Apache License to your work.

    To apply the Apache License to your work, attach the following
    boilerplate notice, with the fields enclosed by brackets "[]"
    replaced with your own identifying information. (Don't include
    the brackets!)  The text should be enclosed in the appropriate
    comment syntax for the file format. We also recommend that a
    file or class name and description of purpose be included on the
    same "printed page" as the copyright notice for easier
    identification within third-party archives.

Copyright [yyyy] [name of copyright owner]

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
