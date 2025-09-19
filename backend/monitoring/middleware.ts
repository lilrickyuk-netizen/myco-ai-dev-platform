import { trackRequest } from "./metrics";
import log from "encore.dev/log";

// Simple middleware interface for request tracking
export interface RequestMetrics {
  startTime: number;
  endpoint: string;
  method: string;
}

// Start tracking a request
export function startRequestTracking(endpoint: string, method: string): RequestMetrics {
  return {
    startTime: Date.now(),
    endpoint,
    method
  };
}

// End tracking and record metrics
export function endRequestTracking(metrics: RequestMetrics, statusCode: number): void {
  const responseTime = Date.now() - metrics.startTime;
  
  try {
    trackRequest(metrics.endpoint, metrics.method, statusCode, responseTime);
  } catch (error) {
    log.error('Failed to track request metrics', error);
  }
}

// Utility function to wrap API handlers with metrics tracking
export function withMetrics<T extends (...args: any[]) => Promise<any>>(
  endpoint: string,
  method: string,
  handler: T
): T {
  return (async (...args: any[]) => {
    const tracking = startRequestTracking(endpoint, method);
    let statusCode = 200;
    
    try {
      const result = await handler(...args);
      return result;
    } catch (error) {
      // Determine status code from error type
      if (error instanceof Error) {
        if (error.message.includes('not found')) statusCode = 404;
        else if (error.message.includes('unauthorized')) statusCode = 401;
        else if (error.message.includes('forbidden')) statusCode = 403;
        else statusCode = 500;
      } else {
        statusCode = 500;
      }
      throw error;
    } finally {
      endRequestTracking(tracking, statusCode);
    }
  }) as T;
}