import { api, APIError } from "encore.dev/api";
import { validateEnvironment } from "./env-validation";
import db from "../db";

export interface GlobalHealthResponse {
  status: "healthy" | "unhealthy" | "degraded";
  timestamp: string;
  version: string;
  services: string[];
  environment: {
    valid: boolean;
    errors: string[];
    warnings: string[];
    missingOptional: string[];
    database?: string;
  };
  nodeEnv: string;
}

// Global health check for the entire platform.
export const health = api(
  { expose: true, method: "GET", path: "/health" },
  async (): Promise<GlobalHealthResponse> => {
    const envValidation = validateEnvironment();
    
    // Test database connectivity
    let dbHealthy = true;
    try {
      await db.queryRow`SELECT 1 as test`;
    } catch (error) {
      console.error("Database health check failed:", error);
      dbHealthy = false;
    }
    
    // Determine overall status
    let status: "healthy" | "unhealthy" | "degraded" = "healthy";
    if (!envValidation.valid || !dbHealthy) {
      status = "unhealthy";
    } else if (envValidation.warnings.length > 0) {
      status = "degraded";
    }

    const services = [
      "main",
      "auth",
      "project", 
      "filesystem",
      "ai"
    ];

    return {
      status,
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      services,
      environment: {
        ...envValidation,
        database: dbHealthy ? "connected" : "disconnected"
      },
      nodeEnv: process.env.NODE_ENV || "development"
    };
  }
);

export interface ReadinessResponse {
  status: "ready" | "degraded";
  services: {
    database: "available" | "unavailable";
    ai_engine: "available" | "unavailable";
  };
  timestamp: string;
}

// Readiness check to determine if the service can handle traffic.
export const ready = api(
  { expose: true, method: "GET", path: "/ready" },
  async (): Promise<ReadinessResponse> => {
    const services = {
      database: "unavailable" as "available" | "unavailable",
      ai_engine: "unavailable" as "available" | "unavailable"
    };

    // Check Database
    try {
      await db.queryRow`SELECT 1 as test`;
      services.database = "available";
    } catch (error) {
      console.error("Database readiness check failed:", error);
    }

    // Check AI Engine
    try {
      const aiEngineUrl = process.env.AI_ENGINE_URL || "http://ai-engine:8001";
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(`${aiEngineUrl}/healthz`, {
        signal: controller.signal
      });
      if (response.ok) {
        services.ai_engine = "available";
      }
    } catch (error) {
      console.error("AI Engine readiness check failed:", error);
    }

    const criticalServicesAvailable = services.database === "available";
    const status = criticalServicesAvailable ? "ready" : "degraded";

    return {
      status,
      services,
      timestamp: new Date().toISOString()
    };
  }
);

// Legacy export for test compatibility
export const status = health;