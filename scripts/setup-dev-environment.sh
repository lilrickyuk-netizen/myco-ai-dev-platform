#!/bin/bash
set -e

# Myco Platform Development Environment Setup Script
# This script sets up the complete development environment for the Myco Platform

echo "🚀 Setting up Myco Platform Development Environment"
echo "================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running on macOS or Linux
if [[ "$OSTYPE" == "darwin"* ]]; then
    PLATFORM="macos"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    PLATFORM="linux"
else
    log_error "Unsupported operating system. This script supports macOS and Linux only."
    exit 1
fi

log_info "Detected platform: $PLATFORM"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to install dependencies based on platform
install_dependencies() {
    log_info "Installing system dependencies..."
    
    if [[ "$PLATFORM" == "macos" ]]; then
        # Check if Homebrew is installed
        if ! command_exists brew; then
            log_info "Installing Homebrew..."
            /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        fi
        
        # Install dependencies via Homebrew
        brew update
        brew install node@18 python@3.11 docker docker-compose postgresql redis mongodb-community git curl wget jq
        
        # Start services
        brew services start postgresql
        brew services start redis
        brew services start mongodb-community
        
    elif [[ "$PLATFORM" == "linux" ]]; then
        # Update package manager
        sudo apt-get update
        
        # Install dependencies
        sudo apt-get install -y \
            nodejs npm python3 python3-pip \
            docker.io docker-compose \
            postgresql postgresql-contrib \
            redis-server \
            git curl wget jq \
            build-essential
        
        # Install MongoDB
        wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
        echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
        sudo apt-get update
        sudo apt-get install -y mongodb-org
        
        # Start services
        sudo systemctl start postgresql
        sudo systemctl enable postgresql
        sudo systemctl start redis-server
        sudo systemctl enable redis-server
        sudo systemctl start mongod
        sudo systemctl enable mongod
        
        # Add user to docker group
        sudo usermod -aG docker $USER
        log_warning "You may need to log out and back in for Docker permissions to take effect"
    fi
    
    log_success "System dependencies installed successfully"
}

# Function to setup Node.js environment
setup_nodejs() {
    log_info "Setting up Node.js environment..."
    
    # Check Node.js version
    if command_exists node; then
        NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$NODE_VERSION" -lt "18" ]; then
            log_warning "Node.js version is $NODE_VERSION. Version 18+ is recommended."
        fi
    else
        log_error "Node.js not found. Please install Node.js 18+"
        exit 1
    fi
    
    # Install global npm packages
    npm install -g typescript tsx nodemon concurrently
    
    log_success "Node.js environment setup complete"
}

# Function to setup Python environment
setup_python() {
    log_info "Setting up Python environment..."
    
    # Check Python version
    if command_exists python3; then
        PYTHON_VERSION=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1-2)
        log_info "Python version: $PYTHON_VERSION"
    else
        log_error "Python 3 not found. Please install Python 3.11+"
        exit 1
    fi
    
    # Install pipenv for virtual environment management
    if ! command_exists pipenv; then
        pip3 install pipenv
    fi
    
    log_success "Python environment setup complete"
}

# Function to setup Docker environment
setup_docker() {
    log_info "Setting up Docker environment..."
    
    if ! command_exists docker; then
        log_error "Docker not found. Please install Docker"
        exit 1
    fi
    
    if ! command_exists docker-compose; then
        log_error "Docker Compose not found. Please install Docker Compose"
        exit 1
    fi
    
    # Test Docker
    if ! docker ps >/dev/null 2>&1; then
        log_error "Docker is not running or you don't have permission to access it"
        exit 1
    fi
    
    log_success "Docker environment verified"
}

