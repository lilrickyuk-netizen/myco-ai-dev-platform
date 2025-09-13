import { EventEmitter } from 'events';
import { createServer } from 'http';
import { register, Histogram, Counter, Gauge, collectDefaultMetrics } from 'prom-client';

export interface MetricsConfig {
  port: number;
  path: string;
  enableDefaultMetrics: boolean;
  prefix: string;
}

export interface CustomMetric {
  name: string;
  help: string;
  type: 'counter' | 'gauge' | 'histogram';
  labelNames?: string[];
  buckets?: number[];
}

export class MetricsCollector extends EventEmitter {
  private config: MetricsConfig;
  private metrics: Map<string, any> = new Map();
  private server: any;

  constructor(config: Partial<MetricsConfig> = {}) {
    super();
    
    this.config = {
      port: config.port || 9090,
      path: config.path || '/metrics',
      enableDefaultMetrics: config.enableDefaultMetrics ?? true,
      prefix: config.prefix || 'myco_',
      ...config
    };

    if (this.config.enableDefaultMetrics) {
      collectDefaultMetrics({ prefix: this.config.prefix });
    }

    this.initializeStandardMetrics();
  }

  private initializeStandardMetrics(): void {
    // HTTP request metrics
    this.createMetric({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      type: 'counter',
      labelNames: ['method', 'route', 'status_code']
    });

    this.createMetric({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      type: 'histogram',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
    });

    this.createMetric({
      name: 'http_request_size_bytes',
      help: 'Size of HTTP requests in bytes',
      type: 'histogram',
      labelNames: ['method', 'route'],
      buckets: [100, 1000, 10000, 100000, 1000000]
    });

    this.createMetric({
      name: 'http_response_size_bytes',
      help: 'Size of HTTP responses in bytes',
      type: 'histogram',
      labelNames: ['method', 'route'],
      buckets: [100, 1000, 10000, 100000, 1000000]
    });

    // Database metrics
    this.createMetric({
      name: 'database_connections_active',
      help: 'Number of active database connections',
      type: 'gauge'
    });

    this.createMetric({
      name: 'database_query_duration_seconds',
      help: 'Duration of database queries in seconds',
      type: 'histogram',
      labelNames: ['operation', 'table'],
      buckets: [0.001, 0.01, 0.1, 0.5, 1, 2, 5]
    });

    this.createMetric({
      name: 'database_queries_total',
      help: 'Total number of database queries',
      type: 'counter',
      labelNames: ['operation', 'table', 'status']
    });

    // Cache metrics
    this.createMetric({
      name: 'cache_hits_total',
      help: 'Total number of cache hits',
      type: 'counter',
      labelNames: ['cache_name']
    });

    this.createMetric({
      name: 'cache_misses_total',
      help: 'Total number of cache misses',
      type: 'counter',
      labelNames: ['cache_name']
    });

    this.createMetric({
      name: 'cache_size_bytes',
      help: 'Current cache size in bytes',
      type: 'gauge',
      labelNames: ['cache_name']
    });

    // AI/LLM metrics
    this.createMetric({
      name: 'llm_requests_total',
      help: 'Total number of LLM requests',
      type: 'counter',
      labelNames: ['provider', 'model', 'status']
    });

    this.createMetric({
      name: 'llm_request_duration_seconds',
      help: 'Duration of LLM requests in seconds',
      type: 'histogram',
      labelNames: ['provider', 'model'],
      buckets: [0.5, 1, 2, 5, 10, 20, 30, 60]
    });

    this.createMetric({
      name: 'llm_tokens_total',
      help: 'Total number of LLM tokens consumed',
      type: 'counter',
      labelNames: ['provider', 'model', 'type']
    });

    this.createMetric({
      name: 'llm_cost_total',
      help: 'Total estimated LLM cost in USD',
      type: 'counter',
      labelNames: ['provider', 'model']
    });

    // Code execution metrics
    this.createMetric({
      name: 'code_executions_total',
      help: 'Total number of code executions',
      type: 'counter',
      labelNames: ['language', 'status']
    });

    this.createMetric({
      name: 'code_execution_duration_seconds',
      help: 'Duration of code executions in seconds',
      type: 'histogram',
      labelNames: ['language'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60]
    });

    this.createMetric({
      name: 'active_containers',
      help: 'Number of active Docker containers',
      type: 'gauge'
    });

    this.createMetric({
      name: 'container_memory_usage_bytes',
      help: 'Container memory usage in bytes',
      type: 'gauge',
      labelNames: ['container_id', 'language']
    });

    // User and project metrics
    this.createMetric({
      name: 'active_users',
      help: 'Number of active users',
      type: 'gauge'
    });

    this.createMetric({
      name: 'user_sessions_total',
      help: 'Total number of user sessions',
      type: 'counter'
    });

    this.createMetric({
      name: 'projects_total',
      help: 'Total number of projects',
      type: 'gauge',
      labelNames: ['status']
    });

    this.createMetric({
      name: 'files_total',
      help: 'Total number of files',
      type: 'gauge'
    });

    // Agent metrics
    this.createMetric({
      name: 'agent_sessions_total',
      help: 'Total number of agent sessions',
      type: 'counter',
      labelNames: ['agent_type', 'status']
    });

    this.createMetric({
      name: 'agent_task_duration_seconds',
      help: 'Duration of agent tasks in seconds',
      type: 'histogram',
      labelNames: ['agent_type', 'task_type'],
      buckets: [1, 5, 10, 30, 60, 300, 600]
    });

    this.createMetric({
      name: 'active_agent_sessions',
      help: 'Number of currently active agent sessions',
      type: 'gauge'
    });

    // Error metrics
    this.createMetric({
      name: 'errors_total',
      help: 'Total number of errors',
      type: 'counter',
      labelNames: ['service', 'error_type']
    });

    // Business metrics
    this.createMetric({
      name: 'user_registrations_total',
      help: 'Total number of user registrations',
      type: 'counter'
    });

    this.createMetric({
      name: 'project_creations_total',
      help: 'Total number of project creations',
      type: 'counter',
      labelNames: ['template_type']
    });

    this.createMetric({
      name: 'deployments_total',
      help: 'Total number of deployments',
      type: 'counter',
      labelNames: ['status']
    });
  }

