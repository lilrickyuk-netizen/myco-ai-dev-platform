/**
 * Enhanced Docker Manager - Secure sandboxed code execution
 */

import Docker from 'dockerode';
import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';

export interface ExecutionRequest {
  id: string;
  code: string;
  language: string;
  files?: { [filename: string]: string };
  dependencies?: string[];
  environment?: { [key: string]: string };
  timeout?: number;
  memoryLimit?: string;
  cpuLimit?: number;
  networkAccess?: boolean;
  allowedPorts?: number[];
  userId?: string;
  projectId?: string;
}

export interface ExecutionResult {
  id: string;
  success: boolean;
  output: string;
  error?: string;
  exitCode: number;
  executionTime: number;
  memoryUsage?: number;
  logs: string[];
  files?: { [filename: string]: string };
  metadata: {
    containerId?: string;
    imageUsed: string;
    securityProfile: string;
    resourceLimits: any;
  };
}

export interface SecurityProfile {
  allowNetworking: boolean;
  allowFileSystem: boolean;
  allowedSyscalls: string[];
  blockedSyscalls: string[];
  maxProcesses: number;
  memoryLimit: string;
  cpuLimit: number;
  timeoutSeconds: number;
}

export class EnhancedDockerManager extends EventEmitter {
  private docker: Docker;
  private activeContainers: Map<string, Docker.Container> = new Map();
  private executionQueue: ExecutionRequest[] = [];
  private isProcessingQueue = false;
  private securityProfiles: Map<string, SecurityProfile>;
  
  // Language configurations
  private languageConfigs = {
    javascript: {
      image: 'node:18-alpine',
      command: ['node'],
      fileExtension: '.js',
      setupCommands: ['npm install']
    },
    typescript: {
      image: 'node:18-alpine',
      command: ['npx', 'tsx'],
      fileExtension: '.ts',
      setupCommands: ['npm install', 'npm install -g tsx']
    },
    python: {
      image: 'python:3.11-slim',
      command: ['python'],
      fileExtension: '.py',
      setupCommands: ['pip install -r requirements.txt']
    },
    java: {
      image: 'openjdk:17-alpine',
      command: ['java'],
      fileExtension: '.java',
      setupCommands: ['javac *.java']
    },
    go: {
      image: 'golang:1.21-alpine',
      command: ['go', 'run'],
      fileExtension: '.go',
      setupCommands: ['go mod init main', 'go mod tidy']
    },
    rust: {
      image: 'rust:1.75-slim',
      command: ['cargo', 'run'],
      fileExtension: '.rs',
      setupCommands: ['cargo init --name main .']
    }
  };

  constructor() {
    super();
    this.docker = new Docker();
    this.initializeSecurityProfiles();
    this.startQueueProcessor();
  }

  private initializeSecurityProfiles() {
    this.securityProfiles = new Map([
      ['strict', {
        allowNetworking: false,
        allowFileSystem: false,
        allowedSyscalls: ['read', 'write', 'open', 'close', 'mmap', 'exit'],
        blockedSyscalls: ['socket', 'connect', 'fork', 'exec'],
        maxProcesses: 1,
        memoryLimit: '128m',
        cpuLimit: 0.5,
        timeoutSeconds: 30
      }],
      ['sandbox', {
        allowNetworking: false,
        allowFileSystem: true,
        allowedSyscalls: ['read', 'write', 'open', 'close', 'mmap', 'exit', 'stat'],
        blockedSyscalls: ['socket', 'connect', 'fork'],
        maxProcesses: 5,
        memoryLimit: '256m',
        cpuLimit: 1.0,
        timeoutSeconds: 60
      }],
      ['development', {
        allowNetworking: true,
        allowFileSystem: true,
        allowedSyscalls: [],
        blockedSyscalls: ['reboot', 'mount'],
        maxProcesses: 10,
        memoryLimit: '512m',
        cpuLimit: 2.0,
        timeoutSeconds: 300
      }]
    ]);
  }