# Function to setup databases
setup_databases() {
    log_info "Setting up databases..."
    
    # PostgreSQL setup
    if command_exists psql; then
        log_info "Setting up PostgreSQL database..."
        
        # Create database and user
        sudo -u postgres psql -c "CREATE DATABASE myco_platform;" 2>/dev/null || true
        sudo -u postgres psql -c "CREATE USER myco_user WITH PASSWORD 'password';" 2>/dev/null || true
        sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE myco_platform TO myco_user;" 2>/dev/null || true
        
        log_success "PostgreSQL database setup complete"
    else
        log_warning "PostgreSQL not found. Some features may not work."
    fi
    
    # MongoDB setup
    if command_exists mongosh || command_exists mongo; then
        log_info "Setting up MongoDB database..."
        
        # MongoDB is usually ready to go after installation
        log_success "MongoDB setup complete"
    else
        log_warning "MongoDB not found. Some features may not work."
    fi
    
    # Redis is usually ready after installation
    if command_exists redis-cli; then
        log_success "Redis setup complete"
    else
        log_warning "Redis not found. Some features may not work."
    fi
}

# Function to install project dependencies
install_project_dependencies() {
    log_info "Installing project dependencies..."
    
    # Backend dependencies
    if [ -d "backend" ]; then
        log_info "Installing backend dependencies..."
        cd backend
        npm install
        cd ..
        log_success "Backend dependencies installed"
    fi
    
    # Frontend dependencies
    if [ -d "frontend" ]; then
        log_info "Installing frontend dependencies..."
        cd frontend
        npm install
        cd ..
        log_success "Frontend dependencies installed"
    fi
    
    # AI Engine dependencies
    if [ -d "ai-engine" ]; then
        log_info "Installing AI Engine dependencies..."
        cd ai-engine
        pip3 install -r requirements.txt
        cd ..
        log_success "AI Engine dependencies installed"
    fi
    
    # Execution Engine dependencies
    if [ -d "execution-engine" ]; then
        log_info "Installing Execution Engine dependencies..."
        cd execution-engine
        npm install
        cd ..
        log_success "Execution Engine dependencies installed"
    fi
    
    # Agents dependencies
    if [ -d "agents" ]; then
        log_info "Installing Agents dependencies..."
        cd agents
        pip3 install -r requirements.txt
        cd ..
        log_success "Agents dependencies installed"
    fi
    
    log_success "All project dependencies installed"
}

# Function to setup environment files
setup_environment_files() {
    log_info "Setting up environment files..."
    
    # Backend .env
    if [ -d "backend" ] && [ ! -f "backend/.env" ]; then
        cat > backend/.env << EOF
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://myco_user:password@localhost:5432/myco_platform
REDIS_URL=redis://localhost:6379/0
MONGODB_URL=mongodb://localhost:27017/myco_platform
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
ENCORE_APP_ID=myco-platform-dev
EOF
        log_success "Backend .env file created"
    fi
    
    # AI Engine .env
    if [ -d "ai-engine" ] && [ ! -f "ai-engine/.env" ]; then
        cat > ai-engine/.env << EOF
AI_ENGINE_HOST=0.0.0.0
AI_ENGINE_PORT=8000
AI_ENGINE_DEBUG=true
DATABASE_URL=postgresql://myco_user:password@localhost:5432/myco_platform
REDIS_URL=redis://localhost:6379/1
MONGODB_URL=mongodb://localhost:27017/myco_platform
OPENAI_API_KEY=your-openai-api-key-here
ANTHROPIC_API_KEY=your-anthropic-api-key-here
GOOGLE_API_KEY=your-google-api-key-here
OLLAMA_BASE_URL=http://localhost:11434
EOF
        log_success "AI Engine .env file created"
    fi
    
    # Frontend .env
    if [ -d "frontend" ] && [ ! -f "frontend/.env" ]; then
        cat > frontend/.env << EOF
VITE_API_URL=http://localhost:3000
VITE_AI_ENGINE_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:3000
VITE_CLERK_PUBLISHABLE_KEY=your-clerk-publishable-key-here
EOF
        log_success "Frontend .env file created"
    fi
    
    # Root docker-compose override
    if [ ! -f "docker-compose.override.yml" ]; then
        cat > docker-compose.override.yml << EOF
version: '3.8'
services:
  postgres:
    ports:
      - "5432:5432"
  mongodb:
    ports:
      - "27017:27017"
  redis:
    ports:
      - "6379:6379"
EOF
        log_success "Docker Compose override file created"
    fi
}

