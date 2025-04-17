/* eslint-disable @typescript-eslint/no-explicit-any */
import { Logger } from '@nestjs/common';
import { HoshinoConnectionFactoryException } from './hoshino-connection-factory.exception';
import { DatabaseType } from './hoshino-connection-factory.types';

export class HoshinoConnectionFactoryService<T = any> {
  private readonly logger = new Logger(HoshinoConnectionFactoryService.name);
  private readonly client: T;
  private readonly connectionName: string;
  private readonly connectionType: DatabaseType;

  constructor(client: T, connectionName: string, connectionType: DatabaseType) {
    if (!client) {
      throw HoshinoConnectionFactoryException.configurationError(
        'Client cannot be null or undefined',
        null,
        `${HoshinoConnectionFactoryService.name}.constructor`
      );
    }

    this.client = client;
    this.connectionName = connectionName;
    this.connectionType = connectionType;
    this.logger.log(
      `HoshinoConnectionFactoryService initialized for ${connectionName} - type: ${connectionType}`
    );
  }

  getClient(): T {
    return this.client;
  }

  getConnectionName(): string {
    return this.connectionName;
  }

  getConnectionType(): DatabaseType {
    return this.connectionType;
  }
}
