/* eslint-disable @typescript-eslint/no-explicit-any */
import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter } from 'events';
import {
  ConnectionEventEmitter,
  DB_TYPES,
  DatabaseType,
  HOSHINO_CONNECTION_FACTORY_POOL_CONFIG,
  PoolConfig,
} from './hoshino-connection-factory.types';
import { HoshinoConnectionFactoryService } from './hoshino-connection-factory.service';
import { HoshinoConnectionFactoryException } from './hoshino-connection-factory.exception';

interface ConnectionEntry<T = any> {
  connection: HoshinoConnectionFactoryService<T>;
  healthCheckTimeout: NodeJS.Timeout | null;
  createdAt: Date;
}

export interface ConnectionOptions<T = any> {
  type: DatabaseType;
  name: string;
  clientFactory: () => Promise<T>;
}

@Injectable()
export class HoshinoConnectionFactoryPoolService implements OnModuleDestroy {
  private readonly logger = new Logger(
    HoshinoConnectionFactoryPoolService.name
  );

  // 연결 관리 (키: 연결 이름)
  private readonly connections = new Map<string, ConnectionEntry<any>>();

  // 연결 생성 Promise 캐싱 (락 대신 사용)
  private readonly connectionCreationPromises = new Map<
    string,
    Promise<ConnectionEntry<any>>
  >();

  // 이벤트 이미터
  public readonly events = new EventEmitter();

  // 설정 옵션
  private readonly maxRetries: number;
  private readonly healthCheckInterval: number;
  private readonly maxConnectionAge: number;
  private readonly cleanupInterval: number;

  // 종료 신호
  private isShuttingDown = false;

  // 정리 타이머
  private cleanupTimer?: NodeJS.Timeout;

  // 메트릭
  private metrics = {
    totalConnections: 0,
    activeConnections: 0,
    failedConnections: 0,
    connectionErrors: 0,
  };

