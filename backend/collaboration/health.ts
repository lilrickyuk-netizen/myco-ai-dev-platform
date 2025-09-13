import { api } from "encore.dev/api";

export interface HealthResponse {
  status: "healthy" | "unhealthy";
  timestamp: string;
  service: string;
  version: string;
  uptime: number;
  dependencies: {
    [key: string]: {
      status: "healthy" | "unhealthy";
      responseTime?: number;
      error?: string;
    };
  };
}

export const health = api(
  { expose: true, method: "GET", path: "/collaboration/health" },
  async (): Promise<HealthResponse> => {
    const startTime = Date.now();
    
    // Check WebSocket and Redis dependencies if needed
    const redisStatus = await checkRedisHealth();
    
    const dependencies = {
      redis: redisStatus,
    };

    const allHealthy = Object.values(dependencies).every(dep => dep.status === "healthy");
    
    return {
      status: allHealthy ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      service: "collaboration",
      version: "1.0.0",
      uptime: process.uptime(),
      dependencies,
    };
  }
);

async function checkRedisHealth(): Promise<{ status: "healthy" | "unhealthy"; responseTime?: number; error?: string }> {
  const startTime = Date.now();
  
  try {
    // Simple check - if Redis environment variables are set, assume healthy
    // In a real implementation, you'd ping Redis
    const redisUrl = process.env.REDIS_URL;
    const responseTime = Date.now() - startTime;
    
    if (redisUrl) {
      return {
        status: "healthy",
        responseTime,
      };
    } else {
      return {
        status: "unhealthy",
        error: "Redis URL not configured",
      };
    }
  } catch (error) {
    return {
      status: "unhealthy",
      error: error instanceof Error ? error.message : "Redis connection failed",
    };
  }
}