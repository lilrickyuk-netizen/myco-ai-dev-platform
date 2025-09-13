import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
// Local execution service interfaces
interface ExecutionRequest {
  userId: string;
  projectId?: string;
  code: string;
  language: string;
  framework?: string;
  timeout?: number;
  memoryLimit?: string;
  cpuLimit?: number;
  environment?: Record<string, string>;
  inputFiles?: Array<{ path: string; content: string }>;
  expectedOutputs?: string[];
  sandboxed?: boolean;
}

interface JobResult {
  id: string;
  status: 'success' | 'error' | 'timeout';
  output: string;
  error?: string;
  exitCode: number;
  duration: number;
  memoryUsage?: number;
  cpuUsage?: number;
  outputFiles?: Array<{ path: string; content: string }>;
}

export interface ExecuteCodeRequest {
  code: string;
  language: string;
  framework?: string;
  projectId?: string;
  timeout?: number;
  memoryLimit?: string;
  cpuLimit?: number;
  environment?: Record<string, string>;
  inputFiles?: Array<{ path: string; content: string }>;
  expectedOutputs?: string[];
}

export interface ExecuteCodeResponse {
  executionId: string;
  status: 'success' | 'error' | 'timeout';
  output: string;
  error?: string;
  exitCode: number;
  duration: number;
  memoryUsage?: number;
  cpuUsage?: number;
  outputFiles?: Array<{ path: string; content: string }>;
}

// Mock execution service for now - would integrate with actual execution engine
function mockExecuteCode(request: ExecutionRequest): Promise<JobResult> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        id: `exec_${Date.now()}`,
        status: 'success',
        output: `// Mock execution result for ${request.language}\nconsole.log("Hello from ${request.language}!");`,
        exitCode: 0,
        duration: Math.random() * 1000 + 500,
        memoryUsage: Math.floor(Math.random() * 50000000),
        cpuUsage: Math.random() * 10
      });
    }, 1000);
  });
}

export const execute = api<ExecuteCodeRequest, ExecuteCodeResponse>(
  { auth: true, expose: true, method: "POST", path: "/execution/execute" },
  async (req) => {
    const auth = getAuthData()!;
    
    try {
      // Validate input
      if (!req.code || !req.code.trim()) {
        throw APIError.invalidArgument("Code is required");
      }
      
      if (!req.language) {
        throw APIError.invalidArgument("Language is required");
      }
      
      // Check if language is supported
      const supportedLanguages = ['javascript', 'typescript', 'python', 'go', 'rust', 'java', 'cpp'];
      if (!supportedLanguages.includes(req.language)) {
        throw APIError.invalidArgument(
          `Language ${req.language} is not supported. Supported languages: ${supportedLanguages.join(', ')}`
        );
      }
      
      // Create execution request
      const executionRequest: ExecutionRequest = {
        userId: auth.userID,
        projectId: req.projectId,
        code: req.code,
        language: req.language,
        framework: req.framework,
        timeout: req.timeout,
        memoryLimit: req.memoryLimit,
        cpuLimit: req.cpuLimit,
        environment: req.environment,
        inputFiles: req.inputFiles,
        expectedOutputs: req.expectedOutputs,
        sandboxed: true
      };
      
      // Execute code (mock implementation)
      const result: JobResult = await mockExecuteCode(executionRequest);
      
      return {
        executionId: result.id,
        status: result.status,
        output: result.output,
        error: result.error,
        exitCode: result.exitCode,
        duration: result.duration,
        memoryUsage: result.memoryUsage,
        cpuUsage: result.cpuUsage,
        outputFiles: result.outputFiles
      };
      
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      
      // Handle specific error types
      if (error instanceof Error) {
        if (error.message.includes('rate limit')) {
          throw APIError.resourceExhausted(error.message);
        }
        if (error.message.includes('not allowed') || error.message.includes('blocked')) {
          throw APIError.permissionDenied(error.message);
        }
        if (error.message.includes('timeout')) {
          throw APIError.deadlineExceeded(error.message);
        }
      }
      
      throw APIError.internal(`Code execution failed: ${error}`);
    }
  }
);

export interface GetExecutionRequest {
  executionId: string;
}

