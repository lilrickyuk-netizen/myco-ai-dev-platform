import { EventEmitter } from 'events';
import { DockerManager, ContainerConfig, ExecutionResult } from './containers/DockerManager';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';

export interface JobConfig {
  language: string;
  code: string;
  input?: string;
  timeout?: number;
  memoryLimit?: string;
  cpuLimit?: number;
  environment?: Record<string, string>;
  dependencies?: string[];
  tests?: string[];
}

export interface JobResult {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'timeout';
  output?: string;
  error?: string;
  exitCode?: number;
  duration?: number;
  memoryUsage?: number;
  cpuUsage?: number;
  logs?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface LanguageConfig {
  image: string;
  fileExtension: string;
  compileCommand?: string[];
  runCommand: string[];
  dependencies?: Record<string, string[]>;
  basePackages?: string[];
}

export class ExecutionService extends EventEmitter {
  private dockerManager: DockerManager;
  private jobs: Map<string, JobResult> = new Map();
  private activeJobs: Set<string> = new Set();
  private maxConcurrentJobs: number;
  private jobQueue: Array<{ jobId: string; config: JobConfig }> = [];
  private isProcessingQueue = false;

  private languageConfigs: Map<string, LanguageConfig> = new Map([
    ['javascript', {
      image: 'node:18-alpine',
      fileExtension: 'js',
      runCommand: ['node', 'main.js'],
      dependencies: {
        'express': ['npm', 'install', 'express'],
        'lodash': ['npm', 'install', 'lodash'],
        'axios': ['npm', 'install', 'axios']
      },
      basePackages: ['npm', 'install', 'typescript', '@types/node']
    }],
    ['typescript', {
      image: 'node:18-alpine',
      fileExtension: 'ts',
      compileCommand: ['npx', 'tsc', 'main.ts'],
      runCommand: ['node', 'main.js'],
      dependencies: {
        'express': ['npm', 'install', 'express', '@types/express'],
        'lodash': ['npm', 'install', 'lodash', '@types/lodash']
      },
      basePackages: ['npm', 'install', 'typescript', '@types/node']
    }],
    ['python', {
      image: 'python:3.11-alpine',
      fileExtension: 'py',
      runCommand: ['python', 'main.py'],
      dependencies: {
        'requests': ['pip', 'install', 'requests'],
        'numpy': ['pip', 'install', 'numpy'],
        'pandas': ['pip', 'install', 'pandas'],
        'flask': ['pip', 'install', 'flask']
      }
    }],
    ['java', {
      image: 'openjdk:17-alpine',
      fileExtension: 'java',
      compileCommand: ['javac', 'Main.java'],
      runCommand: ['java', 'Main'],
      dependencies: {}
    }],
    ['cpp', {
      image: 'gcc:alpine',
      fileExtension: 'cpp',
      compileCommand: ['g++', '-o', 'main', 'main.cpp'],
      runCommand: ['./main'],
      dependencies: {}
    }],
    ['rust', {
      image: 'rust:alpine',
      fileExtension: 'rs',
      compileCommand: ['rustc', 'main.rs'],
      runCommand: ['./main'],
      dependencies: {}
    }],
    ['go', {
      image: 'golang:alpine',
      fileExtension: 'go',
      compileCommand: ['go', 'build', '-o', 'main', 'main.go'],
      runCommand: ['./main'],
      dependencies: {}
    }]
  ]);

  constructor(maxConcurrentJobs: number = 5) {
    super();
    this.dockerManager = new DockerManager();
    this.maxConcurrentJobs = maxConcurrentJobs;
    
    // Set up cleanup on process exit
    process.on('SIGINT', () => this.cleanup());
    process.on('SIGTERM', () => this.cleanup());
  }

  async initialize(): Promise<void> {
    // Check if Docker is available
    const dockerAvailable = await this.dockerManager.isDockerAvailable();
    if (!dockerAvailable) {
      throw new Error('Docker is not available. Please ensure Docker is installed and running.');
    }

    // Pre-pull common images
    await this.prepareEnvironment();
  }

