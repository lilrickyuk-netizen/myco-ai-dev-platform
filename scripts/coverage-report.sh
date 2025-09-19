#!/bin/bash

# Coverage Report Generation Script
# Generates comprehensive coverage reports across all test suites

set -e

echo "🧪 Generating Comprehensive Test Coverage Report"
echo "=============================================="

# Configuration
COVERAGE_DIR="coverage"
REPORTS_DIR="test-results"
THRESHOLD=85
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create directories
mkdir -p "$COVERAGE_DIR/combined"
mkdir -p "$REPORTS_DIR"

echo -e "${BLUE}📁 Created coverage directories${NC}"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to run backend tests
run_backend_tests() {
    echo -e "${BLUE}🔧 Running Backend Tests...${NC}"
    
    if command_exists npm; then
        # Jest tests for TypeScript backend
        npm run test:backend -- --coverage --coverageDirectory="$COVERAGE_DIR/backend"
        echo -e "${GREEN}✅ Backend Jest tests completed${NC}"
    else
        echo -e "${YELLOW}⚠️  npm not found, skipping backend tests${NC}"
    fi
}

# Function to run frontend tests
run_frontend_tests() {
    echo -e "${BLUE}🎨 Running Frontend Tests...${NC}"
    
    if command_exists npm; then
        # Vitest tests for React frontend
        npm run test:frontend -- --coverage --coverage.reportsDirectory="$COVERAGE_DIR/frontend"
        echo -e "${GREEN}✅ Frontend tests completed${NC}"
    else
        echo -e "${YELLOW}⚠️  npm not found, skipping frontend tests${NC}"
    fi
}

# Function to run Python tests
run_python_tests() {
    echo -e "${BLUE}🐍 Running Python Tests...${NC}"
    
    if command_exists python && command_exists pytest; then
        # Set up coverage for Python
        export COVERAGE_FILE="$COVERAGE_DIR/python/.coverage"
        mkdir -p "$COVERAGE_DIR/python"
        
        # Run pytest with coverage
        python -m pytest \
            --cov=agents \
            --cov=ai-engine \
            --cov-report=xml:"$COVERAGE_DIR/python/coverage.xml" \
            --cov-report=html:"$COVERAGE_DIR/python/html" \
            --cov-report=json:"$COVERAGE_DIR/python/coverage.json" \
            --cov-report=term-missing \
            --cov-fail-under=$THRESHOLD \
            --junit-xml="$REPORTS_DIR/pytest-results.xml" \
            tests/agents/ tests/ai-engine/ \
            -v
        
        echo -e "${GREEN}✅ Python tests completed${NC}"
    else
        echo -e "${YELLOW}⚠️  Python or pytest not found, skipping Python tests${NC}"
    fi
}

# Function to run integration tests
run_integration_tests() {
    echo -e "${BLUE}🔗 Running Integration Tests...${NC}"
    
    if command_exists npm; then
        npm run test:integration -- --coverage --coverageDirectory="$COVERAGE_DIR/integration"
        echo -e "${GREEN}✅ Integration tests completed${NC}"
    else
        echo -e "${YELLOW}⚠️  npm not found, skipping integration tests${NC}"
    fi
}

