import { createWriteStream, WriteStream } from 'fs';
import { join } from 'path';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  requestId?: string;
  userId?: string;
  sessionId?: string;
  traceId?: string;
  spanId?: string;
  metadata?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack: string;
  };
}

export interface LoggerConfig {
  level: LogLevel;
  service: string;
  format: 'json' | 'text';
  outputs: Array<{
    type: 'console' | 'file' | 'http';
    config?: any;
  }>;
  enableRequestCorrelation?: boolean;
  enableTracing?: boolean;
  redactSensitiveData?: boolean;
  maxLogFileSize?: number;
  maxLogFiles?: number;
}

export class StructuredLogger {
  private config: LoggerConfig;
  private fileStreams: Map<string, WriteStream> = new Map();
  private context: Record<string, any> = {};
  private sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization', 'cookie', 'session'];

  constructor(config: LoggerConfig) {
    this.config = {
      level: 'info',
      format: 'json',
      enableRequestCorrelation: true,
      enableTracing: false,
      redactSensitiveData: true,
      maxLogFileSize: 100 * 1024 * 1024, // 100MB
      maxLogFiles: 10,
      ...config,
    };

    this.initializeOutputs();
  }

  private initializeOutputs(): void {
    for (const output of this.config.outputs) {
      if (output.type === 'file') {
        this.initializeFileOutput(output.config);
      }
    }
  }

  private initializeFileOutput(config: any): void {
    const logPath = config.path || join(process.cwd(), 'logs', `${this.config.service}.log`);
    const stream = createWriteStream(logPath, { flags: 'a' });
    this.fileStreams.set(logPath, stream);
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['error', 'warn', 'info', 'debug', 'trace'];
    const currentLevelIndex = levels.indexOf(this.config.level);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex <= currentLevelIndex;
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    metadata?: Record<string, any>,
    error?: Error
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.config.service,
      ...this.context,
    };

