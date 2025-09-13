#!/bin/bash

# Myco Platform Production Setup Script
# This script sets up the complete production environment

set -e

echo "🚀 Setting up Myco Platform for Production..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root for security reasons"
   exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_warning ".env file not found. Creating from example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        print_warning "Please edit .env file with your API keys and configuration before continuing"
        print_warning "Press any key to continue after editing .env..."
        read -n 1 -s
    else
        print_error ".env.example file not found. Cannot create .env file."
        exit 1
    fi
fi

# Load environment variables
source .env

# Check required environment variables
print_status "Checking required environment variables..."

required_vars=(
    "JWT_SECRET_KEY"
    "DATABASE_URL"
    "REDIS_URL"
)

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        print_error "Required environment variable $var is not set in .env file"
        exit 1
    fi
done

print_success "Environment variables validated"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js (v18+) first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | sed 's/v//')
REQUIRED_NODE_VERSION="18.0.0"

if [ "$(printf '%s\n' "$REQUIRED_NODE_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_NODE_VERSION" ]; then
    print_error "Node.js version $NODE_VERSION is too old. Please install Node.js v18 or higher."
    exit 1
fi

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    print_error "Python 3 is not installed. Please install Python 3.9+ first."
    exit 1
fi

print_success "Prerequisites validated"

# Install Node.js dependencies
print_status "Installing Node.js dependencies..."
npm install --production
print_success "Node.js dependencies installed"

# Install Python dependencies
print_status "Installing Python dependencies..."
cd ai-engine
python3 -m pip install -r requirements.txt
cd ..

cd agents
python3 -m pip install -r requirements.txt
cd ..
print_success "Python dependencies installed"

# Build frontend
print_status "Building frontend for production..."
npm run build
print_success "Frontend built successfully"

# Setup database
print_status "Setting up database..."
npm run db:migrate
print_success "Database migrations completed"

# Generate API documentation
print_status "Generating API documentation..."
npm run docs:generate
print_success "API documentation generated"

# Setup monitoring
print_status "Setting up monitoring..."
if [ -d "monitoring" ]; then
    cd monitoring
    if [ -f "docker-compose.yml" ]; then
        docker-compose up -d
        print_success "Monitoring services started"
    fi
    cd ..
fi

# Setup SSL certificates (if not using a reverse proxy)
if [ "$ENABLE_SSL" = "true" ]; then
    print_status "Setting up SSL certificates..."
    if [ ! -d "certs" ]; then
        mkdir -p certs
    fi
    
    if [ ! -f "certs/server.crt" ] || [ ! -f "certs/server.key" ]; then
        print_warning "SSL certificates not found. Generating self-signed certificates..."
        openssl req -newkey rsa:2048 -nodes -keyout certs/server.key -x509 -days 365 -out certs/server.crt -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
        print_warning "Self-signed certificates generated. Replace with proper certificates for production."
    fi
fi

# Setup systemd services (optional)
if [ "$SETUP_SYSTEMD" = "true" ]; then
    print_status "Setting up systemd services..."
    
    # Create systemd service files
    sudo tee /etc/systemd/system/myco-backend.service > /dev/null <<EOF
[Unit]
Description=Myco Platform Backend
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$PWD
Environment=NODE_ENV=production
EnvironmentFile=$PWD/.env
ExecStart=$(which node) dist/backend/main.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    sudo tee /etc/systemd/system/myco-ai-engine.service > /dev/null <<EOF
[Unit]
Description=Myco AI Engine
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$PWD/ai-engine
Environment=PYTHON_ENV=production
EnvironmentFile=$PWD/.env
ExecStart=$(which python3) main.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    sudo systemctl daemon-reload
    sudo systemctl enable myco-backend myco-ai-engine
    print_success "Systemd services configured"
fi

# Run security checks
print_status "Running security checks..."

# Check for common security issues
if [ "$JWT_SECRET_KEY" = "your-super-secret-jwt-key-change-in-production" ]; then
    print_error "Default JWT secret key detected! Please change JWT_SECRET_KEY in .env file."
    exit 1
fi

if [ "$ENABLE_AUTH" != "true" ]; then
    print_warning "Authentication is disabled. This is not recommended for production."
fi

if [ -z "$OPENAI_API_KEY" ] && [ -z "$ANTHROPIC_API_KEY" ] && [ -z "$GOOGLE_API_KEY" ]; then
    print_warning "No AI service API keys configured. AI features will not work."
fi

print_success "Security checks completed"

# Test services
print_status "Testing services..."

# Start services in test mode
print_status "Starting backend service..."
timeout 30s npm run start:backend &
BACKEND_PID=$!

sleep 10

# Test backend health
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    print_success "Backend service is healthy"
else
    print_warning "Backend service health check failed"
fi

# Stop test services
kill $BACKEND_PID 2>/dev/null || true

# Create production startup script
print_status "Creating production startup script..."
cat > start-production.sh << 'EOF'
#!/bin/bash

# Myco Platform Production Startup Script

set -e

# Load environment variables
source .env

echo "🚀 Starting Myco Platform in Production Mode..."

# Start infrastructure services
echo "Starting infrastructure services..."
docker-compose -f infrastructure/docker-compose.yml up -d

# Wait for services to be ready
echo "Waiting for services to be ready..."
sleep 30

# Start AI Engine
echo "Starting AI Engine..."
cd ai-engine
python3 main.py &
AI_ENGINE_PID=$!
cd ..

# Start Backend
echo "Starting Backend..."
npm run start:prod &
BACKEND_PID=$!

# Start Frontend (served by backend in production)
echo "Frontend is served by backend at http://localhost:3000"

echo "✅ Myco Platform is now running in production mode!"
echo ""
echo "🌐 Access the application at: http://localhost:3000"
echo "📊 Monitoring dashboard: http://localhost:3001"
echo "📖 API documentation: http://localhost:3000/docs"
echo ""
echo "To stop the platform, run: ./stop-production.sh"

# Keep script running
wait $BACKEND_PID
EOF

chmod +x start-production.sh

# Create production stop script
cat > stop-production.sh << 'EOF'
#!/bin/bash

echo "🛑 Stopping Myco Platform..."

# Stop Node.js processes
pkill -f "node.*backend" || true
pkill -f "npm.*start" || true

# Stop Python processes
pkill -f "python.*main.py" || true

# Stop Docker services
docker-compose -f infrastructure/docker-compose.yml down

echo "✅ Myco Platform stopped successfully"
EOF

chmod +x stop-production.sh

# Final setup summary
print_success "🎉 Myco Platform Production Setup Complete!"
echo ""
echo "📋 Setup Summary:"
echo "  ✅ Dependencies installed"
echo "  ✅ Frontend built for production"
echo "  ✅ Database migrations completed"
echo "  ✅ API documentation generated"
echo "  ✅ Security checks passed"
echo "  ✅ Startup scripts created"
echo ""
echo "🚀 To start the platform:"
echo "  ./start-production.sh"
echo ""
echo "🛑 To stop the platform:"
echo "  ./stop-production.sh"
echo ""
echo "⚙️  Configuration:"
echo "  • Environment: $([ "$NODE_ENV" = "production" ] && echo "Production" || echo "Development")"
echo "  • Authentication: $([ "$ENABLE_AUTH" = "true" ] && echo "Enabled" || echo "Disabled")"
echo "  • AI Services: $([ -n "$OPENAI_API_KEY" ] && echo "OpenAI " || "")$([ -n "$ANTHROPIC_API_KEY" ] && echo "Anthropic " || "")$([ -n "$GOOGLE_API_KEY" ] && echo "Google " || "")"
echo "  • Vector Store: $([ -n "$PINECONE_API_KEY" ] && echo "Pinecone" || "In-Memory")"
echo ""
echo "🔧 For additional configuration, edit the .env file"
echo "📚 For documentation, visit: http://localhost:3000/docs"

print_success "Setup completed successfully! 🎉"