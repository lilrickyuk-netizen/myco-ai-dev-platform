# ===========================================
# MYCO AI DEVELOPMENT PLATFORM
# Development Makefile
# ===========================================

# Default shell
SHELL := /bin/bash

# Colors for output
GREEN := \033[0;32m
YELLOW := \033[1;33m
RED := \033[0;31m
BLUE := \033[0;34m
NC := \033[0m

# Project configuration
PROJECT_NAME := myco-ai-platform
COMPOSE_FILE := docker-compose.yml
COMPOSE_PROD_FILE := docker-compose.prod.yml

# Environment
ENV_FILE := .env
BACKEND_DIR := backend
FRONTEND_DIR := frontend
SCRIPTS_DIR := scripts

# Default target
.DEFAULT_GOAL := help

# Help target
.PHONY: help
help: ## Show this help message
	@echo "$(BLUE)Myco AI Development Platform$(NC)"
	@echo "=============================="
	@echo ""
	@echo "$(GREEN)Available targets:$(NC)"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  $(YELLOW)%-20s$(NC) %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ""

# Environment setup
.PHONY: env
env: ## Create environment files from examples
	@echo "$(BLUE)[INFO]$(NC) Setting up environment files..."
	@if [ ! -f $(ENV_FILE) ]; then \
		cp .env.example $(ENV_FILE); \
		echo "$(GREEN)[SUCCESS]$(NC) Created $(ENV_FILE) from .env.example"; \
		echo "$(YELLOW)[WARNING]$(NC) Please edit $(ENV_FILE) and configure required values"; \
	else \
		echo "$(GREEN)[INFO]$(NC) $(ENV_FILE) already exists"; \
	fi
	@if [ ! -f $(BACKEND_DIR)/.env ]; then \
		cp $(BACKEND_DIR)/.env.example $(BACKEND_DIR)/.env; \
		echo "$(GREEN)[SUCCESS]$(NC) Created $(BACKEND_DIR)/.env"; \
	fi
	@if [ ! -f $(FRONTEND_DIR)/.env ]; then \
		cp $(FRONTEND_DIR)/.env.example $(FRONTEND_DIR)/.env; \
		echo "$(GREEN)[SUCCESS]$(NC) Created $(FRONTEND_DIR)/.env"; \
	fi

# Bootstrap development environment
.PHONY: bootstrap
bootstrap: env ## Initialize development environment
	@echo "$(BLUE)[INFO]$(NC) Bootstrapping development environment..."
	@chmod +x $(SCRIPTS_DIR)/bootstrap.sh
	@$(SCRIPTS_DIR)/bootstrap.sh

# Docker Compose commands
.PHONY: up
up: ## Start all services in development mode
	@echo "$(BLUE)[INFO]$(NC) Starting development services..."
	@docker-compose -f $(COMPOSE_FILE) up -d
	@echo "$(GREEN)[SUCCESS]$(NC) Services started!"
	@echo "$(BLUE)[INFO]$(NC) Frontend: http://localhost:3000"
	@echo "$(BLUE)[INFO]$(NC) Backend API: http://localhost:3001"
	@echo "$(BLUE)[INFO]$(NC) Nginx Proxy: http://localhost:8080"
	@echo "$(BLUE)[INFO]$(NC) AI Engine: http://localhost:8000"

.PHONY: up-prod
up-prod: ## Start all services in production mode
	@echo "$(BLUE)[INFO]$(NC) Starting production services..."
	@docker-compose -f $(COMPOSE_PROD_FILE) up -d
	@echo "$(GREEN)[SUCCESS]$(NC) Production services started!"

.PHONY: down
down: ## Stop all services
	@echo "$(BLUE)[INFO]$(NC) Stopping all services..."
	@docker-compose -f $(COMPOSE_FILE) down
	@if [ -f $(COMPOSE_PROD_FILE) ]; then \
		docker-compose -f $(COMPOSE_PROD_FILE) down; \
	fi
	@echo "$(GREEN)[SUCCESS]$(NC) All services stopped!"

.PHONY: restart
restart: down up ## Restart all services

.PHONY: build
build: ## Build all Docker images
	@echo "$(BLUE)[INFO]$(NC) Building Docker images..."
	@docker-compose -f $(COMPOSE_FILE) build
	@echo "$(GREEN)[SUCCESS]$(NC) Docker images built!"

.PHONY: rebuild
rebuild: ## Rebuild all Docker images from scratch
	@echo "$(BLUE)[INFO]$(NC) Rebuilding Docker images from scratch..."
	@docker-compose -f $(COMPOSE_FILE) build --no-cache
	@echo "$(GREEN)[SUCCESS]$(NC) Docker images rebuilt!"

# Logs
.PHONY: logs
logs: ## Show logs from all services (use service=<name> for specific service)
	@if [ -n "$(service)" ]; then \
		echo "$(BLUE)[INFO]$(NC) Showing logs for service: $(service)"; \
		docker-compose -f $(COMPOSE_FILE) logs -f $(service); \
	else \
		echo "$(BLUE)[INFO]$(NC) Showing logs for all services"; \
		docker-compose -f $(COMPOSE_FILE) logs -f; \
	fi

.PHONY: logs-backend
logs-backend: ## Show backend logs
	@docker-compose -f $(COMPOSE_FILE) logs -f backend

.PHONY: logs-frontend
logs-frontend: ## Show frontend logs
	@docker-compose -f $(COMPOSE_FILE) logs -f frontend

.PHONY: logs-ai
logs-ai: ## Show AI engine logs
	@docker-compose -f $(COMPOSE_FILE) logs -f ai-engine

# Health checks
.PHONY: health
health: ## Check health of all services
	@echo "$(BLUE)[INFO]$(NC) Checking service health..."
	@echo "Backend API:"
	@curl -s http://localhost:3001/health | jq . 2>/dev/null || curl -s http://localhost:3001/health || echo "Backend not responding"
	@echo ""
	@echo "AI Engine:"
	@curl -s http://localhost:8000/health | jq . 2>/dev/null || curl -s http://localhost:8000/health || echo "AI Engine not responding"
	@echo ""
	@echo "Frontend:"
	@curl -s -o /dev/null -w "Status: %{http_code}\n" http://localhost:3000 || echo "Frontend not responding"

.PHONY: status
status: ## Show status of all containers
	@echo "$(BLUE)[INFO]$(NC) Container status:"
	@docker-compose -f $(COMPOSE_FILE) ps

# Development commands
.PHONY: install
install: ## Install dependencies for all services
	@echo "$(BLUE)[INFO]$(NC) Installing dependencies..."
	@cd $(BACKEND_DIR) && npm ci
	@cd $(FRONTEND_DIR) && npm ci
	@if [ -d execution-engine ]; then cd execution-engine && npm ci; fi
	@if [ -d template-engine ]; then cd template-engine && npm ci; fi
	@echo "$(GREEN)[SUCCESS]$(NC) Dependencies installed!"

.PHONY: clean
clean: ## Clean up containers, volumes, and images
	@echo "$(BLUE)[INFO]$(NC) Cleaning up..."
	@docker-compose -f $(COMPOSE_FILE) down -v --remove-orphans
	@docker system prune -f
	@echo "$(GREEN)[SUCCESS]$(NC) Cleanup completed!"

.PHONY: clean-all
clean-all: ## Remove everything including volumes and images
	@echo "$(YELLOW)[WARNING]$(NC) This will remove all containers, volumes, networks, and images!"
	@read -p "Are you sure? (y/N) " -n 1 -r; \
	echo ""; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		docker-compose -f $(COMPOSE_FILE) down -v --rmi all --remove-orphans; \
		docker system prune -af --volumes; \
		echo "$(GREEN)[SUCCESS]$(NC) Everything cleaned!"; \
	else \
		echo "$(BLUE)[INFO]$(NC) Cleanup cancelled"; \
	fi

# Testing
.PHONY: test
test: ## Run all tests
	@echo "$(BLUE)[INFO]$(NC) Running all tests..."
	@cd $(BACKEND_DIR) && npm run test
	@cd $(FRONTEND_DIR) && npm run test
	@echo "$(GREEN)[SUCCESS]$(NC) All tests completed!"

.PHONY: test-backend
test-backend: ## Run backend tests
	@echo "$(BLUE)[INFO]$(NC) Running backend tests..."
	@cd $(BACKEND_DIR) && npm run test

.PHONY: test-frontend
test-frontend: ## Run frontend tests
	@echo "$(BLUE)[INFO]$(NC) Running frontend tests..."
	@cd $(FRONTEND_DIR) && npm run test

.PHONY: test-watch
test-watch: ## Run tests in watch mode
	@echo "$(BLUE)[INFO]$(NC) Running tests in watch mode..."
	@if [ "$(service)" = "backend" ]; then \
		cd $(BACKEND_DIR) && npm run test:watch; \
	elif [ "$(service)" = "frontend" ]; then \
		cd $(FRONTEND_DIR) && npm run test:watch; \
	else \
		echo "$(YELLOW)[WARNING]$(NC) Please specify service=backend or service=frontend"; \
	fi

.PHONY: coverage
coverage: ## Generate test coverage reports
	@echo "$(BLUE)[INFO]$(NC) Generating coverage reports..."
	@cd $(BACKEND_DIR) && npm run test:coverage
	@cd $(FRONTEND_DIR) && npm run test:coverage
	@echo "$(GREEN)[SUCCESS]$(NC) Coverage reports generated!"

# Linting and formatting
.PHONY: lint
lint: ## Run linting for all services
	@echo "$(BLUE)[INFO]$(NC) Running linting..."
	@cd $(BACKEND_DIR) && npm run lint
	@cd $(FRONTEND_DIR) && npm run lint
	@echo "$(GREEN)[SUCCESS]$(NC) Linting completed!"

.PHONY: lint-fix
lint-fix: ## Fix linting issues automatically
	@echo "$(BLUE)[INFO]$(NC) Fixing linting issues..."
	@cd $(BACKEND_DIR) && npm run lint:fix
	@cd $(FRONTEND_DIR) && npm run lint:fix
	@echo "$(GREEN)[SUCCESS]$(NC) Linting fixes applied!"

.PHONY: format
format: ## Format code using Prettier
	@echo "$(BLUE)[INFO]$(NC) Formatting code..."
	@cd $(BACKEND_DIR) && npm run format
	@cd $(FRONTEND_DIR) && npm run format
	@echo "$(GREEN)[SUCCESS]$(NC) Code formatting completed!"

.PHONY: format-check
format-check: ## Check if code is properly formatted
	@echo "$(BLUE)[INFO]$(NC) Checking code formatting..."
	@cd $(BACKEND_DIR) && npm run format:check
	@cd $(FRONTEND_DIR) && npm run format:check
	@echo "$(GREEN)[SUCCESS]$(NC) Code formatting check completed!"

# Type checking
.PHONY: typecheck
typecheck: ## Run TypeScript type checking
	@echo "$(BLUE)[INFO]$(NC) Running TypeScript type checking..."
	@cd $(BACKEND_DIR) && npm run typecheck
	@cd $(FRONTEND_DIR) && npm run typecheck
	@echo "$(GREEN)[SUCCESS]$(NC) Type checking completed!"

# Database operations
.PHONY: migrate
migrate: ## Run database migrations
	@echo "$(BLUE)[INFO]$(NC) Running database migrations..."
	@cd $(BACKEND_DIR) && npm run db:migrate
	@echo "$(GREEN)[SUCCESS]$(NC) Database migrations completed!"

.PHONY: migrate-reset
migrate-reset: ## Reset database and run migrations
	@echo "$(YELLOW)[WARNING]$(NC) This will reset the database and lose all data!"
	@read -p "Are you sure? (y/N) " -n 1 -r; \
	echo ""; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		cd $(BACKEND_DIR) && npm run db:reset && npm run db:migrate; \
		echo "$(GREEN)[SUCCESS]$(NC) Database reset and migrated!"; \
	else \
		echo "$(BLUE)[INFO]$(NC) Database reset cancelled"; \
	fi

.PHONY: db-shell
db-shell: ## Connect to PostgreSQL database shell
	@echo "$(BLUE)[INFO]$(NC) Connecting to database..."
	@docker-compose -f $(COMPOSE_FILE) exec postgres psql -U postgres -d myco_dev

# CI/CD
.PHONY: ci
ci: ## Run full CI pipeline (lint, typecheck, test, build)
	@echo "$(BLUE)[INFO]$(NC) Running CI pipeline..."
	@chmod +x $(SCRIPTS_DIR)/checks/ci-check.sh
	@$(SCRIPTS_DIR)/checks/ci-check.sh
	@echo "$(GREEN)[SUCCESS]$(NC) CI pipeline completed!"

.PHONY: ci-coverage
ci-coverage: ## Run CI pipeline with coverage reports
	@echo "$(BLUE)[INFO]$(NC) Running CI pipeline with coverage..."
	@chmod +x $(SCRIPTS_DIR)/checks/ci-check.sh
	@$(SCRIPTS_DIR)/checks/ci-check.sh --coverage
	@echo "$(GREEN)[SUCCESS]$(NC) CI pipeline with coverage completed!"

# Development tools
.PHONY: shell-backend
shell-backend: ## Open shell in backend container
	@docker-compose -f $(COMPOSE_FILE) exec backend /bin/bash

.PHONY: shell-frontend
shell-frontend: ## Open shell in frontend container
	@docker-compose -f $(COMPOSE_FILE) exec frontend /bin/bash

.PHONY: shell-ai
shell-ai: ## Open shell in AI engine container
	@docker-compose -f $(COMPOSE_FILE) exec ai-engine /bin/bash

# Monitoring
.PHONY: monitor
monitor: ## Open monitoring tools
	@echo "$(BLUE)[INFO]$(NC) Opening monitoring tools..."
	@echo "Grafana: http://localhost:3003 (admin/admin)"
	@echo "Prometheus: http://localhost:9090"
	@echo "Kibana: http://localhost:5601"
	@echo "MinIO Console: http://localhost:9001 (minioadmin/minioadmin)"

# Backup and restore
.PHONY: backup
backup: ## Backup database and volumes
	@echo "$(BLUE)[INFO]$(NC) Creating backup..."
	@mkdir -p backups
	@docker-compose -f $(COMPOSE_FILE) exec -T postgres pg_dump -U postgres myco_dev > backups/postgres_$(shell date +%Y%m%d_%H%M%S).sql
	@echo "$(GREEN)[SUCCESS]$(NC) Database backup created!"

.PHONY: restore
restore: ## Restore database from backup (requires BACKUP_FILE=path/to/backup.sql)
	@if [ -z "$(BACKUP_FILE)" ]; then \
		echo "$(RED)[ERROR]$(NC) Please specify BACKUP_FILE=path/to/backup.sql"; \
		exit 1; \
	fi
	@echo "$(BLUE)[INFO]$(NC) Restoring database from $(BACKUP_FILE)..."
	@docker-compose -f $(COMPOSE_FILE) exec -T postgres psql -U postgres -d myco_dev < $(BACKUP_FILE)
	@echo "$(GREEN)[SUCCESS]$(NC) Database restored!"

# Production deployment
.PHONY: deploy-prod
deploy-prod: ## Deploy to production (requires proper environment setup)
	@echo "$(BLUE)[INFO]$(NC) Deploying to production..."
	@if [ ! -f .env.production ]; then \
		echo "$(RED)[ERROR]$(NC) .env.production file not found!"; \
		exit 1; \
	fi
	@docker-compose -f $(COMPOSE_PROD_FILE) --env-file .env.production up -d
	@echo "$(GREEN)[SUCCESS]$(NC) Production deployment completed!"

# Quick development commands
.PHONY: dev
dev: bootstrap up ## Quick setup for development (bootstrap + up)

.PHONY: fresh
fresh: down clean build up ## Fresh start (clean everything and restart)

# Utility targets
.PHONY: ps
ps: status ## Alias for status

.PHONY: top
top: ## Show running processes in containers
	@docker-compose -f $(COMPOSE_FILE) top