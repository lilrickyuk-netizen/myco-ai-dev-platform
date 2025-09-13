import { getAuthData } from "~encore/auth";

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  userId?: string;
  requestId?: string;
  endpoint?: string;
  method?: string;
  duration?: number;
  statusCode?: number;
  metadata?: Record<string, any>;
}

export class Logger {
  private static instance: Logger;
  
  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private formatLogEntry(entry: LogEntry): string {
    return JSON.stringify({
      ...entry,
      timestamp: new Date().toISOString(),
      service: 'backend',
      environment: process.env.NODE_ENV || 'development',
    });
  }

  private getCurrentUser(): string | undefined {
    try {
      const auth = getAuthData();
      return auth?.userID;
    } catch {
      return undefined;
    }
  }

  info(message: string, metadata?: Record<string, any>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'info',
      message,
      userId: this.getCurrentUser(),
      metadata,
    };
    console.log(this.formatLogEntry(entry));
  }

  warn(message: string, metadata?: Record<string, any>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'warn',
      message,
      userId: this.getCurrentUser(),
      metadata,
    };
    console.warn(this.formatLogEntry(entry));
  }

  error(message: string, error?: Error, metadata?: Record<string, any>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'error',
      message,
      userId: this.getCurrentUser(),
      metadata: {
        ...metadata,
        error: error ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
        } : undefined,
      },
    };
    console.error(this.formatLogEntry(entry));
  }

  debug(message: string, metadata?: Record<string, any>): void {
    if (process.env.NODE_ENV === 'development') {
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: 'debug',
        message,
        userId: this.getCurrentUser(),
        metadata,
      };
      console.debug(this.formatLogEntry(entry));
    }
  }

  // Audit logging for sensitive operations
  audit(action: string, resourceType: string, resourceId: string, details?: Record<string, any>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `AUDIT: ${action} ${resourceType} ${resourceId}`,
      userId: this.getCurrentUser(),
      metadata: {
        action,
        resourceType,
        resourceId,
        auditLog: true,
        ...details,
      },
    };
    console.log(this.formatLogEntry(entry));
  }

  // Performance logging
  performance(operation: string, duration: number, metadata?: Record<string, any>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `PERF: ${operation} completed in ${duration}ms`,
      userId: this.getCurrentUser(),
      duration,
      metadata: {
        operation,
        performance: true,
        ...metadata,
      },
    };
    console.log(this.formatLogEntry(entry));
  }

  // Security logging
  security(event: string, severity: 'low' | 'medium' | 'high' | 'critical', details?: Record<string, any>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: severity === 'critical' || severity === 'high' ? 'error' : 'warn',
      message: `SECURITY: ${event}`,
      userId: this.getCurrentUser(),
      metadata: {
        securityEvent: true,
        severity,
        ...details,
      },
    };
    
    if (severity === 'critical' || severity === 'high') {
      console.error(this.formatLogEntry(entry));
    } else {
      console.warn(this.formatLogEntry(entry));
    }
  }
}

// Global logger instance
export const logger = Logger.getInstance();

// Middleware for request logging
export function logRequest(endpoint: string, method: string, startTime: number, statusCode: number, error?: Error): void {
  const duration = Date.now() - startTime;
  
  if (error) {
    logger.error(`${method} ${endpoint} failed`, error, {
      endpoint,
      method,
      duration,
      statusCode,
    });
  } else if (statusCode >= 400) {
    logger.warn(`${method} ${endpoint} returned ${statusCode}`, {
      endpoint,
      method,
      duration,
      statusCode,
    });
  } else {
    logger.info(`${method} ${endpoint} completed`, {
      endpoint,
      method,
      duration,
      statusCode,
    });
  }
}

// Database operation logging
export function logDatabaseOperation(operation: string, table: string, duration: number, affected?: number): void {
  logger.performance(`DB ${operation} on ${table}`, duration, {
    operation,
    table,
    affectedRows: affected,
  });
}

// File operation logging
export function logFileOperation(operation: string, filePath: string, fileSize?: number): void {
  logger.audit(operation, 'file', filePath, {
    fileSize,
  });
}

// Project operation logging
export function logProjectOperation(operation: string, projectId: string, details?: Record<string, any>): void {
  logger.audit(operation, 'project', projectId, details);
}