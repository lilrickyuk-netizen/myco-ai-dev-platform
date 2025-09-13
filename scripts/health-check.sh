#!/bin/bash

# MYCO Platform Health Check Script
# This script checks the health of all services in the platform

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKEND_URL=${BACKEND_URL:-"http://localhost:3001"}
FRONTEND_URL=${FRONTEND_URL:-"http://localhost:3000"}
AI_ENGINE_URL=${AI_ENGINE_URL:-"http://localhost:8000"}
EXECUTION_ENGINE_URL=${EXECUTION_ENGINE_URL:-"http://localhost:3002"}
POSTGRES_HOST=${POSTGRES_HOST:-"localhost"}
POSTGRES_PORT=${POSTGRES_PORT:-5432}
REDIS_HOST=${REDIS_HOST:-"localhost"}
REDIS_PORT=${REDIS_PORT:-6379}
MONGODB_HOST=${MONGODB_HOST:-"localhost"}
MONGODB_PORT=${MONGODB_PORT:-27017}

# Timeout for HTTP checks
TIMEOUT=10

# Counter for failed checks
FAILED_CHECKS=0

# Function to print status
print_status() {
    local service=$1
    local status=$2
    local message=$3
    
    if [ "$status" = "OK" ]; then
        echo -e "${GREEN}✓${NC} $service: ${GREEN}$status${NC} - $message"
    elif [ "$status" = "WARNING" ]; then
        echo -e "${YELLOW}⚠${NC} $service: ${YELLOW}$status${NC} - $message"
    else
        echo -e "${RED}✗${NC} $service: ${RED}$status${NC} - $message"
        ((FAILED_CHECKS++))
    fi
}

# Function to check HTTP endpoint
check_http() {
    local name=$1
    local url=$2
    local expected_status=${3:-200}
    
    echo -e "${BLUE}Checking $name at $url...${NC}"
    
    if command -v curl >/dev/null 2>&1; then
        response=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$url" || echo "000")
        
        if [ "$response" = "$expected_status" ]; then
            print_status "$name" "OK" "HTTP $response"
        else
            print_status "$name" "FAILED" "HTTP $response (expected $expected_status)"
        fi
    else
        print_status "$name" "FAILED" "curl not available"
    fi
}

# Function to check TCP port
check_tcp() {
    local name=$1
    local host=$2
    local port=$3
    
    echo -e "${BLUE}Checking $name at $host:$port...${NC}"
    
    if command -v nc >/dev/null 2>&1; then
        if nc -z -w$TIMEOUT "$host" "$port" 2>/dev/null; then
            print_status "$name" "OK" "Port $port is open"
        else
            print_status "$name" "FAILED" "Port $port is not accessible"
        fi
    elif command -v telnet >/dev/null 2>&1; then
        if timeout $TIMEOUT telnet "$host" "$port" </dev/null 2>/dev/null | grep -q "Connected"; then
            print_status "$name" "OK" "Port $port is open"
        else
            print_status "$name" "FAILED" "Port $port is not accessible"
        fi
    else
        print_status "$name" "WARNING" "nc/telnet not available, cannot check port"
    fi
}

# Function to check Docker containers
check_docker() {
    echo -e "${BLUE}Checking Docker containers...${NC}"
    
    if command -v docker >/dev/null 2>&1; then
        if docker info >/dev/null 2>&1; then
            print_status "Docker" "OK" "Docker daemon is running"
            
            # Check running containers
            running_containers=$(docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "(backend|frontend|ai-engine|execution-engine|postgres|redis|mongodb)" || true)
            
            if [ -n "$running_containers" ]; then
                echo -e "${BLUE}Running containers:${NC}"
                echo "$running_containers"
            else
                print_status "Docker Containers" "WARNING" "No MYCO containers found running"
            fi
        else
            print_status "Docker" "FAILED" "Docker daemon is not accessible"
        fi
    else
        print_status "Docker" "WARNING" "Docker not installed"
    fi
}

