export class HoshinoConnectionFactoryException extends Error {
  constructor(
    message: string,
    readonly originalError?: unknown,
    readonly context?: unknown
  ) {
    super(message);
    this.name = 'HoshinoConnectionFactoryException';

    // 스택 트레이스 캡처
    Error.captureStackTrace(this, this.constructor);

    // 원본 에러의 스택을 포함 (가능한 경우)
    if (originalError instanceof Error && originalError.stack) {
      this.stack = `${this.stack}\nCaused by: ${originalError.stack}`;
    }
  }

  /**
   * 연결 관련 예외를 생성합니다.
   */
  static connectionError(
    message: string,
    originalError?: unknown,
    context?: unknown
  ): HoshinoConnectionFactoryException {
    return new HoshinoConnectionFactoryException(
      `Connection error: ${message}`,
      originalError,
      context
    );
  }

  /**
   * 클라이언트 초기화 관련 예외를 생성합니다.
   */
  static clientInitializationError(
    message: string,
    originalError?: unknown,
    context?: unknown
  ): HoshinoConnectionFactoryException {
    return new HoshinoConnectionFactoryException(
      `Client initialization error: ${message}`,
      originalError,
      context
    );
  }

  /**
   * 연결 검증 관련 예외를 생성합니다.
   */
  static validationError(
    message: string,
    originalError?: unknown,
    context?: unknown
  ): HoshinoConnectionFactoryException {
    return new HoshinoConnectionFactoryException(
      `Validation error: ${message}`,
      originalError,
      context
    );
  }

  /**
   * 리소스 해제 관련 예외를 생성합니다.
   */
  static disposalError(
    message: string,
    originalError?: unknown,
    context?: unknown
  ): HoshinoConnectionFactoryException {
    return new HoshinoConnectionFactoryException(
      `Resource disposal error: ${message}`,
      originalError,
      context
    );
  }

  /**
   * 설정 관련 예외를 생성합니다.
   */
  static configurationError(
    message: string,
    originalError?: unknown,
    context?: unknown
  ): HoshinoConnectionFactoryException {
    return new HoshinoConnectionFactoryException(
      `Configuration error: ${message}`,
      originalError,
      context
    );
  }

  /**
   * 테넌트 관련 예외를 생성합니다.
   */
  static tenantError(
    message: string,
    originalError?: unknown,
    context?: unknown
  ): HoshinoConnectionFactoryException {
    return new HoshinoConnectionFactoryException(
      `Tenant error: ${message}`,
      originalError,
      context
    );
  }
}
