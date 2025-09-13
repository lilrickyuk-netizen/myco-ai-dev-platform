import { EventEmitter } from 'events';
import { EnhancedDockerManager, JobConfig, JobResult } from './containers/enhanced_docker_manager';
import { randomUUID } from 'crypto';

export interface ExecutionRequest {
  id?: string;
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

export interface ExecutionMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  languageUsage: Record<string, number>;
  userUsage: Record<string, number>;
}

export interface SecurityPolicy {
  allowedLanguages: string[];
  maxExecutionTime: number;
  maxMemoryUsage: string;
  maxConcurrentJobs: number;
  allowNetworkAccess: boolean;
  allowFileSystemAccess: boolean;
  blockedPackages: string[];
  rateLimits: {
    perUser: number;
    perProject: number;
    timeWindow: number; // in seconds
  };
}

export class ExecutionService extends EventEmitter {
  private dockerManager: EnhancedDockerManager;
  private executions: Map<string, JobResult> = new Map();
  private metrics: ExecutionMetrics = {
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    averageExecutionTime: 0,
    languageUsage: {},
    userUsage: {}
  };
  
  private securityPolicy: SecurityPolicy = {
    allowedLanguages: ['javascript', 'typescript', 'python', 'go', 'rust', 'java', 'cpp'],
    maxExecutionTime: 30, // seconds
    maxMemoryUsage: '512m',
    maxConcurrentJobs: 10,
    allowNetworkAccess: false,
    allowFileSystemAccess: true,
    blockedPackages: ['os', 'subprocess', 'exec', 'eval'],
    rateLimits: {
      perUser: 100,
      perProject: 500,
      timeWindow: 3600 // 1 hour
    }
  };

  private rateLimitTracking: Map<string, Array<number>> = new Map();

  constructor() {
    super();
    this.dockerManager = new EnhancedDockerManager();
    this.setupEventHandlers();
    this.startCleanupProcess();
  }

  private setupEventHandlers(): void {
    this.dockerManager.on('jobComplete', (result: JobResult) => {
      this.handleJobComplete(result);
    });

    this.dockerManager.on('jobError', (error: any, jobId: string) => {
      this.handleJobError(error, jobId);
    });
  }

  private handleJobComplete(result: JobResult): void {
    // Store result
    this.executions.set(result.id, result);
    
    // Update metrics
    this.updateMetrics(result);
    
    // Emit completion event
    this.emit('executionComplete', result);
    
    // Clean up old results after 1 hour
    setTimeout(() => {
      this.executions.delete(result.id);
    }, 3600000);
  }

  private handleJobError(error: any, jobId: string): void {
    const errorResult: JobResult = {
      id: jobId,
      status: 'error',
      output: '',
      error: error.message || 'Unknown error',
      exitCode: 1,
      duration: 0
    };
    
    this.handleJobComplete(errorResult);
  }

  private updateMetrics(result: JobResult): void {
    this.metrics.totalExecutions++;
    
    if (result.status === 'success') {
      this.metrics.successfulExecutions++;
    } else {
      this.metrics.failedExecutions++;
    }
    
    // Update average execution time
    const totalTime = this.metrics.averageExecutionTime * (this.metrics.totalExecutions - 1) + result.duration;
    this.metrics.averageExecutionTime = totalTime / this.metrics.totalExecutions;
  }

  private startCleanupProcess(): void {
    // Clean up old rate limit tracking every hour
    setInterval(() => {
      const now = Date.now();
      const windowMs = this.securityPolicy.rateLimits.timeWindow * 1000;
      
      for (const [key, timestamps] of this.rateLimitTracking.entries()) {
        const validTimestamps = timestamps.filter(ts => now - ts < windowMs);
        if (validTimestamps.length === 0) {
          this.rateLimitTracking.delete(key);
        } else {
          this.rateLimitTracking.set(key, validTimestamps);
        }
      }
    }, 3600000); // Run every hour
  }