  createMetric(config: CustomMetric): void {
    const name = `${this.config.prefix}${config.name}`;
    
    let metric;
    switch (config.type) {
      case 'counter':
        metric = new Counter({
          name,
          help: config.help,
          labelNames: config.labelNames || []
        });
        break;
      case 'gauge':
        metric = new Gauge({
          name,
          help: config.help,
          labelNames: config.labelNames || []
        });
        break;
      case 'histogram':
        metric = new Histogram({
          name,
          help: config.help,
          labelNames: config.labelNames || [],
          buckets: config.buckets
        });
        break;
      default:
        throw new Error(`Unsupported metric type: ${config.type}`);
    }

    this.metrics.set(config.name, metric);
    register.registerMetric(metric);
  }

  getMetric(name: string): any {
    return this.metrics.get(name);
  }

  // HTTP request tracking
  recordHttpRequest(method: string, route: string, statusCode: number, duration: number, requestSize?: number, responseSize?: number): void {
    const requestsCounter = this.getMetric('http_requests_total');
    const durationHistogram = this.getMetric('http_request_duration_seconds');
    
    requestsCounter?.inc({ method, route, status_code: statusCode.toString() });
    durationHistogram?.observe({ method, route, status_code: statusCode.toString() }, duration);

    if (requestSize) {
      this.getMetric('http_request_size_bytes')?.observe({ method, route }, requestSize);
    }
    
    if (responseSize) {
      this.getMetric('http_response_size_bytes')?.observe({ method, route }, responseSize);
    }
  }

  // Database tracking
  recordDatabaseQuery(operation: string, table: string, duration: number, status: 'success' | 'error' = 'success'): void {
    this.getMetric('database_queries_total')?.inc({ operation, table, status });
    this.getMetric('database_query_duration_seconds')?.observe({ operation, table }, duration);
  }

  setActiveDatabaseConnections(count: number): void {
    this.getMetric('database_connections_active')?.set(count);
  }

  // Cache tracking
  recordCacheHit(cacheName: string): void {
    this.getMetric('cache_hits_total')?.inc({ cache_name: cacheName });
  }

  recordCacheMiss(cacheName: string): void {
    this.getMetric('cache_misses_total')?.inc({ cache_name: cacheName });
  }

  setCacheSize(cacheName: string, size: number): void {
    this.getMetric('cache_size_bytes')?.set({ cache_name: cacheName }, size);
  }

  // LLM tracking
  recordLLMRequest(provider: string, model: string, duration: number, tokens: { prompt: number; completion: number; total: number }, cost: number, status: 'success' | 'error' = 'success'): void {
    this.getMetric('llm_requests_total')?.inc({ provider, model, status });
    this.getMetric('llm_request_duration_seconds')?.observe({ provider, model }, duration);
    
    this.getMetric('llm_tokens_total')?.inc({ provider, model, type: 'prompt' }, tokens.prompt);
    this.getMetric('llm_tokens_total')?.inc({ provider, model, type: 'completion' }, tokens.completion);
    this.getMetric('llm_tokens_total')?.inc({ provider, model, type: 'total' }, tokens.total);
    
    this.getMetric('llm_cost_total')?.inc({ provider, model }, cost);
  }

