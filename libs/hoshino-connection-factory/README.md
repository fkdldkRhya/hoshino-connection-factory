# Hoshino Connection Factory

A NestJS library for creating database connections for MySQL and MongoDB using Prisma with support for multi-tenancy and single-tenancy.

## Installation

```bash
npm install @hoshino-nestjs-libraries/hoshino-connection-factory
```

## Features

- Support for MySQL and MongoDB databases
- Multi-tenancy support
- Single-tenancy support
- Custom Prisma client support
- NestJS module integration

## Usage

### Module Registration

You can register the module in two ways:

1. **ForRoot** - For registering in the root application module:

```typescript
import { HoshinoConnectionFactoryModule } from '@hoshino-nestjs-libraries/hoshino-connection-factory';
import { PrismaClient } from './generated/client'; // Import from your generated Prisma client

@Module({
  imports: [
    HoshinoConnectionFactoryModule.forRoot({
      connectionOptions: {
        type: 'mysql', // or 'mongodb'
        url: 'mysql://user:password@localhost:3306/mydb',
        multiTenancy: false, // Set to true for multi-tenancy support
        // Provide a factory function that returns a Prisma client instance (REQUIRED)
        clientFactory: async () => {
          // Create your own Prisma client instance
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
      isGlobal: true, // Optional - make the module global
    }),
  ],
})
export class AppModule {}
```

2. **ForFeature** - For registering in feature modules:

```typescript
import { HoshinoConnectionFactoryModule } from '@hoshino-nestjs-libraries/hoshino-connection-factory';
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

### Providing Your Own Prisma Client

This library requires you to provide your own Prisma client factory function. This approach avoids issues with Prisma client generation and gives you full control over how the Prisma client is created and configured.

```typescript
import { PrismaClient } from './generated/client'; // Import from your generated Prisma client

@Module({
  imports: [
    HoshinoConnectionFactoryModule.forRoot({
      connectionOptions: {
        type: 'mysql',
        url: 'mysql://user:password@localhost:3306/mydb',
        // Provide a factory function that returns a Prisma client instance
        clientFactory: async () => {
          // Create your own Prisma client instance
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
      isGlobal: true,
    }),
  ],
})
export class AppModule {}
```

#### Multiple Client Types

You can provide different client factories for different connections:

```typescript
// MySQL connection with custom client
await connectionService.createConnection('mysql', {
  type: 'mysql',
  url: 'mysql://user:password@localhost:3306/mysqldb',
  clientFactory: async () => {
    // Import from your generated MySQL client
    const { PrismaClient } = require('./generated/mysql-client');
    return new PrismaClient();
  },
});

// MongoDB connection with custom client
await connectionService.createConnection('mongodb', {
  type: 'mongodb',
  url: 'mongodb://user:password@localhost:27017/mongodb',
  clientFactory: async () => {
    // Import from your generated MongoDB client
    const { PrismaClient } = require('./generated/mongodb-client');
    return new PrismaClient();
  },
});
```

### Managing Multiple Connections

You can create and manage multiple database connections simultaneously using the `ConnectionService`:

#### Creating Multiple Connections

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConnectionService } from '@hoshino-nestjs-libraries/hoshino-connection-factory';
import { PrismaClient as MySqlClient } from './generated/mysql-client';
import { PrismaClient as MongoDbClient } from './generated/mongodb-client';

@Injectable()
export class DatabaseService implements OnModuleInit {
  constructor(private readonly connectionService: ConnectionService) {}

  async onModuleInit() {
    // The default connection is already created from the module options

    // Create a MySQL connection
    await this.connectionService.createConnection('mysql', {
      type: 'mysql',
      url: 'mysql://user:password@localhost:3306/mysqldb',
      clientFactory: async () => {
        const client = new MySqlClient();
        await client.$connect();
        return client;
      },
    });

    // Create a MongoDB connection
    await this.connectionService.createConnection('mongodb', {
      type: 'mongodb',
      url: 'mongodb://user:password@localhost:27017/mongodb',
      clientFactory: async () => {
        const client = new MongoDbClient();
        await client.$connect();
        return client;
      },
    });
  }

  getMySqlClient() {
    return this.connectionService.getConnection('mysql').getClient();
  }

  getMongoDbClient() {
    return this.connectionService.getConnection('mongodb').getClient();
  }
}
```

#### Using Different Connections in Services

```typescript
import { Injectable } from '@nestjs/common';
import { ConnectionService } from '@hoshino-nestjs-libraries/hoshino-connection-factory';

@Injectable()
export class UserService {
  constructor(private readonly connectionService: ConnectionService) {}

  async findUsers() {
    // Use MySQL connection
    const mySqlClient = this.connectionService.getConnection('mysql').getClient();
    const mySqlUsers = await mySqlClient.user.findMany();

    // Use MongoDB connection
    const mongoDbClient = this.connectionService.getConnection('mongodb').getClient();
    const mongoDbUsers = await mongoDbClient.user.findMany();

    return {
      mySqlUsers,
      mongoDbUsers,
    };
  }
}
```

#### Connecting to Multiple Databases of the Same Type

You can also create multiple connections to the same type of database:

```typescript
// Create multiple MySQL connections
await this.connectionService.createConnection('mysql1', {
  type: 'mysql',
  url: 'mysql://user:password@localhost:3306/db1',
  clientFactory: async () => {
    return new PrismaClient({
      datasources: { db: { url: 'mysql://user:password@localhost:3306/db1' } },
    });
  },
});

await this.connectionService.createConnection('mysql2', {
  type: 'mysql',
  url: 'mysql://user:password@localhost:3306/db2',
  clientFactory: async () => {
    return new PrismaClient({
      datasources: { db: { url: 'mysql://user:password@localhost:3306/db2' } },
    });
  },
});

// Use each connection separately
const client1 = this.connectionService.getConnection('mysql1').getClient();
const client2 = this.connectionService.getConnection('mysql2').getClient();
```

### Using the Connection Service

```typescript
import { Injectable } from '@nestjs/common';
import { ConnectionService } from '@hoshino-nestjs-libraries/hoshino-connection-factory';
import { PrismaClient } from './generated/client';

@Injectable()
export class MyService {
  constructor(private readonly connectionService: ConnectionService) {}

  async doSomething() {
    // Get the default connection
    const connection = this.connectionService.getConnection();

    // Get the Prisma client
    const client = connection.getClient();

    // Use the client to query the database
    const users = await client.user.findMany();

    return users;
  }

  async createTenantConnection(tenantId: string) {
    // Create a new connection for a tenant
    await this.connectionService.createConnection(`tenant-${tenantId}`, {
      type: 'mysql',
      url: 'mysql://user:password@localhost:3306/mydb',
      multiTenancy: true,
      tenantId,
      clientFactory: async () => {
        const client = new PrismaClient();
        await client.$connect();
        return client;
      },
    });

    // Get the tenant connection
    const tenantConnection = this.connectionService.getConnection(`tenant-${tenantId}`);

    // Use the tenant connection
    const tenantClient = tenantConnection.getClient();

    return tenantClient;
  }
}
```

## Multi-tenancy Support

For multi-tenancy support, the library will append the tenant ID to the database name. For example:

- MySQL: `mydb` -> `mydb_tenant1`
- MongoDB: `mydb` -> `mydb_tenant1`

## License

MIT
