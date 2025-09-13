import { performance } from 'perf_hooks';

interface MetricData {
  name: string;
  value: number;
  tags?: Record<string, string>;
  timestamp: number;
}

interface CounterMetric {
  name: string;
  value: number;
  tags: Record<string, string>;
}

interface GaugeMetric {
  name: string;
  value: number;
  tags: Record<string, string>;
}

interface HistogramMetric {
  name: string;
  values: number[];
  tags: Record<string, string>;
}

export class MetricsCollector {
  private static instance: MetricsCollector;
  private counters: Map<string, CounterMetric> = new Map();
  private gauges: Map<string, GaugeMetric> = new Map();
  private histograms: Map<string, HistogramMetric> = new Map();
  private startTimes: Map<string, number> = new Map();

  static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  // Counter metrics - values that only increase
  incrementCounter(name: string, value: number = 1, tags: Record<string, string> = {}): void {
    const key = this.getMetricKey(name, tags);
    const existing = this.counters.get(key);
    
    if (existing) {
      existing.value += value;
    } else {
      this.counters.set(key, { name, value, tags });
    }
  }

  // Gauge metrics - values that can go up or down
  setGauge(name: string, value: number, tags: Record<string, string> = {}): void {
    const key = this.getMetricKey(name, tags);
    this.gauges.set(key, { name, value, tags });
  }

  incrementGauge(name: string, value: number = 1, tags: Record<string, string> = {}): void {
    const key = this.getMetricKey(name, tags);
    const existing = this.gauges.get(key);
    
    if (existing) {
      existing.value += value;
    } else {
      this.gauges.set(key, { name, value, tags });
    }
  }

  decrementGauge(name: string, value: number = 1, tags: Record<string, string> = {}): void {
    this.incrementGauge(name, -value, tags);
  }

  // Histogram metrics - track distribution of values
  recordHistogram(name: string, value: number, tags: Record<string, string> = {}): void {
    const key = this.getMetricKey(name, tags);
    const existing = this.histograms.get(key);
    
    if (existing) {
      existing.values.push(value);
      // Keep only last 1000 values to prevent memory issues
      if (existing.values.length > 1000) {
        existing.values = existing.values.slice(-1000);
      }
    } else {
      this.histograms.set(key, { name, values: [value], tags });
    }
  }

  // Timing utilities
  startTimer(name: string): string {
    const timerId = `${name}_${Date.now()}_${Math.random()}`;
    this.startTimes.set(timerId, performance.now());
    return timerId;
  }

  endTimer(timerId: string, metricName: string, tags: Record<string, string> = {}): number {
    const startTime = this.startTimes.get(timerId);
    if (!startTime) {
      throw new Error(`Timer ${timerId} not found`);
    }
    
    const duration = performance.now() - startTime;
    this.recordHistogram(metricName, duration, tags);
    this.startTimes.delete(timerId);
    
    return duration;
  }

  // Convenience method for timing operations
  async timeOperation<T>(
    name: string, 
    operation: () => Promise<T>, 
    tags: Record<string, string> = {}
  ): Promise<T> {
    const timerId = this.startTimer(name);
    try {
      const result = await operation();
      this.endTimer(timerId, `${name}_duration`, { ...tags, status: 'success' });
      return result;
    } catch (error) {
      this.endTimer(timerId, `${name}_duration`, { ...tags, status: 'error' });
      this.incrementCounter(`${name}_errors`, 1, tags);
      throw error;
    }
  }

  // Business metrics
  recordUserAction(action: string, userId: string, projectId?: string): void {
    const tags: Record<string, string> = { action, userId };
    if (projectId) tags.projectId = projectId;
    
    this.incrementCounter('user_actions_total', 1, tags);
  }

  recordAPICall(endpoint: string, method: string, statusCode: number, duration: number): void {
    const tags = { 
      endpoint: endpoint.replace(/\/[0-9a-f-]{36}/g, '/:id'), // Replace UUIDs with :id
      method, 
      status: Math.floor(statusCode / 100).toString() + 'xx' 
    };
    
    this.incrementCounter('api_requests_total', 1, tags);
    this.recordHistogram('api_request_duration', duration, tags);
    
    if (statusCode >= 400) {
      this.incrementCounter('api_errors_total', 1, { ...tags, status_code: statusCode.toString() });
    }
  }

  recordDatabaseOperation(operation: string, table: string, duration: number, success: boolean): void {
    const tags = { operation, table, status: success ? 'success' : 'error' };
    
    this.incrementCounter('database_operations_total', 1, tags);
    this.recordHistogram('database_operation_duration', duration, tags);
    
    if (!success) {
      this.incrementCounter('database_errors_total', 1, tags);
    }
  }

  recordFileOperation(operation: string, fileType: string, size: number, success: boolean): void {
    const tags = { operation, file_type: fileType, status: success ? 'success' : 'error' };
    
    this.incrementCounter('file_operations_total', 1, tags);
    this.recordHistogram('file_size_bytes', size, tags);
    
    if (!success) {
      this.incrementCounter('file_operation_errors_total', 1, tags);
    }
  }

