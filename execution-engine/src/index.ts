import fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { createClient } from 'redis';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

const app = fastify({ logger: true });

// Redis client for job queue
let redis: any = null;
const jobs = new Map(); // In-memory fallback if Redis not available

interface Job {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  logs?: string[];
  result?: any;
  error?: string;
  created_at: Date;
}

// Initialize Redis if available
async function initRedis() {
  try {
    if (process.env.REDIS_URL) {
      redis = createClient({ url: process.env.REDIS_URL });
      await redis.connect();
      console.log('Connected to Redis for job queue');
    } else {
      console.log('No Redis URL configured, using in-memory job storage');
    }
  } catch (error) {
    console.log('Redis connection failed, using in-memory job storage:', error);
    redis = null;
  }
}

// Middleware
app.register(cors, {
  origin: true,
  credentials: true
});

app.register(helmet);

// Health endpoint
app.get('/health', async (request, reply) => {
  return {
    status: 'healthy',
    service: 'execution-engine',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  };
});

// Ready endpoint
app.get('/ready', async (request, reply) => {
  try {
    // Check Redis if configured
    if (redis) {
      await redis.ping();
    }
    
    return { status: 'ready' };
  } catch (error) {
    reply.code(503);
    return { 
      status: 'degraded', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
});

// Enqueue job endpoint
app.post('/jobs', async (request, reply) => {
  const body = request.body as any;
  const jobId = uuidv4();
  
  const job: Job = {
    id: jobId,
    status: 'pending',
    logs: [],
    created_at: new Date()
  };
  
  try {
    if (redis) {
      await redis.hSet(`job:${jobId}`, job);
      await redis.lPush('job_queue', jobId);
    } else {
      jobs.set(jobId, job);
    }
    
    // Simulate job processing
    processJob(jobId, body);
    
    return { id: jobId };
  } catch (error) {
    reply.code(500);
    return { error: 'Failed to enqueue job' };
  }
});

// Get job status endpoint
app.get('/jobs/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  
  try {
    let job: Job | null = null;
    
    if (redis) {
      const jobData = await redis.hGetAll(`job:${id}`);
      if (Object.keys(jobData).length > 0) {
        job = {
          ...jobData,
          logs: jobData.logs ? JSON.parse(jobData.logs) : [],
          created_at: new Date(jobData.created_at)
        };
      }
    } else {
      job = jobs.get(id) || null;
    }
    
    if (!job) {
      reply.code(404);
      return { error: 'Job not found' };
    }
    
    return job;
  } catch (error) {
    reply.code(500);
    return { error: 'Failed to fetch job' };
  }
});

// List jobs endpoint
app.get('/jobs', async (request, reply) => {
  try {
    const jobList: Job[] = [];
    
    if (redis) {
      const keys = await redis.keys('job:*');
      for (const key of keys) {
        const jobData = await redis.hGetAll(key);
        if (Object.keys(jobData).length > 0) {
          jobList.push({
            ...jobData,
            logs: jobData.logs ? JSON.parse(jobData.logs) : [],
            created_at: new Date(jobData.created_at)
          });
        }
      }
    } else {
      jobList.push(...Array.from(jobs.values()));
    }
    
    return { jobs: jobList };
  } catch (error) {
    reply.code(500);
    return { error: 'Failed to list jobs' };
  }
});

// Simulate job processing
async function processJob(jobId: string, payload: any) {
  const updateJob = async (updates: Partial<Job>) => {
    if (redis) {
      const current = await redis.hGetAll(`job:${jobId}`);
      const updated = { ...current, ...updates };
      if (updates.logs) {
        updated.logs = JSON.stringify(updates.logs);
      }
      await redis.hSet(`job:${jobId}`, updated);
    } else {
      const current = jobs.get(jobId);
      if (current) {
        jobs.set(jobId, { ...current, ...updates });
      }
    }
  };
  
  try {
    // Start job
    await updateJob({ status: 'running' });
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Simulate success
    await updateJob({ 
      status: 'completed',
      logs: ['Job started', 'Processing...', 'Job completed successfully'],
      result: { 
        output: 'Hello, World!',
        execution_time: '1.2s',
        memory_used: '12MB'
      }
    });
  } catch (error) {
    await updateJob({ 
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      logs: ['Job started', 'Error occurred during processing']
    });
  }
}

// Initialize and start server
const start = async () => {
  try {
    await initRedis();
    
    const port = parseInt(process.env.EXECUTION_ENGINE_PORT || '8002');
    await app.listen({ port, host: '0.0.0.0' });
    
    console.log(`Execution Engine running on port ${port}`);
    console.log(`Health check: http://localhost:${port}/health`);
    console.log(`Ready check: http://localhost:${port}/ready`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  if (redis) {
    await redis.quit();
  }
  await app.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  if (redis) {
    await redis.quit();
  }
  await app.close();
  process.exit(0);
});

start();