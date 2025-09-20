# Docker Build & Run Fixes - Changelog

## Summary
Fixed Docker build and run issues to enable clean `docker compose up -d --build` execution on Windows, Linux, and macOS.

## Changes Made

### 1. Backend Dockerfile (`backend/Dockerfile`)
- **Lines 10-11**: Removed invalid `npm install -g @encore.dev/encore@latest` (package doesn't exist)
- **Lines 16-17**: Updated npm install to handle missing package-lock.json: `RUN if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi`
- **Line 33**: Updated exposed port from 3001 to 8080
- **Line 36**: Updated health check URL to match port 8080
- **Line 40**: Changed CMD from `["encore", "run", "--port", "3001"]` to `["npm", "start"]`

### 2. Frontend Dockerfile (`frontend/Dockerfile`)
- **Line 5**: Added wget for health checks: `RUN apk add --no-cache curl wget`
- **Lines 13-14**: Updated npm install to handle missing package-lock.json: `RUN if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi`

### 3. Node Service Dockerfiles (`template-engine/`, `execution-engine/`, `validation-engine/`)
- **All files**: Updated npm install to handle missing package-lock.json with same pattern as above

### 4. AI Engine Dockerfile (`ai-engine/Dockerfile`)
- **Lines 8-12**: Made apt install non-interactive and cleaned cache: Added `--no-install-recommends` flag
- **Line 27**: Updated exposed port from 8001 to 8000
- **Line 31**: Updated health check URL to port 8000 and endpoint `/healthz`
- **Line 34**: Updated uvicorn command to use port 8000

### 5. Docker Compose (`docker-compose.yml`)
- **Line 1**: Removed legacy `version: '3.8'` key
- **AI Engine service**:
  - Replaced environment variables with `env_file: - ./ai-engine/.env.production`
  - Updated ports from 8001:8001 to 8000:8000
  - Updated health check URL to port 8000
  - Improved health check timing (interval: 10s, timeout: 3s, retries: 10)
- **Backend service**:
  - Added `env_file: - ./backend/.env.production`
  - Updated ports from 3001:3001 to 8080:8080
  - Updated health check URL to `/health` endpoint on port 8080
  - Improved health check timing
- **Frontend service**:
  - Added `env_file: - ./frontend/.env.production`
  - Updated health check to use `wget` instead of `curl`
  - Improved health check timing
- **All services**: Updated health check intervals and timeouts for faster startup detection

### 6. Environment Files (Created)
- **`backend/.env.production`**: Added production environment variables for backend
- **`frontend/.env.production`**: Added production environment variables for frontend  
- **`ai-engine/.env.production`**: Added production environment variables for AI engine

### 7. Docker Ignore Files (Created)
- **`backend/.dockerignore`**: Added to exclude node_modules, logs, and development files
- **`frontend/.dockerignore`**: Added to exclude node_modules, logs, and development files
- **`ai-engine/.dockerignore`**: Added to exclude __pycache__, logs, and development files
- **`template-engine/.dockerignore`**: Added to exclude node_modules and development files
- **`execution-engine/.dockerignore`**: Added to exclude node_modules and development files
- **`validation-engine/.dockerignore`**: Added to exclude node_modules and development files

### 8. Service Versions Verified
- **All Node services**: Confirmed using `node:20-alpine`
- **AI Engine**: Confirmed using `python:3.11-slim`

## Port Mapping Summary
- **Frontend**: 3000:3000
- **Backend**: 8080:8080 (changed from 3001)
- **AI Engine**: 8000:8000 (changed from 8001)
- **Execution Engine**: 8002:8002
- **Template Engine**: 8003:8003
- **Validation Engine**: 8004:8004
- **PostgreSQL**: 5432:5432
- **Redis**: 6379:6379

## Test Results
Services should now build and run successfully with:
```bash
docker compose build --no-cache
docker compose up -d
docker compose ps
```

## Verification Commands
- Frontend health: `curl http://localhost:3000`
- Backend health: `curl http://localhost:8080/health`
- AI Engine health: `curl http://localhost:8000/healthz`