  async executeCode(request: ExecutionRequest): Promise<JobResult> {
    // Validate request
    this.validateExecutionRequest(request);
    
    // Check rate limits
    this.checkRateLimits(request);
    
    // Apply security policies
    const secureRequest = this.applySecurityPolicies(request);
    
    // Create job configuration
    const jobConfig: JobConfig = {
      id: request.id || randomUUID(),
      name: `execution-${secureRequest.userId}`,
      image: this.getImageForLanguage(secureRequest.language),
      code: this.sanitizeCode(secureRequest.code, secureRequest.language),
      language: secureRequest.language,
      framework: secureRequest.framework,
      timeout: secureRequest.timeout || this.securityPolicy.maxExecutionTime,
      memoryLimit: secureRequest.memoryLimit || this.securityPolicy.maxMemoryUsage,
      cpuLimit: secureRequest.cpuLimit || 1,
      environment: this.sanitizeEnvironment(secureRequest.environment),
      inputFiles: secureRequest.inputFiles,
      expectedOutputs: secureRequest.expectedOutputs
    };
    
    // Track rate limiting
    this.trackRateLimit(request.userId, request.projectId);
    
    // Update language usage metrics
    this.metrics.languageUsage[secureRequest.language] = 
      (this.metrics.languageUsage[secureRequest.language] || 0) + 1;
    
    // Update user usage metrics
    this.metrics.userUsage[secureRequest.userId] = 
      (this.metrics.userUsage[secureRequest.userId] || 0) + 1;
    
    try {
      // Execute the job
      const result = await this.dockerManager.executeCode(jobConfig);
      
      // Post-process result
      return this.postProcessResult(result, request);
    } catch (error) {
      // Handle execution error
      const errorResult: JobResult = {
        id: jobConfig.id!,
        status: 'error',
        output: '',
        error: error instanceof Error ? error.message : 'Unknown execution error',
        exitCode: 1,
        duration: 0
      };
      
      this.handleJobComplete(errorResult);
      return errorResult;
    }
  }

  private validateExecutionRequest(request: ExecutionRequest): void {
    if (!request.code || !request.code.trim()) {
      throw new Error('Code is required');
    }
    
    if (!request.language) {
      throw new Error('Language is required');
    }
    
    if (!this.securityPolicy.allowedLanguages.includes(request.language)) {
      throw new Error(`Language ${request.language} is not allowed`);
    }
    
    if (!request.userId) {
      throw new Error('User ID is required');
    }
    
    // Check code length
    if (request.code.length > 100000) { // 100KB limit
      throw new Error('Code is too large (max 100KB)');
    }
    
    // Check for blocked patterns
    this.checkForBlockedPatterns(request.code, request.language);
  }

