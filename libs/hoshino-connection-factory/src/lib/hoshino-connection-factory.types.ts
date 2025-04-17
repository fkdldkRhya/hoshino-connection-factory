/* eslint-disable @typescript-eslint/no-explicit-any */

// Database type constants for safer type checking
export const DB_TYPES = {
  MYSQL: 'MYSQL',
  MONGO: 'MONGO',
} as const;

// Database client types
export type DatabaseType = 'MONGO' | 'MYSQL';

// Connection tokens for dependency injection
export const getConnectionToken = (name = 'default') =>
  `HOSHINO_CONNECTION_CLIENT_${name.toUpperCase()}`;

// Service token for dependency injection
export const getServiceToken = (name = 'default') => {
  return name === 'default'
    ? 'HoshinoConnectionFactoryService'
    : `HoshinoConnectionFactoryService_${name}`;
};

// Connection pool service token
export const CONNECTION_POOL_SERVICE = 'HOSHINO_CONNECTION_POOL_SERVICE';

// Pool configuration token
export const HOSHINO_CONNECTION_FACTORY_POOL_CONFIG =
  'HOSHINO_CONNECTION_FACTORY_POOL_CONFIG';

// Pool configuration interface
export interface PoolConfig {
  maxRetries?: number;
  healthCheckInterval?: number;
  maxConnectionAge?: number;
  cleanupInterval?: number;
}

// Options interface for the module
export interface HoshinoConnectionOptions<T = any> {
  type: DatabaseType;
  name?: string; // 커넥션 이름 (기본값: 'default')
  clientFactory: () => T | Promise<T>;
  global?: boolean;
}

// Connection events
export enum ConnectionEventEmitter {
  CONNECTION_CREATED = 'connectionCreated',
  CONNECTION_REMOVED = 'connectionRemoved',
  CONNECTION_CREATION_FAILED = 'connectionCreationFailed',
  HEALTH_CHECK_FAILED = 'healthCheckFailed',
  SERVICE_SHUTDOWN = 'serviceShutdown',
  CONNECTION_ERROR = 'connectionError',
}
