import { api } from "encore.dev/api";
import { getMetrics } from "../monitoring/metrics";

// Metrics endpoint for Prometheus scraping
export const metricsEndpoint = api(
  { method: "GET", path: "/metrics", expose: true, auth: false },
  async (): Promise<string> => {
    return await getMetrics();
  }
);