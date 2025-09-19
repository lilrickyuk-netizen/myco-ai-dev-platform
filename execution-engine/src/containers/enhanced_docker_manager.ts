import { EventEmitter } from 'events';
import { DockerManager, ContainerConfig, ContainerInfo, ExecutionResult } from './DockerManager';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';

export interface JobConfig {
  id?: string;
  name: string;
  image: string;
  code: string;
  language: string;
  framework?: string;
  entrypoint?: string[];
  timeout?: number;
  memoryLimit?: string;
  cpuLimit?: number;
  environment?: Record<string, string>;
  inputFiles?: Array<{ path: string; content: string }>;
  expectedOutputs?: string[];
}

export interface JobResult {
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

export interface LanguageRuntime {
  image: string;
  setup: string[];
  run: string[];
  fileExtension: string;
  packages?: Record<string, string>;
}

export class EnhancedDockerManager extends EventEmitter {
  private dockerManager: DockerManager;
  private activeJobs: Map<string, { containerId: string; timeout?: NodeJS.Timeout }> = new Map();
  private jobQueue: JobConfig[] = [];
  private maxConcurrentJobs: number = 5;
  private currentJobs: number = 0;
  
  // Language runtime configurations
  private languageRuntimes: Record<string, LanguageRuntime> = {
    javascript: {
      image: 'node:18-alpine',
      setup: ['npm install'],
      run: ['node', 'main.js'],
      fileExtension: 'js',
      packages: {
        'package.json': JSON.stringify({
          name: 'user-code',
          version: '1.0.0',
          main: 'main.js',
          dependencies: {}
        }, null, 2)
      }
    },
    typescript: {
      image: 'node:18-alpine',
      setup: [
        'npm install -g typescript ts-node',
        'npm install @types/node',
        'npm install'
      ],
      run: ['npx', 'ts-node', 'main.ts'],
      fileExtension: 'ts',
      packages: {
        'package.json': JSON.stringify({
          name: 'user-code',
          version: '1.0.0',
          main: 'main.ts',
          dependencies: {
            '@types/node': '^18.0.0'
          }
        }, null, 2),
        'tsconfig.json': JSON.stringify({
          compilerOptions: {
            target: 'es2020',
            module: 'commonjs',
            strict: true,
            esModuleInterop: true,
            skipLibCheck: true,
            forceConsistentCasingInFileNames: true
          }
        }, null, 2)
      }
    },
    python: {
      image: 'python:3.11-alpine',
      setup: ['pip install -r requirements.txt || true'],
      run: ['python', 'main.py'],
      fileExtension: 'py',
      packages: {
        'requirements.txt': 'requests\nnumpy\npandas'
      }
    },
    go: {
      image: 'golang:1.21-alpine',
      setup: ['go mod init user-code', 'go mod tidy'],
      run: ['go', 'run', 'main.go'],
      fileExtension: 'go',
      packages: {
        'go.mod': 'module user-code\n\ngo 1.21'
      }
    },
    rust: {
      image: 'rust:1.75-alpine',
      setup: ['cargo build'],
      run: ['cargo', 'run'],
      fileExtension: 'rs',
      packages: {
        'Cargo.toml': `[package]
name = "user-code"
version = "0.1.0"
edition = "2021"

[dependencies]`,
        'src/main.rs': 'fn main() {\n    println!("Hello, World!");\n}'
      }
    },
    java: {
      image: 'openjdk:17-alpine',
      setup: ['javac Main.java'],
      run: ['java', 'Main'],
      fileExtension: 'java',
      packages: {}
    },
    cpp: {
      image: 'gcc:latest',
      setup: ['g++ -o main main.cpp'],
      run: ['./main'],
      fileExtension: 'cpp',
      packages: {}
    }
  };

  constructor(tempDir: string = '/tmp/enhanced-docker-manager') {
    super();
    this.dockerManager = new DockerManager(tempDir);
    this.setupEventHandlers();
    this.startJobProcessor();
  }

  private setupEventHandlers(): void {
    this.dockerManager.on('containerCreated', (container: ContainerInfo) => {
      this.emit('jobStarted', container);
    });

    this.dockerManager.on('containerStopped', (container: ContainerInfo) => {
      this.emit('jobStopped', container);
    });

    this.dockerManager.on('containerError', (container: ContainerInfo, error: any) => {
      this.emit('jobError', container, error);
    });
  }

  private startJobProcessor(): void {
    setInterval(() => {
      this.processJobQueue();
    }, 1000);
  }

  private async processJobQueue(): Promise<void> {
    if (this.currentJobs >= this.maxConcurrentJobs || this.jobQueue.length === 0) {
      return;
    }

    const job = this.jobQueue.shift();
    if (job) {
      this.currentJobs++;
      this.executeJob(job).finally(() => {
        this.currentJobs--;
      });
    }
  }