  // Code execution tracking
  recordCodeExecution(language: string, duration: number, status: 'success' | 'error' | 'timeout' = 'success'): void {
    this.getMetric('code_executions_total')?.inc({ language, status });
    this.getMetric('code_execution_duration_seconds')?.observe({ language }, duration);
  }

  setActiveContainers(count: number): void {
    this.getMetric('active_containers')?.set(count);
  }

  setContainerMemoryUsage(containerId: string, language: string, memoryBytes: number): void {
    this.getMetric('container_memory_usage_bytes')?.set({ container_id: containerId, language }, memoryBytes);
  }

  // User tracking
  setActiveUsers(count: number): void {
    this.getMetric('active_users')?.set(count);
  }

  recordUserSession(): void {
    this.getMetric('user_sessions_total')?.inc();
  }

  recordUserRegistration(): void {
    this.getMetric('user_registrations_total')?.inc();
  }

  // Project tracking
  setProjectCount(status: string, count: number): void {
    this.getMetric('projects_total')?.set({ status }, count);
  }

  setFileCount(count: number): void {
    this.getMetric('files_total')?.set(count);
  }

  recordProjectCreation(templateType: string): void {
    this.getMetric('project_creations_total')?.inc({ template_type: templateType });
  }

  // Agent tracking
  recordAgentSession(agentType: string, status: 'started' | 'completed' | 'failed'): void {
    this.getMetric('agent_sessions_total')?.inc({ agent_type: agentType, status });
  }

  recordAgentTask(agentType: string, taskType: string, duration: number): void {
    this.getMetric('agent_task_duration_seconds')?.observe({ agent_type: agentType, task_type: taskType }, duration);
  }

  setActiveAgentSessions(count: number): void {
    this.getMetric('active_agent_sessions')?.set(count);
  }

  // Error tracking
  recordError(service: string, errorType: string): void {
    this.getMetric('errors_total')?.inc({ service, error_type: errorType });
  }

  // Deployment tracking
  recordDeployment(status: 'success' | 'failed'): void {
    this.getMetric('deployments_total')?.inc({ status });
  }

  // Start the metrics server
  startServer(): void {
    this.server = createServer(async (req, res) => {
      if (req.url === this.config.path && req.method === 'GET') {
        try {
          res.setHeader('Content-Type', register.contentType);
          res.end(await register.metrics());
        } catch (error) {
          res.statusCode = 500;
          res.end(`Error generating metrics: ${error}`);
        }
      } else {
        res.statusCode = 404;
        res.end('Not Found');
      }
    });

    this.server.listen(this.config.port, () => {
      console.log(`Metrics server listening on port ${this.config.port}${this.config.path}`);
      this.emit('server_started', this.config.port);
    });
  }

  // Stop the metrics server
  stopServer(): void {
    if (this.server) {
      this.server.close(() => {
        console.log('Metrics server stopped');
        this.emit('server_stopped');
      });
    }
  }

  // Get all metrics as text
  async getMetrics(): Promise<string> {
    return await register.metrics();
  }

  // Clear all metrics
  clearMetrics(): void {
    register.clear();
    this.metrics.clear();
    this.initializeStandardMetrics();
  }

  // Health check
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
    try {
      const metrics = await this.getMetrics();
      return {
        status: 'healthy',
        details: {
          metrics_count: this.metrics.size,
          server_running: !!this.server,
          metrics_size: metrics.length
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }
}

// Create a singleton instance
export const metricsCollector = new MetricsCollector();

// Middleware for Express.js to automatically track HTTP requests
export function createMetricsMiddleware() {
  return (req: any, res: any, next: any) => {
    const startTime = Date.now();
    const startHrTime = process.hrtime();

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const hrDuration = process.hrtime(startHrTime);
      const durationSeconds = hrDuration[0] + hrDuration[1] / 1e9;

      const route = req.route?.path || req.path || 'unknown';
      const method = req.method;
      const statusCode = res.statusCode;

      metricsCollector.recordHttpRequest(
        method,
        route,
        statusCode,
        durationSeconds,
        req.get('content-length') ? parseInt(req.get('content-length')) : undefined,
        res.get('content-length') ? parseInt(res.get('content-length')) : undefined
      );
    });

    next();
  };
}

export default MetricsCollector;