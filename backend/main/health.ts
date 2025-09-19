import { api } from "encore.dev/api";
import { validateEnvironment } from "./env-validation";

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