import { promisify } from 'util';
import { register, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';

// Enable default metrics collection
collectDefaultMetrics({
  prefix: 'myco_backend_',
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5], // in seconds
});

// Custom metrics for our application
export const httpRequestsTotal = new Counter({
  name: 'myco_backend_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code', 'service'],
});

export const httpRequestDuration = new Histogram({
  name: 'myco_backend_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code', 'service'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

export const activeConnections = new Gauge({
  name: 'myco_backend_active_connections',
  help: 'Number of active connections',
  labelNames: ['service'],
});

export const databaseConnectionsActive = new Gauge({
  name: 'myco_backend_database_connections_active',
  help: 'Number of active database connections',
});

export const databaseConnectionsIdle = new Gauge({
  name: 'myco_backend_database_connections_idle',
  help: 'Number of idle database connections',
});

export const databaseQueryDuration = new Histogram({
  name: 'myco_backend_database_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
});

export const databaseQueriesTotal = new Counter({
  name: 'myco_backend_database_queries_total',
  help: 'Total number of database queries',
  labelNames: ['operation', 'table', 'status'],
});

export const authRequestsTotal = new Counter({
  name: 'myco_backend_auth_requests_total',
  help: 'Total number of authentication requests',
  labelNames: ['type', 'status'],
});

export const projectOperationsTotal = new Counter({
  name: 'myco_backend_project_operations_total',
  help: 'Total number of project operations',
  labelNames: ['operation', 'status'],
});

export const projectCount = new Gauge({
  name: 'myco_backend_projects_total',
  help: 'Total number of projects',
  labelNames: ['status'],
});

export const filesystemOperationsTotal = new Counter({
  name: 'myco_backend_filesystem_operations_total',
  help: 'Total number of filesystem operations',
  labelNames: ['operation', 'status'],
});

export const aiRequestsTotal = new Counter({
  name: 'myco_backend_ai_requests_total',
  help: 'Total number of AI requests',
  labelNames: ['type', 'model', 'status'],
});

export const aiRequestDuration = new Histogram({
  name: 'myco_backend_ai_request_duration_seconds',
  help: 'Duration of AI requests in seconds',
  labelNames: ['type', 'model'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 20, 30, 60],
});

export const aiTokensUsed = new Counter({
  name: 'myco_backend_ai_tokens_used_total',
  help: 'Total number of AI tokens used',
  labelNames: ['type', 'model'],
});

export const errorRate = new Counter({
  name: 'myco_backend_errors_total',
  help: 'Total number of errors',
  labelNames: ['service', 'error_type', 'severity'],
});

export const businessMetrics = {
  usersActive: new Gauge({
    name: 'myco_backend_users_active',
    help: 'Number of active users',
    labelNames: ['period'], // 'last_1h', 'last_24h', 'last_7d'
  }),

  projectsCreated: new Counter({
    name: 'myco_backend_projects_created_total',
    help: 'Total number of projects created',
  }),

  codeGenerated: new Counter({
    name: 'myco_backend_code_generated_lines_total',
    help: 'Total lines of code generated',
    labelNames: ['language', 'framework'],
  }),

  chatMessages: new Counter({
    name: 'myco_backend_chat_messages_total',
    help: 'Total number of chat messages',
    labelNames: ['direction'], // 'incoming', 'outgoing'
  }),
};

// SLO metrics
export const sloMetrics = {
  availability: new Gauge({
    name: 'myco_backend_slo_availability',
    help: 'Service availability percentage',
    labelNames: ['service'],
  }),

  latencyP95: new Gauge({
    name: 'myco_backend_slo_latency_p95_seconds',
    help: '95th percentile latency',
    labelNames: ['service', 'endpoint'],
  }),

  errorRate: new Gauge({
    name: 'myco_backend_slo_error_rate',
    help: 'Error rate percentage',
    labelNames: ['service'],
  }),

  throughput: new Gauge({
    name: 'myco_backend_slo_throughput_rps',
    help: 'Throughput in requests per second',
    labelNames: ['service'],
  }),
};

// Health check metrics
export const healthMetrics = {
  serviceHealth: new Gauge({
    name: 'myco_backend_service_health',
    help: 'Service health status (1 = healthy, 0 = unhealthy)',
    labelNames: ['service'],
  }),

  dependencyHealth: new Gauge({
    name: 'myco_backend_dependency_health',
    help: 'Dependency health status (1 = healthy, 0 = unhealthy)',
    labelNames: ['dependency'],
  }),

  lastHealthCheck: new Gauge({
    name: 'myco_backend_last_health_check_timestamp',
    help: 'Timestamp of last health check',
    labelNames: ['service'],
  }),
};

// Function to get all metrics
export async function getMetrics(): Promise<string> {
  return register.metrics();
}

// Function to clear all metrics (useful for testing)
export function clearMetrics(): void {
  register.clear();
}

// Function to get metric registry
export function getRegistry() {
  return register;
}

// Utility functions for common metric patterns
export function recordHttpRequest(
  method: string,
  route: string,
  statusCode: number,
  duration: number,
  service: string = 'backend'
) {
  const labels = {
    method: method.toUpperCase(),
    route,
    status_code: statusCode.toString(),
    service,
  };

  httpRequestsTotal.inc(labels);
  httpRequestDuration.observe(labels, duration / 1000); // Convert ms to seconds
}

export function recordDatabaseQuery(
  operation: string,
  table: string,
  duration: number,
  success: boolean = true
) {
  const queryLabels = { operation, table };
  const countLabels = { operation, table, status: success ? 'success' : 'error' };

  databaseQueryDuration.observe(queryLabels, duration / 1000);
  databaseQueriesTotal.inc(countLabels);
}

export function recordAuthRequest(type: string, success: boolean = true) {
  authRequestsTotal.inc({
    type,
    status: success ? 'success' : 'failure',
  });
}

export function recordProjectOperation(operation: string, success: boolean = true) {
  projectOperationsTotal.inc({
    operation,
    status: success ? 'success' : 'error',
  });
}

export function recordFilesystemOperation(operation: string, success: boolean = true) {
  filesystemOperationsTotal.inc({
    operation,
    status: success ? 'success' : 'error',
  });
}

export function recordAIRequest(
  type: string,
  model: string,
  duration: number,
  tokensUsed: number = 0,
  success: boolean = true
) {
  const labels = { type, model };
  const countLabels = { ...labels, status: success ? 'success' : 'error' };

  aiRequestsTotal.inc(countLabels);
  aiRequestDuration.observe(labels, duration / 1000);
  
  if (tokensUsed > 0) {
    aiTokensUsed.inc(labels, tokensUsed);
  }
}

export function recordError(
  service: string,
  errorType: string,
  severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
) {
  errorRate.inc({ service, error_type: errorType, severity });
}

export function updateServiceHealth(service: string, isHealthy: boolean) {
  healthMetrics.serviceHealth.set({ service }, isHealthy ? 1 : 0);
  healthMetrics.lastHealthCheck.set({ service }, Date.now() / 1000);
}

export function updateDependencyHealth(dependency: string, isHealthy: boolean) {
  healthMetrics.dependencyHealth.set({ dependency }, isHealthy ? 1 : 0);
}

export function updateProjectCount(status: string, count: number) {
  projectCount.set({ status }, count);
}

export function updateActiveUsers(period: string, count: number) {
  businessMetrics.usersActive.set({ period }, count);
}

export function recordCodeGeneration(language: string, framework: string, lines: number) {
  businessMetrics.codeGenerated.inc({ language, framework }, lines);
}

export function recordChatMessage(direction: 'incoming' | 'outgoing') {
  businessMetrics.chatMessages.inc({ direction });
}

// SLO tracking functions
export function updateSLOMetrics(
  service: string,
  endpoint: string,
  availability: number,
  latencyP95: number,
  errorRate: number,
  throughput: number
) {
  sloMetrics.availability.set({ service }, availability);
  sloMetrics.latencyP95.set({ service, endpoint }, latencyP95);
  sloMetrics.errorRate.set({ service }, errorRate);
  sloMetrics.throughput.set({ service }, throughput);
}

// Initialize default values
updateServiceHealth('backend', true);
updateDependencyHealth('database', true);
updateDependencyHealth('ai_engine', true);