# Function to setup development tools
setup_dev_tools() {
    log_info "Setting up development tools..."
    
    # Install Ollama for local LLM
    if ! command_exists ollama; then
        log_info "Installing Ollama for local LLM support..."
        curl -fsSL https://ollama.com/install.sh | sh
        
        # Start Ollama and pull a model
        if command_exists ollama; then
            ollama serve &
            sleep 5
            ollama pull llama2:7b
            log_success "Ollama installed and Llama2 model downloaded"
        fi
    fi
    
    # Install useful VS Code extensions (if VS Code is installed)
    if command_exists code; then
        log_info "Installing recommended VS Code extensions..."
        code --install-extension ms-vscode.vscode-typescript-next
        code --install-extension bradlc.vscode-tailwindcss
        code --install-extension esbenp.prettier-vscode
        code --install-extension ms-python.python
        code --install-extension ms-vscode.vscode-json
        code --install-extension redhat.vscode-yaml
        log_success "VS Code extensions installed"
    fi
}

# Function to verify installation
verify_installation() {
    log_info "Verifying installation..."
    
    # Check if all services are running
    SERVICES_OK=true
    
    # Check PostgreSQL
    if ! pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
        log_warning "PostgreSQL is not running"
        SERVICES_OK=false
    fi
    
    # Check Redis
    if ! redis-cli ping >/dev/null 2>&1; then
        log_warning "Redis is not running"
        SERVICES_OK=false
    fi
    
    # Check MongoDB
    if ! mongosh --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
        if ! mongo --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
            log_warning "MongoDB is not running"
            SERVICES_OK=false
        fi
    fi
    
    if [ "$SERVICES_OK" = true ]; then
        log_success "All database services are running"
    else
        log_warning "Some database services are not running. You may need to start them manually."
    fi
    
    # Test project dependencies
    if [ -d "backend" ]; then
        cd backend
        if npm run --silent check >/dev/null 2>&1; then
            log_success "Backend setup verified"
        else
            log_warning "Backend setup may have issues"
        fi
        cd ..
    fi
    
    log_success "Installation verification complete"
}

# Function to display next steps
show_next_steps() {
    echo ""
    echo "🎉 Development Environment Setup Complete!"
    echo "========================================"
    echo ""
    echo "Next steps:"
    echo "1. Update API keys in the .env files (OpenAI, Anthropic, etc.)"
    echo "2. Start the development servers:"
    echo "   • Backend: cd backend && npm run dev"
    echo "   • Frontend: cd frontend && npm run dev"
    echo "   • AI Engine: cd ai-engine && python main.py"
    echo "   • Or use Docker: docker-compose up"
    echo ""
    echo "3. Access the application:"
    echo "   • Frontend: http://localhost:5173"
    echo "   • Backend API: http://localhost:3000"
    echo "   • AI Engine: http://localhost:8000"
    echo ""
    echo "4. For production deployment:"
    echo "   • Review infrastructure/terraform/ for cloud deployment"
    echo "   • Review infrastructure/kubernetes/ for Kubernetes deployment"
    echo ""
    echo "📚 Documentation: https://docs.myco.dev"
    echo "🐛 Issues: https://github.com/myco-platform/issues"
    echo ""
    log_success "Happy coding! 🚀"
}

# Main setup process
main() {
    log_info "Starting Myco Platform setup..."
    
    # Check for required tools
    if ! command_exists git; then
        log_error "Git is required but not installed. Please install Git first."
        exit 1
    fi
    
    # Run setup steps
    install_dependencies
    setup_nodejs
    setup_python
    setup_docker
    setup_databases
    install_project_dependencies
    setup_environment_files
    setup_dev_tools
    verify_installation
    show_next_steps
}

# Run main function
main "$@"