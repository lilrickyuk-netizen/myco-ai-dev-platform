import { getAuthData } from "~encore/auth";
import { randomUUID } from "crypto";

export interface LogContext {
  requestId: string;
  userId?: string;
  endpoint?: string;
  method?: string;
  timestamp: Date;
  duration?: number;
  statusCode?: number;
  userAgent?: string;
  ip?: string;
  correlationId?: string;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntry {
  level: LogLevel;
  message: string;
  context: LogContext;
  metadata?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export interface RequestLogEntry extends LogEntry {
  request?: {
    headers?: Record<string, string>;
    body?: any;
    query?: Record<string, string>;
    params?: Record<string, string>;
  };
  response?: {
    statusCode: number;
    body?: any;
    headers?: Record<string, string>;
  };
}

class Logger {
  private static instance: Logger;
  private logLevel: LogLevel = 'info';
  private enableConsoleOutput: boolean = true;
  private enableStructuredOutput: boolean = true;

  private constructor() {
    // Set log level from environment
    const envLogLevel = process.env.LOG_LEVEL?.toLowerCase() as LogLevel;
    if (envLogLevel && ['debug', 'info', 'warn', 'error', 'fatal'].includes(envLogLevel)) {
      this.logLevel = envLogLevel;
    }

    this.enableConsoleOutput = process.env.ENABLE_CONSOLE_LOGGING !== 'false';
    this.enableStructuredOutput = process.env.ENABLE_STRUCTURED_LOGGING !== 'false';
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = ['debug', 'info', 'warn', 'error', 'fatal'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const requestedLevelIndex = levels.indexOf(level);
    return requestedLevelIndex >= currentLevelIndex;
  }

  private formatLogEntry(entry: LogEntry): string {
    if (this.enableStructuredOutput) {
      return JSON.stringify({
        timestamp: entry.context.timestamp.toISOString(),
        level: entry.level.toUpperCase(),
        message: entry.message,
        requestId: entry.context.requestId,
        userId: entry.context.userId,
        endpoint: entry.context.endpoint,
        method: entry.context.method,
        duration: entry.context.duration,
        statusCode: entry.context.statusCode,
        correlationId: entry.context.correlationId,
        metadata: entry.metadata,
        error: entry.error
      });
    } else {
      const timestamp = entry.context.timestamp.toISOString();
      const level = entry.level.toUpperCase().padEnd(5);
      const requestId = entry.context.requestId.substring(0, 8);
      const userPart = entry.context.userId ? `[user:${entry.context.userId.substring(0, 8)}]` : '';
      const endpointPart = entry.context.endpoint ? `[${entry.context.method}:${entry.context.endpoint}]` : '';
      const durationPart = entry.context.duration ? `[${entry.context.duration}ms]` : '';
      
      return `${timestamp} ${level} [req:${requestId}]${userPart}${endpointPart}${durationPart} ${entry.message}`;
    }
  }

  private log(level: LogLevel, message: string, context: Partial<LogContext> = {}, metadata?: Record<string, any>, error?: Error): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const fullContext: LogContext = {
      requestId: context.requestId || randomUUID(),
      timestamp: new Date(),
      ...context
    };

    // Try to get user from auth context if not provided
    if (!fullContext.userId) {
      try {
        const auth = getAuthData();
        if (auth) {
          fullContext.userId = auth.userID;
        }
      } catch {
        // Auth not available, continue without user ID
      }
    }

    const logEntry: LogEntry = {
      level,
      message,
      context: fullContext,
      metadata,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined
    };

    if (this.enableConsoleOutput) {
      const formattedMessage = this.formatLogEntry(logEntry);
      
      switch (level) {
        case 'debug':
          console.debug(formattedMessage);
          break;
        case 'info':
          console.info(formattedMessage);
          break;
        case 'warn':
          console.warn(formattedMessage);
          break;
        case 'error':
        case 'fatal':
          console.error(formattedMessage);
          if (error) {
            console.error(error);
          }
          break;
      }
    }

    // Here you could add additional log handlers like:
    // - Send to external logging service (e.g., LogDNA, Datadog, CloudWatch)
    // - Store in database
    // - Send to metrics collection
  }

  public debug(message: string, context?: Partial<LogContext>, metadata?: Record<string, any>): void {
    this.log('debug', message, context, metadata);
  }

  public info(message: string, context?: Partial<LogContext>, metadata?: Record<string, any>): void {
    this.log('info', message, context, metadata);
  }

  public warn(message: string, context?: Partial<LogContext>, metadata?: Record<string, any>): void {
    this.log('warn', message, context, metadata);
  }

  public error(message: string, error?: Error, context?: Partial<LogContext>, metadata?: Record<string, any>): void {
    this.log('error', message, context, metadata, error);
  }

  public fatal(message: string, error?: Error, context?: Partial<LogContext>, metadata?: Record<string, any>): void {
    this.log('fatal', message, context, metadata, error);
  }
}

// Global logger instance
export const logger = Logger.getInstance();

// Request tracking utilities
const activeRequests = new Map<string, LogContext>();

export function createRequestContext(
  endpoint?: string,
  method?: string,
  userAgent?: string,
  ip?: string,
  correlationId?: string
): LogContext {
  const requestId = randomUUID();
  
  let userId: string | undefined;
  try {
    const auth = getAuthData();
    if (auth) {
      userId = auth.userID;
    }
  } catch {
    // Auth not available
  }

  const context: LogContext = {
    requestId,
    userId,
    endpoint,
    method,
    timestamp: new Date(),
    userAgent,
    ip,
    correlationId
  };

  activeRequests.set(requestId, context);
  return context;
}

export function getRequestContext(requestId: string): LogContext | undefined {
  return activeRequests.get(requestId);
}

export function updateRequestContext(requestId: string, updates: Partial<LogContext>): void {
  const existing = activeRequests.get(requestId);
  if (existing) {
    activeRequests.set(requestId, { ...existing, ...updates });
  }
}

export function completeRequest(requestId: string, statusCode: number): void {
  const context = activeRequests.get(requestId);
  if (context) {
    const duration = Date.now() - context.timestamp.getTime();
    context.duration = duration;
    context.statusCode = statusCode;
    
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    logger.log(level, `Request completed`, context, {
      statusCode,
      duration: `${duration}ms`
    });
    
    activeRequests.delete(requestId);
  }
}

// Structured logging helpers
export function logRequest(
  requestId: string,
  method: string,
  endpoint: string,
  body?: any,
  headers?: Record<string, string>,
  query?: Record<string, string>
): void {
  const context = getRequestContext(requestId);
  logger.info(`Request started`, context, {
    request: {
      method,
      endpoint,
      body: body ? (typeof body === 'string' ? body.substring(0, 1000) : JSON.stringify(body).substring(0, 1000)) : undefined,
      headers: headers ? sanitizeHeaders(headers) : undefined,
      query
    }
  });
}

export function logResponse(
  requestId: string,
  statusCode: number,
  body?: any,
  headers?: Record<string, string>
): void {
  const context = getRequestContext(requestId);
  logger.info(`Response sent`, context, {
    response: {
      statusCode,
      body: body ? (typeof body === 'string' ? body.substring(0, 1000) : JSON.stringify(body).substring(0, 1000)) : undefined,
      headers: headers ? sanitizeHeaders(headers) : undefined
    }
  });
}

export function logBusinessEvent(
  event: string,
  requestId?: string,
  metadata?: Record<string, any>
): void {
  const context = requestId ? getRequestContext(requestId) : undefined;
  logger.info(`Business event: ${event}`, context, metadata);
}

export function logPerformanceMetric(
  metric: string,
  value: number,
  unit: string,
  requestId?: string,
  metadata?: Record<string, any>
): void {
  const context = requestId ? getRequestContext(requestId) : undefined;
  logger.info(`Performance metric: ${metric}`, context, {
    metric,
    value,
    unit,
    ...metadata
  });
}

export function logSecurityEvent(
  event: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  requestId?: string,
  metadata?: Record<string, any>
): void {
  const context = requestId ? getRequestContext(requestId) : undefined;
  const level = severity === 'critical' ? 'fatal' : severity === 'high' ? 'error' : 'warn';
  
  logger.log(level, `Security event: ${event}`, context, {
    securityEvent: event,
    severity,
    ...metadata
  });
}

// Utility functions
function sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
  const sanitized = { ...headers };
  
  // Remove sensitive headers
  const sensitiveHeaders = [
    'authorization',
    'cookie',
    'x-api-key',
    'x-auth-token',
    'authentication'
  ];
  
  sensitiveHeaders.forEach(header => {
    if (sanitized[header.toLowerCase()]) {
      sanitized[header.toLowerCase()] = '[REDACTED]';
    }
  });
  
  return sanitized;
}

// Request tracking decorator
export function withRequestTracking<T extends any[], R>(
  fn: (...args: T) => R | Promise<R>,
  endpoint?: string,
  method?: string
): (...args: T) => R | Promise<R> {
  return (...args: T) => {
    const context = createRequestContext(endpoint, method);
    
    try {
      const result = fn(...args);
      
      if (result instanceof Promise) {
        return result
          .then(value => {
            completeRequest(context.requestId, 200);
            return value;
          })
          .catch(error => {
            logger.error(`Request failed`, error, context);
            completeRequest(context.requestId, 500);
            throw error;
          });
      } else {
        completeRequest(context.requestId, 200);
        return result;
      }
    } catch (error) {
      logger.error(`Request failed`, error as Error, context);
      completeRequest(context.requestId, 500);
      throw error;
    }
  };
}

// Environment-specific configuration
export function configureLogging(config: {
  level?: LogLevel;
  enableConsole?: boolean;
  enableStructured?: boolean;
}): void {
  const loggerInstance = Logger.getInstance() as any;
  
  if (config.level) {
    loggerInstance.logLevel = config.level;
  }
  if (config.enableConsole !== undefined) {
    loggerInstance.enableConsoleOutput = config.enableConsole;
  }
  if (config.enableStructured !== undefined) {
    loggerInstance.enableStructuredOutput = config.enableStructured;
  }
}