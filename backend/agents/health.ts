import { api } from "encore.dev/api";
import { agentsDB } from "./db";

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
  { expose: true, method: "GET", path: "/health" },
  async (): Promise<HealthResponse> => {
    const startTime = Date.now();
    
    // Check database dependency
    const dbStatus = await checkDatabaseHealth();
    const aiEngineStatus = await checkAIEngineHealth();
    
    const dependencies = {
      database: dbStatus,
      aiEngine: aiEngineStatus,
    };

    const allHealthy = Object.values(dependencies).every(dep => dep.status === "healthy");
    
    return {
      status: allHealthy ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      service: "agents",
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
    await agentsDB.queryRow`SELECT 1 as health_check`;
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

async function checkAIEngineHealth(): Promise<{ status: "healthy" | "unhealthy"; responseTime?: number; error?: string }> {
  const startTime = Date.now();
  
  try {
    const aiEngineUrl = process.env.AI_ENGINE_URL || 'http://localhost:8001';
    const response = await fetch(`${aiEngineUrl}/health/ping`, {
      method: 'GET',
      timeout: 5000, // 5 second timeout
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
        error: `AI Engine returned ${response.status}: ${response.statusText}`,
      };
    }
  } catch (error) {
    return {
      status: "unhealthy",
      error: error instanceof Error ? error.message : "AI Engine connection failed",
    };
  }
}