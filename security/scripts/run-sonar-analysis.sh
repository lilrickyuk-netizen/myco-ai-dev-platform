#!/bin/bash

# SonarQube Analysis Script for AI Development Platform
set -e

# Configuration
SONAR_HOST_URL="${SONAR_HOST_URL:-http://localhost:9000}"
SONAR_TOKEN="${SONAR_TOKEN:-}"
PROJECT_KEY="ai-dev-platform"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting SonarQube Analysis for AI Development Platform${NC}"

# Check if SonarScanner is installed
if ! command -v sonar-scanner &> /dev/null; then
    echo -e "${RED}SonarScanner CLI not found. Installing...${NC}"
    
    # Install SonarScanner
    wget -q https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/sonar-scanner-cli-5.0.1.3006-linux.zip
    unzip -q sonar-scanner-cli-5.0.1.3006-linux.zip
    sudo mv sonar-scanner-5.0.1.3006-linux /opt/sonar-scanner
    sudo ln -sf /opt/sonar-scanner/bin/sonar-scanner /usr/local/bin/sonar-scanner
    rm sonar-scanner-cli-5.0.1.3006-linux.zip
    
    echo -e "${GREEN}SonarScanner installed successfully${NC}"
fi

# Generate coverage reports
echo -e "${YELLOW}Generating test coverage reports...${NC}"

# Frontend coverage
cd frontend
npm run test:coverage || echo "Frontend tests failed, continuing..."
cd ..

# Backend coverage
cd backend
npm run test:coverage || echo "Backend tests failed, continuing..."
cd ..

# Python services coverage
for service in ai-engine agents; do
    if [ -d "$service" ]; then
        echo -e "${YELLOW}Running coverage for $service${NC}"
        cd "$service"
        python -m pytest --cov=. --cov-report=xml:../coverage/${service}-coverage.xml || echo "$service tests failed, continuing..."
        cd ..
    fi
done

# Run SonarQube analysis
echo -e "${YELLOW}Running SonarQube analysis...${NC}"

SONAR_ARGS="-Dsonar.projectKey=${PROJECT_KEY}"
SONAR_ARGS="${SONAR_ARGS} -Dsonar.host.url=${SONAR_HOST_URL}"

if [ -n "$SONAR_TOKEN" ]; then
    SONAR_ARGS="${SONAR_ARGS} -Dsonar.token=${SONAR_TOKEN}"
fi

# Add branch information if in CI
if [ -n "$CI_COMMIT_REF_NAME" ]; then
    SONAR_ARGS="${SONAR_ARGS} -Dsonar.branch.name=${CI_COMMIT_REF_NAME}"
fi

# Add pull request information if available
if [ -n "$CI_MERGE_REQUEST_IID" ]; then
    SONAR_ARGS="${SONAR_ARGS} -Dsonar.pullrequest.key=${CI_MERGE_REQUEST_IID}"
    SONAR_ARGS="${SONAR_ARGS} -Dsonar.pullrequest.branch=${CI_MERGE_REQUEST_SOURCE_BRANCH_NAME}"
    SONAR_ARGS="${SONAR_ARGS} -Dsonar.pullrequest.base=${CI_MERGE_REQUEST_TARGET_BRANCH_NAME}"
fi

sonar-scanner $SONAR_ARGS

# Check quality gate status
echo -e "${YELLOW}Checking quality gate status...${NC}"

# Wait for analysis to complete
sleep 10

# Get quality gate status
if [ -n "$SONAR_TOKEN" ]; then
    QUALITY_GATE_STATUS=$(curl -s -u "${SONAR_TOKEN}:" \
        "${SONAR_HOST_URL}/api/qualitygates/project_status?projectKey=${PROJECT_KEY}" \
        | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    
    if [ "$QUALITY_GATE_STATUS" = "OK" ]; then
        echo -e "${GREEN}✅ Quality gate passed!${NC}"
        exit 0
    else
        echo -e "${RED}❌ Quality gate failed with status: $QUALITY_GATE_STATUS${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}No SONAR_TOKEN provided, skipping quality gate check${NC}"
fi

echo -e "${GREEN}SonarQube analysis completed${NC}"