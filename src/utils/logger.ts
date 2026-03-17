/**
 * @file Structured Logger Utility
 * @description Production-ready logging system with different severity levels
 */

/**
 * Log Levels (RFC 5424 Syslog Protocol)
 */
export enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG',
}

/**
 * Structured log entry format
 */
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  metadata?: Record<string, any>;
}

/**
 * Logger Class with structured output
 * In production, this would integrate with ELK Stack, Datadog, or CloudWatch
 */
class Logger {
  private formatMessage(
    level: LogLevel,
    message: string,
    metadata?: Record<string, any>
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(metadata && { metadata }),
    };
  }

  /**
   * Logs informational messages (normal operation)
   */
  info(message: string, metadata?: Record<string, any>): void {
    const entry = this.formatMessage(LogLevel.INFO, message, metadata);
    console.log(JSON.stringify(entry));
  }

  /**
   * Logs warning messages (potentially harmful situations)
   */
  warn(message: string, metadata?: Record<string, any>): void {
    const entry = this.formatMessage(LogLevel.WARN, message, metadata);
    console.warn(JSON.stringify(entry));
  }

  /**
   * Logs error messages (error events that might still allow operation)
   */
  error(message: string, error?: Error, metadata?: Record<string, any>): void {
    const entry = this.formatMessage(LogLevel.ERROR, message, {
      ...metadata,
      ...(error && {
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name,
        },
      }),
    });
    console.error(JSON.stringify(entry));
  }

  /**
   * Logs debug messages (fine-grained informational events)
   */
  debug(message: string, metadata?: Record<string, any>): void {
    if (process.env.NODE_ENV === 'development') {
      const entry = this.formatMessage(LogLevel.DEBUG, message, metadata);
      console.debug(JSON.stringify(entry));
    }
  }
}

// Export singleton logger instance
export const logger = new Logger();
