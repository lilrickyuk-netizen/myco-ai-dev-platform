import { EventEmitter } from 'events';

export interface Metric {
  name: string;
  value: number;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  labels?: Record<string, string>;
  timestamp: Date;
}

export interface HistogramBucket {
  le: number;
  count: number;
}

export interface HistogramMetric extends Metric {
  type: 'histogram';
  buckets: HistogramBucket[];
  sum: number;
  count: number;
}

export interface CounterMetric extends Metric {
  type: 'counter';
}

export interface GaugeMetric extends Metric {
  type: 'gauge';
}

export interface SummaryMetric extends Metric {
  type: 'summary';
  quantiles: { quantile: number; value: number }[];
  sum: number;
  count: number;
}

export class MetricsCollector extends EventEmitter {
  private metrics: Map<string, Metric> = new Map();
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, { values: number[]; buckets: number[] }> = new Map();
  private summaries: Map<string, { values: number[]; maxAge: number; maxSize: number }> = new Map();

  constructor() {
    super();
    this.startPeriodicCollection();
  }

  // Counter methods
  incrementCounter(name: string, labels?: Record<string, string>, value: number = 1): void {
    const key = this.generateKey(name, labels);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);

    const metric: CounterMetric = {
      name,
      value: current + value,
      type: 'counter',
      labels,
      timestamp: new Date(),
    };

