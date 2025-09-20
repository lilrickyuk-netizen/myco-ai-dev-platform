import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import { join, resolve } from 'path';
import { randomUUID } from 'crypto';

export interface ContainerConfig {
  image: string;
  name?: string;
  environment?: Record<string, string>;
  volumes?: Array<{ host: string; container: string; readonly?: boolean }>;
  ports?: Array<{ host: number; container: number }>;
  workingDir?: string;
  command?: string[];
  memory?: string;
  cpu?: number;
  networkMode?: string;
  user?: string;
  capabilities?: string[];
  securityOpts?: string[];
}

export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  status: 'creating' | 'running' | 'stopped' | 'error';
  ports: Array<{ host: number; container: number }>;
  created: Date;
  started?: Date;
  stopped?: Date;
  exitCode?: number;
}

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
  memoryUsage?: number;
  cpuUsage?: number;
}

export interface FileOperationOptions {
  mode?: string;
  owner?: string;
  recursive?: boolean;
}

export class DockerManager extends EventEmitter {
  private containers: Map<string, ContainerInfo> = new Map();
  private processes: Map<string, ChildProcess> = new Map();
  private tempDir: string;

  constructor(tempDir: string = '/tmp/docker-manager') {
    super();
    this.tempDir = tempDir;
    this.ensureTempDir();
  }

