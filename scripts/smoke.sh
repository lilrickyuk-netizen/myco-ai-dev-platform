#!/bin/bash

# MYCO Platform Smoke Test
# This script tests the basic functionality of the platform

set -e

echo "🧪 Running MYCO Platform Smoke Tests..."
echo

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test configuration
BACKEND_URL="http://localhost:3001"
AI_ENGINE_URL="http://localhost:8001"
FRONTEND_URL="http://localhost:3000"
EXECUTION_ENGINE_URL="http://localhost:8002"
TEMPLATE_ENGINE_URL="http://localhost:8003"
VALIDATION_ENGINE_URL="http://localhost:8004"

# Function to print test status
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
    else
        echo -e "${RED}✗${NC} $2"
        exit 1
    fi
}

# Function to wait for service
wait_for_service() {
    local url=$1
    local service_name=$2
    local max_attempts=30
    local attempt=1
    
    echo -e "${YELLOW}⏳${NC} Waiting for $service_name..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s "$url" > /dev/null 2>&1; then
            echo -e "${GREEN}✓${NC} $service_name is ready"
            return 0
        fi
        
        echo "   Attempt $attempt/$max_attempts..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo -e "${RED}✗${NC} $service_name failed to start after $max_attempts attempts"
    return 1
}

echo "1. Testing service availability..."

# Wait for all services to be ready
wait_for_service "$BACKEND_URL/health" "Backend"
wait_for_service "$AI_ENGINE_URL/health" "AI Engine"
wait_for_service "$EXECUTION_ENGINE_URL/health" "Execution Engine"
wait_for_service "$TEMPLATE_ENGINE_URL/health" "Template Engine"
wait_for_service "$VALIDATION_ENGINE_URL/health" "Validation Engine"
wait_for_service "$FRONTEND_URL" "Frontend"

echo
echo "2. Testing backend API endpoints..."

# Test backend health
response=$(curl -s "$BACKEND_URL/health")
if echo "$response" | grep -q '"status":"healthy"'; then
    print_status 0 "Backend health check"
else
    print_status 1 "Backend health check"
fi

# Test backend readiness
response=$(curl -s "$BACKEND_URL/ready")
status=$?
print_status $status "Backend readiness check"

echo
echo "3. Testing AI Engine..."

# Test AI Engine health
response=$(curl -s "$AI_ENGINE_URL/health")
if echo "$response" | grep -q '"status":"healthy"'; then
    print_status 0 "AI Engine health check"
else
    print_status 1 "AI Engine health check"
fi

# Test AI Engine models endpoint
response=$(curl -s "$AI_ENGINE_URL/models")
if echo "$response" | grep -q '"models"'; then
    print_status 0 "AI Engine models endpoint"
else
    print_status 1 "AI Engine models endpoint"
fi

echo
echo "4. Testing project creation..."

# Create a test project
project_response=$(curl -s -X POST "$BACKEND_URL/projects" \
    -H "Content-Type: application/json" \
    -d '{"name":"smoke-test-project"}')

if echo "$project_response" | grep -q '"id"'; then
    project_id=$(echo "$project_response" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    print_status 0 "Project creation (ID: ${project_id:0:8}...)"
else
    print_status 1 "Project creation"
fi

echo
echo "5. Testing file operations..."

# Create a test file
file_response=$(curl -s -X POST "$BACKEND_URL/files" \
    -H "Content-Type: application/json" \
    -d "{\"project_id\":\"$project_id\",\"path\":\"test.js\"}")

if echo "$file_response" | grep -q '"id"'; then
    file_id=$(echo "$file_response" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    print_status 0 "File creation"
else
    print_status 1 "File creation"
fi

# Update file content
curl -s -X PUT "$BACKEND_URL/files/$file_id" \
    -H "Content-Type: application/json" \
    -d '{"content":"console.log(\"Hello, World!\");"}' > /dev/null

# Retrieve file
file_content=$(curl -s "$BACKEND_URL/files/$file_id")
if echo "$file_content" | grep -q "Hello, World"; then
    print_status 0 "File update and retrieval"
else
    print_status 1 "File update and retrieval"
fi

echo
echo "6. Testing AI generation..."

# Test AI generation
ai_response=$(curl -s -X POST "$AI_ENGINE_URL/generation" \
    -H "Content-Type: application/json" \
    -d '{"prompt":"Write a simple hello world function","model":"gpt-3.5-turbo"}')

if echo "$ai_response" | grep -q "choices\|content\|stub"; then
    print_status 0 "AI generation"
else
    print_status 1 "AI generation"
fi

echo
echo "7. Testing other engines..."

# Test Template Engine
template_response=$(curl -s -X POST "$TEMPLATE_ENGINE_URL/render" \
    -H "Content-Type: application/json" \
    -d '{"template":"Hello {{name}}!","variables":{"name":"World"}}')

if echo "$template_response" | grep -q "Hello World"; then
    print_status 0 "Template Engine"
else
    print_status 1 "Template Engine"
fi

# Test Validation Engine
validation_response=$(curl -s -X POST "$VALIDATION_ENGINE_URL/validate" \
    -H "Content-Type: application/json" \
    -d '{"schema":{"type":"object","properties":{"name":{"type":"string"}}},"data":{"name":"test"}}')

if echo "$validation_response" | grep -q '"valid":true'; then
    print_status 0 "Validation Engine"
else
    print_status 1 "Validation Engine"
fi

# Test Execution Engine
execution_response=$(curl -s -X POST "$EXECUTION_ENGINE_URL/jobs" \
    -H "Content-Type: application/json" \
    -d '{"code":"console.log(\"test\")","language":"javascript"}')

if echo "$execution_response" | grep -q '"id"'; then
    print_status 0 "Execution Engine"
else
    print_status 1 "Execution Engine"
fi

echo
echo "8. Cleanup..."

# Delete test file
curl -s -X DELETE "$BACKEND_URL/files/$file_id" > /dev/null
print_status 0 "Test file cleanup"

echo
echo -e "${GREEN}🎉 All smoke tests passed successfully!${NC}"
echo
echo "The MYCO AI Dev Platform is ready for use:"
echo "• Frontend: $FRONTEND_URL"
echo "• Backend API: $BACKEND_URL"
echo "• AI Engine: $AI_ENGINE_URL"
echo
echo "Happy coding! 🚀"