  async executeCode(request: ExecutionRequest): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    try {
      // Validate request
      this.validateExecutionRequest(request);
      
      // Create execution environment
      const container = await this.createSecureContainer(request);
      this.activeContainers.set(request.id, container);
      
      // Prepare workspace
      await this.prepareWorkspace(container, request);
      
      // Execute code
      const result = await this.runCodeInContainer(container, request);
      
      // Collect results and cleanup
      const files = await this.collectOutputFiles(container);
      await this.cleanupContainer(request.id);
      
      const executionTime = Date.now() - startTime;
      
      const executionResult: ExecutionResult = {
        id: request.id,
        success: result.exitCode === 0,
        output: result.output,
        error: result.error,
        exitCode: result.exitCode,
        executionTime,
        logs: result.logs,
        files,
        metadata: {
          containerId: container.id,
          imageUsed: this.getImageForLanguage(request.language),
          securityProfile: this.getSecurityProfileName(request),
          resourceLimits: this.getResourceLimits(request)
        }
      };
      
      this.emit('executionComplete', executionResult);
      return executionResult;
      
    } catch (error) {
      await this.cleanupContainer(request.id);
      
      const executionResult: ExecutionResult = {
        id: request.id,
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error',
        exitCode: -1,
        executionTime: Date.now() - startTime,
        logs: [],
        metadata: {
          imageUsed: this.getImageForLanguage(request.language),
          securityProfile: this.getSecurityProfileName(request),
          resourceLimits: this.getResourceLimits(request)
        }
      };
      
      this.emit('executionError', executionResult);
      return executionResult;
    }
  }

  private validateExecutionRequest(request: ExecutionRequest): void {
    if (!request.id) {
      throw new Error('Execution request must have an ID');
    }
    
    if (!request.code || request.code.trim().length === 0) {
      throw new Error('Execution request must contain code');
    }
    
    if (!this.languageConfigs[request.language]) {
      throw new Error(`Unsupported language: ${request.language}`);
    }
    
    if (request.code.length > 1024 * 1024) { // 1MB limit
      throw new Error('Code size exceeds maximum limit');
    }
  }

  private async createSecureContainer(request: ExecutionRequest): Promise<Docker.Container> {
    const image = this.getImageForLanguage(request.language);
    const securityProfile = this.getSecurityProfile(request);
    
    // Ensure image is available
    await this.ensureImage(image);
    
    // Create container with security constraints
    const containerConfig = {
      Image: image,
      WorkingDir: '/workspace',
      User: 'nobody:nogroup',
      NetworkMode: securityProfile.allowNetworking ? 'bridge' : 'none',
      HostConfig: {
        Memory: this.parseMemoryLimit(securityProfile.memoryLimit),
        CpuQuota: Math.floor(securityProfile.cpuLimit * 100000),
        CpuPeriod: 100000,
        PidsLimit: securityProfile.maxProcesses,
        ReadonlyRootfs: true,
        SecurityOpt: [
          'no-new-privileges:true',
          'seccomp:unconfined' // TODO: Create custom seccomp profile
        ],
        CapDrop: ['ALL'],
        CapAdd: ['SETUID', 'SETGID'], // Minimal capabilities
        Tmpfs: {
          '/tmp': 'rw,size=100m,uid=65534,gid=65534',
          '/workspace': 'rw,size=500m,uid=65534,gid=65534'
        },
        Ulimits: [
          { Name: 'nproc', Soft: securityProfile.maxProcesses, Hard: securityProfile.maxProcesses },
          { Name: 'nofile', Soft: 1024, Hard: 1024 }
        ]
      },
      Env: this.buildEnvironmentVariables(request),
      AttachStdout: true,
      AttachStderr: true,
      Tty: false
    };

    return await this.docker.createContainer(containerConfig);
  }

  private async ensureImage(image: string): Promise<void> {
    try {
      await this.docker.getImage(image).inspect();
    } catch (error) {
      console.log(`Pulling image: ${image}`);
      await new Promise((resolve, reject) => {
        this.docker.pull(image, (err: any, stream: any) => {
          if (err) return reject(err);
          
          this.docker.modem.followProgress(stream, (err: any, res: any) => {
            if (err) return reject(err);
            resolve(res);
          });
        });
      });
    }
  }

  private async prepareWorkspace(container: Docker.Container, request: ExecutionRequest): Promise<void> {
    await container.start();
    
    const languageConfig = this.languageConfigs[request.language];
    
    // Create main code file
    const mainFile = `main${languageConfig.fileExtension}`;
    await this.writeFileToContainer(container, mainFile, request.code);
    
    // Write additional files
    if (request.files) {
      for (const [filename, content] of Object.entries(request.files)) {
        await this.writeFileToContainer(container, filename, content);
      }
    }
    
    // Setup dependencies
    if (request.dependencies && request.dependencies.length > 0) {
      await this.installDependencies(container, request);
    }
  }

  private async writeFileToContainer(container: Docker.Container, filename: string, content: string): Promise<void> {
    const tar = require('tar-stream');
    const pack = tar.pack();
    
    pack.entry({ name: filename }, content);
    pack.finalize();
    
    await container.putArchive(pack, { path: '/workspace' });
  }

  private async installDependencies(container: Docker.Container, request: ExecutionRequest): Promise<void> {
    const languageConfig = this.languageConfigs[request.language];
    
    if (request.language === 'javascript' || request.language === 'typescript') {
      const packageJson = {
        name: 'workspace',
        version: '1.0.0',
        dependencies: request.dependencies?.reduce((acc, dep) => {
          acc[dep] = 'latest';
          return acc;
        }, {} as any) || {}
      };
      
      await this.writeFileToContainer(container, 'package.json', JSON.stringify(packageJson, null, 2));
    } else if (request.language === 'python') {
      const requirements = request.dependencies?.join('\n') || '';
      await this.writeFileToContainer(container, 'requirements.txt', requirements);
    }
    
    // Run setup commands
    for (const command of languageConfig.setupCommands) {
      await this.execInContainer(container, command.split(' '));
    }
  }

  private async runCodeInContainer(container: Docker.Container, request: ExecutionRequest): Promise<{
    output: string;
    error: string;
    exitCode: number;
    logs: string[];
  }> {
    const languageConfig = this.languageConfigs[request.language];
    const timeout = request.timeout || this.getSecurityProfile(request).timeoutSeconds * 1000;
    
    const command = [
      ...languageConfig.command,
      `main${languageConfig.fileExtension}`
    ];
    
    return new Promise(async (resolve) => {
      const exec = await container.exec({
        Cmd: command,
        AttachStdout: true,
        AttachStderr: true,
        WorkingDir: '/workspace'
      });
      
      let output = '';
      let error = '';
      const logs: string[] = [];
      
      const stream = await exec.start({ hijack: true, stdin: false });
      
      // Setup timeout
      const timeoutHandle = setTimeout(async () => {
        try {
          await container.kill({ signal: 'SIGKILL' });
          resolve({
            output,
            error: error + '\nExecution timed out',
            exitCode: 124,
            logs: [...logs, 'Execution timed out']
          });
        } catch (e) {
          // Container might already be stopped
        }
      }, timeout);
      
      // Collect output
      stream.on('data', (chunk: Buffer) => {
        const data = chunk.toString();
        if (chunk[0] === 1) { // stdout
          output += data.slice(8);
        } else if (chunk[0] === 2) { // stderr
          error += data.slice(8);
        }
        logs.push(data);
      });
      
      stream.on('end', async () => {
        clearTimeout(timeoutHandle);
        
        try {
          const inspection = await exec.inspect();
          resolve({
            output: output.trim(),
            error: error.trim(),
            exitCode: inspection.ExitCode || 0,
            logs
          });
        } catch (e) {
          resolve({
            output: output.trim(),
            error: error.trim(),
            exitCode: -1,
            logs
          });
        }
      });
    });
  }

  private async execInContainer(container: Docker.Container, command: string[]): Promise<void> {
    const exec = await container.exec({
      Cmd: command,
      AttachStdout: true,
      AttachStderr: true,
      WorkingDir: '/workspace'
    });
    
    await exec.start({});
  }

  private async collectOutputFiles(container: Docker.Container): Promise<{ [filename: string]: string }> {
    try {
      const stream = await container.getArchive({ path: '/workspace' });
      const tar = require('tar-stream');
      const extract = tar.extract();
      const files: { [filename: string]: string } = {};
      
      return new Promise((resolve) => {
        extract.on('entry', (header: any, stream: any, next: any) => {
          if (header.type === 'file' && !header.name.startsWith('main.')) {
            let content = '';
            stream.on('data', (chunk: Buffer) => {
              content += chunk.toString();
            });
            stream.on('end', () => {
              files[header.name] = content;
              next();
            });
            stream.resume();
          } else {
            stream.on('end', () => next());
            stream.resume();
          }
        });
        
        extract.on('finish', () => {
          resolve(files);
        });
        
        stream.pipe(extract);
      });
    } catch (error) {
      return {};
    }
  }

  private async cleanupContainer(executionId: string): Promise<void> {
    const container = this.activeContainers.get(executionId);
    if (container) {
      try {
        await container.kill();
        await container.remove({ force: true });
      } catch (error) {
        console.error(`Failed to cleanup container ${executionId}:`, error);
      }
      this.activeContainers.delete(executionId);
    }
  }

  private getImageForLanguage(language: string): string {
    return this.languageConfigs[language]?.image || 'alpine:latest';
  }

  private getSecurityProfile(request: ExecutionRequest): SecurityProfile {
    // Determine security profile based on user, project, or default
    const profileName = request.userId ? 'development' : 'strict';
    return this.securityProfiles.get(profileName) || this.securityProfiles.get('strict')!;
  }

  private getSecurityProfileName(request: ExecutionRequest): string {
    return request.userId ? 'development' : 'strict';
  }

  private getResourceLimits(request: ExecutionRequest): any {
    const profile = this.getSecurityProfile(request);
    return {
      memory: profile.memoryLimit,
      cpu: profile.cpuLimit,
      processes: profile.maxProcesses,
      timeout: profile.timeoutSeconds
    };
  }

  private parseMemoryLimit(limit: string): number {
    const match = limit.match(/^(\d+)([kmg]?)$/i);
    if (!match) return 128 * 1024 * 1024; // Default 128MB
    
    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    
    switch (unit) {
      case 'g': return value * 1024 * 1024 * 1024;
      case 'm': return value * 1024 * 1024;
      case 'k': return value * 1024;
      default: return value;
    }
  }

  private buildEnvironmentVariables(request: ExecutionRequest): string[] {
    const env = [
      'PATH=/usr/local/bin:/usr/bin:/bin',
      'HOME=/workspace',
      'USER=nobody'
    ];
    
    if (request.environment) {
      for (const [key, value] of Object.entries(request.environment)) {
        env.push(`${key}=${value}`);
      }
    }
    
    return env;
  }

  // Queue management
  async queueExecution(request: ExecutionRequest): Promise<void> {
    this.executionQueue.push(request);
    this.emit('executionQueued', request);
  }

  private async startQueueProcessor(): Promise<void> {
    if (this.isProcessingQueue) return;
    
    this.isProcessingQueue = true;
    
    while (this.executionQueue.length > 0) {
      const request = this.executionQueue.shift();
      if (request) {
        try {
          await this.executeCode(request);
        } catch (error) {
          console.error(`Queue execution failed for ${request.id}:`, error);
        }
      }
      
      // Small delay to prevent overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.isProcessingQueue = false;
  }

  // Management methods
  async getActiveExecutions(): Promise<string[]> {
    return Array.from(this.activeContainers.keys());
  }

  async killExecution(executionId: string): Promise<boolean> {
    const container = this.activeContainers.get(executionId);
    if (container) {
      try {
        await container.kill();
        await this.cleanupContainer(executionId);
        return true;
      } catch (error) {
        console.error(`Failed to kill execution ${executionId}:`, error);
        return false;
      }
    }
    return false;
  }

  async getExecutionStats(): Promise<any> {
    const containerInfos = await Promise.all(
      Array.from(this.activeContainers.values()).map(async (container) => {
        try {
          const stats = await container.stats({ stream: false });
          return {
            id: container.id,
            memory: stats.memory_stats,
            cpu: stats.cpu_stats
          };
        } catch (error) {
          return null;
        }
      })
    );

    return {
      activeExecutions: this.activeContainers.size,
      queuedExecutions: this.executionQueue.length,
      containerStats: containerInfos.filter(Boolean)
    };
  }

  async cleanup(): Promise<void> {
    // Kill all active containers
    const cleanupPromises = Array.from(this.activeContainers.keys()).map(
      executionId => this.cleanupContainer(executionId)
    );
    
    await Promise.all(cleanupPromises);
    this.executionQueue.length = 0;
  }
}