# Function to combine coverage reports
combine_coverage() {
    echo -e "${BLUE}📊 Combining Coverage Reports...${NC}"
    
    # Combine JavaScript/TypeScript coverage
    if command_exists nyc; then
        echo "Combining JS/TS coverage..."
        
        # Copy coverage files to temp directory
        TEMP_COV_DIR="/tmp/coverage_$TIMESTAMP"
        mkdir -p "$TEMP_COV_DIR"
        
        # Copy coverage data
        [ -f "$COVERAGE_DIR/backend/coverage-final.json" ] && cp "$COVERAGE_DIR/backend/coverage-final.json" "$TEMP_COV_DIR/backend.json"
        [ -f "$COVERAGE_DIR/frontend/coverage-final.json" ] && cp "$COVERAGE_DIR/frontend/coverage-final.json" "$TEMP_COV_DIR/frontend.json"
        [ -f "$COVERAGE_DIR/integration/coverage-final.json" ] && cp "$COVERAGE_DIR/integration/coverage-final.json" "$TEMP_COV_DIR/integration.json"
        
        # Merge coverage files
        npx nyc merge "$TEMP_COV_DIR" "$COVERAGE_DIR/combined/coverage-final.json"
        
        # Generate combined reports
        npx nyc report \
            --reporter=html \
            --reporter=text \
            --reporter=json \
            --reporter=lcov \
            --reporter=cobertura \
            --report-dir="$COVERAGE_DIR/combined" \
            --temp-dir="$TEMP_COV_DIR"
        
        echo -e "${GREEN}✅ JavaScript/TypeScript coverage combined${NC}"
        
        # Cleanup
        rm -rf "$TEMP_COV_DIR"
    else
        echo -e "${YELLOW}⚠️  nyc not found, manual coverage combination needed${NC}"
    fi
}

# Function to generate coverage summary
generate_summary() {
    echo -e "${BLUE}📋 Generating Coverage Summary...${NC}"
    
    # Create summary report
    SUMMARY_FILE="$COVERAGE_DIR/coverage-summary.md"
    
    cat > "$SUMMARY_FILE" << EOF
# Coverage Report Summary

Generated on: $(date)
Threshold: ${THRESHOLD}%

## Overall Coverage

EOF
    
    # Add backend coverage if available
    if [ -f "$COVERAGE_DIR/backend/coverage-summary.json" ]; then
        echo "### Backend Coverage" >> "$SUMMARY_FILE"
        if command_exists jq; then
            BACKEND_LINES=$(jq -r '.total.lines.pct' "$COVERAGE_DIR/backend/coverage-summary.json")
            BACKEND_FUNCTIONS=$(jq -r '.total.functions.pct' "$COVERAGE_DIR/backend/coverage-summary.json")
            BACKEND_BRANCHES=$(jq -r '.total.branches.pct' "$COVERAGE_DIR/backend/coverage-summary.json")
            BACKEND_STATEMENTS=$(jq -r '.total.statements.pct' "$COVERAGE_DIR/backend/coverage-summary.json")
            
            cat >> "$SUMMARY_FILE" << EOF
- Lines: ${BACKEND_LINES}%
- Functions: ${BACKEND_FUNCTIONS}%
- Branches: ${BACKEND_BRANCHES}%
- Statements: ${BACKEND_STATEMENTS}%

EOF
        fi
    fi
    
    # Add frontend coverage if available
    if [ -f "$COVERAGE_DIR/frontend/coverage-summary.json" ]; then
        echo "### Frontend Coverage" >> "$SUMMARY_FILE"
        if command_exists jq; then
            FRONTEND_LINES=$(jq -r '.total.lines.pct' "$COVERAGE_DIR/frontend/coverage-summary.json")
            FRONTEND_FUNCTIONS=$(jq -r '.total.functions.pct' "$COVERAGE_DIR/frontend/coverage-summary.json")
            FRONTEND_BRANCHES=$(jq -r '.total.branches.pct' "$COVERAGE_DIR/frontend/coverage-summary.json")
            FRONTEND_STATEMENTS=$(jq -r '.total.statements.pct' "$COVERAGE_DIR/frontend/coverage-summary.json")
            
            cat >> "$SUMMARY_FILE" << EOF
- Lines: ${FRONTEND_LINES}%
- Functions: ${FRONTEND_FUNCTIONS}%
- Branches: ${FRONTEND_BRANCHES}%
- Statements: ${FRONTEND_STATEMENTS}%

EOF
        fi
    fi
    
    # Add Python coverage if available
    if [ -f "$COVERAGE_DIR/python/coverage.json" ]; then
        echo "### Python Coverage" >> "$SUMMARY_FILE"
        if command_exists jq; then
            PYTHON_LINES=$(jq -r '.totals.percent_covered' "$COVERAGE_DIR/python/coverage.json")
            
            cat >> "$SUMMARY_FILE" << EOF
- Lines: ${PYTHON_LINES}%

EOF
        fi
    fi
    
    # Add file links
    cat >> "$SUMMARY_FILE" << EOF
## Detailed Reports

- [Combined HTML Report](combined/index.html)
- [Backend HTML Report](backend/index.html)
- [Frontend HTML Report](frontend/index.html)
- [Python HTML Report](python/html/index.html)

## Coverage Files

- [Combined LCOV](combined/lcov.info)
- [Combined JSON](combined/coverage-final.json)
- [Backend LCOV](backend/lcov.info)
- [Frontend LCOV](frontend/lcov.info)
- [Python XML](python/coverage.xml)

EOF
    
    echo -e "${GREEN}✅ Coverage summary generated${NC}"
}

