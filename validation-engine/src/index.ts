import fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import Ajv from 'ajv';
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const app = fastify({ logger: true });
const ajv = new Ajv();

// Middleware
app.register(cors, {
  origin: true,
  credentials: true
});

app.register(helmet);

// Validation functions
function validateWithZod(schema: any, data: any) {
  try {
    const zodSchema = z.object(schema);
    const result = zodSchema.safeParse(data);
    
    return {
      valid: result.success,
      errors: result.success ? [] : result.error.issues.map(issue => ({
        path: issue.path.join('.'),
        message: issue.message,
        code: issue.code
      }))
    };
  } catch (error) {
    return {
      valid: false,
      errors: [{ 
        path: 'schema', 
        message: 'Invalid schema provided',
        code: 'invalid_schema'
      }]
    };
  }
}

function validateWithAjv(schema: any, data: any) {
  try {
    const validate = ajv.compile(schema);
    const valid = validate(data);
    
    return {
      valid,
      errors: valid ? [] : (validate.errors || []).map(error => ({
        path: error.instancePath || '',
        message: error.message || 'Validation error',
        code: error.keyword || 'validation_error'
      }))
    };
  } catch (error) {
    return {
      valid: false,
      errors: [{ 
        path: 'schema', 
        message: 'Invalid schema provided',
        code: 'invalid_schema'
      }]
    };
  }
}

// Health endpoint
app.get('/health', async (request, reply) => {
  return {
    status: 'healthy',
    service: 'validation-engine',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  };
});

// Ready endpoint
app.get('/ready', async (request, reply) => {
  return { status: 'ready' };
});

// Validate data endpoint
app.post('/validate', async (request, reply) => {
  const body = request.body as { 
    schema?: any; 
    data?: any; 
    validator?: 'zod' | 'ajv' 
  };
  
  if (!body.schema || body.data === undefined) {
    reply.code(400);
    return { error: 'Schema and data are required' };
  }
  
  try {
    const validator = body.validator || 'ajv';
    
    let result;
    if (validator === 'zod') {
      result = validateWithZod(body.schema, body.data);
    } else {
      result = validateWithAjv(body.schema, body.data);
    }
    
    return result;
  } catch (error) {
    reply.code(500);
    return { 
      error: 'Validation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});

// Code quality validation endpoint
app.post('/validate/code', async (request, reply) => {
  const body = request.body as { 
    code?: string; 
    language?: string;
    rules?: string[];
  };
  
  if (!body.code) {
    reply.code(400);
    return { error: 'Code is required' };
  }
  
  try {
    const issues = [];
    const language = body.language || 'javascript';
    
    // Simple code quality checks
    if (body.code.includes('eval(')) {
      issues.push({
        line: 0,
        message: 'Use of eval() is discouraged for security reasons',
        severity: 'error',
        rule: 'no-eval'
      });
    }
    
    if (body.code.includes('innerHTML')) {
      issues.push({
        line: 0,
        message: 'Use of innerHTML can lead to XSS vulnerabilities',
        severity: 'warning',
        rule: 'no-innerHTML'
      });
    }
    
    if (!body.code.includes('try') && body.code.includes('throw')) {
      issues.push({
        line: 0,
        message: 'Consider wrapping throw statements in try-catch blocks',
        severity: 'info',
        rule: 'error-handling'
      });
    }
    
    const lines = body.code.split('\n');
    if (lines.some(line => line.length > 120)) {
      issues.push({
        line: 0,
        message: 'Line length exceeds 120 characters',
        severity: 'warning',
        rule: 'max-line-length'
      });
    }
    
    return {
      valid: issues.filter(i => i.severity === 'error').length === 0,
      issues,
      summary: {
        errors: issues.filter(i => i.severity === 'error').length,
        warnings: issues.filter(i => i.severity === 'warning').length,
        info: issues.filter(i => i.severity === 'info').length
      }
    };
  } catch (error) {
    reply.code(500);
    return { 
      error: 'Code validation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});

// Security validation endpoint
app.post('/validate/security', async (request, reply) => {
  const body = request.body as { 
    code?: string; 
    language?: string;
  };
  
  if (!body.code) {
    reply.code(400);
    return { error: 'Code is required' };
  }
  
  try {
    const vulnerabilities = [];
    
    // Security checks
    const securityPatterns = [
      { pattern: /password\s*=\s*['"][^'"]+['"]/gi, message: 'Hardcoded password detected', severity: 'high' },
      { pattern: /api[_-]?key\s*=\s*['"][^'"]+['"]/gi, message: 'Hardcoded API key detected', severity: 'high' },
      { pattern: /token\s*=\s*['"][^'"]+['"]/gi, message: 'Hardcoded token detected', severity: 'medium' },
      { pattern: /eval\s*\(/gi, message: 'Use of eval() detected', severity: 'high' },
      { pattern: /document\.write\s*\(/gi, message: 'Use of document.write() detected', severity: 'medium' },
      { pattern: /innerHTML\s*=/gi, message: 'Use of innerHTML detected', severity: 'medium' },
      { pattern: /\.exec\s*\(/gi, message: 'Command execution detected', severity: 'high' }
    ];
    
    for (const { pattern, message, severity } of securityPatterns) {
      const matches = body.code.match(pattern);
      if (matches) {
        vulnerabilities.push({
          type: 'security',
          message,
          severity,
          occurrences: matches.length,
          pattern: pattern.source
        });
      }
    }
    
    return {
      secure: vulnerabilities.filter(v => v.severity === 'high').length === 0,
      vulnerabilities,
      summary: {
        high: vulnerabilities.filter(v => v.severity === 'high').length,
        medium: vulnerabilities.filter(v => v.severity === 'medium').length,
        low: vulnerabilities.filter(v => v.severity === 'low').length
      }
    };
  } catch (error) {
    reply.code(500);
    return { 
      error: 'Security validation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});

// Get validation schemas
app.get('/schemas', async (request, reply) => {
  return {
    schemas: {
      user: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1 },
          email: { type: 'string', format: 'email' },
          age: { type: 'number', minimum: 0 }
        },
        required: ['name', 'email']
      },
      project: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1 },
          description: { type: 'string' },
          language: { type: 'string', enum: ['javascript', 'typescript', 'python'] }
        },
        required: ['name']
      }
    }
  };
});

// Initialize and start server
const start = async () => {
  try {
    const port = parseInt(process.env.VALIDATION_ENGINE_PORT || '8004');
    await app.listen({ port, host: '0.0.0.0' });
    
    console.log(`Validation Engine running on port ${port}`);
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
  await app.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await app.close();
  process.exit(0);
});

start();