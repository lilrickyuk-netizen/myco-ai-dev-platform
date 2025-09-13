import { createLogger, format, transports, Logger } from 'winston';
import { ElasticsearchTransport } from 'winston-elasticsearch';
import path from 'path';
import fs from 'fs';

export interface LogContext {
  requestId?: string;
  userId?: string;
  sessionId?: string;
  correlationId?: string;
  service?: string;
  component?: string;
  operation?: string;
  environment?: string;
  version?: string;
  [key: string]: any;
}

export interface LogMetadata {
  timestamp: string;
  level: string;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string | number;
  };
  performance?: {
    duration: number;
    memory: number;
    cpu?: number;
  };
  security?: {
    ip?: string;
    userAgent?: string;
    suspicious?: boolean;
  };
  business?: {
    action: string;
    resource?: string;
    outcome?: 'success' | 'failure' | 'partial';
    metrics?: Record<string, number>;
  };
}

export class StructuredLogger {
  private logger: Logger;
  private context: LogContext = {};
  private config: {
    level: string;
    service: string;
    version: string;
    environment: string;
    enableConsole: boolean;
    enableFile: boolean;
    enableElastic: boolean;
    logDir: string;
    elasticUrl?: string;
    elasticIndex: string;
  };

  constructor(options: Partial<typeof StructuredLogger.prototype.config> = {}) {
    this.config = {
      level: options.level || process.env.LOG_LEVEL || 'info',
      service: options.service || process.env.SERVICE_NAME || 'myco-platform',
      version: options.version || process.env.VERSION || '1.0.0',
      environment: options.environment || process.env.NODE_ENV || 'development',
      enableConsole: options.enableConsole ?? true,
      enableFile: options.enableFile ?? true,
      enableElastic: options.enableElastic ?? false,
      logDir: options.logDir || './logs',
      elasticUrl: options.elasticUrl || process.env.ELASTICSEARCH_URL,
      elasticIndex: options.elasticIndex || 'myco-platform-logs',
    };

    this.setupLogger();
  }

  private setupLogger(): void {
    // Ensure log directory exists
    if (this.config.enableFile && !fs.existsSync(this.config.logDir)) {
      fs.mkdirSync(this.config.logDir, { recursive: true });
    }

    const logFormat = format.combine(
      format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
      format.errors({ stack: true }),
      format.json(),
      format.printf((info) => {
        const logEntry: LogMetadata = {
          timestamp: info.timestamp,
          level: info.level,
          message: info.message,
          context: {
            ...this.context,
            service: this.config.service,
            version: this.config.version,
            environment: this.config.environment,
            ...info.context,
          },
        };

        // Add error information if present
        if (info.error) {
          logEntry.error = {
            name: info.error.name,
            message: info.error.message,
            stack: info.error.stack,
            code: info.error.code,
          };
        }

        // Add performance information if present
        if (info.performance) {
          logEntry.performance = info.performance;
        }

        // Add security information if present
        if (info.security) {
          logEntry.security = info.security;
        }

        // Add business information if present
        if (info.business) {
          logEntry.business = info.business;
        }

        return JSON.stringify(logEntry);
      })
    );

    const transportArray: any[] = [];

    // Console transport
    if (this.config.enableConsole) {
      transportArray.push(
        new transports.Console({
          level: this.config.level,
          format: this.config.environment === 'development' 
            ? format.combine(
                format.colorize(),
                format.simple(),
                format.printf((info) => {
                  const contextStr = info.context ? ` [${JSON.stringify(info.context)}]` : '';
                  return `${info.timestamp} ${info.level}: ${info.message}${contextStr}`;
                })
              )
            : logFormat,
        })
      );
    }

    // File transports
    if (this.config.enableFile) {
      // Combined log file
      transportArray.push(
        new transports.File({
          filename: path.join(this.config.logDir, 'combined.log'),
          level: this.config.level,
          format: logFormat,
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 5,
          tailable: true,
        })
      );

      // Error log file
      transportArray.push(
        new transports.File({
          filename: path.join(this.config.logDir, 'error.log'),
          level: 'error',
          format: logFormat,
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 5,
          tailable: true,
        })
      );

      // Audit log file (for security and business events)
      transportArray.push(
        new transports.File({
          filename: path.join(this.config.logDir, 'audit.log'),
          level: 'info',
          format: logFormat,
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 10,
          tailable: true,
        })
      );
    }

    // Elasticsearch transport
    if (this.config.enableElastic && this.config.elasticUrl) {
      try {
        transportArray.push(
          new ElasticsearchTransport({
            level: this.config.level,
            clientOpts: {
              node: this.config.elasticUrl,
            },
            index: this.config.elasticIndex,
            indexTemplate: {
              index_patterns: [`${this.config.elasticIndex}-*`],
              settings: {
                number_of_shards: 1,
                number_of_replicas: 0,
              },
              mappings: {
                properties: {
                  '@timestamp': { type: 'date' },
                  level: { type: 'keyword' },
                  message: { type: 'text' },
                  context: {
                    properties: {
                      requestId: { type: 'keyword' },
                      userId: { type: 'keyword' },
                      service: { type: 'keyword' },
                      component: { type: 'keyword' },
                      operation: { type: 'keyword' },
                    },
                  },
                  error: {
                    properties: {
                      name: { type: 'keyword' },
                      message: { type: 'text' },
                      stack: { type: 'text' },
                      code: { type: 'keyword' },
                    },
                  },
                  performance: {
                    properties: {
                      duration: { type: 'double' },
                      memory: { type: 'long' },
                      cpu: { type: 'double' },
                    },
                  },
                },
              },
            },
          })
        );
      } catch (error) {
        console.warn('Failed to setup Elasticsearch transport:', error);
      }
    }

    this.logger = createLogger({
      level: this.config.level,
      format: logFormat,
      transports: transportArray,
      exitOnError: false,
    });

    // Handle uncaught exceptions and rejections
    this.logger.exceptions.handle(
      new transports.File({
        filename: path.join(this.config.logDir, 'exceptions.log'),
        format: logFormat,
      })
    );

    this.logger.rejections.handle(
      new transports.File({
        filename: path.join(this.config.logDir, 'rejections.log'),
        format: logFormat,
      })
    );
  }