# Function to check coverage thresholds
check_thresholds() {
    echo -e "${BLUE}🎯 Checking Coverage Thresholds...${NC}"
    
    THRESHOLD_PASSED=true
    
    # Check backend coverage
    if [ -f "$COVERAGE_DIR/backend/coverage-summary.json" ] && command_exists jq; then
        BACKEND_LINES=$(jq -r '.total.lines.pct' "$COVERAGE_DIR/backend/coverage-summary.json")
        if (( $(echo "$BACKEND_LINES < $THRESHOLD" | bc -l) )); then
            echo -e "${RED}❌ Backend lines coverage ($BACKEND_LINES%) below threshold ($THRESHOLD%)${NC}"
            THRESHOLD_PASSED=false
        else
            echo -e "${GREEN}✅ Backend lines coverage ($BACKEND_LINES%) meets threshold${NC}"
        fi
    fi
    
    # Check frontend coverage
    if [ -f "$COVERAGE_DIR/frontend/coverage-summary.json" ] && command_exists jq; then
        FRONTEND_LINES=$(jq -r '.total.lines.pct' "$COVERAGE_DIR/frontend/coverage-summary.json")
        if (( $(echo "$FRONTEND_LINES < $THRESHOLD" | bc -l) )); then
            echo -e "${RED}❌ Frontend lines coverage ($FRONTEND_LINES%) below threshold ($THRESHOLD%)${NC}"
            THRESHOLD_PASSED=false
        else
            echo -e "${GREEN}✅ Frontend lines coverage ($FRONTEND_LINES%) meets threshold${NC}"
        fi
    fi
    
    # Check Python coverage
    if [ -f "$COVERAGE_DIR/python/coverage.json" ] && command_exists jq; then
        PYTHON_LINES=$(jq -r '.totals.percent_covered' "$COVERAGE_DIR/python/coverage.json")
        if (( $(echo "$PYTHON_LINES < $THRESHOLD" | bc -l) )); then
            echo -e "${RED}❌ Python lines coverage ($PYTHON_LINES%) below threshold ($THRESHOLD%)${NC}"
            THRESHOLD_PASSED=false
        else
            echo -e "${GREEN}✅ Python lines coverage ($PYTHON_LINES%) meets threshold${NC}"
        fi
    fi
    
    if [ "$THRESHOLD_PASSED" = true ]; then
        echo -e "${GREEN}🎉 All coverage thresholds met!${NC}"
        return 0
    else
        echo -e "${RED}💥 Some coverage thresholds not met${NC}"
        return 1
    fi
}

# Function to generate badges
generate_badges() {
    echo -e "${BLUE}🏷️  Generating Coverage Badges...${NC}"
    
    if command_exists jq && [ -f "$COVERAGE_DIR/combined/coverage-summary.json" ]; then
        COMBINED_LINES=$(jq -r '.total.lines.pct' "$COVERAGE_DIR/combined/coverage-summary.json")
        
        # Create badge data
        if (( $(echo "$COMBINED_LINES >= 90" | bc -l) )); then
            COLOR="brightgreen"
        elif (( $(echo "$COMBINED_LINES >= 80" | bc -l) )); then
            COLOR="green"
        elif (( $(echo "$COMBINED_LINES >= 70" | bc -l) )); then
            COLOR="yellow"
        else
            COLOR="red"
        fi
        
        # Generate shield.io URLs
        BADGE_URL="https://img.shields.io/badge/coverage-${COMBINED_LINES}%25-${COLOR}"
        
        echo "Coverage badge URL: $BADGE_URL" > "$COVERAGE_DIR/badge-url.txt"
        echo -e "${GREEN}✅ Coverage badge URL generated${NC}"
    fi
}