  async executeCode(jobConfig: JobConfig): Promise<JobResult> {
    return new Promise((resolve, reject) => {
      const jobId = jobConfig.id || randomUUID();
      jobConfig.id = jobId;

      // Add to queue
      this.jobQueue.push(jobConfig);

      // Listen for job completion
      const onJobComplete = (result: JobResult) => {
        if (result.id === jobId) {
          this.removeListener('jobComplete', onJobComplete);
          this.removeListener('jobError', onJobError);
          resolve(result);
        }
      };

      const onJobError = (error: any, jId: string) => {
        if (jId === jobId) {
          this.removeListener('jobComplete', onJobComplete);
          this.removeListener('jobError', onJobError);
          reject(error);
        }
      };

      this.on('jobComplete', onJobComplete);
      this.on('jobError', onJobError);

      // Set overall timeout
      setTimeout(() => {
        this.removeListener('jobComplete', onJobComplete);
        this.removeListener('jobError', onJobError);
        this.cancelJob(jobId);
        reject(new Error('Job timeout exceeded'));
      }, (jobConfig.timeout || 300) * 1000);
    });
  }

  private async executeJob(jobConfig: JobConfig): Promise<void> {
    const startTime = Date.now();
    const jobId = jobConfig.id!;

    try {
      // Prepare runtime configuration
      const runtime = this.languageRuntimes[jobConfig.language];
      if (!runtime) {
        throw new Error(`Unsupported language: ${jobConfig.language}`);
      }

      // Create container configuration
      const containerConfig: ContainerConfig = {
        image: runtime.image,
        name: `job-${jobId}`,
        workingDir: '/workspace',
        memory: jobConfig.memoryLimit || '512m',
        cpu: jobConfig.cpuLimit || 1,
        environment: {
          NODE_ENV: 'production',
          PYTHONUNBUFFERED: '1',
          ...jobConfig.environment
        },
        capabilities: ['SYS_ADMIN'], // Needed for some operations
        securityOpts: ['seccomp:unconfined'], // Allow system calls
        networkMode: 'none' // Disable network access for security
      };

      // Create container
      const containerId = await this.dockerManager.createContainer(containerConfig);
      
      // Store job reference
      this.activeJobs.set(jobId, { containerId });

      // Setup workspace
      await this.setupWorkspace(containerId, jobConfig, runtime);

      // Execute code
      const result = await this.runCode(containerId, jobConfig, runtime);

      // Collect outputs
      const outputFiles = await this.collectOutputs(containerId, jobConfig);

      // Calculate duration
      const duration = (Date.now() - startTime) / 1000;

      // Create result
      const jobResult: JobResult = {
        id: jobId,
        status: result.exitCode === 0 ? 'success' : 'error',
        output: result.stdout,
        error: result.stderr || undefined,
        exitCode: result.exitCode,
        duration,
        memoryUsage: result.memoryUsage,
        cpuUsage: result.cpuUsage,
        outputFiles
      };

      // Clean up
      await this.cleanupJob(jobId);

      this.emit('jobComplete', jobResult);

    } catch (error) {
      // Clean up on error
      await this.cleanupJob(jobId);

      const jobResult: JobResult = {
        id: jobId,
        status: 'error',
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error',
        exitCode: 1,
        duration: (Date.now() - startTime) / 1000
      };

      this.emit('jobComplete', jobResult);
    }
  }

  private async setupWorkspace(
    containerId: string, 
    jobConfig: JobConfig, 
    runtime: LanguageRuntime
  ): Promise<void> {
    // Create workspace directory
    await this.dockerManager.executeCommand(containerId, ['mkdir', '-p', '/workspace']);

    // Create package files
    for (const [fileName, content] of Object.entries(runtime.packages || {})) {
      await this.dockerManager.createFileInContainer(
        containerId,
        `/workspace/${fileName}`,
        content
      );
    }

    // Create main code file
    const mainFileName = jobConfig.language === 'rust' 
      ? `src/main.${runtime.fileExtension}`
      : `main.${runtime.fileExtension}`;
    
    await this.dockerManager.createFileInContainer(
      containerId,
      `/workspace/${mainFileName}`,
      jobConfig.code
    );

    // Create additional input files
    if (jobConfig.inputFiles) {
      for (const file of jobConfig.inputFiles) {
        await this.dockerManager.createFileInContainer(
          containerId,
          `/workspace/${file.path}`,
          file.content
        );
      }
    }

    // Run setup commands
    for (const command of runtime.setup) {
      const result = await this.dockerManager.executeCommand(
        containerId,
        ['sh', '-c', command],
        { 
          workingDir: '/workspace',
          timeout: 60000 // 1 minute timeout for setup
        }
      );

      if (result.exitCode !== 0) {
        throw new Error(`Setup failed: ${result.stderr}`);
      }
    }
  }

