import { api } from "encore.dev/api";
import { deploymentDB } from "./db";

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
  { expose: true, method: "GET", path: "/deployment/health" },
  async (): Promise<HealthResponse> => {
    const startTime = Date.now();
    
    // Check database dependency
    const dbStatus = await checkDatabaseHealth();
    
    const dependencies = {
      database: dbStatus,
    };

    const allHealthy = Object.values(dependencies).every(dep => dep.status === "healthy");
    
    return {
      status: allHealthy ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      service: "deployment",
      version: "1.0.0",
      uptime: process.uptime(),
      dependencies,
    };
  }
);

async function checkDatabaseHealth(): Promise<{ status: "healthy" | "unhealthy"; responseTime?: number; error?: string }> {
  const startTime = Date.now();
  
  try {
    // Simple query to check database connectivity
    await deploymentDB.queryRow`SELECT 1 as health_check`;
    const responseTime = Date.now() - startTime;
    
    return {
      status: "healthy",
      responseTime,
    };
  } catch (error) {
    return {
      status: "unhealthy",
      error: error instanceof Error ? error.message : "Database connection failed",
    };
  }
}