# Function to upload to coverage services
upload_coverage() {
    echo -e "${BLUE}☁️  Uploading Coverage Reports...${NC}"
    
    # Upload to Codecov if token is available
    if [ -n "${CODECOV_TOKEN:-}" ] && command_exists codecov; then
        echo "Uploading to Codecov..."
        codecov -f "$COVERAGE_DIR/combined/lcov.info" -t "$CODECOV_TOKEN"
        echo -e "${GREEN}✅ Uploaded to Codecov${NC}"
    fi
    
    # Upload to Coveralls if token is available
    if [ -n "${COVERALLS_REPO_TOKEN:-}" ] && command_exists coveralls; then
        echo "Uploading to Coveralls..."
        coveralls < "$COVERAGE_DIR/combined/lcov.info"
        echo -e "${GREEN}✅ Uploaded to Coveralls${NC}"
    fi
}

# Function to archive results
archive_results() {
    echo -e "${BLUE}📦 Archiving Results...${NC}"
    
    ARCHIVE_DIR="coverage-archive"
    ARCHIVE_NAME="coverage-${TIMESTAMP}.tar.gz"
    
    mkdir -p "$ARCHIVE_DIR"
    
    tar -czf "$ARCHIVE_DIR/$ARCHIVE_NAME" \
        "$COVERAGE_DIR" \
        "$REPORTS_DIR" \
        2>/dev/null || true
    
    echo -e "${GREEN}✅ Results archived to $ARCHIVE_DIR/$ARCHIVE_NAME${NC}"
}

# Main execution
main() {
    echo -e "${BLUE}Starting comprehensive test coverage generation...${NC}"
    
    # Clean previous coverage
    rm -rf "$COVERAGE_DIR"
    rm -rf "$REPORTS_DIR"
    
    # Run tests
    run_backend_tests
    run_frontend_tests
    run_python_tests
    run_integration_tests
    
    # Process results
    combine_coverage
    generate_summary
    generate_badges
    
    # Check thresholds
    if check_thresholds; then
        COVERAGE_STATUS="PASSED"
        EXIT_CODE=0
    else
        COVERAGE_STATUS="FAILED"
        EXIT_CODE=1
    fi
    
    # Upload and archive
    upload_coverage
    archive_results
    
    # Final summary
    echo ""
    echo -e "${BLUE}=============================================="
    echo -e "📊 Coverage Report Generation Complete"
    echo -e "=============================================="${NC}
    echo -e "Status: ${COVERAGE_STATUS}"
    echo -e "Reports available in: ${COVERAGE_DIR}"
    echo -e "Test results in: ${REPORTS_DIR}"
    echo -e "Summary: ${COVERAGE_DIR}/coverage-summary.md"
    echo ""
    
    if [ $EXIT_CODE -eq 0 ]; then
        echo -e "${GREEN}🎉 All coverage requirements met!${NC}"
    else
        echo -e "${RED}💥 Coverage requirements not met. Please add more tests.${NC}"
    fi
    
    exit $EXIT_CODE
}

# Handle script arguments
case "${1:-}" in
    "backend")
        run_backend_tests
        ;;
    "frontend")
        run_frontend_tests
        ;;
    "python")
        run_python_tests
        ;;
    "integration")
        run_integration_tests
        ;;
    "combine")
        combine_coverage
        ;;
    "summary")
        generate_summary
        ;;
    "check")
        check_thresholds
        ;;
    *)
        main
        ;;
esac