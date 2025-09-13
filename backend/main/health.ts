import { api } from "encore.dev/api";

export interface GlobalHealthResponse {
  status: "healthy" | "unhealthy";
  timestamp: string;
  version: string;
  services: string[];
}

export const health = api(
  { expose: true, method: "GET", path: "/health" },
  async (): Promise<GlobalHealthResponse> => {
    return {
      status: "healthy",
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
      ]
    };
  }
);