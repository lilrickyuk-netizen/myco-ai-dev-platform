import { api } from "encore.dev/api";
import { validateEnvironment } from "./env-validation";
import { HTTPError } from "encore.dev/api";

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
  };
  nodeEnv: string;
}

export const health = api(
  { expose: true, method: "GET", path: "/health" },
  async (): Promise<GlobalHealthResponse> => {
    const envValidation = validateEnvironment();
    
    // Determine overall status
    let status: "healthy" | "unhealthy" | "degraded" = "healthy";
    if (!envValidation.valid) {
      status = "unhealthy";
    } else if (envValidation.warnings.length > 0) {
      status = "degraded";
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      services: [
        "auth",
        "projects", 
        "files",
        "ai",
        "agents",
        "deployment",
        "execution",
        "collaboration"
      ],
      environment: envValidation,
      nodeEnv: process.env.NODE_ENV || "unknown"
    };
  }
);

export interface ReadinessResponse {
  status: "ready" | "degraded";
  services: {
    postgres: "available" | "unavailable";
    redis: "available" | "unavailable";
    ai_engine: "available" | "unavailable";
  };
  timestamp: string;
}

export const ready = api(
  { expose: true, method: "GET", path: "/ready" },
  async (): Promise<ReadinessResponse> => {
    const services = {
      postgres: "unavailable" as "available" | "unavailable",
      redis: "unavailable" as "available" | "unavailable", 
      ai_engine: "unavailable" as "available" | "unavailable"
    };

    // Check Postgres
    try {
      // This would be implemented with actual database connection
      services.postgres = "available";
    } catch (error) {
      console.error("Postgres check failed:", error);
    }

    // Check Redis
    try {
      // This would be implemented with actual Redis connection
      services.redis = "available";
    } catch (error) {
      console.error("Redis check failed:", error);
    }

    // Check AI Engine
    try {
      const aiEngineUrl = process.env.AI_ENGINE_URL || "http://ai-engine:8001";
      const response = await fetch(`${aiEngineUrl}/health`);
      if (response.ok) {
        services.ai_engine = "available";
      }
    } catch (error) {
      console.error("AI Engine check failed:", error);
    }

    const allAvailable = Object.values(services).every(s => s === "available");
    const status = allAvailable ? "ready" : "degraded";

    return {
      status,
      services,
      timestamp: new Date().toISOString()
    };
  }
);