import { api } from "encore.dev/api";
import { getCurrentRequest } from "encore.dev/internal/reqtrack";
import log from "encore.dev/log";

// Metrics storage for demonstration (in production, use proper metrics collection)
interface MetricsData {
  timestamp: string;
  service: string;
  endpoint: string;
  method: string;
  status_code: number;
  response_time_ms: number;
  memory_usage_mb?: number;
  cpu_usage_percent?: number;
}

interface SystemMetrics {
  uptime_seconds: number;
  memory_usage_mb: number;
  cpu_usage_percent: number;
  active_connections: number;
  total_requests: number;
  error_rate: number;
}

interface HealthMetrics {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime_seconds: number;
  timestamp: string;
  checks: {
    database: 'healthy' | 'unhealthy';
    memory: 'healthy' | 'unhealthy';
    disk: 'healthy' | 'unhealthy';
  };
}

interface PrometheusMetric {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  help: string;
  value: number;
  labels?: Record<string, string>;
}

interface PrometheusResponse {
  metrics: string;
}

// Global metrics storage (in production, use Redis or proper metrics backend)
let requestCount = 0;
let errorCount = 0;
let responseTimeSum = 0;
let responseTimeCount = 0;
const startTime = Date.now();

// Track request metrics
function trackRequest(endpoint: string, method: string, statusCode: number, responseTime: number) {
  requestCount++;
  responseTimeSum += responseTime;
  responseTimeCount++;
  
  if (statusCode >= 400) {
    errorCount++;
  }
  
  log.info('Request tracked', {
    endpoint,
    method,
    statusCode,
    responseTime,
    requestCount,
    errorCount
  });
}

// Exposes Prometheus-compatible metrics endpoint
export const metrics = api<void, PrometheusResponse>(
  { expose: true, method: "GET", path: "/metrics" },
  async (): Promise<PrometheusResponse> => {
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    const avgResponseTime = responseTimeCount > 0 ? responseTimeSum / responseTimeCount : 0;
    const errorRate = requestCount > 0 ? errorCount / requestCount : 0;
    
    // Generate Prometheus format metrics
    const prometheusMetrics = [
      // HTTP request metrics
      `# HELP http_requests_total Total number of HTTP requests`,
      `# TYPE http_requests_total counter`,
      `http_requests_total{service="myco-ai-platform"} ${requestCount}`,
      '',
      `# HELP http_request_errors_total Total number of HTTP request errors`,
      `# TYPE http_request_errors_total counter`,
      `http_request_errors_total{service="myco-ai-platform"} ${errorCount}`,
      '',
      `# HELP http_request_duration_seconds HTTP request duration in seconds`,
      `# TYPE http_request_duration_seconds histogram`,
      `http_request_duration_seconds_sum{service="myco-ai-platform"} ${responseTimeSum / 1000}`,
      `http_request_duration_seconds_count{service="myco-ai-platform"} ${responseTimeCount}`,
      '',
      // P95 approximation (simplified for demo)
      `# HELP http_request_duration_seconds_p95 95th percentile of HTTP request duration`,
      `# TYPE http_request_duration_seconds_p95 gauge`,
      `http_request_duration_seconds_p95{service="myco-ai-platform"} ${Math.min(avgResponseTime * 1.5 / 1000, 2.0)}`,
      '',
      // Error rate
      `# HELP http_request_error_rate HTTP request error rate (0-1)`,
      `# TYPE http_request_error_rate gauge`,
      `http_request_error_rate{service="myco-ai-platform"} ${errorRate}`,
      '',
      // System metrics
      `# HELP process_uptime_seconds Process uptime in seconds`,
      `# TYPE process_uptime_seconds gauge`,
      `process_uptime_seconds{service="myco-ai-platform"} ${uptime}`,
      '',
      `# HELP nodejs_memory_usage_bytes Node.js memory usage in bytes`,
      `# TYPE nodejs_memory_usage_bytes gauge`,
      `nodejs_memory_usage_bytes{service="myco-ai-platform",type="rss"} ${process.memoryUsage().rss}`,
      `nodejs_memory_usage_bytes{service="myco-ai-platform",type="heapUsed"} ${process.memoryUsage().heapUsed}`,
      `nodejs_memory_usage_bytes{service="myco-ai-platform",type="heapTotal"} ${process.memoryUsage().heapTotal}`,
      '',
      // Health status
      `# HELP service_health Service health status (1=healthy, 0=unhealthy)`,
      `# TYPE service_health gauge`,
      `service_health{service="myco-ai-platform"} 1`,
      ''
    ].join('\n');
    
    return { metrics: prometheusMetrics };
  }
);

// Health metrics endpoint with detailed system information
export const health = api<void, HealthMetrics>(
  { expose: true, method: "GET", path: "/health" },
  async (): Promise<HealthMetrics> => {
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    const memUsage = process.memoryUsage();
    
    // Simple health checks (in production, implement proper checks)
    const memoryHealthy = memUsage.heapUsed / memUsage.heapTotal < 0.9;
    const databaseHealthy = true; // Would check database connection
    const diskHealthy = true; // Would check disk space
    
    const overallHealth = memoryHealthy && databaseHealthy && diskHealthy 
      ? 'healthy' as const
      : 'degraded' as const;
    
    return {
      status: overallHealth,
      version: process.env.APP_VERSION || '1.0.0',
      uptime_seconds: uptime,
      timestamp: new Date().toISOString(),
      checks: {
        database: databaseHealthy ? 'healthy' : 'unhealthy',
        memory: memoryHealthy ? 'healthy' : 'unhealthy',
        disk: diskHealthy ? 'healthy' : 'unhealthy'
      }
    };
  }
);

// System metrics endpoint for detailed monitoring
export const systemMetrics = api<void, SystemMetrics>(
  { expose: true, method: "GET", path: "/system" },
  async (): Promise<SystemMetrics> => {
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const errorRate = requestCount > 0 ? errorCount / requestCount : 0;
    
    return {
      uptime_seconds: uptime,
      memory_usage_mb: Math.round(memUsage.heapUsed / 1024 / 1024),
      cpu_usage_percent: Math.round((cpuUsage.user + cpuUsage.system) / 1000000 * 100) / 100,
      active_connections: 0, // Would track active connections
      total_requests: requestCount,
      error_rate: errorRate
    };
  }
);

// Record a custom metric (for use by other services)
export const recordMetric = api<MetricsData, { success: boolean }>(
  { expose: false, method: "POST", path: "/record" },
  async (data: MetricsData): Promise<{ success: boolean }> => {
    // Track the metric
    trackRequest(data.endpoint, data.method, data.status_code, data.response_time_ms);
    
    log.info('Custom metric recorded', data);
    
    return { success: true };
  }
);

// Export the tracking function for use by middleware
export { trackRequest };