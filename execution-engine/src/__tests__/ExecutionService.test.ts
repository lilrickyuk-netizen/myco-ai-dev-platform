import { ExecutionService, JobConfig } from '../execution_service';
import { jest } from '@jest/globals';

describe('ExecutionService', () => {
  let executionService: ExecutionService;

  beforeEach(() => {
    executionService = new ExecutionService(2); // Limit to 2 concurrent jobs for testing
  });

  afterEach(async () => {
    await executionService.cleanup();
  });

  describe('Language Support', () => {
    it('should support multiple programming languages', () => {
      const languages = executionService.getSupportedLanguages();
      expect(languages).toContain('javascript');
      expect(languages).toContain('python');
      expect(languages).toContain('typescript');
      expect(languages).toContain('java');
      expect(languages).toContain('cpp');
      expect(languages).toContain('rust');
      expect(languages).toContain('go');
    });

    it('should provide language configurations', () => {
      const jsConfig = executionService.getLanguageConfig('javascript');
      expect(jsConfig).toBeDefined();
      expect(jsConfig?.image).toBe('node:18-alpine');
      expect(jsConfig?.fileExtension).toBe('js');
      expect(jsConfig?.runCommand).toEqual(['node', 'main.js']);
    });
  });

  describe('Job Management', () => {
    it('should create and track jobs', async () => {
      const config: JobConfig = {
        language: 'javascript',
        code: 'console.log("Hello, World!");'
      };

      const jobId = await executionService.executeCode(config);
      expect(jobId).toBeDefined();

      const job = await executionService.getJobStatus(jobId);
      expect(job).toBeDefined();
      expect(job?.id).toBe(jobId);
      expect(job?.status).toMatch(/queued|running|completed/);
    });

    it('should execute simple JavaScript code', async () => {
      const config: JobConfig = {
        language: 'javascript',
        code: 'console.log("Hello, World!");'
      };

      const jobId = await executionService.executeCode(config);
      
      // Wait for job to complete
      let job = await executionService.getJobStatus(jobId);
      let attempts = 0;
      while (job && job.status !== 'completed' && job.status !== 'failed' && attempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        job = await executionService.getJobStatus(jobId);
        attempts++;
      }

      expect(job?.status).toBe('completed');
      expect(job?.output).toContain('Hello, World!');
      expect(job?.exitCode).toBe(0);
    });

    it('should execute Python code', async () => {
      const config: JobConfig = {
        language: 'python',
        code: 'print("Hello from Python!")'
      };

      const jobId = await executionService.executeCode(config);
      
      // Wait for job to complete
      let job = await executionService.getJobStatus(jobId);
      let attempts = 0;
      while (job && job.status !== 'completed' && job.status !== 'failed' && attempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        job = await executionService.getJobStatus(jobId);
        attempts++;
      }

      expect(job?.status).toBe('completed');
      expect(job?.output).toContain('Hello from Python!');
      expect(job?.exitCode).toBe(0);
    });

    it('should handle code with input', async () => {
      const config: JobConfig = {
        language: 'python',
        code: `
name = input("Enter name: ")
print(f"Hello, {name}!")
        `,
        input: 'Alice\n'
      };

      const jobId = await executionService.executeCode(config);
      
      // Wait for job to complete
      let job = await executionService.getJobStatus(jobId);
      let attempts = 0;
      while (job && job.status !== 'completed' && job.status !== 'failed' && attempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        job = await executionService.getJobStatus(jobId);
        attempts++;
      }

      expect(job?.status).toBe('completed');
      expect(job?.output).toContain('Hello, Alice!');
    });

    it('should handle compilation errors', async () => {
      const config: JobConfig = {
        language: 'java',
        code: `
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello"  // Missing semicolon and closing parenthesis
    }
}
        `
      };

      const jobId = await executionService.executeCode(config);
      
      // Wait for job to complete
      let job = await executionService.getJobStatus(jobId);
      let attempts = 0;
      while (job && job.status !== 'completed' && job.status !== 'failed' && attempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        job = await executionService.getJobStatus(jobId);
        attempts++;
      }

      expect(job?.status).toBe('failed');
      expect(job?.error).toContain('Compilation failed');
    });

    it('should handle runtime errors', async () => {
      const config: JobConfig = {
        language: 'python',
        code: `
print("Before error")
x = 1 / 0  # Division by zero
print("After error")
        `
      };

      const jobId = await executionService.executeCode(config);
      
      // Wait for job to complete
      let job = await executionService.getJobStatus(jobId);
      let attempts = 0;
      while (job && job.status !== 'completed' && job.status !== 'failed' && attempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        job = await executionService.getJobStatus(jobId);
        attempts++;
      }

      expect(job?.status).toBe('completed'); // Python exits with non-zero code but job completes
      expect(job?.exitCode).not.toBe(0);
      expect(job?.output).toContain('Before error');
      expect(job?.error).toContain('ZeroDivisionError');
    });

    it('should enforce timeouts', async () => {
      const config: JobConfig = {
        language: 'python',
        code: `
import time
time.sleep(10)  # Sleep for 10 seconds
print("This should not print")
        `,
        timeout: 2000 // 2 second timeout
      };

      const jobId = await executionService.executeCode(config);
      
      // Wait for job to complete or timeout
      let job = await executionService.getJobStatus(jobId);
      let attempts = 0;
      while (job && job.status !== 'completed' && job.status !== 'failed' && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        job = await executionService.getJobStatus(jobId);
        attempts++;
      }

      expect(job?.status).toBe('failed');
      expect(job?.error).toContain('timeout');
    });

    it('should list jobs', async () => {
      const config1: JobConfig = {
        language: 'javascript',
        code: 'console.log("Job 1");'
      };
      const config2: JobConfig = {
        language: 'python',
        code: 'print("Job 2")'
      };

      const jobId1 = await executionService.executeCode(config1);
      const jobId2 = await executionService.executeCode(config2);

      const jobs = await executionService.listJobs();
      expect(jobs.length).toBeGreaterThanOrEqual(2);
      
      const jobIds = jobs.map(job => job.id);
      expect(jobIds).toContain(jobId1);
      expect(jobIds).toContain(jobId2);
    });

    it('should provide queue status', async () => {
      const status = await executionService.getQueueStatus();
      expect(status).toHaveProperty('queueLength');
      expect(status).toHaveProperty('activeJobs');
      expect(status).toHaveProperty('maxConcurrentJobs');
      expect(status.maxConcurrentJobs).toBe(2); // Set in beforeEach
    });
  });

  describe('Error Handling', () => {
    it('should reject unsupported languages', async () => {
      const config: JobConfig = {
        language: 'unsupported',
        code: 'print("test")'
      };

      const jobId = await executionService.executeCode(config);
      
      // Wait for job to complete
      let job = await executionService.getJobStatus(jobId);
      let attempts = 0;
      while (job && job.status !== 'completed' && job.status !== 'failed' && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        job = await executionService.getJobStatus(jobId);
        attempts++;
      }

      expect(job?.status).toBe('failed');
      expect(job?.error).toContain('Unsupported language');
    });

    it('should handle job cancellation', async () => {
      const config: JobConfig = {
        language: 'python',
        code: `
import time
time.sleep(5)
print("Should not reach here")
        `
      };

      const jobId = await executionService.executeCode(config);
      
      // Cancel the job immediately
      await executionService.cancelJob(jobId);
      
      const job = await executionService.getJobStatus(jobId);
      expect(job?.status).toBe('failed');
      expect(job?.error).toContain('cancelled');
    });
  });

  describe('Health Check', () => {
    it('should provide health status', async () => {
      const health = await executionService.healthCheck();
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('dockerAvailable');
      expect(health).toHaveProperty('activeJobs');
      expect(health).toHaveProperty('queueLength');
      expect(health).toHaveProperty('totalJobs');
    });
  });
});