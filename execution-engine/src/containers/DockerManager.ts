import Docker from 'dockerode';
import { EventEmitter } from 'events';
import { createWriteStream, promises as fs } from 'fs';
import { join } from 'path';
import archiver from 'archiver';
import tar from 'tar';

export interface ContainerConfig {
  image: string;
  name: string;
  environment?: Record<string, string>;
  ports?: Record<string, number>;
  volumes?: Record<string, string>;
  workingDir?: string;
  command?: string[];
  resources?: {
    cpus?: number;
    memory?: number;
  };
}

export interface BuildConfig {
  dockerfile: string;
  context: string;
  tags: string[];
  buildArgs?: Record<string, string>;
  target?: string;
}

export class DockerManager extends EventEmitter {
  private docker: Docker;
  private containers: Map<string, Docker.Container> = new Map();
  
  constructor(dockerOptions?: Docker.DockerOptions) {
    super();
    this.docker = new Docker(dockerOptions);
  }

  async buildImage(config: BuildConfig): Promise<string> {
    try {
      // Create build context tar stream
      const contextStream = await this.createBuildContext(config.context);
      
      // Build image
      const stream = await this.docker.buildImage(contextStream, {
        dockerfile: config.dockerfile,
        t: config.tags,
        buildargs: config.buildArgs,
        target: config.target,
      });

      // Handle build output
      const output = await this.handleDockerStream(stream);
      
      this.emit('build:complete', { tags: config.tags, output });
      return config.tags[0];
    } catch (error) {
      this.emit('build:error', error);
      throw error;
    }
  }

  async createContainer(config: ContainerConfig): Promise<string> {
    try {
      const createOptions: Docker.ContainerCreateOptions = {
        Image: config.image,
        name: config.name,
        Env: this.formatEnvironmentVariables(config.environment),
        ExposedPorts: this.formatExposedPorts(config.ports),
        HostConfig: {
          PortBindings: this.formatPortBindings(config.ports),
          Binds: this.formatBindMounts(config.volumes),
          Memory: config.resources?.memory ? config.resources.memory * 1024 * 1024 : undefined,
          CpuShares: config.resources?.cpus ? config.resources.cpus * 1024 : undefined,
        },
        WorkingDir: config.workingDir,
        Cmd: config.command,
      };

      const container = await this.docker.createContainer(createOptions);
      this.containers.set(container.id, container);
      
      this.emit('container:created', { id: container.id, name: config.name });
      return container.id;
    } catch (error) {
      this.emit('container:error', error);
      throw error;
    }
  }

  async startContainer(containerId: string): Promise<void> {
    const container = this.containers.get(containerId) || this.docker.getContainer(containerId);
    
    try {
      await container.start();
      this.emit('container:started', { id: containerId });
    } catch (error) {
      this.emit('container:error', error);
      throw error;
    }
  }

  async stopContainer(containerId: string, timeout = 10): Promise<void> {
    const container = this.containers.get(containerId) || this.docker.getContainer(containerId);
    
    try {
      await container.stop({ t: timeout });
      this.emit('container:stopped', { id: containerId });
    } catch (error) {
      this.emit('container:error', error);
      throw error;
    }
  }

  async removeContainer(containerId: string, force = false): Promise<void> {
    const container = this.containers.get(containerId) || this.docker.getContainer(containerId);
    
    try {
      await container.remove({ force });
      this.containers.delete(containerId);
      this.emit('container:removed', { id: containerId });
    } catch (error) {
      this.emit('container:error', error);
      throw error;
    }
  }

  async executeCommand(
    containerId: string, 
    command: string[], 
    options: { workingDir?: string; environment?: Record<string, string> } = {}
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    const container = this.containers.get(containerId) || this.docker.getContainer(containerId);
    
    try {
      const exec = await container.exec({
        Cmd: command,
        AttachStdout: true,
        AttachStderr: true,
        WorkingDir: options.workingDir,
        Env: this.formatEnvironmentVariables(options.environment),
      });

      const stream = await exec.start({});
      const output = await this.handleExecutionStream(stream);
      
      const inspection = await exec.inspect();
      
      return {
        exitCode: inspection.ExitCode || 0,
        stdout: output.stdout,
        stderr: output.stderr,
      };
    } catch (error) {
      this.emit('execution:error', error);
      throw error;
    }
  }