  private async prepareEnvironment(): Promise<void> {
    const images = Array.from(this.languageConfigs.values()).map(config => config.image);
    const uniqueImages = [...new Set(images)];

    for (const image of uniqueImages) {
      try {
        console.log(`Pulling Docker image: ${image}`);
        await this.dockerManager.pullImage(image);
      } catch (error) {
        console.warn(`Failed to pull image ${image}:`, error);
      }
    }
  }

  async executeCode(config: JobConfig): Promise<string> {
    const jobId = randomUUID();
    
    const job: JobResult = {
      id: jobId,
      status: 'queued',
      createdAt: new Date()
    };

    this.jobs.set(jobId, job);
    this.emit('jobCreated', job);

    // Add to queue
    this.jobQueue.push({ jobId, config });
    
    // Process queue if not already processing
    if (!this.isProcessingQueue) {
      this.processJobQueue();
    }

    return jobId;
  }

  private async processJobQueue(): Promise<void> {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    while (this.jobQueue.length > 0 && this.activeJobs.size < this.maxConcurrentJobs) {
      const queuedJob = this.jobQueue.shift();
      if (!queuedJob) continue;

      this.activeJobs.add(queuedJob.jobId);
      
      // Process job in background
      this.processJob(queuedJob.jobId, queuedJob.config)
        .finally(() => {
          this.activeJobs.delete(queuedJob.jobId);
          // Continue processing queue
          setTimeout(() => this.processJobQueue(), 100);
        });
    }

    this.isProcessingQueue = false;
  }

  private async processJob(jobId: string, config: JobConfig): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    try {
      job.status = 'running';
      job.startedAt = new Date();
      this.emit('jobStarted', job);

      const result = await this.runCodeInContainer(config);
      
      job.status = 'completed';
      job.output = result.stdout;
      job.error = result.stderr;
      job.exitCode = result.exitCode;
      job.duration = result.duration;
      job.memoryUsage = result.memoryUsage;
      job.cpuUsage = result.cpuUsage;
      job.completedAt = new Date();

      this.emit('jobCompleted', job);

    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : String(error);
      job.completedAt = new Date();
      
      this.emit('jobFailed', job);
    }
  }

  private async runCodeInContainer(config: JobConfig): Promise<ExecutionResult> {
    const languageConfig = this.languageConfigs.get(config.language);
    if (!languageConfig) {
      throw new Error(`Unsupported language: ${config.language}`);
    }

    const containerConfig: ContainerConfig = {
      image: languageConfig.image,
      memory: config.memoryLimit || '128m',
      cpu: config.cpuLimit || 0.5,
      networkMode: 'none', // Disable network access for security
      user: 'nobody', // Run as non-root user
      securityOpts: ['no-new-privileges:true'],
      workingDir: '/app'
    };

    const containerId = await this.dockerManager.createContainer(containerConfig);

    try {
      // Create the main code file
      const fileName = config.language === 'java' ? 'Main.java' : `main.${languageConfig.fileExtension}`;
      await this.dockerManager.createFileInContainer(containerId, `/app/${fileName}`, config.code);

      // Install dependencies if specified
      if (config.dependencies && config.dependencies.length > 0) {
        await this.installDependencies(containerId, config.language, config.dependencies);
      }

      // Install base packages if needed
      if (languageConfig.basePackages) {
        try {
          await this.dockerManager.executeCommand(
            containerId,
            languageConfig.basePackages,
            { timeout: 60000 }
          );
        } catch (error) {
          console.warn(`Failed to install base packages: ${error}`);
        }
      }

      // Compile if needed
      if (languageConfig.compileCommand) {
        const compileResult = await this.dockerManager.executeCommand(
          containerId,
          languageConfig.compileCommand,
          { timeout: 30000 }
        );

        if (compileResult.exitCode !== 0) {
          throw new Error(`Compilation failed: ${compileResult.stderr}`);
        }
      }

      // Run tests if provided
      if (config.tests && config.tests.length > 0) {
        await this.runTests(containerId, config.language, config.tests);
      }

      // Execute the code
      const executionResult = await this.dockerManager.executeCommand(
        containerId,
        languageConfig.runCommand,
        {
          timeout: config.timeout || 30000,
          stdin: config.input,
          environment: config.environment
        }
      );

      return executionResult;

    } finally {
      // Clean up container
      try {
        await this.dockerManager.stopContainer(containerId);
        await this.dockerManager.removeContainer(containerId, true);
      } catch (error) {
        console.error(`Failed to cleanup container ${containerId}:`, error);
      }
    }
  }