  private async runCode(
    containerId: string,
    jobConfig: JobConfig,
    runtime: LanguageRuntime
  ): Promise<ExecutionResult> {
    const command = jobConfig.entrypoint || runtime.run;
    const timeout = (jobConfig.timeout || 30) * 1000; // Convert to milliseconds

    try {
      const result = await this.dockerManager.executeCommand(
        containerId,
        command,
        {
          workingDir: '/workspace',
          timeout,
          environment: jobConfig.environment
        }
      );

      return result;
    } catch (error) {
      throw new Error(`Code execution failed: ${error}`);
    }
  }

  private async collectOutputs(
    containerId: string,
    jobConfig: JobConfig
  ): Promise<Array<{ path: string; content: string }>> {
    const outputFiles: Array<{ path: string; content: string }> = [];

    if (!jobConfig.expectedOutputs) {
      return outputFiles;
    }

    for (const outputPath of jobConfig.expectedOutputs) {
      try {
        const content = await this.dockerManager.readFileFromContainer(
          containerId,
          `/workspace/${outputPath}`
        );
        
        outputFiles.push({
          path: outputPath,
          content
        });
      } catch (error) {
        // File doesn't exist or can't be read - continue
        console.warn(`Failed to read output file ${outputPath}: ${error}`);
      }
    }

    return outputFiles;
  }

  private async cleanupJob(jobId: string): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (!job) return;

    try {
      // Clear timeout if exists
      if (job.timeout) {
        clearTimeout(job.timeout);
      }

      // Stop and remove container
      await this.dockerManager.stopContainer(job.containerId);
      await this.dockerManager.removeContainer(job.containerId, true);
    } catch (error) {
      console.error(`Failed to cleanup job ${jobId}:`, error);
    } finally {
      this.activeJobs.delete(jobId);
    }
  }

  async cancelJob(jobId: string): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (!job) return;

    await this.cleanupJob(jobId);
    
    const jobResult: JobResult = {
      id: jobId,
      status: 'error',
      output: '',
      error: 'Job was cancelled',
      exitCode: 130, // SIGINT exit code
      duration: 0
    };

    this.emit('jobComplete', jobResult);
  }

  async getJobStatus(jobId: string): Promise<string | null> {
    const job = this.activeJobs.get(jobId);
    if (!job) return null;

    try {
      const containerInfo = await this.dockerManager.getContainerInfo(job.containerId);
      return containerInfo?.status || null;
    } catch {
      return null;
    }
  }

  async getActiveJobs(): Promise<string[]> {
    return Array.from(this.activeJobs.keys());
  }

  async getJobLogs(jobId: string): Promise<string | null> {
    const job = this.activeJobs.get(jobId);
    if (!job) return null;

    try {
      return await this.dockerManager.getContainerLogs(job.containerId);
    } catch {
      return null;
    }
  }

  getSupportedLanguages(): string[] {
    return Object.keys(this.languageRuntimes);
  }

  getLanguageRuntime(language: string): LanguageRuntime | null {
    return this.languageRuntimes[language] || null;
  }

  async addLanguageRuntime(language: string, runtime: LanguageRuntime): Promise<void> {
    this.languageRuntimes[language] = runtime;
    
    // Pre-pull the image
    try {
      await this.dockerManager.pullImage(runtime.image);
    } catch (error) {
      console.warn(`Failed to pre-pull image for ${language}: ${error}`);
    }
  }

  setMaxConcurrentJobs(max: number): void {
    this.maxConcurrentJobs = Math.max(1, max);
  }

  getQueueStatus(): { queueLength: number; activeJobs: number; maxConcurrent: number } {
    return {
      queueLength: this.jobQueue.length,
      activeJobs: this.currentJobs,
      maxConcurrent: this.maxConcurrentJobs
    };
  }

  async cleanup(): Promise<void> {
    // Cancel all active jobs
    const activeJobIds = Array.from(this.activeJobs.keys());
    await Promise.all(activeJobIds.map(jobId => this.cancelJob(jobId)));

    // Clear job queue
    this.jobQueue.length = 0;

    // Cleanup docker manager
    await this.dockerManager.cleanup();
  }

  async isHealthy(): Promise<boolean> {
    try {
      return await this.dockerManager.isDockerAvailable();
    } catch {
      return false;
    }
  }

  async getStats(): Promise<any> {
    return {
      activeJobs: this.activeJobs.size,
      queuedJobs: this.jobQueue.length,
      maxConcurrentJobs: this.maxConcurrentJobs,
      supportedLanguages: this.getSupportedLanguages().length,
      isHealthy: await this.isHealthy()
    };
  }
}

export default EnhancedDockerManager;