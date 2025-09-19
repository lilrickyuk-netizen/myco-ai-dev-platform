/**
 * Enhanced Structured Logger for AI Development Platform
 * Provides consistent, secure, and performance-optimized logging across all services
 */

import winston from 'winston';
import { Request, Response } from 'express';

// Log levels with numeric values for filtering
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  HTTP = 3,
  VERBOSE = 4,
  DEBUG = 5,
  SILLY = 6
}

// Log context interface for structured logging
export interface LogContext {
  requestId?: string;
  userId?: string;
  sessionId?: string;
  traceId?: string;
  spanId?: string;
  operation?: string;
  component?: string;
  environment?: string;
  version?: string;
  [key: string]: any;
}

// Security context for sensitive operations
export interface SecurityContext {
  action: string;
  resource: string;
  permission?: string;
  result: 'success' | 'failure' | 'blocked';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  sourceIp?: string;
  userAgent?: string;
}

// Performance metrics context
export interface PerformanceContext {
  operation: string;
  duration: number;
  memoryUsage?: number;
  cpuUsage?: number;
  responseSize?: number;
  dbQueries?: number;
  cacheHits?: number;
  cacheMisses?: number;
}

// Error context for structured error logging
export interface ErrorContext {
  errorCode?: string;
  errorType?: string;
  stackTrace?: string;
  requestData?: any;
  userContext?: Partial<LogContext>;
}

class StructuredLogger {
  private logger: winston.Logger;
  private defaultContext: LogContext;
  private sensitiveFields = new Set([
    'password', 'token', 'secret', 'key', 'auth', 'credential',
    'ssn', 'creditcard', 'credit_card', 'apikey', 'api_key'
  ]);

  constructor() {
    this.defaultContext = {
      service: process.env.SERVICE_NAME || 'ai-dev-platform',
      environment: process.env.NODE_ENV || 'development',
      version: process.env.APP_VERSION || '1.0.0',
      hostname: process.env.HOSTNAME || 'unknown',
      region: process.env.AWS_REGION || 'us-west-2'
    };

    this.initializeLogger();
  }

  private initializeLogger(): void {
    const logLevel = process.env.LOG_LEVEL || 'info';
    const isProduction = process.env.NODE_ENV === 'production';

    // Custom log format for structured logging
    const structuredFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.printf((info) => {
        // Sanitize sensitive information
        const sanitizedInfo = this.sanitizeLogData(info);
        
        // Add correlation IDs and trace information
        const enrichedInfo = {
          timestamp: info.timestamp,
          level: info.level,
          message: info.message,
          ...this.defaultContext,
          ...sanitizedInfo,
          ...(info.stack && { stackTrace: info.stack })
        };

        return JSON.stringify(enrichedInfo);
      })
    );

    // Console format for development
    const consoleFormat = winston.format.combine(
      winston.format.timestamp({ format: 'HH:mm:ss' }),
      winston.format.colorize(),
      winston.format.printf((info) => {
        const { timestamp, level, message, requestId, operation } = info;
        const context = requestId ? `[${requestId}]` : '';
        const op = operation ? `[${operation}]` : '';
        return `${timestamp} ${level} ${context}${op}: ${message}`;
      })
    );

    const transports: winston.transport[] = [
      new winston.transports.Console({
        format: isProduction ? structuredFormat : consoleFormat,
        level: logLevel
      })
    ];

    // Add file transports for production
    if (isProduction) {
      transports.push(
        new winston.transports.File({
          filename: '/var/log/app/error.log',
          level: 'error',
          format: structuredFormat,
          maxsize: 50 * 1024 * 1024, // 50MB
          maxFiles: 5
        }),
        new winston.transports.File({
          filename: '/var/log/app/combined.log',
          format: structuredFormat,
          maxsize: 100 * 1024 * 1024, // 100MB
          maxFiles: 10
        })
      );
    }

    this.logger = winston.createLogger({
      level: logLevel,
      format: structuredFormat,
      transports,
      exitOnError: false,
      silent: process.env.NODE_ENV === 'test'
    });

    // Handle uncaught exceptions and rejections
    this.logger.exceptions.handle(
      new winston.transports.File({ 
        filename: '/var/log/app/exceptions.log',
        format: structuredFormat 
      })
    );