  // Set global context that will be included in all log entries
  setContext(context: LogContext): void {
    this.context = { ...this.context, ...context };
  }

  // Clear global context
  clearContext(): void {
    this.context = {};
  }

  // Get current context
  getContext(): LogContext {
    return { ...this.context };
  }

  // Create a child logger with additional context
  child(context: LogContext): StructuredLogger {
    const childLogger = new StructuredLogger(this.config);
    childLogger.setContext({ ...this.context, ...context });
    return childLogger;
  }

  // Basic logging methods
  debug(message: string, context?: LogContext): void {
    this.logger.debug(message, { context });
  }

  info(message: string, context?: LogContext): void {
    this.logger.info(message, { context });
  }

  warn(message: string, context?: LogContext): void {
    this.logger.warn(message, { context });
  }

  error(message: string, error?: Error, context?: LogContext): void {
    this.logger.error(message, { 
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
      } : undefined,
      context 
    });
  }

  // Performance logging
  performance(message: string, duration: number, context?: LogContext): void {
    this.logger.info(message, {
      performance: {
        duration,
        memory: process.memoryUsage().heapUsed,
        cpu: process.cpuUsage().user,
      },
      context,
    });
  }

  // Security logging
  security(message: string, details: {
    ip?: string;
    userAgent?: string;
    suspicious?: boolean;
    action: string;
    resource?: string;
    outcome: 'success' | 'failure';
  }, context?: LogContext): void {
    this.logger.info(message, {
      security: {
        ip: details.ip,
        userAgent: details.userAgent,
        suspicious: details.suspicious,
      },
      business: {
        action: details.action,
        resource: details.resource,
        outcome: details.outcome,
      },
      context,
    });
  }

  // Business event logging
  business(message: string, details: {
    action: string;
    resource?: string;
    outcome: 'success' | 'failure' | 'partial';
    metrics?: Record<string, number>;
  }, context?: LogContext): void {
    this.logger.info(message, {
      business: details,
      context,
    });
  }

  // HTTP request logging
  httpRequest(method: string, url: string, statusCode: number, duration: number, context?: LogContext): void {
    const level = statusCode >= 400 ? 'warn' : 'info';
    this.logger.log(level, `HTTP ${method} ${url} ${statusCode}`, {
      performance: {
        duration,
        memory: process.memoryUsage().heapUsed,
      },
      business: {
        action: 'http_request',
        resource: `${method} ${url}`,
        outcome: statusCode >= 400 ? 'failure' : 'success',
        metrics: {
          status_code: statusCode,
          duration_ms: duration,
        },
      },
      context: {
        ...context,
        method,
        url,
        statusCode,
      },
    });
  }

  // Database operation logging
  database(operation: string, table: string, duration: number, success: boolean, context?: LogContext): void {
    this.logger.info(`Database ${operation} on ${table}`, {
      performance: {
        duration,
        memory: process.memoryUsage().heapUsed,
      },
      business: {
        action: 'database_operation',
        resource: `${table}.${operation}`,
        outcome: success ? 'success' : 'failure',
        metrics: {
          duration_ms: duration,
        },
      },
      context: {
        ...context,
        operation,
        table,
      },
    });
  }

  // User action logging
  userAction(userId: string, action: string, resource?: string, success: boolean = true, context?: LogContext): void {
    this.logger.info(`User action: ${action}`, {
      business: {
        action,
        resource,
        outcome: success ? 'success' : 'failure',
      },
      context: {
        ...context,
        userId,
        component: 'user_action',
      },
    });
  }

  // LLM operation logging
  llm(provider: string, model: string, operation: string, duration: number, tokens: number, cost: number, success: boolean, context?: LogContext): void {
    this.logger.info(`LLM ${operation} with ${provider}/${model}`, {
      performance: {
        duration,
        memory: process.memoryUsage().heapUsed,
      },
      business: {
        action: 'llm_operation',
        resource: `${provider}/${model}`,
        outcome: success ? 'success' : 'failure',
        metrics: {
          duration_ms: duration,
          tokens,
          cost_usd: cost,
        },
      },
      context: {
        ...context,
        provider,
        model,
        operation,
      },
    });
  }

  // Agent operation logging
  agent(agentType: string, operation: string, duration: number, success: boolean, context?: LogContext): void {
    this.logger.info(`Agent ${agentType} ${operation}`, {
      performance: {
        duration,
        memory: process.memoryUsage().heapUsed,
      },
      business: {
        action: 'agent_operation',
        resource: `${agentType}.${operation}`,
        outcome: success ? 'success' : 'failure',
        metrics: {
          duration_ms: duration,
        },
      },
      context: {
        ...context,
        agentType,
        operation,
        component: 'agent',
      },
    });
  }

  // Code execution logging
  codeExecution(language: string, duration: number, success: boolean, context?: LogContext): void {
    this.logger.info(`Code execution: ${language}`, {
      performance: {
        duration,
        memory: process.memoryUsage().heapUsed,
      },
      business: {
        action: 'code_execution',
        resource: language,
        outcome: success ? 'success' : 'failure',
        metrics: {
          duration_ms: duration,
        },
      },
      context: {
        ...context,
        language,
        component: 'execution_engine',
      },
    });
  }

  // Deployment logging
  deployment(environment: string, version: string, success: boolean, duration: number, context?: LogContext): void {
    this.logger.info(`Deployment to ${environment}`, {
      performance: {
        duration,
        memory: process.memoryUsage().heapUsed,
      },
      business: {
        action: 'deployment',
        resource: environment,
        outcome: success ? 'success' : 'failure',
        metrics: {
          duration_ms: duration,
        },
      },
      context: {
        ...context,
        environment,
        version,
        component: 'deployment',
      },
    });
  }

  // Health check method
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
    try {
      // Test logging functionality
      this.debug('Health check test log');
      
      return {
        status: 'healthy',
        details: {
          level: this.config.level,
          service: this.config.service,
          transports: this.logger.transports.length,
          context_keys: Object.keys(this.context).length,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  // Flush logs (useful for testing)
  async flush(): Promise<void> {
    return new Promise((resolve) => {
      this.logger.on('finish', resolve);
      this.logger.end();
    });
  }
}

// Create default logger instance
export const logger = new StructuredLogger();

// Middleware for Express.js to automatically log HTTP requests
export function createLoggingMiddleware() {
  return (req: any, res: any, next: any) => {
    const startTime = Date.now();
    const requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Set request context
    const requestLogger = logger.child({
      requestId,
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.connection.remoteAddress,
    });

    // Add logger to request for use in route handlers
    req.logger = requestLogger;

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      requestLogger.httpRequest(req.method, req.url, res.statusCode, duration);
    });

    next();
  };
}

export default StructuredLogger;