    if (metadata) {
      entry.metadata = this.config.redactSensitiveData 
        ? this.redactSensitiveData(metadata)
        : metadata;
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack || '',
      };
    }

    return entry;
  }

  private redactSensitiveData(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.redactSensitiveData(item));
    }

    const redacted = { ...data };
    for (const [key, value] of Object.entries(redacted)) {
      const lowerKey = key.toLowerCase();
      if (this.sensitiveFields.some(field => lowerKey.includes(field))) {
        redacted[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        redacted[key] = this.redactSensitiveData(value);
      }
    }

    return redacted;
  }

  private formatLogEntry(entry: LogEntry): string {
    if (this.config.format === 'json') {
      return JSON.stringify(entry);
    }

    // Text format
    const timestamp = entry.timestamp;
    const level = entry.level.toUpperCase().padEnd(5);
    const service = entry.service;
    const requestId = entry.requestId ? ` [${entry.requestId}]` : '';
    const userId = entry.userId ? ` {${entry.userId}}` : '';
    
    let logLine = `${timestamp} ${level} [${service}]${requestId}${userId} ${entry.message}`;
    
    if (entry.metadata) {
      logLine += ` | ${JSON.stringify(entry.metadata)}`;
    }
    
    if (entry.error) {
      logLine += `\\n${entry.error.stack}`;
    }
    
    return logLine;
  }

  private writeToOutputs(entry: LogEntry): void {
    const formattedEntry = this.formatLogEntry(entry);

    for (const output of this.config.outputs) {
      switch (output.type) {
        case 'console':
          this.writeToConsole(entry.level, formattedEntry);
          break;
        case 'file':
          this.writeToFile(output.config?.path, formattedEntry);
          break;
        case 'http':
          this.writeToHttp(output.config, entry);
          break;
      }
    }
  }

  private writeToConsole(level: LogLevel, message: string): void {
    switch (level) {
      case 'error':
        console.error(message);
        break;
      case 'warn':
        console.warn(message);
        break;
      case 'debug':
      case 'trace':
        console.debug(message);
        break;
      default:
        console.log(message);
    }
  }

  private writeToFile(path: string, message: string): void {
    const logPath = path || join(process.cwd(), 'logs', `${this.config.service}.log`);
    const stream = this.fileStreams.get(logPath);
    
    if (stream) {
      stream.write(message + '\\n');
    }
  }

  private async writeToHttp(config: any, entry: LogEntry): Promise<void> {
    try {
      const response = await fetch(config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...config.headers,
        },
        body: JSON.stringify(entry),
      });

      if (!response.ok) {
        console.error(`Failed to send log to HTTP endpoint: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to send log to HTTP endpoint:', error);
    }
  }

  // Public logging methods
  error(message: string, metadata?: Record<string, any>, error?: Error): void {
    if (!this.shouldLog('error')) return;
    const entry = this.createLogEntry('error', message, metadata, error);
    this.writeToOutputs(entry);
  }

  warn(message: string, metadata?: Record<string, any>): void {
    if (!this.shouldLog('warn')) return;
    const entry = this.createLogEntry('warn', message, metadata);
    this.writeToOutputs(entry);
  }

  info(message: string, metadata?: Record<string, any>): void {
    if (!this.shouldLog('info')) return;
    const entry = this.createLogEntry('info', message, metadata);
    this.writeToOutputs(entry);
  }

  debug(message: string, metadata?: Record<string, any>): void {
    if (!this.shouldLog('debug')) return;
    const entry = this.createLogEntry('debug', message, metadata);
    this.writeToOutputs(entry);
  }

  trace(message: string, metadata?: Record<string, any>): void {
    if (!this.shouldLog('trace')) return;
    const entry = this.createLogEntry('trace', message, metadata);
    this.writeToOutputs(entry);
  }

  // Context management
  setContext(key: string, value: any): void {
    this.context[key] = value;
  }

  getContext(key: string): any {
    return this.context[key];
  }

  clearContext(): void {
    this.context = {};
  }

  withContext(context: Record<string, any>): StructuredLogger {
    const newLogger = new StructuredLogger(this.config);
    newLogger.context = { ...this.context, ...context };
    return newLogger;
  }

  // Request correlation
  withRequestId(requestId: string): StructuredLogger {
    return this.withContext({ requestId });
  }

  withUserId(userId: string): StructuredLogger {
    return this.withContext({ userId });
  }

  withSessionId(sessionId: string): StructuredLogger {
    return this.withContext({ sessionId });
  }

  withTracing(traceId: string, spanId?: string): StructuredLogger {
    const context: Record<string, any> = { traceId };
    if (spanId) context.spanId = spanId;
    return this.withContext(context);
  }

  // Performance logging
  time(label: string): () => void {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      this.info(`Timer: ${label}`, { duration_ms: duration });
    };
  }

  async timeAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - start;
      this.info(`Async timer: ${label}`, { duration_ms: duration, success: true });
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.error(`Async timer failed: ${label}`, { duration_ms: duration, success: false }, error as Error);
      throw error;
    }
  }

  // API request logging
  logAPIRequest(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    requestSize?: number,
    responseSize?: number,
    userAgent?: string
  ): void {
    const level: LogLevel = statusCode >= 400 ? 'error' : statusCode >= 300 ? 'warn' : 'info';
    
    this.log(level, 'API Request', {
      http: {
        method,
        url,
        status_code: statusCode,
        duration_ms: duration,
        request_size_bytes: requestSize,
        response_size_bytes: responseSize,
        user_agent: userAgent,
      },
    });
  }

  // Database operation logging
  logDatabaseOperation(
    operation: string,
    table: string,
    duration: number,
    rowsAffected?: number,
    success: boolean = true
  ): void {
    const level: LogLevel = success ? 'debug' : 'error';
    
    this.log(level, 'Database Operation', {
      database: {
        operation,
        table,
        duration_ms: duration,
        rows_affected: rowsAffected,
        success,
      },
    });
  }

  // Application event logging
  logApplicationEvent(
    event: string,
    category: string,
    details?: Record<string, any>
  ): void {
    this.info('Application Event', {
      event: {
        name: event,
        category,
        details,
      },
    });
  }

  // Security event logging
  logSecurityEvent(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    details?: Record<string, any>
  ): void {
    const level: LogLevel = severity === 'critical' ? 'error' : severity === 'high' ? 'warn' : 'info';
    
    this.log(level, 'Security Event', {
      security: {
        event,
        severity,
        details,
      },
    });
  }

  // Generic log method
  log(level: LogLevel, message: string, metadata?: Record<string, any>, error?: Error): void {
    if (!this.shouldLog(level)) return;
    const entry = this.createLogEntry(level, message, metadata, error);
    this.writeToOutputs(entry);
  }

  // Cleanup
  close(): void {
    for (const stream of this.fileStreams.values()) {
      stream.end();
    }
    this.fileStreams.clear();
  }
}

// Create default logger instances
export const logger = new StructuredLogger({
  service: 'myco-platform',
  level: process.env.LOG_LEVEL as LogLevel || 'info',
  format: 'json',
  outputs: [
    { type: 'console' },
    { type: 'file', config: { path: join(process.cwd(), 'logs', 'app.log') } },
  ],
});

export const auditLogger = new StructuredLogger({
  service: 'myco-audit',
  level: 'info',
  format: 'json',
  outputs: [
    { type: 'file', config: { path: join(process.cwd(), 'logs', 'audit.log') } },
  ],
  redactSensitiveData: false, // Audit logs need complete information
});

export const securityLogger = new StructuredLogger({
  service: 'myco-security',
  level: 'info',
  format: 'json',
  outputs: [
    { type: 'console' },
    { type: 'file', config: { path: join(process.cwd(), 'logs', 'security.log') } },
  ],
});

export default logger;