  async getContainerLogs(
    containerId: string, 
    options: { tail?: number; since?: Date; until?: Date } = {}
  ): Promise<string> {
    const container = this.containers.get(containerId) || this.docker.getContainer(containerId);
    
    try {
      const logsStream = await container.logs({
        stdout: true,
        stderr: true,
        tail: options.tail || 100,
        since: options.since ? Math.floor(options.since.getTime() / 1000) : undefined,
        until: options.until ? Math.floor(options.until.getTime() / 1000) : undefined,
      });

      return this.demuxStream(logsStream);
    } catch (error) {
      this.emit('logs:error', error);
      throw error;
    }
  }

  async getContainerStats(containerId: string): Promise<Docker.ContainerStats> {
    const container = this.containers.get(containerId) || this.docker.getContainer(containerId);
    
    try {
      const stats = await container.stats({ stream: false });
      return stats;
    } catch (error) {
      this.emit('stats:error', error);
      throw error;
    }
  }

  async listContainers(all = false): Promise<Docker.ContainerInfo[]> {
    try {
      return await this.docker.listContainers({ all });
    } catch (error) {
      this.emit('list:error', error);
      throw error;
    }
  }

  async listImages(): Promise<Docker.ImageInfo[]> {
    try {
      return await this.docker.listImages();
    } catch (error) {
      this.emit('images:error', error);
      throw error;
    }
  }

  async pullImage(imageName: string, tag = 'latest'): Promise<void> {
    try {
      const stream = await this.docker.pull(`${imageName}:${tag}`);
      await this.handleDockerStream(stream);
      this.emit('image:pulled', { image: `${imageName}:${tag}` });
    } catch (error) {
      this.emit('image:error', error);
      throw error;
    }
  }

  async pushImage(imageName: string, tag = 'latest'): Promise<void> {
    try {
      const image = this.docker.getImage(`${imageName}:${tag}`);
      const stream = await image.push();
      await this.handleDockerStream(stream);
      this.emit('image:pushed', { image: `${imageName}:${tag}` });
    } catch (error) {
      this.emit('image:error', error);
      throw error;
    }
  }

  async createNetwork(name: string, driver = 'bridge'): Promise<string> {
    try {
      const network = await this.docker.createNetwork({ Name: name, Driver: driver });
      this.emit('network:created', { id: network.id, name });
      return network.id;
    } catch (error) {
      this.emit('network:error', error);
      throw error;
    }
  }

  async createVolume(name: string, driver = 'local'): Promise<string> {
    try {
      const volume = await this.docker.createVolume({ Name: name, Driver: driver });
      this.emit('volume:created', { name });
      return volume.Name;
    } catch (error) {
      this.emit('volume:error', error);
      throw error;
    }
  }

  // Utility methods

  private async createBuildContext(contextPath: string): Promise<NodeJS.ReadableStream> {
    return new Promise((resolve, reject) => {
      const archive = archiver('tar');
      
      archive.on('error', reject);
      archive.on('end', () => resolve(archive));
      
      archive.directory(contextPath, false);
      archive.finalize();
    });
  }

  private async handleDockerStream(stream: NodeJS.ReadableStream): Promise<string> {
    return new Promise((resolve, reject) => {
      let output = '';
      
      stream.on('data', (chunk) => {
        const data = chunk.toString();
        output += data;
        this.emit('stream:data', data);
      });
      
      stream.on('end', () => resolve(output));
      stream.on('error', reject);
    });
  }

  private async handleExecutionStream(stream: NodeJS.ReadableStream): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      
      stream.on('data', (chunk) => {
        const data = chunk.toString();
        // Docker exec streams are multiplexed
        if (chunk[0] === 1) {
          stdout += data.slice(8); // Remove Docker stream header
        } else if (chunk[0] === 2) {
          stderr += data.slice(8); // Remove Docker stream header
        }
      });
      
