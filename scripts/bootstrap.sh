#!/bin/bash

# ===========================================
# MYCO AI DEVELOPMENT PLATFORM
# Bootstrap Script for Development Environment
# ===========================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_ROOT/.env"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    local missing_deps=()
    
    # Check Docker
    if ! command_exists docker; then
        missing_deps+=("docker")
    fi
    
    # Check Docker Compose
    if ! command_exists docker-compose && ! docker compose version >/dev/null 2>&1; then
        missing_deps+=("docker-compose")
    fi
    
    # Check Node.js
    if ! command_exists node; then
        missing_deps+=("node")
    else
        local node_version
        node_version=$(node --version | sed 's/v//')
        local required_version="18.0.0"
        if [ "$(printf '%s\n' "$required_version" "$node_version" | sort -V | head -n1)" != "$required_version" ]; then
            print_warning "Node.js version $node_version found, but $required_version+ is recommended"
        fi
    fi
    
    # Check npm
    if ! command_exists npm; then
        missing_deps+=("npm")
    fi
    
    # Check curl (for health checks)
    if ! command_exists curl; then
        missing_deps+=("curl")
    fi
    
    # Check git
    if ! command_exists git; then
        missing_deps+=("git")
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        print_error "Missing required dependencies: ${missing_deps[*]}"
        print_error "Please install the missing dependencies and run this script again."
        exit 1
    fi
    
    # Check Docker daemon
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker daemon is not running. Please start Docker and try again."
        exit 1
    fi
    
    print_success "All prerequisites are met!"
}

# Function to setup environment file
setup_environment() {
    print_status "Setting up environment configuration..."
    
    if [ ! -f "$ENV_FILE" ]; then
        if [ -f "$PROJECT_ROOT/.env.example" ]; then
            print_status "Copying .env.example to .env..."
            cp "$PROJECT_ROOT/.env.example" "$ENV_FILE"
            print_warning "Please edit .env file and configure the required values before running 'make up'"
            print_warning "Required configurations:"
            print_warning "  - CLERK_SECRET_KEY (get from https://clerk.com)"
            print_warning "  - CLERK_PUBLISHABLE_KEY (get from https://clerk.com)"
            print_warning "  - JWT_SECRET (generate a secure random string)"
            print_warning "  - API keys for LLM providers (OpenAI, Anthropic, etc.)"
        else
            print_error ".env.example file not found!"
            exit 1
        fi
    else
        print_success "Environment file already exists at $ENV_FILE"
    fi
    
    # Create backend .env if it doesn't exist
    if [ ! -f "$PROJECT_ROOT/backend/.env" ] && [ -f "$PROJECT_ROOT/backend/.env.example" ]; then
        print_status "Creating backend/.env from example..."
        cp "$PROJECT_ROOT/backend/.env.example" "$PROJECT_ROOT/backend/.env"
    fi
    
    # Create frontend .env if it doesn't exist
    if [ ! -f "$PROJECT_ROOT/frontend/.env" ] && [ -f "$PROJECT_ROOT/frontend/.env.example" ]; then
        print_status "Creating frontend/.env from example..."
        cp "$PROJECT_ROOT/frontend/.env.example" "$PROJECT_ROOT/frontend/.env"
    fi
}

# Function to create required directories
create_directories() {
    print_status "Creating required directories..."
    
    local dirs=(
        "$PROJECT_ROOT/data/uploads"
        "$PROJECT_ROOT/data/chroma"
        "$PROJECT_ROOT/logs"
        "$PROJECT_ROOT/nginx/ssl"
    )
    
    for dir in "${dirs[@]}"; do
        if [ ! -d "$dir" ]; then
            mkdir -p "$dir"
            print_status "Created directory: $dir"
        fi
    done
    
    print_success "Required directories created!"
}

# Function to create Docker volumes
create_volumes() {
    print_status "Creating Docker volumes..."
    
    local volumes=(
        "myco_postgres_data"
        "myco_redis_data"
        "myco_mongodb_data"
        "myco_elasticsearch_data"
        "myco_prometheus_data"
        "myco_grafana_data"
        "myco_chromadb_data"
        "myco_minio_data"
        "myco_ai_models"
    )
    
    for volume in "${volumes[@]}"; do
        if ! docker volume inspect "$volume" >/dev/null 2>&1; then
            docker volume create "$volume"
            print_status "Created volume: $volume"
        else
            print_status "Volume already exists: $volume"
        fi
    done
    
    print_success "Docker volumes ready!"
}

# Function to pull Docker images
pull_images() {
    print_status "Pulling required Docker images..."
    
    # Pull base images to ensure we have the latest versions
    local images=(
        "postgres:15-alpine"
        "redis:7-alpine"
        "mongo:7"
        "nginx:alpine"
        "prom/prometheus:latest"
        "grafana/grafana:latest"
        "docker.elastic.co/elasticsearch/elasticsearch:8.11.0"
        "docker.elastic.co/kibana/kibana:8.11.0"
        "ghcr.io/chroma-core/chroma:latest"
        "minio/minio:latest"
        "mailhog/mailhog:latest"
    )
    
    for image in "${images[@]}"; do
        print_status "Pulling $image..."
        docker pull "$image"
    done
    
    print_success "Docker images pulled successfully!"
}

