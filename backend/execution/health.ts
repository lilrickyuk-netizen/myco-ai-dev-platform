import { api } from "encore.dev/api";
import { executionDB } from "./db";

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
  { expose: true, method: "GET", path: "/execution/health" },
  async (): Promise<HealthResponse> => {
    const startTime = Date.now();
    
    // Check database and execution engine dependencies
    const dbStatus = await checkDatabaseHealth();
    const executionEngineStatus = await checkExecutionEngineHealth();
    
    const dependencies = {
      database: dbStatus,
      executionEngine: executionEngineStatus,
    };

    const allHealthy = Object.values(dependencies).every(dep => dep.status === "healthy");
    
    return {
      status: allHealthy ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      service: "execution",
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
    await executionDB.queryRow`SELECT 1 as health_check`;
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

async function checkExecutionEngineHealth(): Promise<{ status: "healthy" | "unhealthy"; responseTime?: number; error?: string }> {
  const startTime = Date.now();
  
  try {
    const executionEngineUrl = process.env.EXECUTION_ENGINE_URL || 'http://localhost:8001';
    const response = await fetch(`${executionEngineUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    
    const responseTime = Date.now() - startTime;
    
    if (response.ok) {
      return {
        status: "healthy",
        responseTime,
      };
    } else {
      return {
        status: "unhealthy",
        error: `Execution Engine returned ${response.status}: ${response.statusText}`,
      };
    }
  } catch (error) {
    return {
      status: "unhealthy",
      error: error instanceof Error ? error.message : "Execution Engine connection failed",
    };
  }
}