      stream.on('end', () => resolve({ stdout, stderr }));
      stream.on('error', reject);
    });
  }

  private demuxStream(stream: Buffer): string {
    // Demux Docker log stream format
    let output = '';
    let offset = 0;
    
    while (offset < stream.length) {
      const header = stream.slice(offset, offset + 8);
      const size = header.readUInt32BE(4);
      const data = stream.slice(offset + 8, offset + 8 + size);
      output += data.toString();
      offset += 8 + size;
    }
    
    return output;
  }

  private formatEnvironmentVariables(env?: Record<string, string>): string[] | undefined {
    if (!env) return undefined;
    return Object.entries(env).map(([key, value]) => `${key}=${value}`);
  }

  private formatExposedPorts(ports?: Record<string, number>): Record<string, {}> | undefined {
    if (!ports) return undefined;
    const exposed: Record<string, {}> = {};
    Object.values(ports).forEach(port => {
      exposed[`${port}/tcp`] = {};
    });
    return exposed;
  }

  private formatPortBindings(ports?: Record<string, number>): Record<string, Docker.PortBinding[]> | undefined {
    if (!ports) return undefined;
    const bindings: Record<string, Docker.PortBinding[]> = {};
    Object.entries(ports).forEach(([hostPort, containerPort]) => {
      bindings[`${containerPort}/tcp`] = [{ HostPort: hostPort }];
    });
    return bindings;
  }

  private formatBindMounts(volumes?: Record<string, string>): string[] | undefined {
    if (!volumes) return undefined;
    return Object.entries(volumes).map(([hostPath, containerPath]) => `${hostPath}:${containerPath}`);
  }
}

// Container pool for managing multiple containers
export class ContainerPool {
  private manager: DockerManager;
  private pools: Map<string, Set<string>> = new Map();
  private activeContainers: Map<string, { id: string; lastUsed: Date }> = new Map();
  
  constructor(manager: DockerManager) {
    this.manager = manager;
  }

  async getContainer(poolName: string, config: ContainerConfig): Promise<string> {
    // Check for available container in pool
    const pool = this.pools.get(poolName) || new Set();
    
    for (const containerId of pool) {
      const containerInfo = this.activeContainers.get(containerId);
      if (containerInfo && this.isContainerAvailable(containerInfo)) {
        containerInfo.lastUsed = new Date();
        return containerId;
      }
    }

    // Create new container if none available
    const containerId = await this.manager.createContainer(config);
    await this.manager.startContainer(containerId);
    
    pool.add(containerId);
    this.pools.set(poolName, pool);
    this.activeContainers.set(containerId, { id: containerId, lastUsed: new Date() });
    
    return containerId;
  }

  async releaseContainer(containerId: string): Promise<void> {
    const containerInfo = this.activeContainers.get(containerId);
    if (containerInfo) {
      containerInfo.lastUsed = new Date();
    }
  }

  async cleanupPool(poolName: string, maxAge = 30 * 60 * 1000): Promise<void> {
    const pool = this.pools.get(poolName);
    if (!pool) return;

    const now = new Date();
    const containersToRemove: string[] = [];

    for (const containerId of pool) {
      const containerInfo = this.activeContainers.get(containerId);
      if (containerInfo && now.getTime() - containerInfo.lastUsed.getTime() > maxAge) {
        containersToRemove.push(containerId);
      }
    }

    for (const containerId of containersToRemove) {
      try {
        await this.manager.stopContainer(containerId);
        await this.manager.removeContainer(containerId);
        pool.delete(containerId);
        this.activeContainers.delete(containerId);
      } catch (error) {
        console.error(`Failed to cleanup container ${containerId}:`, error);
      }
    }
  }

  private isContainerAvailable(containerInfo: { id: string; lastUsed: Date }): boolean {
    // Container is available if it was last used more than 1 minute ago
    const now = new Date();
    return now.getTime() - containerInfo.lastUsed.getTime() > 60 * 1000;
  }
}