  constructor(
    @Inject(HOSHINO_CONNECTION_FACTORY_POOL_CONFIG)
    readonly config?: PoolConfig
  ) {
    // 설정 초기화
    this.maxRetries = config?.maxRetries ?? 3;
    this.healthCheckInterval = config?.healthCheckInterval ?? 15000; // 15초
    this.maxConnectionAge = config?.maxConnectionAge ?? 3600000; // 1시간
    this.cleanupInterval = config?.cleanupInterval ?? 60000; // 1분

    // 정리 타이머 시작
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldConnections();
      this.logMetrics();
    }, this.cleanupInterval);

    this.logger.log(
      `HoshinoConnectionFactoryPoolService initialized with healthCheckInterval: ${this.healthCheckInterval}, maxRetries: ${this.maxRetries}, maxConnectionAge: ${this.maxConnectionAge}`
    );
  }

  /**
   * 메트릭 정보를 로깅합니다.
   */
  private logMetrics(): void {
    this.logger.debug(
      `HoshinoConnectionFactoryPoolService Metrics - totalConnections: ${this.metrics.totalConnections}, activeConnections: ${this.metrics.activeConnections}, failedConnections: ${this.metrics.failedConnections}, connectionErrors: ${this.metrics.connectionErrors}`
    );
  }

  /**
   * 연결이 만료되었는지 확인합니다.
   */
  private isConnectionExpired(createdAt: Date): boolean {
    return Date.now() - createdAt.getTime() > this.maxConnectionAge;
  }

  /**
   * 지정된 이름의 연결을 가져옵니다.
   * 연결이 없거나 만료된 경우, 생성을 요청합니다.
   */
  async getConnection<T = any>(
    name: string
  ): Promise<HoshinoConnectionFactoryService<T>> {
    this.checkServiceActive();

    const existingEntry = this.connections.get(name);
    if (existingEntry && !this.isConnectionExpired(existingEntry.createdAt)) {
      return existingEntry.connection as HoshinoConnectionFactoryService<T>;
    }

    // 새 연결 생성 중인 Promise가 있다면 사용
    const creationPromise = this.connectionCreationPromises.get(name);
    if (!creationPromise) {
      throw HoshinoConnectionFactoryException.connectionError(
        `Connection with name '${name}' does not exist and no creation request is active`,
        null,
        { name }
      );
    }

    try {
      const newEntry = await creationPromise;
      return newEntry.connection as HoshinoConnectionFactoryService<T>;
    } catch (error) {
      throw HoshinoConnectionFactoryException.connectionError(
        `Failed to get connection for '${name}'`,
        error,
        { name }
      );
    }
  }

  /**
   * 서비스 활성 상태를 확인합니다.
   */
  private checkServiceActive(): void {
    if (this.isShuttingDown) {
      throw HoshinoConnectionFactoryException.connectionError(
        'Service is shutting down',
        null
      );
    }
  }

  /**
   * 새로운 연결을 생성합니다. 이미 존재한다면 기존 연결을 반환합니다.
   */
  async createConnection<T = any>(
    options: ConnectionOptions<T>
  ): Promise<void> {
    this.checkServiceActive();

    const { name } = options;

    // 이미 활성 연결이 있는지 확인
    const existingEntry = this.connections.get(name);
    if (existingEntry && !this.isConnectionExpired(existingEntry.createdAt)) {
      return;
    }

    // 이미 연결 생성이 진행 중인지 확인
    let creationPromise = this.connectionCreationPromises.get(name);
    if (!creationPromise) {
      this.logger.verbose(`Creating new connection: ${name}`);

      creationPromise = this.initializeConnection<T>(options);
      this.connectionCreationPromises.set(name, creationPromise);

      this.handleConnectionCreation(name, creationPromise);
    }

    try {
      await creationPromise;
    } catch (error) {
      throw HoshinoConnectionFactoryException.connectionError(
        `Failed to create connection for '${name}'`,
        error,
        { name, options }
      );
    }
  }

  /**
   * 연결 생성 프로세스를 처리합니다.
   */
  private handleConnectionCreation<T>(
    name: string,
    creationPromise: Promise<ConnectionEntry<T>>
  ): void {
    creationPromise
      .then((entry) => {
        this.connections.set(name, entry as ConnectionEntry<any>);
        this.connectionCreationPromises.delete(name);
        this.logger.verbose(`Connection created successfully: ${name}`);
        this.events.emit(ConnectionEventEmitter.CONNECTION_CREATED, name);
      })
      .catch((error) => {
        this.connectionCreationPromises.delete(name);
        const connectionError =
          HoshinoConnectionFactoryException.connectionError(
            `Failed to create connection for ${name}`,
            error,
            { name }
          );
        this.logger.error(
          `${connectionError.message} - original error: ${
            error?.message ?? JSON.stringify(error)
          }`
        );
        this.events.emit(ConnectionEventEmitter.CONNECTION_CREATION_FAILED, {
          name,
          error: connectionError,
        });
        this.events.emit(
          ConnectionEventEmitter.CONNECTION_ERROR,
          connectionError
        );
      });
  }

  /**
   * 연결을 초기화합니다.
   */
  private async initializeConnection<T = any>(
    options: ConnectionOptions<T>
  ): Promise<ConnectionEntry<T>> {
    try {
      const { name, type, clientFactory } = options;

      // 클라이언트 생성
      this.logger.debug(`Initializing connection: ${name} - type: ${type}`);

      const connection = await this.createConnectionWithRetry<T>({
        name,
        type,
        clientFactory,
      });

      // 헬스 체크 타이머 설정
      const healthCheckTimeout = this.setupHealthCheck(name, connection);

      this.metrics.totalConnections++;
      this.metrics.activeConnections++;

      return {
        connection,
        healthCheckTimeout,
        createdAt: new Date(),
      };
    } catch (error) {
      throw HoshinoConnectionFactoryException.connectionError(
        `Failed to initialize connection for '${options.name}'`,
        error,
        { options }
      );
    }
  }

  /**
   * 헬스 체크를 설정합니다.
   */
  private setupHealthCheck<T>(
    name: string,
    connection: HoshinoConnectionFactoryService<T>
  ): NodeJS.Timeout {
    return setInterval(async () => {
      try {
        this.logger.debug(`Health check for ${name}`);
        if (!(await this.validateConnection(connection))) {
          this.logger.warn(`Unhealthy connection detected for ${name}`);
          const validationError =
            HoshinoConnectionFactoryException.validationError(
              `Health check failed for connection '${name}'`,
              null,
              { name, connection }
            );
          this.emitHealthCheckFailure(name, connection, validationError);
          await this.removeConnection(name);
        }
      } catch (error: any) {
        const validationError =
          HoshinoConnectionFactoryException.validationError(
            `Error during health check for '${name}'`,
            error,
            { name }
          );
        this.logger.error(
          `${validationError.message} - original error: ${
            error?.message ?? JSON.stringify(error)
          }`
        );

        this.events.emit(
          ConnectionEventEmitter.CONNECTION_ERROR,
          validationError
        );
      }
    }, this.healthCheckInterval);
  }

  /**
   * 헬스 체크 실패 이벤트를 발생시킵니다.
   */
  private emitHealthCheckFailure<T>(
    name: string,
    connection: HoshinoConnectionFactoryService<T>,
    error: Error
  ): void {
    this.events.emit(ConnectionEventEmitter.HEALTH_CHECK_FAILED, {
      name,
      connection,
      error,
    });
    this.events.emit(ConnectionEventEmitter.CONNECTION_ERROR, error);
  }

  /**
   * 연결 상태를 검증합니다.
   */
  private async validateConnection<T = any>(
    connection: HoshinoConnectionFactoryService<T>
  ): Promise<boolean> {
    try {
      const client = connection.getClient();

      // 클라이언트 객체가 있는지 확인
      if (!client) {
        return false;
      }

      const connectionType = connection.getConnectionType();

      if (connectionType === DB_TYPES.MYSQL) {
        // Prisma 클라이언트
        await (client as any).$queryRaw`SELECT 1`;
        return true;
      }

      if (connectionType === DB_TYPES.MONGO) {
        await (client as any).$runCommandRaw({
          ping: 1,
        });
        return true;
      }

      // 기본 체크: 객체가 존재하는지만 확인
      return true;
    } catch (error: any) {
      const connectionName = connection.getConnectionName();
      const validationError = HoshinoConnectionFactoryException.validationError(
        `Connection validation failed for ${connectionName}`,
        error,
        {
          connectionName,
          type: connection.getConnectionType(),
        }
      );
      this.logger.warn(
        `${validationError.message} - original error: ${
          error?.message ?? JSON.stringify(error)
        }`
      );
      this.events.emit(
        ConnectionEventEmitter.CONNECTION_ERROR,
        validationError
      );
      return false;
    }
  }

  /**
   * 연결을 제거합니다.
   */
  async removeConnection(name: string): Promise<void> {
    const entry = this.connections.get(name);
    if (!entry) return;

    try {
      this.logger.log(`Removing connection: ${name}`);

      if (entry.healthCheckTimeout) {
        clearInterval(entry.healthCheckTimeout);
      }

      await this.disconnectClient(entry.connection.getClient());

      this.connections.delete(name);
      this.metrics.activeConnections--;
      this.events.emit(ConnectionEventEmitter.CONNECTION_REMOVED, name);
      this.logger.log(`Connection removed: ${name}`);
    } catch (error: any) {
      const disposalError = HoshinoConnectionFactoryException.disposalError(
        `Error removing connection for ${name}`,
        error,
        { name }
      );
      this.logger.error(
        `${disposalError.message} - original error: ${error?.message}`
      );
      this.events.emit(ConnectionEventEmitter.CONNECTION_ERROR, disposalError);
    }
  }

  /**
   * 클라이언트 연결을 종료합니다.
   */
  private async disconnectClient(client: any): Promise<void> {
    if (!client) return;

    if (typeof client.$disconnect === 'function') {
      await client.$disconnect();
    } else if (typeof client.close === 'function') {
      await client.close();
    } else if (typeof client.end === 'function') {
      await client.end();
    }
  }

  /**
   * 오래된 연결을 정리합니다.
   */
  private async cleanupOldConnections(): Promise<void> {
    try {
      const oldConnections: string[] = [];

      for (const [name, entry] of this.connections.entries()) {
        if (this.isConnectionExpired(entry.createdAt)) {
          oldConnections.push(name);
        }
      }

      if (oldConnections.length > 0) {
        this.logger.log(`Cleaning up ${oldConnections.length} old connections`);

        for (const name of oldConnections) {
          await this.removeConnection(name);
        }
      }
    } catch (error: any) {
      const disposalError = HoshinoConnectionFactoryException.disposalError(
        'Error during old connections cleanup',
        error
      );
      this.logger.error(
        `${disposalError.message} - original error: ${
          error?.message ?? JSON.stringify(error)
        }`
      );
      this.events.emit(ConnectionEventEmitter.CONNECTION_ERROR, disposalError);
    }
  }

  /**
   * 연결을 재시도와 함께 생성합니다.
   */
  private async createConnectionWithRetry<T = any>(
    args: {
      name: string;
      type: DatabaseType;
      clientFactory: () => Promise<T>;
    },
    attempt = 1
  ): Promise<HoshinoConnectionFactoryService<T>> {
    try {
      return await this.createSingleConnection<T>(args);
    } catch (error: any) {
      const retryError = HoshinoConnectionFactoryException.connectionError(
        `Failed to create connection for ${args.name} on attempt ${attempt}`,
        error,
        { name: args.name, attempt }
      );
      this.logger.error(
        `${retryError.message} - original error: ${
          error?.message ?? JSON.stringify(error)
        }`
      );
      this.events.emit(ConnectionEventEmitter.CONNECTION_ERROR, retryError);

      this.metrics.failedConnections++;
      this.metrics.connectionErrors++;

      if (attempt >= this.maxRetries) {
        throw HoshinoConnectionFactoryException.connectionError(
          `Failed to create connection for ${args.name} after ${this.maxRetries} attempts`,
          error,
          { name: args.name, maxRetries: this.maxRetries }
        );
      }

      const delay = Math.min(100 * Math.pow(2, attempt), 1000);
      this.logger.warn(
        `Retrying connection in ${delay}ms - name: ${
          args.name
        } - attempt: ${attempt} - nextAttempt: ${attempt + 1}`
      );

      await new Promise((resolve) => setTimeout(resolve, delay));

      return this.createConnectionWithRetry<T>(args, attempt + 1);
    }
  }

  /**
   * 단일 연결을 생성합니다.
   */
  private async createSingleConnection<T = any>(args: {
    name: string;
    type: DatabaseType;
    clientFactory: () => Promise<T>;
  }): Promise<HoshinoConnectionFactoryService<T>> {
    const { name, type, clientFactory } = args;

    try {
      this.logger.debug(
        `Creating client for connection: ${name} - type: ${type}`
      );

      // 클라이언트 생성
      const client = await clientFactory();

      // 서비스 인스턴스 생성
      const service = new HoshinoConnectionFactoryService<T>(
        client,
        name,
        type
      );

      this.logger.log(`Connection created for ${name}`);

      return service;
    } catch (error) {
      throw HoshinoConnectionFactoryException.clientInitializationError(
        `Failed to create client for ${name}`,
        error,
        { name, type }
      );
    }
  }

  /**
   * 연결의 존재 여부를 확인합니다.
   */
  hasConnection(name: string): boolean {
    const entry = this.connections.get(name);
    return !!entry && !this.isConnectionExpired(entry.createdAt);
  }

  /**
   * 연결의 상세 정보를 조회합니다.
   */
  getConnectionInfo(name: string): any {
    const entry = this.connections.get(name);
    if (!entry) {
      return null;
    }

    const age = Date.now() - entry.createdAt.getTime();

    return {
      name,
      createdAt: entry.createdAt,
      age,
      isExpired: age > this.maxConnectionAge,
    };
  }

  /**
   * 모든 연결의 정보를 조회합니다.
   */
  getAllConnectionsInfo(): any[] {
    return Array.from(this.connections.entries()).map(([name, entry]) => {
      const age = Date.now() - entry.createdAt.getTime();
      return {
        name,
        createdAt: entry.createdAt,
        age,
        isExpired: age > this.maxConnectionAge,
      };
    });
  }

  /**
   * 메트릭 정보를 조회합니다.
   */
  getMetrics() {
    return { ...this.metrics };
  }

  /**
   * 모듈 종료 시 모든 연결을 정리합니다.
   */
  async onModuleDestroy() {
    try {
      this.logger.log('Service shutting down, cleaning up connections');
      this.isShuttingDown = true;

      // 정리 타이머 중지
      if (this.cleanupTimer) {
        clearInterval(this.cleanupTimer);
      }

      // 모든 연결 종료
      const connectionNames = [...this.connections.keys()];
      for (const name of connectionNames) {
        await this.removeConnection(name);
      }

      this.events.emit(ConnectionEventEmitter.SERVICE_SHUTDOWN);
      this.logger.log('Service shutdown complete');

      // 이벤트 리스너 정리
      this.events.removeAllListeners();
    } catch (error: any) {
      const shutdownError = HoshinoConnectionFactoryException.disposalError(
        'Error during service shutdown',
        error
      );
      this.logger.error(
        `${shutdownError.message} - original error: ${
          error?.message ?? JSON.stringify(error)
        }`
      );
    }
  }
}
