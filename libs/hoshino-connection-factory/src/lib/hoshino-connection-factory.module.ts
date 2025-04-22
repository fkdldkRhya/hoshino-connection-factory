/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { DynamicModule, Module, Provider } from '@nestjs/common';
import { HoshinoConnectionFactoryService } from './hoshino-connection-factory.service';
import { HoshinoConnectionFactoryPoolService } from './hoshino-connection-factory-pool.service';
import { HoshinoConnectionFactoryException } from './hoshino-connection-factory.exception';
import {
  CONNECTION_POOL_SERVICE,
  DatabaseType,
  HOSHINO_CONNECTION_FACTORY_POOL_CONFIG,
  HoshinoConnectionOptions,
  PoolConfig,
  getConnectionToken,
  getServiceToken,
} from './hoshino-connection-factory.types';

@Module({
  providers: [
    {
      provide: CONNECTION_POOL_SERVICE,
      useClass: HoshinoConnectionFactoryPoolService,
    },
    {
      provide: HOSHINO_CONNECTION_FACTORY_POOL_CONFIG,
      useValue: {},
    },
  ],
  exports: [CONNECTION_POOL_SERVICE],
})
export class HoshinoConnectionFactoryModule {
  /**
   * 주입된 서비스 인스턴스를 가져오기 위한 헬퍼 메서드
   */
  static getConnectionService(name = 'default'): any {
    return name === 'default'
      ? HoshinoConnectionFactoryService
      : getServiceToken(name);
  }

  static forRoot<T = any>(options: HoshinoConnectionOptions<T>): DynamicModule {
    const connectionName = options.name || 'default';
    const connectionToken = getConnectionToken(connectionName);
    const serviceToken = getServiceToken(connectionName);

    const connectionProvider: Provider = {
      provide: connectionToken,
      useFactory: async () => {
        if (!['MONGO', 'MYSQL'].includes(options.type)) {
          throw HoshinoConnectionFactoryException.configurationError(
            'Only MONGO or MYSQL database types are supported',
            undefined,
            'HoshinoConnectionFactoryModule.forRoot'
          );
        }

        return await options.clientFactory();
      },
    };

    const serviceProvider: Provider = {
      provide:
        connectionName === 'default'
          ? HoshinoConnectionFactoryService
          : serviceToken,
      useFactory: (client: T) => {
        return new HoshinoConnectionFactoryService<T>(
          client,
          connectionName,
          options.type
        );
      },
      inject: [connectionToken],
    };

    return {
      global: options.global,
      module: HoshinoConnectionFactoryModule,
      providers: [connectionProvider, serviceProvider],
      exports: [
        connectionProvider,
        connectionName === 'default'
          ? HoshinoConnectionFactoryService
          : serviceToken,
        CONNECTION_POOL_SERVICE,
      ],
    };
  }

  static forRootAsync<T = any>(options: {
    global?: boolean;
    type: DatabaseType;
    name?: string; // 커넥션 이름 (기본값: 'default')
    useFactory: (...args: any[]) => Promise<T>;
    inject?: any[];
  }): DynamicModule {
    const connectionName = options.name || 'default';
    const connectionToken = getConnectionToken(connectionName);
    const serviceToken = getServiceToken(connectionName);

    const connectionProvider: Provider = {
      provide: connectionToken,
      useFactory: async (...args: any[]) => {
        if (!['MONGO', 'MYSQL'].includes(options.type)) {
          throw HoshinoConnectionFactoryException.configurationError(
            'Only MONGO or MYSQL database types are supported',
            undefined,
            'HoshinoConnectionFactoryModule.forRootAsync'
          );
        }

        return await options.useFactory(...args);
      },
      inject: options.inject || [],
    };

    const serviceProvider: Provider = {
      provide:
        connectionName === 'default'
          ? HoshinoConnectionFactoryService
          : serviceToken,
      useFactory: (client: T) => {
        return new HoshinoConnectionFactoryService<T>(
          client,
          connectionName,
          options.type
        );
      },
      inject: [connectionToken],
    };

    return {
      global: options.global,
      module: HoshinoConnectionFactoryModule,
      providers: [connectionProvider, serviceProvider],
      exports: [
        connectionProvider,
        connectionName === 'default'
          ? HoshinoConnectionFactoryService
          : serviceToken,
        CONNECTION_POOL_SERVICE,
      ],
    };
  }

  /**
   * 커넥션 풀의 설정을 위한 정적 메서드
   */
  static forPoolConfig(config: PoolConfig): DynamicModule {
    return {
      module: HoshinoConnectionFactoryModule,
      providers: [
        {
          provide: HOSHINO_CONNECTION_FACTORY_POOL_CONFIG,
          useValue: config,
        },
        {
          provide: CONNECTION_POOL_SERVICE,
          useClass: HoshinoConnectionFactoryPoolService,
        },
      ],
      exports: [CONNECTION_POOL_SERVICE],
    };
  }

