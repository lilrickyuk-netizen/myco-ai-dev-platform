#!/bin/bash

# ===========================================
# MYCO AI DEVELOPMENT PLATFORM
# Continuous Integration Check Script
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
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
EXIT_CODE=0

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

# Function to run a command and handle errors
run_check() {
    local check_name="$1"
    local command="$2"
    local optional="${3:-false}"
    
    print_status "Running $check_name..."
    
    if eval "$command"; then
        print_success "$check_name passed"
        return 0
    else
        if [ "$optional" = "true" ]; then
            print_warning "$check_name failed (optional)"
            return 0
        else
            print_error "$check_name failed"
            EXIT_CODE=1
            return 1
        fi
    fi
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Backend checks
check_backend() {
    print_status "=== Backend Checks ==="
    
    if [ ! -d "$PROJECT_ROOT/backend" ]; then
        print_error "Backend directory not found!"
        EXIT_CODE=1
        return 1
    fi
    
    cd "$PROJECT_ROOT/backend"
    
    # Check if package.json exists
    if [ ! -f "package.json" ]; then
        print_error "Backend package.json not found!"
        EXIT_CODE=1
        return 1
    fi
    
    # Install dependencies if node_modules doesn't exist
    if [ ! -d "node_modules" ]; then
        print_status "Installing backend dependencies..."
        npm ci
    fi
    
    # Run TypeScript type checking
    run_check "Backend TypeScript Type Check" "npm run typecheck"
    
    # Run linting
    run_check "Backend ESLint" "npm run lint"
    
    # Run formatting check
    run_check "Backend Prettier Format Check" "npm run format:check" "true"
    
    # Run tests
    run_check "Backend Tests" "npm run test" "true"
    
    # Run build
    run_check "Backend Build" "npm run build"
    
    cd "$PROJECT_ROOT"
}

# Frontend checks
check_frontend() {
    print_status "=== Frontend Checks ==="
    
    if [ ! -d "$PROJECT_ROOT/frontend" ]; then
        print_error "Frontend directory not found!"
        EXIT_CODE=1
        return 1
    fi
    
    cd "$PROJECT_ROOT/frontend"
    
    # Check if package.json exists
    if [ ! -f "package.json" ]; then
        print_error "Frontend package.json not found!"
        EXIT_CODE=1
        return 1
    fi
    
    # Install dependencies if node_modules doesn't exist
    if [ ! -d "node_modules" ]; then
        print_status "Installing frontend dependencies..."
        npm ci
    fi
    
    # Run TypeScript type checking
    run_check "Frontend TypeScript Type Check" "npm run typecheck"
    
    # Run linting
    run_check "Frontend ESLint" "npm run lint"
    
    # Run formatting check
    run_check "Frontend Prettier Format Check" "npm run format:check" "true"
    
    # Run tests
    run_check "Frontend Tests" "npm run test" "true"
    
    # Run build
    run_check "Frontend Build" "npm run build"
    
    cd "$PROJECT_ROOT"
}

# AI Engine checks
check_ai_engine() {
    print_status "=== AI Engine Checks ==="
    
    if [ ! -d "$PROJECT_ROOT/ai-engine" ]; then
        print_warning "AI Engine directory not found, skipping checks"
        return 0
    fi
    
    cd "$PROJECT_ROOT/ai-engine"
    
    # Check if requirements.txt exists
    if [ ! -f "requirements.txt" ]; then
        print_warning "AI Engine requirements.txt not found, skipping Python checks"
        cd "$PROJECT_ROOT"
        return 0
    fi
    
    # Check if Python is available
    if ! command_exists python3; then
        print_warning "Python3 not found, skipping AI Engine checks"
        cd "$PROJECT_ROOT"
        return 0
    fi
    
    # Create virtual environment if it doesn't exist
    if [ ! -d "venv" ]; then
        print_status "Creating Python virtual environment..."
        python3 -m venv venv
    fi
    
    # Activate virtual environment and install dependencies
    source venv/bin/activate
    pip install -r requirements.txt >/dev/null 2>&1 || print_warning "Failed to install Python dependencies"
    
    # Run Python linting if flake8 is available
    if command_exists flake8; then
        run_check "AI Engine Flake8 Linting" "flake8 . --count --select=E9,F63,F7,F82 --show-source --statistics" "true"
    fi
    
    # Run Python type checking if mypy is available
    if command_exists mypy; then
        run_check "AI Engine MyPy Type Check" "mypy . --ignore-missing-imports" "true"
    fi
    
    # Run Python tests if pytest is available
    if command_exists pytest; then
        run_check "AI Engine Tests" "pytest tests/ -v" "true"
    fi
    
    deactivate
    cd "$PROJECT_ROOT"
}

# Execution Engine checks
check_execution_engine() {
    print_status "=== Execution Engine Checks ==="
    
    if [ ! -d "$PROJECT_ROOT/execution-engine" ]; then
        print_warning "Execution Engine directory not found, skipping checks"
        return 0
    fi
    
    cd "$PROJECT_ROOT/execution-engine"
    
    # Check if package.json exists
    if [ ! -f "package.json" ]; then
        print_warning "Execution Engine package.json not found, skipping checks"
        cd "$PROJECT_ROOT"
        return 0
    fi
    
    # Install dependencies if node_modules doesn't exist
    if [ ! -d "node_modules" ]; then
        print_status "Installing execution engine dependencies..."
        npm ci
    fi
    
    # Run TypeScript type checking
    if grep -q "typecheck" package.json; then
        run_check "Execution Engine TypeScript Type Check" "npm run typecheck" "true"
    fi
    
    # Run linting
    if grep -q "lint" package.json; then
        run_check "Execution Engine ESLint" "npm run lint" "true"
    fi
    
    # Run tests
    if grep -q "test" package.json; then
        run_check "Execution Engine Tests" "npm run test" "true"
    fi
    
    # Run build
    if grep -q "build" package.json; then
        run_check "Execution Engine Build" "npm run build" "true"
    fi
    
    cd "$PROJECT_ROOT"
}

# Template Engine checks
check_template_engine() {
    print_status "=== Template Engine Checks ==="
    
    if [ ! -d "$PROJECT_ROOT/template-engine" ]; then
        print_warning "Template Engine directory not found, skipping checks"
        return 0
    fi
    
    cd "$PROJECT_ROOT/template-engine"
    
    # Check if package.json exists
    if [ ! -f "package.json" ]; then
        print_warning "Template Engine package.json not found, skipping checks"
        cd "$PROJECT_ROOT"
        return 0
    fi
    
    # Install dependencies if node_modules doesn't exist
    if [ ! -d "node_modules" ]; then
        print_status "Installing template engine dependencies..."
        npm ci
    fi
    
    # Run TypeScript type checking
    if grep -q "typecheck" package.json; then
        run_check "Template Engine TypeScript Type Check" "npm run typecheck" "true"
    fi
    
    # Run linting
    if grep -q "lint" package.json; then
        run_check "Template Engine ESLint" "npm run lint" "true"
    fi
    
    # Run tests
    if grep -q "test" package.json; then
        run_check "Template Engine Tests" "npm run test" "true"
    fi
    
    # Run build
    if grep -q "build" package.json; then
        run_check "Template Engine Build" "npm run build" "true"
    fi
    
    cd "$PROJECT_ROOT"
}

# Docker checks
check_docker() {
    print_status "=== Docker Checks ==="
    
    # Check if Docker is running
    if ! command_exists docker; then
        print_warning "Docker not found, skipping Docker checks"
        return 0
    fi
    
    if ! docker info >/dev/null 2>&1; then
        print_warning "Docker daemon not running, skipping Docker checks"
        return 0
    fi
    
    # Check Docker Compose syntax
    run_check "Docker Compose Syntax Check" "docker-compose config -q"
    
    # Check production Docker Compose syntax
    if [ -f "docker-compose.prod.yml" ]; then
        run_check "Production Docker Compose Syntax Check" "docker-compose -f docker-compose.prod.yml config -q"
    fi
    
    # Try to build images (without cache for clean build)
    run_check "Docker Build Check" "docker-compose build --no-cache backend frontend" "true"
}

# Configuration checks
check_configuration() {
    print_status "=== Configuration Checks ==="
    
    # Check if example env files exist
    run_check "Root .env.example exists" "test -f .env.example"
    run_check "Backend .env.example exists" "test -f backend/.env.example"
    run_check "Frontend .env.example exists" "test -f frontend/.env.example"
    
    # Check if required directories exist
    local required_dirs=(
        "backend"
        "frontend"
        "scripts"
        "nginx"
        "monitoring"
    )
    
    for dir in "${required_dirs[@]}"; do
        run_check "Directory $dir exists" "test -d $dir"
    done
    
    # Check if Makefile exists
    run_check "Makefile exists" "test -f Makefile"
    
    # Check nginx configuration syntax
    if [ -f "nginx/nginx.conf" ]; then
        if command_exists nginx; then
            run_check "Nginx Configuration Syntax" "nginx -t -c $PROJECT_ROOT/nginx/nginx.conf" "true"
        fi
    fi
}

# Security checks
check_security() {
    print_status "=== Security Checks ==="
    
    # Check for common security issues
    
    # Check for hardcoded secrets (basic check)
    local secret_patterns=(
        "password.*=.*['\"][^'\"]*['\"]"
        "secret.*=.*['\"][^'\"]*['\"]"
        "api[_-]?key.*=.*['\"][^'\"]*['\"]"
        "token.*=.*['\"][^'\"]*['\"]"
    )
    
    local files_with_secrets=()
    
    for pattern in "${secret_patterns[@]}"; do
        local matches
        matches=$(grep -r -i --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=venv --exclude="*.log" "$pattern" . 2>/dev/null || true)
        if [ -n "$matches" ]; then
            files_with_secrets+=("$matches")
        fi
    done
    
    if [ ${#files_with_secrets[@]} -gt 0 ]; then
        print_warning "Potential hardcoded secrets found:"
        for match in "${files_with_secrets[@]}"; do
            echo "  $match"
        done
        print_warning "Please review these files and ensure no secrets are hardcoded"
    else
        print_success "No obvious hardcoded secrets found"
    fi
    
    # Check for .env files in version control
    if git ls-files | grep -E "\.env$" >/dev/null 2>&1; then
        print_error ".env files should not be committed to version control"
        EXIT_CODE=1
    else
        print_success "No .env files found in version control"
    fi
    
    # Check file permissions on scripts
    local scripts=(
        "scripts/bootstrap.sh"
        "scripts/checks/ci-check.sh"
    )
    
    for script in "${scripts[@]}"; do
        if [ -f "$script" ] && [ ! -x "$script" ]; then
            print_warning "$script is not executable. Run: chmod +x $script"
        fi
    done
}

# Coverage report (if available)
generate_coverage() {
    print_status "=== Coverage Report ==="
    
    # Backend coverage
    if [ -d "$PROJECT_ROOT/backend" ]; then
        cd "$PROJECT_ROOT/backend"
        if grep -q "test:coverage" package.json; then
            run_check "Backend Coverage Report" "npm run test:coverage" "true"
        fi
        cd "$PROJECT_ROOT"
    fi
    
    # Frontend coverage
    if [ -d "$PROJECT_ROOT/frontend" ]; then
        cd "$PROJECT_ROOT/frontend"
        if grep -q "test:coverage" package.json; then
            run_check "Frontend Coverage Report" "npm run test:coverage" "true"
        fi
        cd "$PROJECT_ROOT"
    fi
}

# Main execution
main() {
    echo "========================================="
    echo "Myco AI Development Platform CI Checks"
    echo "========================================="
    echo ""
    
    cd "$PROJECT_ROOT"
    
    # Run all checks
    check_configuration
    check_backend
    check_frontend
    check_ai_engine
    check_execution_engine
    check_template_engine
    check_docker
    check_security
    
    # Generate coverage if requested
    if [ "$1" = "--coverage" ]; then
        generate_coverage
    fi
    
    echo ""
    echo "========================================="
    if [ $EXIT_CODE -eq 0 ]; then
        print_success "All CI checks passed!"
        echo "The codebase is ready for deployment."
    else
        print_error "Some CI checks failed!"
        echo "Please fix the issues above before proceeding."
    fi
    echo "========================================="
    
    exit $EXIT_CODE
}

# Run main function
main "$@"