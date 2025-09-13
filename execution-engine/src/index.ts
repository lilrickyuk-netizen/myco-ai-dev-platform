import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { ExecutionService, JobConfig } from './execution_service';
import { body, param, validationResult } from 'express-validator';

const app = express();
const port = process.env.EXECUTION_ENGINE_PORT || 8001;

// Initialize execution service
const executionService = new ExecutionService();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:5173']
}));
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later'
});
app.use(limiter);

// Stricter rate limiting for execution endpoint
const executionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 executions per minute
  message: 'Too many code executions, please try again later'
});

// Validation middleware
const handleValidationErrors = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const health = await executionService.healthCheck();
    res.json(health);
  } catch (error) {
    res.status(500).json({ error: 'Health check failed' });
  }
});

// Get supported languages
app.get('/languages', (req, res) => {
  const languages = executionService.getSupportedLanguages();
  const configs = Object.fromEntries(
    languages.map(lang => [lang, executionService.getLanguageConfig(lang)])
  );
  
  res.json({
    languages,
    configs
  });
});

// Execute code
app.post('/execute',
  executionLimiter,
  [
    body('language').isString().notEmpty().withMessage('Language is required'),
    body('code').isString().notEmpty().withMessage('Code is required'),
    body('input').optional().isString(),
    body('timeout').optional().isInt({ min: 1000, max: 60000 }),
    body('memoryLimit').optional().isString(),
    body('cpuLimit').optional().isFloat({ min: 0.1, max: 2.0 }),
    body('environment').optional().isObject(),
    body('dependencies').optional().isArray(),
    body('tests').optional().isArray()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const config: JobConfig = {
        language: req.body.language,
        code: req.body.code,
        input: req.body.input,
        timeout: req.body.timeout,
        memoryLimit: req.body.memoryLimit,
        cpuLimit: req.body.cpuLimit,
        environment: req.body.environment,
        dependencies: req.body.dependencies,
        tests: req.body.tests
      };

      // Validate language
      if (!executionService.getSupportedLanguages().includes(config.language)) {
        return res.status(400).json({ error: `Unsupported language: ${config.language}` });
      }

      const jobId = await executionService.executeCode(config);
      res.json({ jobId, message: 'Code execution started' });
    } catch (error) {
      console.error('Execution error:', error);
      res.status(500).json({ error: 'Failed to start code execution' });
    }
  }
);

// Get job status
app.get('/jobs/:jobId',
  [
    param('jobId').isUUID().withMessage('Invalid job ID')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const job = await executionService.getJobStatus(req.params.jobId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      res.json(job);
    } catch (error) {
      console.error('Get job status error:', error);
      res.status(500).json({ error: 'Failed to get job status' });
    }
  }
);

// Cancel job
app.delete('/jobs/:jobId',
  [
    param('jobId').isUUID().withMessage('Invalid job ID')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      await executionService.cancelJob(req.params.jobId);
      res.json({ message: 'Job cancelled' });
    } catch (error) {
      console.error('Cancel job error:', error);
      if (error instanceof Error && error.message.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to cancel job' });
    }
  }
);

// List all jobs
app.get('/jobs', async (req, res) => {
  try {
    const jobs = await executionService.listJobs();
    res.json({ jobs });
  } catch (error) {
    console.error('List jobs error:', error);
    res.status(500).json({ error: 'Failed to list jobs' });
  }
});

// Get queue status
app.get('/queue', async (req, res) => {
  try {
    const status = await executionService.getQueueStatus();
    res.json(status);
  } catch (error) {
    console.error('Queue status error:', error);
    res.status(500).json({ error: 'Failed to get queue status' });
  }
});

// WebSocket support for real-time job updates
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:5173'],
    methods: ['GET', 'POST']
  }
});

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('subscribe-job', (jobId: string) => {
    socket.join(`job-${jobId}`);
  });

  socket.on('unsubscribe-job', (jobId: string) => {
    socket.leave(`job-${jobId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Set up execution service event listeners
executionService.on('jobCreated', (job) => {
  io.to(`job-${job.id}`).emit('job-created', job);
});

executionService.on('jobStarted', (job) => {
  io.to(`job-${job.id}`).emit('job-started', job);
});

executionService.on('jobCompleted', (job) => {
  io.to(`job-${job.id}`).emit('job-completed', job);
});

executionService.on('jobFailed', (job) => {
  io.to(`job-${job.id}`).emit('job-failed', job);
});

executionService.on('jobCancelled', (job) => {
  io.to(`job-${job.id}`).emit('job-cancelled', job);
});

// Error handling middleware
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Initialize and start server
async function start() {
  try {
    console.log('Initializing execution service...');
    await executionService.initialize();
    
    server.listen(port, () => {
      console.log(`Execution Engine running on port ${port}`);
      console.log(`Supported languages: ${executionService.getSupportedLanguages().join(', ')}`);
    });
  } catch (error) {
    console.error('Failed to start execution engine:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down execution engine...');
  await executionService.cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down execution engine...');
  await executionService.cleanup();
  process.exit(0);
});

start();

export { app, executionService };