    this.logger.rejections.handle(
      new winston.transports.File({ 
        filename: '/var/log/app/rejections.log',
        format: structuredFormat 
      })
    );
  }

  private sanitizeLogData(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sanitized = { ...data };

    // Remove or mask sensitive fields
    for (const [key, value] of Object.entries(sanitized)) {
      const lowerKey = key.toLowerCase();
      
      if (this.sensitiveFields.has(lowerKey) || this.isSensitiveValue(key, value)) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeLogData(value);
      }
    }

    return sanitized;
  }

  private isSensitiveValue(key: string, value: any): boolean {
    if (typeof value !== 'string') return false;
    
    // Check for patterns that might indicate sensitive data
    const sensitivePatterns = [
      /^[a-zA-Z0-9+/]+=*$/, // Base64 encoded
      /^[0-9]{13,19}$/, // Credit card numbers
      /^[0-9]{3}-[0-9]{2}-[0-9]{4}$/, // SSN format
      /^sk-[a-zA-Z0-9]{32,}$/, // API key pattern
      /^[a-fA-F0-9]{32,}$/ // Hex encoded secrets
    ];

    return sensitivePatterns.some(pattern => pattern.test(value));
  }

  // Core logging methods
  public error(message: string, context?: LogContext & ErrorContext): void {
    this.logger.error(message, context);
  }

  public warn(message: string, context?: LogContext): void {
    this.logger.warn(message, context);
  }

  public info(message: string, context?: LogContext): void {
    this.logger.info(message, context);
  }

  public debug(message: string, context?: LogContext): void {
    this.logger.debug(message, context);
  }

  public verbose(message: string, context?: LogContext): void {
    this.logger.verbose(message, context);
  }

  // Specialized logging methods
  public security(message: string, securityContext: SecurityContext, context?: LogContext): void {
    this.logger.warn(message, {
      ...context,
      logType: 'security',
      security: securityContext,
      timestamp: new Date().toISOString()
    });
  }

  public performance(message: string, perfContext: PerformanceContext, context?: LogContext): void {
    this.logger.info(message, {
      ...context,
      logType: 'performance',
      performance: perfContext,
      timestamp: new Date().toISOString()
    });
  }

  public audit(message: string, auditContext: any, context?: LogContext): void {
    this.logger.info(message, {
      ...context,
      logType: 'audit',
      audit: auditContext,
      timestamp: new Date().toISOString()
    });
  }

  public business(message: string, businessContext: any, context?: LogContext): void {
    this.logger.info(message, {
      ...context,
      logType: 'business',
      business: businessContext,
      timestamp: new Date().toISOString()
    });
  }

  // HTTP request logging middleware
  public createHttpLogger() {
    return (req: Request, res: Response, next: Function) => {
      const start = Date.now();
      const requestId = req.headers['x-request-id'] || this.generateRequestId();
      
      // Add request ID to request for downstream use
      (req as any).requestId = requestId;

      // Log request start
      this.info('HTTP Request Started', {
        requestId,
        method: req.method,
        url: req.url,
        userAgent: req.headers['user-agent'],
        ip: req.ip || req.connection.remoteAddress,
        headers: this.sanitizeLogData(req.headers)
      });

      // Capture response
      const originalSend = res.send;
      res.send = function(data) {
        const duration = Date.now() - start;
        
        logger.info('HTTP Request Completed', {
          requestId,
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          duration,
          responseSize: data ? Buffer.byteLength(data) : 0
        });

        // Log performance metrics
        if (duration > 1000) { // Log slow requests
          logger.performance('Slow HTTP Request', {
            operation: `${req.method} ${req.url}`,
            duration,
            responseSize: data ? Buffer.byteLength(data) : 0
          }, { requestId });
        }

        return originalSend.call(this, data);
      };

      next();
    };
  }

  // Database query logging
  public logDatabaseQuery(query: string, duration: number, context?: LogContext): void {
    this.debug('Database Query', {
      ...context,
      query: this.sanitizeLogData({ sql: query }),
      duration,
      logType: 'database'
    });

    if (duration > 1000) { // Log slow queries
      this.performance('Slow Database Query', {
        operation: 'database_query',
        duration
      }, context);
    }
  }

  // Cache operation logging
  public logCacheOperation(operation: 'hit' | 'miss' | 'set' | 'delete', key: string, context?: LogContext): void {
    this.debug(`Cache ${operation}`, {
      ...context,
      cache: { operation, key: this.sanitizeLogData({ key }).key },
      logType: 'cache'
    });
  }

  // External API call logging
  public logExternalApiCall(url: string, method: string, statusCode: number, duration: number, context?: LogContext): void {
    this.info('External API Call', {
      ...context,
      api: { url, method, statusCode, duration },
      logType: 'external_api'
    });

    if (statusCode >= 400) {
      this.warn('External API Error', {
        ...context,
        api: { url, method, statusCode, duration },
        logType: 'external_api_error'
      });
    }
  }

  // User action logging
  public logUserAction(action: string, userId: string, details?: any, context?: LogContext): void {
    this.audit('User Action', {
      action,
      userId,
      details: this.sanitizeLogData(details)
    }, context);
  }

  // System event logging
  public logSystemEvent(event: string, details?: any, context?: LogContext): void {
    this.info('System Event', {
      ...context,
      event,
      details,
      logType: 'system'
    });
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Health check logging
  public logHealthCheck(component: string, status: 'healthy' | 'unhealthy', details?: any, context?: LogContext): void {
    const level = status === 'healthy' ? 'info' : 'error';
    this.logger[level]('Health Check', {
      ...context,
      component,
      status,
      details,
      logType: 'health_check'
    });
  }

  // Metrics logging for monitoring integration
  public logMetric(name: string, value: number, unit: string, tags?: Record<string, string>, context?: LogContext): void {
    this.info('Metric', {
      ...context,
      metric: { name, value, unit, tags },
      logType: 'metric'
    });
  }
}

// Export singleton instance
export const logger = new StructuredLogger();

// Export types and utilities
export { StructuredLogger };
export default logger;