# Function to initialize MinIO bucket
init_minio_bucket() {
    print_status "Checking if MinIO is running..."
    
    # Wait for MinIO to be ready
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f http://localhost:9000/minio/health/live >/dev/null 2>&1; then
            break
        fi
        print_status "Waiting for MinIO to be ready... (attempt $attempt/$max_attempts)"
        sleep 2
        ((attempt++))
    done
    
    if [ $attempt -gt $max_attempts ]; then
        print_warning "MinIO is not responding. You may need to create the bucket manually."
        return 0
    fi
    
    # Install MinIO client if not present
    if ! command_exists mc; then
        print_status "Installing MinIO client..."
        if [[ "$OSTYPE" == "linux-gnu"* ]]; then
            curl https://dl.min.io/client/mc/release/linux-amd64/mc -o /tmp/mc
            chmod +x /tmp/mc
            sudo mv /tmp/mc /usr/local/bin/
        elif [[ "$OSTYPE" == "darwin"* ]]; then
            if command_exists brew; then
                brew install minio/stable/mc
            else
                curl https://dl.min.io/client/mc/release/darwin-amd64/mc -o /tmp/mc
                chmod +x /tmp/mc
                sudo mv /tmp/mc /usr/local/bin/
            fi
        else
            print_warning "Please install MinIO client manually and create the 'myco-files' bucket"
            return 0
        fi
    fi
    
    # Configure MinIO client
    mc alias set local http://localhost:9000 minioadmin minioadmin >/dev/null 2>&1 || true
    
    # Create bucket if it doesn't exist
    if ! mc ls local/myco-files >/dev/null 2>&1; then
        print_status "Creating MinIO bucket 'myco-files'..."
        mc mb local/myco-files
        print_success "MinIO bucket created!"
    else
        print_success "MinIO bucket already exists!"
    fi
}

# Function to run database migrations
run_migrations() {
    print_status "Running database migrations..."
    
    # Wait for backend to be ready
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f http://localhost:3001/health >/dev/null 2>&1; then
            break
        fi
        print_status "Waiting for backend to be ready... (attempt $attempt/$max_attempts)"
        sleep 3
        ((attempt++))
    done
    
    if [ $attempt -gt $max_attempts ]; then
        print_warning "Backend is not responding. You may need to run migrations manually."
        print_warning "Run: cd backend && npm run db:migrate"
        return 0
    fi
    
    # Check if we can run Encore commands
    if [ -d "$PROJECT_ROOT/backend" ] && command_exists npm; then
        cd "$PROJECT_ROOT/backend"
        if [ -f "package.json" ]; then
            print_status "Running database migrations..."
            npm run db:migrate || print_warning "Migration failed. You may need to run it manually later."
        fi
        cd "$PROJECT_ROOT"
    fi
    
    print_success "Database setup completed!"
}

# Function to verify services
verify_services() {
    print_status "Verifying services are running..."
    
    local services=(
        "postgres:5432"
        "redis:6379"
        "mongodb:27017"
        "backend:3001"
        "frontend:3000"
        "ai-engine:8000"
        "execution-engine:3002"
        "minio:9000"
        "chromadb:8001"
    )
    
    local failed_services=()
    
    for service in "${services[@]}"; do
        local name="${service%%:*}"
        local port="${service##*:}"
        
        if ! nc -z localhost "$port" 2>/dev/null; then
            failed_services+=("$name")
        fi
    done
    
    if [ ${#failed_services[@]} -eq 0 ]; then
        print_success "All services are running!"
    else
        print_warning "Some services are not responding: ${failed_services[*]}"
        print_warning "You may need to wait a bit longer or check the logs with 'make logs'"
    fi
}

# Function to display next steps
show_next_steps() {
    echo ""
    print_success "Bootstrap completed successfully!"
    echo ""
    print_status "Next steps:"
    echo "  1. Edit .env file and configure required values (API keys, secrets, etc.)"
    echo "  2. Run 'make up' to start all services"
    echo "  3. Visit http://localhost:8080 to access the application"
    echo "  4. Check service health at http://localhost:8080/api/health"
    echo ""
    print_status "Useful commands:"
    echo "  • make up          - Start all services"
    echo "  • make down        - Stop all services"
    echo "  • make logs        - View logs from all services"
    echo "  • make logs service=backend - View logs from specific service"
    echo "  • make test        - Run all tests"
    echo "  • make lint        - Run linting"
    echo ""
}

# Main execution
main() {
    echo "======================================"
    echo "Myco AI Development Platform Bootstrap"
    echo "======================================"
    echo ""
    
    cd "$PROJECT_ROOT"
    
    check_prerequisites
    setup_environment
    create_directories
    create_volumes
    pull_images
    
    print_status "Bootstrap phase completed!"
    print_status "You can now run 'make up' to start the services."
    print_warning "Remember to configure your .env file with proper API keys and secrets!"
    
    show_next_steps
}

# Run main function
main "$@"