import fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import dotenv from 'dotenv';

dotenv.config();

const app = fastify({ logger: true });

// Middleware
app.register(cors, {
  origin: true,
  credentials: true
});

app.register(helmet);

// Simple template renderer
function renderTemplate(template: string, variables: Record<string, any>): string {
  let result = template;
  
  // Simple {{variable}} replacement
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    result = result.replace(regex, String(value));
  }
  
  return result;
}

// Health endpoint
app.get('/health', async (request, reply) => {
  return {
    status: 'healthy',
    service: 'template-engine',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  };
});

// Ready endpoint
app.get('/ready', async (request, reply) => {
  return { status: 'ready' };
});

// Render template endpoint
app.post('/render', async (request, reply) => {
  const body = request.body as { template?: string; variables?: Record<string, any> };
  
  if (!body.template) {
    reply.code(400);
    return { error: 'Template is required' };
  }
  
  try {
    const result = renderTemplate(body.template, body.variables || {});
    return { result };
  } catch (error) {
    reply.code(500);
    return { 
      error: 'Template rendering failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});

// Get available templates
app.get('/templates', async (request, reply) => {
  return {
    templates: [
      {
        name: 'basic-component',
        description: 'Basic React component template',
        template: `import React from 'react';

interface {{componentName}}Props {
  // Add props here
}

const {{componentName}}: React.FC<{{componentName}}Props> = () => {
  return (
    <div>
      <h1>{{title}}</h1>
      <p>{{description}}</p>
    </div>
  );
};

export default {{componentName}};`
      },
      {
        name: 'api-endpoint',
        description: 'Basic API endpoint template',
        template: `export async function {{methodName}}(req: Request, res: Response) {
  try {
    // {{description}}
    const result = {
      message: '{{successMessage}}',
      data: {}
    };
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}`
      }
    ]
  };
});

// Initialize and start server
const start = async () => {
  try {
    const port = parseInt(process.env.TEMPLATE_ENGINE_PORT || '8003');
    await app.listen({ port, host: '0.0.0.0' });
    
    console.log(`Template Engine running on port ${port}`);
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