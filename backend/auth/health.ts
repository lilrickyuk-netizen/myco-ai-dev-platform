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
  { expose: true, method: "GET", path: "/auth/health" },
  async (): Promise<HealthResponse> => {
    const startTime = Date.now();
    
    // Check Clerk dependency
    const clerkStatus = await checkClerkHealth();
    
    const dependencies = {
      clerk: clerkStatus,
    };

    const allHealthy = Object.values(dependencies).every(dep => dep.status === "healthy");
    
    return {
      status: allHealthy ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      service: "auth",
      version: "1.0.0",
      uptime: process.uptime(),
      dependencies,
    };
  }
);

async function checkClerkHealth(): Promise<{ status: "healthy" | "unhealthy"; responseTime?: number; error?: string }> {
  const startTime = Date.now();
  
  try {
    // Simple check - if we can import Clerk without errors, it's healthy
    const { createClerkClient } = await import("@clerk/backend");
    const responseTime = Date.now() - startTime;
    
    return {
      status: "healthy",
      responseTime,
    };
  } catch (error) {
    return {
      status: "unhealthy",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}