import fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import compress from '@fastify/compress';
import { Pool } from 'pg';
import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const app = fastify({ logger: true });

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Redis client
const redis = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redis.on('error', (err) => {
  console.error('Redis Client Error', err);
});

// Middleware
app.register(cors, {
  origin: true,
  credentials: true
});

app.register(helmet);
app.register(compress);

// Health endpoint
app.get('/health', async (request, reply) => {
  return {
    status: 'healthy',
    service: 'backend',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  };
});

// Ready endpoint
app.get('/ready', async (request, reply) => {
  try {
    // Check database connection
    await pool.query('SELECT 1');
    
    // Check Redis connection
    await redis.ping();
    
    // Check AI Engine
    const aiEngineUrl = process.env.AI_ENGINE_URL || 'http://localhost:8001';
    const response = await fetch(`${aiEngineUrl}/health`);
    
    if (!response.ok) {
      throw new Error('AI Engine not reachable');
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

// Projects endpoints
app.post('/projects', async (request, reply) => {
  const { name } = request.body as { name: string };
  
  if (!name) {
    reply.code(400);
    return { error: 'Project name is required' };
  }
  
  try {
    const result = await pool.query(
      'INSERT INTO projects (id, name, created_at) VALUES (gen_random_uuid(), $1, NOW()) RETURNING id, name, created_at',
      [name]
    );
    
    return result.rows[0];
  } catch (error) {
    reply.code(500);
    return { error: 'Failed to create project' };
  }
});

app.get('/projects', async (request, reply) => {
  try {
    const result = await pool.query(
      'SELECT id, name, created_at FROM projects ORDER BY created_at DESC'
    );
    
    return result.rows;
  } catch (error) {
    reply.code(500);
    return { error: 'Failed to fetch projects' };
  }
});

// Files endpoints
app.post('/files', async (request, reply) => {
  const { project_id, path } = request.body as { project_id: string; path: string };
  
  if (!project_id || !path) {
    reply.code(400);
    return { error: 'Project ID and path are required' };
  }
  
  try {
    const fileResult = await pool.query(
      'INSERT INTO files (id, project_id, path, created_at) VALUES (gen_random_uuid(), $1, $2, NOW()) RETURNING id, project_id, path, created_at',
      [project_id, path]
    );
    
    const file = fileResult.rows[0];
    
    // Create empty content
    await pool.query(
      'INSERT INTO file_content (file_id, content, updated_at) VALUES ($1, $2, NOW())',
      [file.id, '']
    );
    
    return file;
  } catch (error) {
    reply.code(500);
    return { error: 'Failed to create file' };
  }
});

app.get('/files', async (request, reply) => {
  const { project_id } = request.query as { project_id?: string };
  
  if (!project_id) {
    reply.code(400);
    return { error: 'Project ID is required' };
  }
  
  try {
    const result = await pool.query(
      'SELECT id, project_id, path, created_at FROM files WHERE project_id = $1 ORDER BY path',
      [project_id]
    );
    
    return result.rows;
  } catch (error) {
    reply.code(500);
    return { error: 'Failed to fetch files' };
  }
});

app.get('/files/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  
  try {
    const result = await pool.query(`
      SELECT f.id, f.project_id, f.path, f.created_at, fc.content, fc.updated_at
      FROM files f
      LEFT JOIN file_content fc ON f.id = fc.file_id
      WHERE f.id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      reply.code(404);
      return { error: 'File not found' };
    }
    
    return result.rows[0];
  } catch (error) {
    reply.code(500);
    return { error: 'Failed to fetch file' };
  }
});

app.put('/files/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const { content } = request.body as { content: string };
  
  try {
    // Update or insert content
    await pool.query(`
      INSERT INTO file_content (file_id, content, updated_at) 
      VALUES ($1, $2, NOW())
      ON CONFLICT (file_id) 
      DO UPDATE SET content = EXCLUDED.content, updated_at = NOW()
    `, [id, content || '']);
    
    return { success: true };
  } catch (error) {
    reply.code(500);
    return { error: 'Failed to update file' };
  }
});

app.delete('/files/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  
  try {
    await pool.query('DELETE FROM file_content WHERE file_id = $1', [id]);
    const result = await pool.query('DELETE FROM files WHERE id = $1', [id]);
    
    if (result.rowCount === 0) {
      reply.code(404);
      return { error: 'File not found' };
    }
    
    return { success: true };
  } catch (error) {
    reply.code(500);
    return { error: 'Failed to delete file' };
  }
});

// AI generate endpoint (proxy to ai-engine)
app.post('/ai/generate', async (request, reply) => {
  const body = request.body as any;
  
  try {
    const aiEngineUrl = process.env.AI_ENGINE_URL || 'http://localhost:8001';
    const response = await fetch(`${aiEngineUrl}/generation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: body.model || 'gpt-3.5-turbo',
        messages: body.messages || [{ role: 'user', content: body.prompt || 'Generate code' }],
        stream: false,
        ...body
      })
    });
    
    if (!response.ok) {
      throw new Error(`AI Engine responded with ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    reply.code(500);
    return { 
      error: 'AI generation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});

// Initialize connections and start server
const start = async () => {
  try {
    // Connect to Redis
    await redis.connect();
    console.log('Connected to Redis');
    
    // Test database connection
    await pool.query('SELECT 1');
    console.log('Connected to PostgreSQL');
    
    // Run database migrations
    await runMigrations();
    
    const port = parseInt(process.env.PORT || '3001');
    await app.listen({ port, host: '0.0.0.0' });
    
    console.log(`Backend server running on port ${port}`);
    console.log(`Health check: http://localhost:${port}/health`);
    console.log(`Ready check: http://localhost:${port}/ready`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

// Database migrations
async function runMigrations() {
  try {
    // Create tables if they don't exist
    await pool.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        name TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS files (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
        path TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS file_content (
        file_id UUID PRIMARY KEY REFERENCES files(id) ON DELETE CASCADE,
        content TEXT DEFAULT '',
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        kind TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        payload JSONB DEFAULT '{}'
      );
    `);
    
    console.log('Database migrations completed');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await app.close();
  await pool.end();
  await redis.quit();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await app.close();
  await pool.end();
  await redis.quit();
  process.exit(0);
});

start();