# Function to check disk space
check_disk_space() {
    echo -e "${BLUE}Checking disk space...${NC}"
    
    if command -v df >/dev/null 2>&1; then
        usage=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
        
        if [ "$usage" -lt 80 ]; then
            print_status "Disk Space" "OK" "${usage}% used"
        elif [ "$usage" -lt 90 ]; then
            print_status "Disk Space" "WARNING" "${usage}% used"
        else
            print_status "Disk Space" "FAILED" "${usage}% used (critically low)"
        fi
    else
        print_status "Disk Space" "WARNING" "df command not available"
    fi
}

# Function to check memory usage
check_memory() {
    echo -e "${BLUE}Checking memory usage...${NC}"
    
    if command -v free >/dev/null 2>&1; then
        memory_usage=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
        
        if [ "$memory_usage" -lt 80 ]; then
            print_status "Memory Usage" "OK" "${memory_usage}% used"
        elif [ "$memory_usage" -lt 90 ]; then
            print_status "Memory Usage" "WARNING" "${memory_usage}% used"
        else
            print_status "Memory Usage" "FAILED" "${memory_usage}% used (critically high)"
        fi
    else
        print_status "Memory Usage" "WARNING" "free command not available"
    fi
}

# Function to check load average
check_load() {
    echo -e "${BLUE}Checking system load...${NC}"
    
    if command -v uptime >/dev/null 2>&1; then
        load=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
        cpu_cores=$(nproc 2>/dev/null || echo "1")
        load_threshold=$((cpu_cores * 2))
        
        if (( $(echo "$load < $cpu_cores" | bc -l 2>/dev/null || echo "1") )); then
            print_status "System Load" "OK" "Load: $load (cores: $cpu_cores)"
        elif (( $(echo "$load < $load_threshold" | bc -l 2>/dev/null || echo "1") )); then
            print_status "System Load" "WARNING" "Load: $load (cores: $cpu_cores)"
        else
            print_status "System Load" "FAILED" "Load: $load (cores: $cpu_cores) - High load"
        fi
    else
        print_status "System Load" "WARNING" "uptime command not available"
    fi
}

# Function to check API endpoints with detailed health info
check_api_health() {
    local name=$1
    local url=$2
    
    echo -e "${BLUE}Checking $name API health...${NC}"
    
    if command -v curl >/dev/null 2>&1; then
        health_response=$(curl -s --max-time $TIMEOUT "$url/health" 2>/dev/null || echo "")
        
        if [ -n "$health_response" ]; then
            # Try to parse JSON status
            if echo "$health_response" | grep -q '"status".*"healthy"'; then
                print_status "$name API" "OK" "Health check passed"
            elif echo "$health_response" | grep -q '"status"'; then
                status=$(echo "$health_response" | grep -o '"status"[^,]*' | cut -d'"' -f4)
                print_status "$name API" "WARNING" "Status: $status"
            else
                print_status "$name API" "WARNING" "Health endpoint responded but format unclear"
            fi
        else
            print_status "$name API" "FAILED" "Health endpoint not responding"
        fi
    else
        print_status "$name API" "WARNING" "curl not available for API check"
    fi
}