  private async ensureTempDir(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create temp directory:', error);
    }
  }

  private async runDockerCommand(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve) => {
      const process = spawn('docker', args, { stdio: 'pipe' });
      let stdout = '';
      let stderr = '';

      process.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (exitCode) => {
        resolve({ stdout, stderr, exitCode: exitCode || 0 });
      });

      process.on('error', (error) => {
        resolve({ stdout, stderr: error.message, exitCode: 1 });
      });
    });
  }

  async createContainer(config: ContainerConfig): Promise<string> {
    const containerId = randomUUID();
    const containerName = config.name || `container-${containerId}`;

    try {
      // Prepare Docker run arguments
      const args = ['run', '-d', '--name', containerName];

      // Add environment variables
      if (config.environment) {
        for (const [key, value] of Object.entries(config.environment)) {
          args.push('-e', `${key}=${value}`);
        }
      }

      // Add volumes
      if (config.volumes) {
        for (const volume of config.volumes) {
          const volumeArg = volume.readonly 
            ? `${volume.host}:${volume.container}:ro`
            : `${volume.host}:${volume.container}`;
          args.push('-v', volumeArg);
        }
      }

      // Add port mappings
      if (config.ports) {
        for (const port of config.ports) {
          args.push('-p', `${port.host}:${port.container}`);
        }
      }

      // Add working directory
      if (config.workingDir) {
        args.push('-w', config.workingDir);
      }

      // Add memory limit
      if (config.memory) {
        args.push('-m', config.memory);
      }

      // Add CPU limit
      if (config.cpu) {
        args.push('--cpus', config.cpu.toString());
      }

      // Add network mode
      if (config.networkMode) {
        args.push('--network', config.networkMode);
      }

      // Add user
      if (config.user) {
        args.push('--user', config.user);
      }

      // Add capabilities
      if (config.capabilities) {
        for (const cap of config.capabilities) {
          args.push('--cap-add', cap);
        }
      }

      // Add security options
      if (config.securityOpts) {
        for (const opt of config.securityOpts) {
          args.push('--security-opt', opt);
        }
      }

      // Add security restrictions for sandboxing
      args.push('--security-opt', 'no-new-privileges:true');
      args.push('--read-only');
      args.push('--tmpfs', '/tmp:exec,size=100M');
      args.push('--tmpfs', '/var/tmp:exec,size=100M');

      // Add the image
      args.push(config.image);

      // Add command if specified
      if (config.command) {
        args.push(...config.command);
      }

      const result = await this.runDockerCommand(args);

      if (result.exitCode !== 0) {
        throw new Error(`Failed to create container: ${result.stderr}`);
      }

      const dockerContainerId = result.stdout.trim();

      // Store container info
      const containerInfo: ContainerInfo = {
        id: containerId,
        name: containerName,
        image: config.image,
        status: 'running',
        ports: config.ports || [],
        created: new Date(),
        started: new Date(),
      };

      this.containers.set(containerId, containerInfo);
      this.emit('containerCreated', containerInfo);

      return containerId;

    } catch (error) {
      const containerInfo: ContainerInfo = {
        id: containerId,
        name: containerName,
        image: config.image,
        status: 'error',
        ports: [],
        created: new Date(),
      };

      this.containers.set(containerId, containerInfo);
      this.emit('containerError', containerInfo, error);
      
      throw error;
    }
  }

  async executeCommand(
    containerId: string, 
    command: string[], 
    options: { 
      workingDir?: string; 
      environment?: Record<string, string>;
      timeout?: number;
      stdin?: string;
    } = {}
  ): Promise<ExecutionResult> {
    const container = this.containers.get(containerId);
    if (!container) {
      throw new Error(`Container ${containerId} not found`);
    }

    if (container.status !== 'running') {
      throw new Error(`Container ${containerId} is not running`);
    }

    const startTime = Date.now();

    try {
      // Prepare docker exec arguments
      const args = ['exec'];

      if (options.workingDir) {
        args.push('-w', options.workingDir);
      }

      if (options.environment) {
        for (const [key, value] of Object.entries(options.environment)) {
          args.push('-e', `${key}=${value}`);
        }
      }

      args.push('-i', container.name);
      args.push(...command);

      return new Promise((resolve, reject) => {
        const process = spawn('docker', args, { stdio: 'pipe' });
        let stdout = '';
        let stderr = '';

        // Set timeout if specified
        let timeoutId: NodeJS.Timeout | undefined;
        if (options.timeout) {
          timeoutId = setTimeout(() => {
            process.kill('SIGKILL');
            reject(new Error(`Command timed out after ${options.timeout}ms`));
          }, options.timeout);
        }

        process.stdout?.on('data', (data) => {
          stdout += data.toString();
        });

        process.stderr?.on('data', (data) => {
          stderr += data.toString();
        });

        process.on('close', (exitCode) => {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }

          const duration = Date.now() - startTime;
          resolve({
            stdout,
            stderr,
            exitCode: exitCode || 0,
            duration,
          });
        });

        process.on('error', (error) => {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          reject(error);
        });

        // Send stdin if provided
        if (options.stdin && process.stdin) {
          process.stdin.write(options.stdin);
          process.stdin.end();
        }
      });

    } catch (error) {
      throw new Error(`Failed to execute command in container ${containerId}: ${error}`);
    }
  }

  async copyFileToContainer(
    containerId: string, 
    hostPath: string, 
    containerPath: string, 
    options: FileOperationOptions = {}
  ): Promise<void> {
    const container = this.containers.get(containerId);
    if (!container) {
      throw new Error(`Container ${containerId} not found`);
    }

    try {
      const result = await this.runDockerCommand([
        'cp', hostPath, `${container.name}:${containerPath}`
      ]);

      if (result.exitCode !== 0) {
        throw new Error(`Failed to copy file to container: ${result.stderr}`);
      }

      // Set permissions if specified
      if (options.mode) {
        await this.executeCommand(containerId, ['chmod', options.mode, containerPath]);
      }

      if (options.owner) {
        await this.executeCommand(containerId, ['chown', options.owner, containerPath]);
      }

    } catch (error) {
      throw new Error(`Failed to copy file to container ${containerId}: ${error}`);
    }
  }

  async copyFileFromContainer(
    containerId: string, 
    containerPath: string, 
    hostPath: string
  ): Promise<void> {
    const container = this.containers.get(containerId);
    if (!container) {
      throw new Error(`Container ${containerId} not found`);
    }

    try {
      const result = await this.runDockerCommand([
        'cp', `${container.name}:${containerPath}`, hostPath
      ]);

      if (result.exitCode !== 0) {
        throw new Error(`Failed to copy file from container: ${result.stderr}`);
      }

    } catch (error) {
      throw new Error(`Failed to copy file from container ${containerId}: ${error}`);
    }
  }

  async createFileInContainer(
    containerId: string, 
    filePath: string, 
    content: string, 
    options: FileOperationOptions = {}
  ): Promise<void> {
    const container = this.containers.get(containerId);
    if (!container) {
      throw new Error(`Container ${containerId} not found`);
    }

    try {
      // Create a temporary file on the host
      const tempFile = join(this.tempDir, `temp-${randomUUID()}`);
      await fs.writeFile(tempFile, content, 'utf8');

      // Copy to container
      await this.copyFileToContainer(containerId, tempFile, filePath, options);

      // Clean up temp file
      await fs.unlink(tempFile);

    } catch (error) {
      throw new Error(`Failed to create file in container ${containerId}: ${error}`);
    }
  }

  async readFileFromContainer(containerId: string, filePath: string): Promise<string> {
    const container = this.containers.get(containerId);
    if (!container) {
      throw new Error(`Container ${containerId} not found`);
    }

    try {
      const result = await this.executeCommand(containerId, ['cat', filePath]);
      
      if (result.exitCode !== 0) {
        throw new Error(`Failed to read file: ${result.stderr}`);
      }

      return result.stdout;

    } catch (error) {
      throw new Error(`Failed to read file from container ${containerId}: ${error}`);
    }
  }

  async stopContainer(containerId: string, timeout: number = 10): Promise<void> {
    const container = this.containers.get(containerId);
    if (!container) {
      throw new Error(`Container ${containerId} not found`);
    }

    try {
      const result = await this.runDockerCommand(['stop', '-t', timeout.toString(), container.name]);

      if (result.exitCode !== 0) {
        // Try force kill if stop fails
        await this.runDockerCommand(['kill', container.name]);
      }

      container.status = 'stopped';
      container.stopped = new Date();

      this.emit('containerStopped', container);

    } catch (error) {
      throw new Error(`Failed to stop container ${containerId}: ${error}`);
    }
  }

  async removeContainer(containerId: string, force: boolean = false): Promise<void> {
    const container = this.containers.get(containerId);
    if (!container) {
      throw new Error(`Container ${containerId} not found`);
    }

    try {
      const args = ['rm'];
      if (force) {
        args.push('-f');
      }
      args.push(container.name);

      const result = await this.runDockerCommand(args);

      if (result.exitCode !== 0) {
        throw new Error(`Failed to remove container: ${result.stderr}`);
      }

      this.containers.delete(containerId);
      this.emit('containerRemoved', container);

    } catch (error) {
      throw new Error(`Failed to remove container ${containerId}: ${error}`);
    }
  }

  async getContainerInfo(containerId: string): Promise<ContainerInfo | null> {
    return this.containers.get(containerId) || null;
  }

  async listContainers(): Promise<ContainerInfo[]> {
    return Array.from(this.containers.values());
  }

  async getContainerLogs(containerId: string, tail?: number): Promise<string> {
    const container = this.containers.get(containerId);
    if (!container) {
      throw new Error(`Container ${containerId} not found`);
    }

    try {
      const args = ['logs'];
      if (tail) {
        args.push('--tail', tail.toString());
      }
      args.push(container.name);

      const result = await this.runDockerCommand(args);
      return result.stdout + result.stderr;

    } catch (error) {
      throw new Error(`Failed to get container logs ${containerId}: ${error}`);
    }
  }

  async getContainerStats(containerId: string): Promise<any> {
    const container = this.containers.get(containerId);
    if (!container) {
      throw new Error(`Container ${containerId} not found`);
    }

    try {
      const result = await this.runDockerCommand([
        'stats', '--no-stream', '--format', 'json', container.name
      ]);

      if (result.exitCode !== 0) {
        throw new Error(`Failed to get container stats: ${result.stderr}`);
      }

      return JSON.parse(result.stdout);

    } catch (error) {
      throw new Error(`Failed to get container stats ${containerId}: ${error}`);
    }
  }

  async isDockerAvailable(): Promise<boolean> {
    try {
      const result = await this.runDockerCommand(['--version']);
      return result.exitCode === 0;
    } catch {
      return false;
    }
  }

  async pullImage(image: string): Promise<void> {
    try {
      const result = await this.runDockerCommand(['pull', image]);

      if (result.exitCode !== 0) {
        throw new Error(`Failed to pull image: ${result.stderr}`);
      }

    } catch (error) {
      throw new Error(`Failed to pull image ${image}: ${error}`);
    }
  }

  async cleanup(): Promise<void> {
    const containers = Array.from(this.containers.keys());
    
    for (const containerId of containers) {
      try {
        await this.stopContainer(containerId);
        await this.removeContainer(containerId, true);
      } catch (error) {
        console.error(`Failed to cleanup container ${containerId}:`, error);
      }
    }

    // Clean up temp directory
    try {
      await fs.rm(this.tempDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Failed to cleanup temp directory:', error);
    }
  }
}

export default DockerManager;