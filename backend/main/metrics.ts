import { api } from "encore.dev/api";
import { getMetrics } from "../monitoring/metrics";

export interface MetricsResponse {
  metrics: string;
}

// Metrics endpoint for Prometheus scraping
export const metricsEndpoint = api<void, MetricsResponse>(
  { method: "GET", path: "/metrics", expose: true, auth: false },
  async (): Promise<MetricsResponse> => {
    const metrics = await getMetrics();
    return { metrics };
  }
);