# MYCO Platform Documentation

Welcome to the comprehensive documentation for the MYCO Hybrid Development Platform. This documentation covers everything you need to know to develop, deploy, and maintain the platform.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Architecture Overview](#architecture-overview)
3. [Development Guide](#development-guide)
4. [API Reference](#api-reference)
5. [Deployment Guide](#deployment-guide)
6. [Contributing](#contributing)
7. [Troubleshooting](#troubleshooting)

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ and npm
- Python 3.11+
- Git

### Local Development Setup

```bash
# Clone the repository
git clone https://github.com/myco/platform.git
cd platform

# Copy environment configuration
cp .env.example .env

# Start all services
docker-compose up

# Access the application
# Frontend: http://localhost:3000
# Backend API: http://localhost:3001
# AI Engine: http://localhost:8000
```

The platform will be ready to use with:
- Admin user: admin@myco.dev / admin123
- Demo project pre-loaded
- All services running and healthy

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                             │
│                  React + TypeScript + Vite                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                   Backend API                               │
│              Encore.ts + Express + TypeScript              │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┬─────────────────┐
        │              │              │                 │
┌───────▼───────┐ ┌───▼────┐ ┌──────▼──────┐ ┌───────▼────┐
│  AI Engine    │ │Database│ │  Execution  │ │ Validation │
│   FastAPI     │ │Postgres│ │   Engine    │ │   Engine   │
└───────────────┘ └────────┘ └─────────────┘ └────────────┘
```

### Core Services

1. **Frontend (React + TypeScript)**
   - Modern web-based IDE
   - Real-time collaboration
   - Monaco code editor
   - Project management UI

2. **Backend API (Encore.ts)**
   - RESTful API services
   - Authentication & authorization
   - File management
   - Real-time WebSocket communication

3. **AI Engine (FastAPI + Python)**
   - Code generation
   - Natural language processing
   - Multiple LLM provider support
   - Context-aware assistance

4. **Execution Engine (Docker)**
   - Sandboxed code execution
   - Multi-language support
   - Resource management
   - Security isolation

5. **Validation Engine (TypeScript)**
   - Code quality analysis
   - Security scanning
   - Performance metrics
   - Compliance checking

## Development Guide

### Getting Started

1. **Environment Setup**
   ```bash
   # Install dependencies
   npm install
   pip install -r ai-engine/requirements.txt
   
   # Setup development database
   npm run db:setup
   
   # Run development servers
   npm run dev
   ```

2. **Project Structure**
   ```
   myco-platform/
   ├── frontend/          # React frontend application
   ├── backend/           # Encore.ts backend services
   ├── ai-engine/         # Python AI services
   ├── execution-engine/  # Docker execution environment
   ├── validation-engine/ # Code quality and security validation
   ├── template-engine/   # Project template system
   ├── infrastructure/    # Docker, Kubernetes, Terraform
   ├── database/          # Database schemas and migrations
   ├── monitoring/        # Observability configuration
   ├── security/          # Security policies and configuration
   └── docs/              # Documentation
   ```

### Key Development Workflows

#### Adding a New Feature

1. Create feature branch: `git checkout -b feature/new-feature`
2. Implement backend API endpoints in `backend/`
3. Add frontend components in `frontend/src/components/`
4. Write tests in appropriate `__tests__/` directories
5. Update documentation
6. Submit pull request

#### Working with AI Services

1. Define new AI capabilities in `ai-engine/services/`
2. Add API routes in `ai-engine/api/routes/`
3. Update backend proxy in `backend/ai/`
4. Test with various prompts and edge cases

#### Database Changes

1. Create migration in `database/migrations/`
2. Update backend models in relevant service directories
3. Add seed data if needed in `database/seeds/`
4. Test migration up and down

### Code Standards

- **TypeScript**: Strict mode enabled, full type coverage
- **Python**: PEP 8 compliant, type hints required
- **Testing**: Minimum 70% code coverage
- **Documentation**: JSDoc for TypeScript, docstrings for Python
- **Git**: Conventional commits, feature branch workflow

## API Reference

### Authentication

```typescript
// Login
POST /auth/login
{
  "email": "user@example.com",
  "password": "password123"
}

// Response
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe"
  },
  "token": "jwt-token",
  "refreshToken": "refresh-token"
}
```

### Projects

```typescript
// Create project
POST /projects
{
  "name": "My Project",
  "description": "Project description",
  "templateId": "template-uuid"
}

// List projects
GET /projects
// Response: Project[]

// Get project
GET /projects/:id
// Response: Project with files
```

### Files

```typescript
// Create file
POST /projects/:projectId/files
{
  "name": "app.tsx",
  "path": "/src/app.tsx",
  "type": "file",
  "content": "// React component code"
}

// Update file
PUT /projects/:projectId/files/:fileId
{
  "content": "// Updated content"
}

// Delete file
DELETE /projects/:projectId/files/:fileId
```

### AI Generation

```typescript
// Generate code
POST /ai/generate
{
  "prompt": "Create a React login component",
  "context": {
    "projectId": "uuid",
    "currentFile": "optional-file-context"
  }
}

// Response
{
  "content": "// Generated code",
  "language": "typescript",
  "suggestions": ["additional suggestions"]
}
```

For complete API documentation, see [API Reference](./API.md).

## Deployment Guide

### Local Development

```bash
# Start all services with Docker Compose
docker-compose up

# Or start services individually
npm run dev:backend
npm run dev:frontend
python ai-engine/main.py
```

### Staging Deployment

```bash
# Build and deploy to staging
./scripts/deploy-staging.sh

# Or use Terraform
cd infrastructure/terraform
terraform plan -var-file="staging.tfvars"
terraform apply
```

### Production Deployment

```bash
# Deploy to production (requires approval)
./scripts/deploy-production.sh

# Or use Kubernetes
kubectl apply -f infrastructure/kubernetes/
```

### Environment Variables

Required environment variables for each service:

**Backend**
```env
DATABASE_URL=postgres://user:pass@localhost:5432/myco
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-jwt-secret
AI_ENGINE_URL=http://localhost:8000
```

**AI Engine**
```env
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
VECTOR_DB_URL=your-vector-db-url
```

**Frontend**
```env
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
```

For complete deployment instructions, see [Deployment Guide](./DEPLOYMENT.md).

## Contributing

### Development Workflow

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests and documentation
5. Ensure all checks pass
6. Submit a pull request

### Pull Request Process

1. **Code Review**: All PRs require review by 2 maintainers
2. **Automated Tests**: All tests must pass
3. **Security Scan**: Security vulnerabilities must be resolved
4. **Documentation**: Update relevant documentation
5. **Changelog**: Add entry to CHANGELOG.md

### Coding Standards

- Follow existing code style and conventions
- Write comprehensive tests
- Update documentation for any API changes
- Use semantic commit messages
- Keep PRs focused and reasonably sized

For detailed contributing guidelines, see [CONTRIBUTING.md](./CONTRIBUTING.md).

## Troubleshooting

### Common Issues

#### Development Environment

**Docker containers won't start**
```bash
# Check Docker daemon is running
docker info

# Clear Docker cache
docker system prune -a

# Rebuild containers
docker-compose build --no-cache
```

**Database connection errors**
```bash
# Check database is running
docker-compose ps postgres

# Reset database
npm run db:reset

# Check connection manually
psql postgres://user:pass@localhost:5432/myco
```

**AI Engine not responding**
```bash
# Check Python dependencies
pip install -r ai-engine/requirements.txt

# Check API keys are set
env | grep API_KEY

# Restart AI service
docker-compose restart ai-engine
```

#### Production Issues

**High memory usage**
- Check container resource limits
- Monitor database connection pools
- Review AI model memory usage

**Slow API responses**
- Enable query logging and analyze slow queries
- Check Redis cache hit rates
- Monitor network latency

**WebSocket disconnections**
- Check load balancer configuration
- Verify sticky sessions
- Monitor connection limits

### Getting Help

1. **Documentation**: Check relevant docs sections
2. **Issues**: Search existing GitHub issues
3. **Community**: Join our Discord community
4. **Support**: Contact support@myco.dev for priority support

## Additional Resources

- [Architecture Deep Dive](./ARCHITECTURE.md)
- [Security Guide](./SECURITY.md)
- [Performance Optimization](./PERFORMANCE.md)
- [Monitoring Guide](./MONITORING.md)
- [FAQ](./FAQ.md)

---

**Last Updated**: January 2024  
**Version**: 1.0.0  
**Maintained by**: MYCO Development Team