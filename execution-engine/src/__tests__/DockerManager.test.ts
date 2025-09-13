import { DockerManager, ContainerConfig } from '../containers/DockerManager';
import { jest } from '@jest/globals';

describe('DockerManager', () => {
  let dockerManager: DockerManager;

  beforeEach(() => {
    dockerManager = new DockerManager('/tmp/test-docker');
  });

  afterEach(async () => {
    await dockerManager.cleanup();
  });

  describe('Container Management', () => {
    it('should create and manage container lifecycle', async () => {
      const config: ContainerConfig = {
        image: 'alpine:latest',
        name: 'test-container',
        command: ['sleep', '10']
      };

      const containerId = await dockerManager.createContainer(config);
      expect(containerId).toBeDefined();

      const containerInfo = await dockerManager.getContainerInfo(containerId);
      expect(containerInfo).toBeDefined();
      expect(containerInfo?.name).toBe('test-container');
      expect(containerInfo?.image).toBe('alpine:latest');
      expect(containerInfo?.status).toBe('running');

      await dockerManager.stopContainer(containerId);
      const stoppedInfo = await dockerManager.getContainerInfo(containerId);
      expect(stoppedInfo?.status).toBe('stopped');

      await dockerManager.removeContainer(containerId);
      const removedInfo = await dockerManager.getContainerInfo(containerId);
      expect(removedInfo).toBeNull();
    });

    it('should execute commands in container', async () => {
      const config: ContainerConfig = {
        image: 'alpine:latest',
        command: ['sleep', '30']
      };

      const containerId = await dockerManager.createContainer(config);
      
      const result = await dockerManager.executeCommand(containerId, ['echo', 'hello world']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe('hello world');

      await dockerManager.removeContainer(containerId, true);
    });

    it('should handle file operations', async () => {
      const config: ContainerConfig = {
        image: 'alpine:latest',
        command: ['sleep', '30']
      };

      const containerId = await dockerManager.createContainer(config);
      
      // Create file in container
      const testContent = 'Hello, Docker!';
      await dockerManager.createFileInContainer(containerId, '/tmp/test.txt', testContent);

      // Read file back
      const content = await dockerManager.readFileFromContainer(containerId, '/tmp/test.txt');
      expect(content.trim()).toBe(testContent);

      await dockerManager.removeContainer(containerId, true);
    });

    it('should handle container errors gracefully', async () => {
      const config: ContainerConfig = {
        image: 'nonexistent:image'
      };

      await expect(dockerManager.createContainer(config)).rejects.toThrow();
    });

    it('should handle command timeouts', async () => {
      const config: ContainerConfig = {
        image: 'alpine:latest',
        command: ['sleep', '30']
      };

      const containerId = await dockerManager.createContainer(config);
      
      await expect(
        dockerManager.executeCommand(containerId, ['sleep', '5'], { timeout: 1000 })
      ).rejects.toThrow(/timed out/);

      await dockerManager.removeContainer(containerId, true);
    });
  });

  describe('Security Features', () => {
    it('should apply security restrictions', async () => {
      const config: ContainerConfig = {
        image: 'alpine:latest',
        user: 'nobody',
        securityOpts: ['no-new-privileges:true'],
        command: ['sleep', '10']
      };

      const containerId = await dockerManager.createContainer(config);
      
      // Test that security restrictions are applied
      const result = await dockerManager.executeCommand(containerId, ['whoami']);
      expect(result.stdout.trim()).toBe('nobody');

      await dockerManager.removeContainer(containerId, true);
    });

    it('should enforce resource limits', async () => {
      const config: ContainerConfig = {
        image: 'alpine:latest',
        memory: '64m',
        cpu: 0.5,
        command: ['sleep', '10']
      };

      const containerId = await dockerManager.createContainer(config);
      expect(containerId).toBeDefined();

      await dockerManager.removeContainer(containerId, true);
    });
  });

  describe('Utility Functions', () => {
    it('should check Docker availability', async () => {
      const isAvailable = await dockerManager.isDockerAvailable();
      expect(typeof isAvailable).toBe('boolean');
    });

    it('should list containers', async () => {
      const containers = await dockerManager.listContainers();
      expect(Array.isArray(containers)).toBe(true);
    });

    it('should get container logs', async () => {
      const config: ContainerConfig = {
        image: 'alpine:latest',
        command: ['echo', 'test log message']
      };

      const containerId = await dockerManager.createContainer(config);
      
      // Wait a bit for the command to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const logs = await dockerManager.getContainerLogs(containerId);
      expect(logs).toContain('test log message');

      await dockerManager.removeContainer(containerId, true);
    });
  });
});