  private checkForBlockedPatterns(code: string, language: string): void {
    const blockedPatterns = {
      javascript: [
        /require\s*\(\s*['"]child_process['"]\s*\)/,
        /require\s*\(\s*['"]fs['"]\s*\)/,
        /process\.exit/,
        /eval\s*\(/,
        /Function\s*\(/
      ],
      python: [
        /import\s+os/,
        /import\s+subprocess/,
        /import\s+sys/,
        /exec\s*\(/,
        /eval\s*\(/,
        /__import__/
      ],
      typescript: [
        /require\s*\(\s*['"]child_process['"]\s*\)/,
        /require\s*\(\s*['"]fs['"]\s*\)/,
        /process\.exit/,
        /eval\s*\(/
      ]
    };
    
    const patterns = blockedPatterns[language as keyof typeof blockedPatterns] || [];
    
    for (const pattern of patterns) {
      if (pattern.test(code)) {
        throw new Error(`Blocked pattern detected: ${pattern.source}`);
      }
    }
  }

  private checkRateLimits(request: ExecutionRequest): void {
    const now = Date.now();
    const windowMs = this.securityPolicy.rateLimits.timeWindow * 1000;
    
    // Check user rate limit
    const userKey = `user:${request.userId}`;
    const userTimestamps = this.rateLimitTracking.get(userKey) || [];
    const recentUserExecutions = userTimestamps.filter(ts => now - ts < windowMs);
    
    if (recentUserExecutions.length >= this.securityPolicy.rateLimits.perUser) {
      throw new Error('User rate limit exceeded');
    }
    
    // Check project rate limit if projectId is provided
    if (request.projectId) {
      const projectKey = `project:${request.projectId}`;
      const projectTimestamps = this.rateLimitTracking.get(projectKey) || [];
      const recentProjectExecutions = projectTimestamps.filter(ts => now - ts < windowMs);
      
      if (recentProjectExecutions.length >= this.securityPolicy.rateLimits.perProject) {
        throw new Error('Project rate limit exceeded');
      }
    }
  }

  private trackRateLimit(userId: string, projectId?: string): void {
    const now = Date.now();
    
    // Track user rate limit
    const userKey = `user:${userId}`;
    const userTimestamps = this.rateLimitTracking.get(userKey) || [];
    userTimestamps.push(now);
    this.rateLimitTracking.set(userKey, userTimestamps);
    
    // Track project rate limit
    if (projectId) {
      const projectKey = `project:${projectId}`;
      const projectTimestamps = this.rateLimitTracking.get(projectKey) || [];
      projectTimestamps.push(now);
      this.rateLimitTracking.set(projectKey, projectTimestamps);
    }
  }

  private applySecurityPolicies(request: ExecutionRequest): ExecutionRequest {
    return {
      ...request,
      timeout: Math.min(request.timeout || 30, this.securityPolicy.maxExecutionTime),
      memoryLimit: request.memoryLimit || this.securityPolicy.maxMemoryUsage,
      cpuLimit: Math.min(request.cpuLimit || 1, 2), // Max 2 CPU cores
      environment: this.sanitizeEnvironment(request.environment)
    };
  }

  private sanitizeEnvironment(env?: Record<string, string>): Record<string, string> {
    if (!env) return {};
    
    const sanitized: Record<string, string> = {};
    const allowedKeys = ['NODE_ENV', 'PYTHONPATH', 'GOPATH', 'JAVA_HOME'];
    
    for (const [key, value] of Object.entries(env)) {
      if (allowedKeys.includes(key) && typeof value === 'string') {
        sanitized[key] = value.substring(0, 1000); // Limit value length
      }
    }
    
    return sanitized;
  }

  private sanitizeCode(code: string, language: string): string {
    // Remove potentially dangerous comments or embedded commands
    let sanitized = code.trim();
    
    // Language-specific sanitization
    switch (language) {
      case 'javascript':
      case 'typescript':
        // Remove eval and Function constructor usage
        sanitized = sanitized.replace(/eval\s*\(/g, '// eval(');
        sanitized = sanitized.replace(/Function\s*\(/g, '// Function(');
        break;
      
      case 'python':
        // Remove exec and eval usage
        sanitized = sanitized.replace(/exec\s*\(/g, '# exec(');
        sanitized = sanitized.replace(/eval\s*\(/g, '# eval(');
        break;
    }
    
    return sanitized;
  }

  private getImageForLanguage(language: string): string {
    const runtime = this.dockerManager.getLanguageRuntime(language);
    if (!runtime) {
      throw new Error(`No runtime available for language: ${language}`);
    }
    return runtime.image;
  }

  private postProcessResult(result: JobResult, request: ExecutionRequest): JobResult {
    return {
      ...result,
      output: this.sanitizeOutput(result.output),
      error: result.error ? this.sanitizeOutput(result.error) : undefined
    };
  }

  private sanitizeOutput(output: string): string {
    // Remove or mask potentially sensitive information
    return output
      .replace(/\/workspace\/[^\s]*/g, '[workspace]') // Hide workspace paths
      .replace(/\/tmp\/[^\s]*/g, '[temp]') // Hide temp paths
      .substring(0, 10000); // Limit output length
  }

  async getExecutionResult(executionId: string): Promise<JobResult | null> {
    return this.executions.get(executionId) || null;
  }

  async cancelExecution(executionId: string): Promise<boolean> {
    try {
      await this.dockerManager.cancelJob(executionId);
      return true;
    } catch {
      return false;
    }
  }

  async getExecutionStatus(executionId: string): Promise<string | null> {
    return await this.dockerManager.getJobStatus(executionId);
  }

  async getExecutionLogs(executionId: string): Promise<string | null> {
    return await this.dockerManager.getJobLogs(executionId);
  }

  getSupportedLanguages(): string[] {
    return this.securityPolicy.allowedLanguages;
  }

  getMetrics(): ExecutionMetrics {
    return { ...this.metrics };
  }

  getSecurityPolicy(): SecurityPolicy {
    return { ...this.securityPolicy };
  }

  updateSecurityPolicy(policy: Partial<SecurityPolicy>): void {
    this.securityPolicy = { ...this.securityPolicy, ...policy };
    
    // Update docker manager settings
    if (policy.maxConcurrentJobs) {
      this.dockerManager.setMaxConcurrentJobs(policy.maxConcurrentJobs);
    }
  }

  async getSystemHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: Record<string, any>;
  }> {
    const dockerHealthy = await this.dockerManager.isHealthy();
    const queueStatus = this.dockerManager.getQueueStatus();
    const stats = await this.dockerManager.getStats();
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (!dockerHealthy) {
      status = 'unhealthy';
    } else if (queueStatus.queueLength > 50 || queueStatus.activeJobs >= queueStatus.maxConcurrent) {
      status = 'degraded';
    }
    
    return {
      status,
      details: {
        dockerHealthy,
        queueStatus,
        stats,
        metrics: this.metrics,
        supportedLanguages: this.getSupportedLanguages().length
      }
    };
  }

  async cleanup(): Promise<void> {
    await this.dockerManager.cleanup();
    this.executions.clear();
    this.rateLimitTracking.clear();
  }
}

export default ExecutionService;