    this.metrics.set(key, metric);
    this.emit('metric', metric);
  }

  // Gauge methods
  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.generateKey(name, labels);
    this.gauges.set(key, value);

    const metric: GaugeMetric = {
      name,
      value,
      type: 'gauge',
      labels,
      timestamp: new Date(),
    };

    this.metrics.set(key, metric);
    this.emit('metric', metric);
  }

  incrementGauge(name: string, labels?: Record<string, string>, delta: number = 1): void {
    const key = this.generateKey(name, labels);
    const current = this.gauges.get(key) || 0;
    this.setGauge(name, current + delta, labels);
  }

  decrementGauge(name: string, labels?: Record<string, string>, delta: number = 1): void {
    this.incrementGauge(name, labels, -delta);
  }

  // Histogram methods
  observeHistogram(name: string, value: number, labels?: Record<string, string>, buckets?: number[]): void {
    const key = this.generateKey(name, labels);
    const defaultBuckets = [0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1.0, 2.5, 5.0, 7.5, 10.0];
    const histogramBuckets = buckets || defaultBuckets;

    if (!this.histograms.has(key)) {
      this.histograms.set(key, { values: [], buckets: histogramBuckets });
    }

    const histogram = this.histograms.get(key)!;
    histogram.values.push(value);

    // Create histogram metric
    const bucketCounts: HistogramBucket[] = histogram.buckets.map(le => ({
      le,
      count: histogram.values.filter(v => v <= le).length,
    }));

    const metric: HistogramMetric = {
      name,
      value: value,
      type: 'histogram',
      labels,
      timestamp: new Date(),
      buckets: bucketCounts,
      sum: histogram.values.reduce((a, b) => a + b, 0),
      count: histogram.values.length,
    };

    this.metrics.set(key, metric);
    this.emit('metric', metric);
  }

  // Summary methods
  observeSummary(name: string, value: number, labels?: Record<string, string>, maxAge: number = 600000, maxSize: number = 1000): void {
    const key = this.generateKey(name, labels);

    if (!this.summaries.has(key)) {
      this.summaries.set(key, { values: [], maxAge, maxSize });
    }

    const summary = this.summaries.get(key)!;
    const now = Date.now();

    // Add new value
    summary.values.push(value);

    // Remove old values (older than maxAge)
    summary.values = summary.values.slice(-maxAge);

    // Limit size
    if (summary.values.length > maxSize) {
      summary.values = summary.values.slice(-maxSize);
    }

    // Calculate quantiles
    const sortedValues = [...summary.values].sort((a, b) => a - b);
    const quantiles = [0.5, 0.9, 0.95, 0.99].map(q => ({
      quantile: q,
      value: this.calculateQuantile(sortedValues, q),
    }));

    const metric: SummaryMetric = {
      name,
      value: value,
      type: 'summary',
      labels,
      timestamp: new Date(),
      quantiles,
      sum: summary.values.reduce((a, b) => a + b, 0),
      count: summary.values.length,
    };

    this.metrics.set(key, metric);
    this.emit('metric', metric);
  }

  // Application-specific metrics
  recordAPIRequest(endpoint: string, method: string, statusCode: number, duration: number, userId?: string): void {
    const labels = { endpoint, method, status: statusCode.toString() };
    
    // Count requests
    this.incrementCounter('api_requests_total', labels);
    
    // Record duration
    this.observeHistogram('api_request_duration_seconds', duration / 1000, labels);
    
    // Track active users
    if (userId) {
      this.setGauge('active_users', 1, { user_id: userId });
    }
    
    // Track errors
    if (statusCode >= 400) {
      this.incrementCounter('api_errors_total', labels);
    }
  }

  recordAIGeneration(model: string, tokensUsed: number, duration: number, success: boolean): void {
    const labels = { model, success: success.toString() };
    
    this.incrementCounter('ai_generations_total', labels);
    this.observeHistogram('ai_generation_duration_seconds', duration / 1000, labels);
    this.observeHistogram('ai_tokens_used', tokensUsed, labels);
  }

  recordProjectGeneration(templateType: string, filesGenerated: number, duration: number, success: boolean): void {
    const labels = { template_type: templateType, success: success.toString() };
    
    this.incrementCounter('project_generations_total', labels);
    this.observeHistogram('project_generation_duration_seconds', duration / 1000, labels);
    this.setGauge('files_generated', filesGenerated, labels);
  }

  recordCodeExecution(language: string, duration: number, memoryUsage: number, success: boolean): void {
    const labels = { language, success: success.toString() };
    
    this.incrementCounter('code_executions_total', labels);
    this.observeHistogram('code_execution_duration_seconds', duration / 1000, labels);
    this.setGauge('code_execution_memory_mb', memoryUsage, labels);
  }

  recordDeployment(provider: string, success: boolean, duration: number): void {
    const labels = { provider, success: success.toString() };
    
    this.incrementCounter('deployments_total', labels);
    this.observeHistogram('deployment_duration_seconds', duration / 1000, labels);
  }

  recordCollaboration(projectId: string, userCount: number, messageCount: number): void {
    const labels = { project_id: projectId };
    
    this.setGauge('collaboration_active_users', userCount, labels);
    this.incrementCounter('collaboration_messages_total', labels, messageCount);
  }

  // System metrics
  recordSystemMetrics(): void {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    this.setGauge('system_memory_heap_used_bytes', memUsage.heapUsed);
    this.setGauge('system_memory_heap_total_bytes', memUsage.heapTotal);
    this.setGauge('system_memory_external_bytes', memUsage.external);
    this.setGauge('system_memory_rss_bytes', memUsage.rss);
    
    this.setGauge('system_cpu_user_microseconds', cpuUsage.user);
    this.setGauge('system_cpu_system_microseconds', cpuUsage.system);
    
    this.setGauge('system_uptime_seconds', process.uptime());
  }

  // Database metrics
  recordDatabaseOperation(operation: string, table: string, duration: number, success: boolean): void {
    const labels = { operation, table, success: success.toString() };
    
    this.incrementCounter('database_operations_total', labels);
    this.observeHistogram('database_operation_duration_seconds', duration / 1000, labels);
  }

  recordDatabaseConnections(active: number, idle: number, total: number): void {
    this.setGauge('database_connections_active', active);
    this.setGauge('database_connections_idle', idle);
    this.setGauge('database_connections_total', total);
  }

  // Helper methods
  private generateKey(name: string, labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) {
      return name;
    }
    
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}="${value}"`)
      .join(',');
    
    return `${name}{${labelStr}}`;
  }

  private calculateQuantile(sortedValues: number[], quantile: number): number {
    if (sortedValues.length === 0) return 0;
    
    const index = quantile * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sortedValues[lower];
    }
    
    const weight = index - lower;
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  private startPeriodicCollection(): void {
    // Collect system metrics every 30 seconds
    setInterval(() => {
      this.recordSystemMetrics();
    }, 30000);
  }

  // Export methods
  getAllMetrics(): Metric[] {
    return Array.from(this.metrics.values());
  }

  getMetric(name: string, labels?: Record<string, string>): Metric | undefined {
    const key = this.generateKey(name, labels);
    return this.metrics.get(key);
  }

  getMetricsByName(name: string): Metric[] {
    return Array.from(this.metrics.values()).filter(metric => metric.name === name);
  }

  exportPrometheusFormat(): string {
    const lines: string[] = [];
    const metricsByName = new Map<string, Metric[]>();
    
    // Group metrics by name
    for (const metric of this.metrics.values()) {
      if (!metricsByName.has(metric.name)) {
        metricsByName.set(metric.name, []);
      }
      metricsByName.get(metric.name)!.push(metric);
    }
    
    // Generate Prometheus format
    for (const [name, metrics] of metricsByName.entries()) {
      const firstMetric = metrics[0];
      
      // Add HELP and TYPE comments
      lines.push(`# HELP ${name} ${this.getHelpText(name)}`);
      lines.push(`# TYPE ${name} ${firstMetric.type}`);
      
      for (const metric of metrics) {
        const labelStr = metric.labels 
          ? Object.entries(metric.labels)
              .map(([key, value]) => `${key}="${value}"`)
              .join(',')
          : '';
        
        const metricLine = labelStr 
          ? `${metric.name}{${labelStr}} ${metric.value}`
          : `${metric.name} ${metric.value}`;
        
        lines.push(metricLine);
      }
      
      lines.push('');
    }
    
    return lines.join('\\n');
  }

  private getHelpText(metricName: string): string {
    const helpTexts: Record<string, string> = {
      'api_requests_total': 'Total number of API requests',
      'api_request_duration_seconds': 'API request duration in seconds',
      'api_errors_total': 'Total number of API errors',
      'ai_generations_total': 'Total number of AI generations',
      'ai_generation_duration_seconds': 'AI generation duration in seconds',
      'ai_tokens_used': 'Number of tokens used in AI generation',
      'project_generations_total': 'Total number of project generations',
      'project_generation_duration_seconds': 'Project generation duration in seconds',
      'code_executions_total': 'Total number of code executions',
      'code_execution_duration_seconds': 'Code execution duration in seconds',
      'deployments_total': 'Total number of deployments',
      'deployment_duration_seconds': 'Deployment duration in seconds',
      'system_memory_heap_used_bytes': 'Heap memory used in bytes',
      'system_memory_heap_total_bytes': 'Total heap memory in bytes',
      'system_cpu_user_microseconds': 'CPU user time in microseconds',
      'database_operations_total': 'Total number of database operations',
      'database_operation_duration_seconds': 'Database operation duration in seconds',
      'active_users': 'Number of active users',
    };
    
    return helpTexts[metricName] || `Metric: ${metricName}`;
  }

  reset(): void {
    this.metrics.clear();
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.summaries.clear();
  }
}

// Global metrics collector instance
export const metricsCollector = new MetricsCollector();

export default metricsCollector;