  /**
   * 커넥션 풀의 설정을 비동기적으로 설정하기 위한 정적 메서드
   */
  static forPoolConfigAsync(options: {
    useFactory: (...args: any[]) => Promise<PoolConfig> | PoolConfig;
    inject?: any[];
    global?: boolean;
  }): DynamicModule {
    return {
      global: options.global,
      module: HoshinoConnectionFactoryModule,
      providers: [
        {
          provide: HOSHINO_CONNECTION_FACTORY_POOL_CONFIG,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        {
          provide: CONNECTION_POOL_SERVICE,
          useClass: HoshinoConnectionFactoryPoolService,
        },
      ],
      exports: [CONNECTION_POOL_SERVICE],
    };
  }

  /**
   * 데이터베이스 연결과 풀 설정을 한번에 설정하는 정적 메서드
   */
  static forFeature<T = any>(options: {
    global?: boolean;
    connection: HoshinoConnectionOptions<T>;
    poolConfig?: PoolConfig;
  }): DynamicModule {
    const { connection, poolConfig = {}, global = false } = options;
    const connectionName = connection.name || 'default';
    const connectionToken = getConnectionToken(connectionName);
    const serviceToken = getServiceToken(connectionName);

    const connectionProvider: Provider = {
      provide: connectionToken,
      useFactory: async () => {
        if (!['MONGO', 'MYSQL'].includes(connection.type)) {
          throw HoshinoConnectionFactoryException.configurationError(
            'Only MONGO or MYSQL database types are supported',
            undefined,
            'HoshinoConnectionFactoryModule.forFeature'
          );
        }

        return await connection.clientFactory();
      },
    };

    const serviceProvider: Provider = {
      provide:
        connectionName === 'default'
          ? HoshinoConnectionFactoryService
          : serviceToken,
      useFactory: (client: T) => {
        return new HoshinoConnectionFactoryService<T>(
          client,
          connectionName,
          connection.type
        );
      },
      inject: [connectionToken],
    };

    return {
      global: options.global,
      module: HoshinoConnectionFactoryModule,
      providers: [
        connectionProvider,
        serviceProvider,
        {
          provide: HOSHINO_CONNECTION_FACTORY_POOL_CONFIG,
          useValue: poolConfig,
        },
        {
          provide: CONNECTION_POOL_SERVICE,
          useClass: HoshinoConnectionFactoryPoolService,
        },
      ],
      exports: [
        connectionProvider,
        connectionName === 'default'
          ? HoshinoConnectionFactoryService
          : serviceToken,
        CONNECTION_POOL_SERVICE,
      ],
    };
  }

  /**
   * 데이터베이스 연결과 풀 설정을 한번에 비동기적으로 설정하는 정적 메서드
   */
  static forFeatureAsync<T = any>(options: {
    global?: boolean;
    connection: {
      type: DatabaseType;
      name?: string;
      useFactory: (...args: any[]) => Promise<T>;
      inject?: any[];
    };
    poolConfig?: {
      useFactory: (...args: any[]) => Promise<PoolConfig> | PoolConfig;
      inject?: any[];
    };
  }): DynamicModule {
    const { connection, poolConfig } = options;
    const connectionName = connection.name || 'default';
    const connectionToken = getConnectionToken(connectionName);
    const serviceToken = getServiceToken(connectionName);

    const connectionProvider: Provider = {
      provide: connectionToken,
      useFactory: async (...args: any[]) => {
        if (!['MONGO', 'MYSQL'].includes(connection.type)) {
          throw HoshinoConnectionFactoryException.configurationError(
            'Only MONGO or MYSQL database types are supported',
            undefined,
            'HoshinoConnectionFactoryModule.forFeatureAsync'
          );
        }

        return await connection.useFactory(...args);
      },
      inject: connection.inject || [],
    };

    const serviceProvider: Provider = {
      provide:
        connectionName === 'default'
          ? HoshinoConnectionFactoryService
          : serviceToken,
      useFactory: (client: T) => {
        return new HoshinoConnectionFactoryService<T>(
          client,
          connectionName,
          connection.type
        );
      },
      inject: [connectionToken],
    };

    const providers: Provider[] = [
      connectionProvider,
      serviceProvider,
      {
        provide: CONNECTION_POOL_SERVICE,
        useClass: HoshinoConnectionFactoryPoolService,
      },
    ];

    if (poolConfig) {
      providers.push({
        provide: HOSHINO_CONNECTION_FACTORY_POOL_CONFIG,
        useFactory: poolConfig.useFactory,
        inject: poolConfig.inject || [],
      });
    } else {
      providers.push({
        provide: HOSHINO_CONNECTION_FACTORY_POOL_CONFIG,
        useValue: {},
      });
    }

    return {
      global: options.global,
      module: HoshinoConnectionFactoryModule,
      providers,
      exports: [
        connectionProvider,
        connectionName === 'default'
          ? HoshinoConnectionFactoryService
          : serviceToken,
        CONNECTION_POOL_SERVICE,
      ],
    };
  }
}