# Function to check database connectivity
check_database() {
    echo -e "${BLUE}Checking database connectivity...${NC}"
    
    # PostgreSQL
    if command -v pg_isready >/dev/null 2>&1; then
        if pg_isready -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -t $TIMEOUT >/dev/null 2>&1; then
            print_status "PostgreSQL" "OK" "Database is accepting connections"
        else
            print_status "PostgreSQL" "FAILED" "Database is not accepting connections"
        fi
    else
        check_tcp "PostgreSQL" "$POSTGRES_HOST" "$POSTGRES_PORT"
    fi
    
    # Redis
    if command -v redis-cli >/dev/null 2>&1; then
        if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping 2>/dev/null | grep -q "PONG"; then
            print_status "Redis" "OK" "Cache is responding"
        else
            print_status "Redis" "FAILED" "Cache is not responding"
        fi
    else
        check_tcp "Redis" "$REDIS_HOST" "$REDIS_PORT"
    fi
    
    # MongoDB
    if command -v mongosh >/dev/null 2>&1; then
        if mongosh --host "$MONGODB_HOST:$MONGODB_PORT" --eval "db.runCommand('ping')" --quiet 2>/dev/null | grep -q '"ok"'; then
            print_status "MongoDB" "OK" "Document database is responding"
        else
            print_status "MongoDB" "FAILED" "Document database is not responding"
        fi
    elif command -v mongo >/dev/null 2>&1; then
        if mongo --host "$MONGODB_HOST:$MONGODB_PORT" --eval "db.runCommand('ping')" --quiet 2>/dev/null | grep -q '"ok"'; then
            print_status "MongoDB" "OK" "Document database is responding"
        else
            print_status "MongoDB" "FAILED" "Document database is not responding"
        fi
    else
        check_tcp "MongoDB" "$MONGODB_HOST" "$MONGODB_PORT"
    fi
}

# Main health check function
main() {
    echo -e "${BLUE}==================================${NC}"
    echo -e "${BLUE}  MYCO Platform Health Check${NC}"
    echo -e "${BLUE}==================================${NC}"
    echo ""
    
    # System checks
    echo -e "${YELLOW}System Health:${NC}"
    check_disk_space
    check_memory
    check_load
    echo ""
    
    # Infrastructure checks
    echo -e "${YELLOW}Infrastructure:${NC}"
    check_docker
    check_database
    echo ""
    
    # Service checks
    echo -e "${YELLOW}Application Services:${NC}"
    check_api_health "Backend" "$BACKEND_URL"
    check_api_health "AI Engine" "$AI_ENGINE_URL"
    check_http "Execution Engine" "$EXECUTION_ENGINE_URL/health"
    check_http "Frontend" "$FRONTEND_URL"
    echo ""
    
    # Summary
    echo -e "${BLUE}==================================${NC}"
    if [ $FAILED_CHECKS -eq 0 ]; then
        echo -e "${GREEN}✓ All checks passed successfully!${NC}"
        exit 0
    else
        echo -e "${RED}✗ $FAILED_CHECKS check(s) failed${NC}"
        echo -e "${YELLOW}Please review the failed services above${NC}"
        exit 1
    fi
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --backend-url)
            BACKEND_URL="$2"
            shift 2
            ;;
        --frontend-url)
            FRONTEND_URL="$2"
            shift 2
            ;;
        --ai-engine-url)
            AI_ENGINE_URL="$2"
            shift 2
            ;;
        --execution-engine-url)
            EXECUTION_ENGINE_URL="$2"
            shift 2
            ;;
        --postgres-host)
            POSTGRES_HOST="$2"
            shift 2
            ;;
        --redis-host)
            REDIS_HOST="$2"
            shift 2
            ;;
        --mongodb-host)
            MONGODB_HOST="$2"
            shift 2
            ;;
        --timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        --help)
            echo "MYCO Platform Health Check Script"
            echo ""
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --backend-url URL         Backend API URL (default: http://localhost:3001)"
            echo "  --frontend-url URL        Frontend URL (default: http://localhost:3000)"
            echo "  --ai-engine-url URL       AI Engine URL (default: http://localhost:8000)"
            echo "  --execution-engine-url URL Execution Engine URL (default: http://localhost:3002)"
            echo "  --postgres-host HOST      PostgreSQL host (default: localhost)"
            echo "  --redis-host HOST         Redis host (default: localhost)"
            echo "  --mongodb-host HOST       MongoDB host (default: localhost)"
            echo "  --timeout SECONDS         Timeout for checks (default: 10)"
            echo "  --help                    Show this help message"
            echo ""
            echo "Environment variables can also be used:"
            echo "  BACKEND_URL, FRONTEND_URL, AI_ENGINE_URL, EXECUTION_ENGINE_URL"
            echo "  POSTGRES_HOST, REDIS_HOST, MONGODB_HOST"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Run main function
main