  private async installDependencies(
    containerId: string,
    language: string,
    dependencies: string[]
  ): Promise<void> {
    const languageConfig = this.languageConfigs.get(language);
    if (!languageConfig || !languageConfig.dependencies) return;

    for (const dep of dependencies) {
      const installCommand = languageConfig.dependencies[dep];
      if (installCommand) {
        try {
          await this.dockerManager.executeCommand(
            containerId,
            installCommand,
            { timeout: 60000 }
          );
        } catch (error) {
          console.warn(`Failed to install dependency ${dep}:`, error);
        }
      }
    }
  }

  private async runTests(containerId: string, language: string, tests: string[]): Promise<void> {
    for (let i = 0; i < tests.length; i++) {
      const testCode = tests[i];
      const testFileName = `test_${i}.${this.languageConfigs.get(language)?.fileExtension}`;
      
      await this.dockerManager.createFileInContainer(containerId, `/app/${testFileName}`, testCode);
      
      // Run the test based on language
      const testCommand = this.getTestCommand(language, testFileName);
      if (testCommand) {
        const testResult = await this.dockerManager.executeCommand(
          containerId,
          testCommand,
          { timeout: 10000 }
        );

        if (testResult.exitCode !== 0) {
          throw new Error(`Test ${i + 1} failed: ${testResult.stderr}`);
        }
      }
    }
  }

  private getTestCommand(language: string, testFileName: string): string[] | null {
    switch (language) {
      case 'javascript':
      case 'typescript':
        return ['node', testFileName];
      case 'python':
        return ['python', testFileName];
      case 'java':
        return ['java', testFileName.replace('.java', '')];
      default:
        return null;
    }
  }

  async getJobStatus(jobId: string): Promise<JobResult | null> {
    return this.jobs.get(jobId) || null;
  }

  async cancelJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    if (job.status === 'running') {
      // Find and stop the container
      // This is a simplified approach - in production you'd track container IDs per job
      job.status = 'failed';
      job.error = 'Job cancelled by user';
      job.completedAt = new Date();
      
      this.emit('jobCancelled', job);
    }
  }

  async listJobs(): Promise<JobResult[]> {
    return Array.from(this.jobs.values()).sort((a, b) => 
      b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  async getQueueStatus(): Promise<{
    queueLength: number;
    activeJobs: number;
    maxConcurrentJobs: number;
  }> {
    return {
      queueLength: this.jobQueue.length,
      activeJobs: this.activeJobs.size,
      maxConcurrentJobs: this.maxConcurrentJobs
    };
  }

  getSupportedLanguages(): string[] {
    return Array.from(this.languageConfigs.keys());
  }

  getLanguageConfig(language: string): LanguageConfig | undefined {
    return this.languageConfigs.get(language);
  }

  async cleanup(): Promise<void> {
    console.log('Cleaning up execution service...');
    
    // Cancel all running jobs
    for (const [jobId, job] of this.jobs.entries()) {
      if (job.status === 'running') {
        await this.cancelJob(jobId);
      }
    }

    // Clean up Docker containers
    await this.dockerManager.cleanup();
  }

  async healthCheck(): Promise<{
    status: string;
    dockerAvailable: boolean;
    activeJobs: number;
    queueLength: number;
    totalJobs: number;
  }> {
    const dockerAvailable = await this.dockerManager.isDockerAvailable();
    
    return {
      status: dockerAvailable ? 'healthy' : 'unhealthy',
      dockerAvailable,
      activeJobs: this.activeJobs.size,
      queueLength: this.jobQueue.length,
      totalJobs: this.jobs.size
    };
  }
}

export default ExecutionService;