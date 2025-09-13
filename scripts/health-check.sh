#!/bin/bash

set -e

ENVIRONMENT=${1:-development}
BASE_URL=${2:-http://localhost}

echo "Running health checks for $ENVIRONMENT environment..."

# Function to check service health
check_service() {
    local service_name=$1
    local port=$2
    local path=$3
    local max_attempts=30
    local attempt=1

    echo "Checking $service_name health..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "$BASE_URL:$port$path" > /dev/null; then
            echo "✅ $service_name is healthy"
            return 0
        fi
        
        echo "🔄 Attempt $attempt/$max_attempts: $service_name not ready yet..."
        sleep 5
        ((attempt++))
    done
    
    echo "❌ $service_name health check failed after $max_attempts attempts"
    return 1
}

# Function to check database connectivity
check_database() {
    local max_attempts=30
    local attempt=1
    
    echo "Checking database connectivity..."
    
    while [ $attempt -le $max_attempts ]; do
        if pg_isready -h localhost -p 5432 -U postgres > /dev/null 2>&1; then
            echo "✅ Database is healthy"
            return 0
        fi
        
        echo "🔄 Attempt $attempt/$max_attempts: Database not ready yet..."
        sleep 2
        ((attempt++))
    done
    
    echo "❌ Database health check failed after $max_attempts attempts"
    return 1
}

# Function to check Redis connectivity
check_redis() {
    local max_attempts=30
    local attempt=1
    
    echo "Checking Redis connectivity..."
    
    while [ $attempt -le $max_attempts ]; do
        if redis-cli -h localhost -p 6379 ping > /dev/null 2>&1; then
            echo "✅ Redis is healthy"
            return 0
        fi
        
        echo "🔄 Attempt $attempt/$max_attempts: Redis not ready yet..."
        sleep 2
        ((attempt++))
    done
    
    echo "❌ Redis health check failed after $max_attempts attempts"
    return 1
}

# Set ports based on environment
if [ "$ENVIRONMENT" = "test" ]; then
    BACKEND_PORT=3001
    AI_ENGINE_PORT=8001
    EXECUTION_ENGINE_PORT=8002
    FRONTEND_PORT=5174
    POSTGRES_PORT=5433
    REDIS_PORT=6380
else
    BACKEND_PORT=3000
    AI_ENGINE_PORT=8000
    EXECUTION_ENGINE_PORT=8001
    FRONTEND_PORT=5173
    POSTGRES_PORT=5432
    REDIS_PORT=6379
fi

# Track overall health
OVERALL_HEALTH=0

# Check infrastructure services
echo "🔍 Checking infrastructure services..."

if command -v pg_isready > /dev/null; then
    check_database || OVERALL_HEALTH=1
else
    echo "⚠️  pg_isready not available, skipping database check"
fi

if command -v redis-cli > /dev/null; then
    check_redis || OVERALL_HEALTH=1
else
    echo "⚠️  redis-cli not available, skipping Redis check"
fi

# Check application services
echo "🔍 Checking application services..."

check_service "Backend" $BACKEND_PORT "/health" || OVERALL_HEALTH=1
check_service "AI Engine" $AI_ENGINE_PORT "/health/ping" || OVERALL_HEALTH=1
check_service "Execution Engine" $EXECUTION_ENGINE_PORT "/health" || OVERALL_HEALTH=1
check_service "Frontend" $FRONTEND_PORT "/" || OVERALL_HEALTH=1

# Run integration tests
echo "🔍 Running integration tests..."

# Test backend API
if curl -f -s "$BASE_URL:$BACKEND_PORT/health" | jq -e '.status == "healthy"' > /dev/null; then
    echo "✅ Backend API integration test passed"
else
    echo "❌ Backend API integration test failed"
    OVERALL_HEALTH=1
fi

# Test AI Engine API
if curl -f -s "$BASE_URL:$AI_ENGINE_PORT/health/ping" | jq -e '.message == "pong"' > /dev/null; then
    echo "✅ AI Engine API integration test passed"
else
    echo "❌ AI Engine API integration test failed"
    OVERALL_HEALTH=1
fi

# Test Execution Engine API
if curl -f -s "$BASE_URL:$EXECUTION_ENGINE_PORT/health" | jq -e '.status == "healthy"' > /dev/null; then
    echo "✅ Execution Engine API integration test passed"
else
    echo "❌ Execution Engine API integration test failed"
    OVERALL_HEALTH=1
fi

# Test end-to-end flow
echo "🔍 Running end-to-end flow test..."

# Create a test project through the API
PROJECT_RESPONSE=$(curl -s -X POST "$BASE_URL:$BACKEND_PORT/projects" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer test-token" \
    -d '{
        "name": "Health Check Test Project",
        "description": "Automated health check test",
        "templateType": "web",
        "templateName": "react-typescript"
    }' || echo "")

if echo "$PROJECT_RESPONSE" | jq -e '.id' > /dev/null 2>&1; then
    PROJECT_ID=$(echo "$PROJECT_RESPONSE" | jq -r '.id')
    echo "✅ End-to-end project creation test passed (ID: $PROJECT_ID)"
    
    # Clean up test project
    curl -s -X DELETE "$BASE_URL:$BACKEND_PORT/projects/$PROJECT_ID" \
        -H "Authorization: Bearer test-token" > /dev/null
    echo "🧹 Cleaned up test project"
else
    echo "❌ End-to-end project creation test failed"
    OVERALL_HEALTH=1
fi

# Final report
echo ""
echo "🏥 Health Check Summary"
echo "======================="

if [ $OVERALL_HEALTH -eq 0 ]; then
    echo "✅ All services are healthy!"
    echo "🚀 System is ready for use"
    exit 0
else
    echo "❌ Some services are unhealthy"
    echo "🔧 Please check the logs and fix issues before proceeding"
    exit 1
fi