export const getExecution = api<GetExecutionRequest, ExecuteCodeResponse>(
  { auth: true, expose: true, method: "GET", path: "/execution/:executionId" },
  async ({ executionId }) => {
    const auth = getAuthData()!;
    
    try {
      // Mock implementation - would integrate with actual execution engine
      const result = {
        id: executionId,
        status: 'success' as const,
        output: 'Mock execution result',
        exitCode: 0,
        duration: 1500
      };
      
      return {
        executionId: result.id,
        status: result.status,
        output: result.output,
        error: result.error,
        exitCode: result.exitCode,
        duration: result.duration,
        memoryUsage: result.memoryUsage,
        cpuUsage: result.cpuUsage,
        outputFiles: result.outputFiles
      };
      
    } catch (error) {
      throw APIError.internal(`Failed to get execution result: ${error}`);
    }
  }
);

export interface CancelExecutionRequest {
  executionId: string;
}

export const cancelExecution = api<CancelExecutionRequest, { success: boolean }>(
  { auth: true, expose: true, method: "DELETE", path: "/execution/:executionId" },
  async ({ executionId }) => {
    const auth = getAuthData()!;
    
    try {
      // Mock implementation - would integrate with actual execution engine
      return { success: true };
      
    } catch (error) {
      throw APIError.internal(`Failed to cancel execution: ${error}`);
    }
  }
);

export interface ExecutionStatusResponse {
  status: string | null;
}

export const getExecutionStatus = api<GetExecutionRequest, ExecutionStatusResponse>(
  { auth: true, expose: true, method: "GET", path: "/execution/:executionId/status" },
  async ({ executionId }) => {
    const auth = getAuthData()!;
    
    try {
      // Mock implementation - would integrate with actual execution engine
      return { status: 'completed' };
      
    } catch (error) {
      throw APIError.internal(`Failed to get execution status: ${error}`);
    }
  }
);

export interface ExecutionLogsResponse {
  logs: string | null;
}

export const getExecutionLogs = api<GetExecutionRequest, ExecutionLogsResponse>(
  { auth: true, expose: true, method: "GET", path: "/execution/:executionId/logs" },
  async ({ executionId }) => {
    const auth = getAuthData()!;
    
    try {
      // Mock implementation - would integrate with actual execution engine
      return { logs: 'Mock execution logs' };
      
    } catch (error) {
      throw APIError.internal(`Failed to get execution logs: ${error}`);
    }
  }
);

export interface SupportedLanguagesResponse {
  languages: string[];
}

export const getSupportedLanguages = api<{}, SupportedLanguagesResponse>(
  { auth: true, expose: true, method: "GET", path: "/execution/languages" },
  async () => {
    try {
      // Mock implementation - would integrate with actual execution engine
      const languages = ['javascript', 'typescript', 'python', 'go', 'rust', 'java', 'cpp'];
      return { languages };
      
    } catch (error) {
      throw APIError.internal(`Failed to get supported languages: ${error}`);
    }
  }
);

export interface ExecutionMetricsResponse {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  languageUsage: Record<string, number>;
  userUsage: Record<string, number>;
}

export const getExecutionMetrics = api<{}, ExecutionMetricsResponse>(
  { auth: true, expose: true, method: "GET", path: "/execution/metrics" },
  async () => {
    const auth = getAuthData()!;
    
    try {
      // Mock implementation - would integrate with actual execution engine
      return {
        totalExecutions: 1500,
        successfulExecutions: 1485,
        failedExecutions: 15,
        averageExecutionTime: 2.3,
        languageUsage: {
          javascript: 800,
          python: 500,
          typescript: 200
        },
        userUsage: {}
      };
      
    } catch (error) {
      throw APIError.internal(`Failed to get execution metrics: ${error}`);
    }
  }
);

export interface ExecutionHealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  details: Record<string, any>;
}

export const getExecutionHealth = api<{}, ExecutionHealthResponse>(
  { auth: true, expose: true, method: "GET", path: "/execution/health" },
  async () => {
    try {
      // Mock implementation - would integrate with actual execution engine
      return {
        status: 'healthy' as const,
        details: {
          dockerHealthy: true,
          queueStatus: { queueLength: 0, activeJobs: 0, maxConcurrent: 10 },
          supportedLanguages: 7
        }
      };
      
    } catch (error) {
      throw APIError.internal(`Failed to get execution health: ${error}`);
    }
  }
);

// Cleanup function for graceful shutdown
export async function cleanup() {
  // Mock cleanup - would integrate with actual execution engine
  console.log('Execution service cleanup completed');
}