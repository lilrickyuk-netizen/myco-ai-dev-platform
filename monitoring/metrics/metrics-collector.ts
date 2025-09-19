/**
 * Advanced Metrics Collector for AI Development Platform
 * Provides comprehensive metrics collection with Prometheus integration
 */

import { register, Counter, Histogram, Gauge, Summary, collectDefaultMetrics } from 'prom-client';
import { Request, Response } from 'express';

// Enable default metrics collection
collectDefaultMetrics({ register });

export class MetricsCollector {
  // HTTP Metrics
  public httpRequestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code', 'user_agent']
  });

  public httpRequestDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
  });

  public httpRequestSize = new Histogram({
    name: 'http_request_size_bytes',
    help: 'Size of HTTP requests in bytes',
    labelNames: ['method', 'route'],
    buckets: [10, 100, 1000, 10000, 100000, 1000000, 10000000]
  });

  public httpResponseSize = new Histogram({
    name: 'http_response_size_bytes',
    help: 'Size of HTTP responses in bytes',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [10, 100, 1000, 10000, 100000, 1000000, 10000000]
  });

  // AI Engine Metrics
  public aiCompletionsTotal = new Counter({
    name: 'ai_completions_total',
    help: 'Total number of AI completions',
    labelNames: ['provider', 'model', 'status']
  });

  public aiTokensUsedTotal = new Counter({
    name: 'ai_tokens_used_total',
    help: 'Total number of AI tokens used',
    labelNames: ['provider', 'model', 'type'] // type: input, output
  });

  public aiModelRequestDuration = new Histogram({
    name: 'ai_model_request_duration_seconds',
    help: 'Duration of AI model requests in seconds',
    labelNames: ['provider', 'model'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120]
  });

  public aiQueueLength = new Gauge({
    name: 'ai_queue_length',
    help: 'Current length of AI request queue',
    labelNames: ['provider', 'priority']
  });

  public aiCostTotal = new Counter({
    name: 'ai_cost_total',
    help: 'Total AI API costs in USD',
    labelNames: ['provider', 'model']
  });

  // Database Metrics
  public dbConnectionsActive = new Gauge({
    name: 'db_connections_active',
    help: 'Number of active database connections',
    labelNames: ['database', 'user']
  });

  public dbConnectionsIdle = new Gauge({
    name: 'db_connections_idle',
    help: 'Number of idle database connections',
    labelNames: ['database']
  });

  public dbQueryDuration = new Histogram({
    name: 'db_query_duration_seconds',
    help: 'Duration of database queries in seconds',
    labelNames: ['database', 'operation', 'table'],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5, 10]
  });

  public dbQueriesTotal = new Counter({
    name: 'db_queries_total',
    help: 'Total number of database queries',
    labelNames: ['database', 'operation', 'table', 'status']
  });

  public dbRowsAffected = new Histogram({
    name: 'db_rows_affected',
    help: 'Number of rows affected by database operations',
    labelNames: ['database', 'operation', 'table'],
    buckets: [1, 10, 100, 1000, 10000, 100000]
  });

  // Cache Metrics
  public cacheOperationsTotal = new Counter({
    name: 'cache_operations_total',
    help: 'Total number of cache operations',
    labelNames: ['operation', 'status'] // operation: get, set, delete; status: hit, miss, success, error
  });

  public cacheKeyCount = new Gauge({
    name: 'cache_keys_total',
    help: 'Total number of keys in cache'
  });

  public cacheMemoryUsage = new Gauge({
    name: 'cache_memory_usage_bytes',
    help: 'Cache memory usage in bytes'
  });

  public cacheOperationDuration = new Histogram({
    name: 'cache_operation_duration_seconds',
    help: 'Duration of cache operations in seconds',
    labelNames: ['operation'],
    buckets: [0.0001, 0.0005, 0.001, 0.005, 0.01, 0.05, 0.1]
  });

  // Execution Engine Metrics
  public codeExecutionsTotal = new Counter({
    name: 'code_executions_total',
    help: 'Total number of code executions',
    labelNames: ['language', 'status', 'template']
  });

  public codeExecutionDuration = new Histogram({
    name: 'code_execution_duration_seconds',
    help: 'Duration of code executions in seconds',
    labelNames: ['language', 'template'],
    buckets: [1, 5, 10, 30, 60, 120, 300, 600]
  });

  public containerOperationsTotal = new Counter({
    name: 'container_operations_total',
    help: 'Total number of container operations',
    labelNames: ['operation', 'status'] // operation: create, start, stop, remove
  });

  public activeContainers = new Gauge({
    name: 'active_containers',
    help: 'Number of active containers',
    labelNames: ['language', 'template']
  });

  // File System Metrics
  public fileOperationsTotal = new Counter({
    name: 'file_operations_total',
    help: 'Total number of file operations',
    labelNames: ['operation', 'status'] // operation: read, write, delete, create
  });

  public projectFilesCount = new Gauge({
    name: 'project_files_count',
    help: 'Number of files per project',
    labelNames: ['project_id', 'file_type']
  });

  public projectSizeBytes = new Gauge({
    name: 'project_size_bytes',
    help: 'Project size in bytes',
    labelNames: ['project_id']
  });

  // User and Authentication Metrics
  public userSessionsActive = new Gauge({
    name: 'user_sessions_active',
    help: 'Number of active user sessions'
  });

  public authenticationAttempts = new Counter({
    name: 'authentication_attempts_total',
    help: 'Total number of authentication attempts',
    labelNames: ['method', 'status'] // method: password, oauth, api_key; status: success, failure
  });

  public userActionsTotal = new Counter({
    name: 'user_actions_total',
    help: 'Total number of user actions',
    labelNames: ['action', 'user_id']
  });

  // Business Metrics
  public projectsCreatedTotal = new Counter({
    name: 'projects_created_total',
    help: 'Total number of projects created',
    labelNames: ['template', 'user_tier']
  });

  public projectsActiveGauge = new Gauge({
    name: 'projects_active',
    help: 'Number of active projects',
    labelNames: ['template']
  });

  public deploymentsTotal = new Counter({
    name: 'deployments_total',
    help: 'Total number of deployments',
    labelNames: ['status', 'environment', 'template']
  });

  public revenueTotal = new Counter({
    name: 'revenue_total_usd',
    help: 'Total revenue in USD',
    labelNames: ['plan', 'payment_method']
  });

  // Security Metrics
  public securityEventsTotal = new Counter({
    name: 'security_events_total',
    help: 'Total number of security events',
    labelNames: ['event_type', 'severity', 'source']
  });

  public suspiciousActivitiesTotal = new Counter({
    name: 'suspicious_activities_total',
    help: 'Total number of suspicious activities',
    labelNames: ['activity_type', 'risk_level', 'user_id']
  });

  public rateLimitHitsTotal = new Counter({
    name: 'rate_limit_hits_total',
    help: 'Total number of rate limit hits',
    labelNames: ['endpoint', 'user_id', 'limit_type']
  });

  // System Resource Metrics
  public customCpuUsage = new Gauge({
    name: 'system_cpu_usage_percent',
    help: 'System CPU usage percentage',
    labelNames: ['component']
  });

  public customMemoryUsage = new Gauge({
    name: 'system_memory_usage_bytes',
    help: 'System memory usage in bytes',
    labelNames: ['component', 'type'] // type: heap, rss, external
  });

  public customDiskUsage = new Gauge({
    name: 'system_disk_usage_bytes',
    help: 'System disk usage in bytes',
    labelNames: ['component', 'mount_point']
  });

  // Error and Warning Metrics
  public errorsTotal = new Counter({
    name: 'errors_total',
    help: 'Total number of errors',
    labelNames: ['component', 'error_type', 'severity']
  });

  public warningsTotal = new Counter({
    name: 'warnings_total',
    help: 'Total number of warnings',
    labelNames: ['component', 'warning_type']
  });

  // Performance Summary Metrics
  public responseTimeSummary = new Summary({
    name: 'response_time_summary_seconds',
    help: 'Summary of response times',
    labelNames: ['component', 'operation'],
    maxAgeSeconds: 600,
    ageBuckets: 5
  });

  public throughputSummary = new Summary({
    name: 'throughput_summary_ops_per_second',
    help: 'Summary of operations per second',
    labelNames: ['component', 'operation'],
    maxAgeSeconds: 600,
    ageBuckets: 5
  });

  constructor() {
    // Initialize metrics with default values
    this.initializeDefaultMetrics();
  }

  private initializeDefaultMetrics(): void {
    // Set initial values for gauges to avoid missing metrics
    this.userSessionsActive.set(0);
    this.aiQueueLength.set(0, 'default');
    this.dbConnectionsActive.set(0, 'postgres', 'app');
    this.dbConnectionsIdle.set(0, 'postgres');
    this.activeContainers.set(0, 'nodejs', 'default');
    this.projectsActiveGauge.set(0, 'default');
    this.cacheKeyCount.set(0);
    this.cacheMemoryUsage.set(0);
  }

  // HTTP Request Middleware
  public httpMetricsMiddleware() {
    return (req: Request, res: Response, next: Function) => {
      const start = Date.now();
      const requestSize = parseInt(req.headers['content-length'] || '0', 10);

      // Track request size
      if (requestSize > 0) {
        this.httpRequestSize.observe(
          { method: req.method, route: req.route?.path || req.path },
          requestSize
        );
      }

      // Override res.end to capture response metrics
      const originalEnd = res.end;
      res.end = function(chunk?: any) {
        const duration = (Date.now() - start) / 1000;
        const statusCode = res.statusCode.toString();
        const userAgent = req.headers['user-agent'] || 'unknown';
        
        // Record metrics
        metricsCollector.httpRequestsTotal.inc({
          method: req.method,
          route: req.route?.path || req.path,
          status_code: statusCode,
          user_agent: userAgent
        });

        metricsCollector.httpRequestDuration.observe(
          { method: req.method, route: req.route?.path || req.path, status_code: statusCode },
          duration
        );

        // Track response size
        if (chunk) {
          const responseSize = Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk, 'utf8');
          metricsCollector.httpResponseSize.observe(
            { method: req.method, route: req.route?.path || req.path, status_code: statusCode },
            responseSize
          );
        }

        originalEnd.call(this, chunk);
      };

      next();
    };
  }

  // Method to manually record AI operations
  public recordAiCompletion(provider: string, model: string, status: string, tokens: number, cost: number, duration: number): void {
    this.aiCompletionsTotal.inc({ provider, model, status });
    this.aiTokensUsedTotal.inc({ provider, model, type: 'total' }, tokens);
    this.aiModelRequestDuration.observe({ provider, model }, duration);
    this.aiCostTotal.inc({ provider, model }, cost);
  }

  // Method to record database operations
  public recordDatabaseOperation(database: string, operation: string, table: string, duration: number, rowsAffected: number, status: string): void {
    this.dbQueriesTotal.inc({ database, operation, table, status });
    this.dbQueryDuration.observe({ database, operation, table }, duration);
    if (rowsAffected > 0) {
      this.dbRowsAffected.observe({ database, operation, table }, rowsAffected);
    }
  }

  // Method to record cache operations
  public recordCacheOperation(operation: string, status: string, duration: number): void {
    this.cacheOperationsTotal.inc({ operation, status });
    this.cacheOperationDuration.observe({ operation }, duration);
  }

  // Method to record code execution
  public recordCodeExecution(language: string, template: string, status: string, duration: number): void {
    this.codeExecutionsTotal.inc({ language, status, template });
    this.codeExecutionDuration.observe({ language, template }, duration);
  }

  // Method to update active containers count
  public updateActiveContainers(language: string, template: string, count: number): void {
    this.activeContainers.set({ language, template }, count);
  }

  // Method to record security events
  public recordSecurityEvent(eventType: string, severity: string, source: string): void {
    this.securityEventsTotal.inc({ event_type: eventType, severity, source });
  }

  // Method to record user actions
  public recordUserAction(action: string, userId: string): void {
    this.userActionsTotal.inc({ action, user_id: userId });
  }

  // Method to record business metrics
  public recordProjectCreation(template: string, userTier: string): void {
    this.projectsCreatedTotal.inc({ template, user_tier: userTier });
  }

  public recordDeployment(status: string, environment: string, template: string): void {
    this.deploymentsTotal.inc({ status, environment, template });
  }

  public recordRevenue(amount: number, plan: string, paymentMethod: string): void {
    this.revenueTotal.inc({ plan, payment_method: paymentMethod }, amount);
  }

  // Method to get metrics for Prometheus endpoint
  public async getMetrics(): Promise<string> {
    return await register.metrics();
  }

  // Method to get metrics in JSON format
  public async getMetricsAsJson(): Promise<any> {
    const metrics = await register.getMetricsAsJSON();
    return metrics;
  }

  // Method to clear all metrics (useful for testing)
  public clearMetrics(): void {
    register.clear();
  }

  // Method to create custom metric
  public createCustomCounter(name: string, help: string, labelNames: string[] = []): Counter<string> {
    return new Counter({ name, help, labelNames });
  }

  public createCustomGauge(name: string, help: string, labelNames: string[] = []): Gauge<string> {
    return new Gauge({ name, help, labelNames });
  }

  public createCustomHistogram(name: string, help: string, labelNames: string[] = [], buckets?: number[]): Histogram<string> {
    return new Histogram({ name, help, labelNames, buckets });
  }

  // Health check endpoint for metrics system
  public healthCheck(): { status: string; metrics_count: number; memory_usage: number } {
    const metricsCount = register.getSingleMetric('prometheus_registry_metrics_total');
    const memoryUsage = process.memoryUsage();
    
    return {
      status: 'healthy',
      metrics_count: Array.from(register.getMetricsAsArray()).length,
      memory_usage: memoryUsage.heapUsed
    };
  }
}

// Export singleton instance
export const metricsCollector = new MetricsCollector();

// Export types
export { MetricsCollector };
export default metricsCollector;