#!/bin/bash

# Test Docker Build and Run Script
set -e

echo "🔧 Testing Docker Compose build..."

# Stop any existing containers
echo "Stopping existing containers..."
docker-compose down --remove-orphans || true

# Build with no cache to ensure clean build
echo "Building all services..."
docker-compose build --no-cache

# Start services
echo "Starting services..."
docker-compose up -d

# Wait a bit for services to start
echo "Waiting for services to initialize..."
sleep 30

# Check service status
echo "📊 Service Status:"
docker-compose ps

echo "✅ Docker Compose test completed!"
echo ""
echo "Services should be available at:"
echo "- Frontend: http://localhost:3000"
echo "- Backend: http://localhost:8080"
echo "- AI Engine: http://localhost:8000"
echo "- PostgreSQL: localhost:5432"
echo "- Redis: localhost:6379"