  recordAIUsage(provider: string, model: string, promptTokens: number, completionTokens: number): void {
    const tags = { provider, model };
    
    this.incrementCounter('ai_requests_total', 1, tags);
    this.incrementCounter('ai_tokens_total', promptTokens + completionTokens, { ...tags, type: 'total' });
    this.incrementCounter('ai_tokens_total', promptTokens, { ...tags, type: 'prompt' });
    this.incrementCounter('ai_tokens_total', completionTokens, { ...tags, type: 'completion' });
  }

  // System metrics
  recordSystemMetrics(): void {
    if (typeof process !== 'undefined') {
      const memUsage = process.memoryUsage();
      
      this.setGauge('nodejs_memory_usage_bytes', memUsage.rss, { type: 'rss' });
      this.setGauge('nodejs_memory_usage_bytes', memUsage.heapUsed, { type: 'heap_used' });
      this.setGauge('nodejs_memory_usage_bytes', memUsage.heapTotal, { type: 'heap_total' });
      this.setGauge('nodejs_memory_usage_bytes', memUsage.external, { type: 'external' });
      
      const cpuUsage = process.cpuUsage();
      this.setGauge('nodejs_cpu_usage_seconds', cpuUsage.user / 1000000, { type: 'user' });
      this.setGauge('nodejs_cpu_usage_seconds', cpuUsage.system / 1000000, { type: 'system' });
      
      this.setGauge('nodejs_uptime_seconds', process.uptime());
    }
  }

  // Get all metrics in Prometheus format
  getPrometheusMetrics(): string {
    const lines: string[] = [];
    
    // Counters
    for (const [key, metric] of this.counters) {
      const tagsStr = this.formatPrometheusTags(metric.tags);
      lines.push(`# TYPE ${metric.name} counter`);
      lines.push(`${metric.name}${tagsStr} ${metric.value}`);
    }
    
    // Gauges
    for (const [key, metric] of this.gauges) {
      const tagsStr = this.formatPrometheusTags(metric.tags);
      lines.push(`# TYPE ${metric.name} gauge`);
      lines.push(`${metric.name}${tagsStr} ${metric.value}`);
    }
    
    // Histograms
    for (const [key, metric] of this.histograms) {
      const tagsStr = this.formatPrometheusTags(metric.tags);
      const sorted = metric.values.slice().sort((a, b) => a - b);
      
      lines.push(`# TYPE ${metric.name} histogram`);
      
      // Calculate percentiles
      const percentiles = [0.5, 0.95, 0.99];
      for (const p of percentiles) {
        const index = Math.ceil(sorted.length * p) - 1;
        const value = sorted[Math.max(0, index)] || 0;
        const pTags = { ...metric.tags, quantile: p.toString() };
        const pTagsStr = this.formatPrometheusTags(pTags);
        lines.push(`${metric.name}${pTagsStr} ${value}`);
      }
      
      // Count and sum
      const countTags = this.formatPrometheusTags(metric.tags);
      lines.push(`${metric.name}_count${countTags} ${metric.values.length}`);
      lines.push(`${metric.name}_sum${countTags} ${metric.values.reduce((a, b) => a + b, 0)}`);
    }
    
    return lines.join('\n') + '\n';
  }

  // Get metrics as JSON
  getMetrics(): {
    counters: CounterMetric[];
    gauges: GaugeMetric[];
    histograms: Array<HistogramMetric & { stats: any }>;
  } {
    return {
      counters: Array.from(this.counters.values()),
      gauges: Array.from(this.gauges.values()),
      histograms: Array.from(this.histograms.values()).map(h => ({
        ...h,
        stats: this.calculateHistogramStats(h.values)
      }))
    };
  }

  // Reset all metrics
  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.startTimes.clear();
  }

  private getMetricKey(name: string, tags: Record<string, string>): string {
    const sortedTags = Object.keys(tags)
      .sort()
      .map(key => `${key}=${tags[key]}`)
      .join(',');
    return `${name}{${sortedTags}}`;
  }

  private formatPrometheusTags(tags: Record<string, string>): string {
    if (Object.keys(tags).length === 0) return '';
    
    const tagPairs = Object.entries(tags)
      .map(([key, value]) => `${key}="${value.replace(/"/g, '\\"')}"`)
      .join(',');
    
    return `{${tagPairs}}`;
  }

  private calculateHistogramStats(values: number[]): any {
    if (values.length === 0) {
      return { count: 0, sum: 0, avg: 0, min: 0, max: 0, p50: 0, p95: 0, p99: 0 };
    }
    
    const sorted = values.slice().sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    
    return {
      count: values.length,
      sum,
      avg: sum / values.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
    };
  }
}

// Global metrics instance
export const metrics = MetricsCollector.getInstance();

// Start collecting system metrics every 30 seconds
if (typeof process !== 'undefined') {
  setInterval(() => {
    metrics.recordSystemMetrics();
  }, 30000);
}