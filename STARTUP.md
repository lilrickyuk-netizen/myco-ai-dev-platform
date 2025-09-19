# MYCO AI Platform - Startup Guide

## Quick Start

To boot MYCO AI end-to-end locally:

```bash
# 1. Copy environment template
cp .env.example .env

# 2. Start all services
docker compose up

# 3. Wait for all services to be healthy (may take 2-3 minutes on first run)
```

The system will be available at:
- **Frontend**: http://localhost:3000 
- **Backend API**: http://localhost:3001
- **AI Engine**: http://localhost:8001
- **Execution Engine**: http://localhost:8002
- **Template Engine**: http://localhost:8003
- **Validation Engine**: http://localhost:8004

## Health Checks

All services have health endpoints:
- GET `/health` - Returns 200 with service status
- GET `/ready` - Returns 200 when fully operational (backend only)

## Configuration

### AI Provider Settings (Optional)

The system works out-of-the-box with a stub AI provider. To enable real AI functionality, set these in `.env`:

```bash
# Choose provider: openai, anthropic, gemini, or stub
AI_PROVIDER=stub

# Add API keys for real providers (optional)
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key  
GOOGLE_API_KEY=your_google_key
```

### Default Credentials

The frontend uses a simple email-based auth stub:
- Enter any email (default: demo@myco.dev) to login
- No password required in development mode

## Happy Path Test

1. **Access Frontend**: Open http://localhost:3000
2. **Login**: Use default email `demo@myco.dev`
3. **Create Project**: Click "Create New Project"
4. **Select Template**: Choose any template from the gallery
5. **Open IDE**: Click "Open in IDE" on your new project
6. **Create File**: Add a new file in the file explorer
7. **Generate Code**: Use the AI Assistant panel to generate code
8. **Save**: File saves automatically via backend API

## Architecture

```
Frontend (React) → Backend (Encore.ts) → AI Engine (FastAPI)
                ↓                      ↗
            PostgreSQL/Redis     ← Execution/Template/Validation Engines
```

## Troubleshooting

### Services Not Starting
- Check Docker is running: `docker --version`
- Check ports are free: `netstat -tulpn | grep -E ':(3000|3001|8001|8002|8003|8004)'`
- View logs: `docker compose logs [service-name]`

### Database Issues
- Reset database: `docker compose down -v && docker compose up`
- Check connection: `docker compose exec postgres pg_isready -U postgres`

### AI Not Working
- Check AI engine health: `curl http://localhost:8001/health`
- Verify stub provider: `curl -X POST http://localhost:8001/generation -H "Content-Type: application/json" -d '{"prompt":"test"}'`

### Build Errors
This is a mixed-architecture project. If you encounter Encore.ts build conflicts, the docker-compose setup bypasses them by running services independently.