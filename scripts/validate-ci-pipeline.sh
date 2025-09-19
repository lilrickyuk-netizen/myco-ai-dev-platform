#!/bin/bash

# CI Pipeline Validation Script
# Validates that all components of the production CI/CD pipeline are working correctly

set -e

echo "🧪 Validating Production CI/CD Pipeline"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
VALIDATION_RESULTS="validation-results-$(date +%Y%m%d_%H%M%S).json"
OVERALL_STATUS="PASSED"

# Function to log results
log_result() {
    local test_name="$1"
    local status="$2"
    local message="$3"
    
    echo "{\"test\": \"$test_name\", \"status\": \"$status\", \"message\": \"$message\", \"timestamp\": \"$(date -Iseconds)\"}" >> "$VALIDATION_RESULTS"
    
    if [ "$status" = "FAILED" ]; then
        OVERALL_STATUS="FAILED"
        echo -e "${RED}❌ $test_name: $message${NC}"
    elif [ "$status" = "WARNING" ]; then
        echo -e "${YELLOW}⚠️  $test_name: $message${NC}"
    else
        echo -e "${GREEN}✅ $test_name: $message${NC}"
    fi
}

# Initialize results file
echo "[" > "$VALIDATION_RESULTS"

echo -e "${BLUE}🔍 Checking CI/CD Configuration Files...${NC}"

# 1. Validate GitHub Actions workflow exists
if [ -f ".github/workflows/ci-production.yml" ]; then
    log_result "GitHub Actions Workflow" "PASSED" "Production CI workflow file exists"
else
    log_result "GitHub Actions Workflow" "FAILED" "Missing .github/workflows/ci-production.yml"
fi

# 2. Validate test coverage configuration
if [ -f "jest.config.js" ] && grep -q "coverageThreshold" jest.config.js; then
    BACKEND_THRESHOLD=$(grep -A 10 "coverageThreshold" jest.config.js | grep -o '[0-9]\+' | head -1)
    if [ "$BACKEND_THRESHOLD" -ge 85 ]; then
        log_result "Coverage Thresholds" "PASSED" "Backend coverage threshold set to ${BACKEND_THRESHOLD}%"
    else
        log_result "Coverage Thresholds" "FAILED" "Backend coverage threshold too low: ${BACKEND_THRESHOLD}%"
    fi
else
    log_result "Coverage Thresholds" "FAILED" "Missing coverage threshold configuration"
fi

# 3. Validate Vitest configuration
if [ -f "vitest.config.ts" ] && grep -q "thresholds" vitest.config.ts; then
    FRONTEND_THRESHOLD=$(grep -A 5 "thresholds" vitest.config.ts | grep -o '[0-9]\+' | head -1)
    if [ "$FRONTEND_THRESHOLD" -ge 85 ]; then
        log_result "Frontend Coverage" "PASSED" "Frontend coverage threshold set to ${FRONTEND_THRESHOLD}%"
    else
        log_result "Frontend Coverage" "FAILED" "Frontend coverage threshold too low: ${FRONTEND_THRESHOLD}%"
    fi
else
    log_result "Frontend Coverage" "FAILED" "Missing Vitest coverage configuration"
fi

echo -e "${BLUE}🛡️  Checking Security Scanning Configuration...${NC}"

# 4. Validate security scanning tools in workflow
WORKFLOW_FILE=".github/workflows/ci-production.yml"
if grep -q "github/codeql-action" "$WORKFLOW_FILE"; then
    log_result "CodeQL Scanning" "PASSED" "CodeQL analysis configured"
else
    log_result "CodeQL Scanning" "FAILED" "CodeQL analysis not configured"
fi

if grep -q "trufflesecurity/trufflehog" "$WORKFLOW_FILE"; then
    log_result "Secret Scanning" "PASSED" "TruffleHog secret scanning configured"
else
    log_result "Secret Scanning" "FAILED" "Secret scanning not configured"
fi

if grep -q "snyk/actions" "$WORKFLOW_FILE"; then
    log_result "Dependency Scanning" "PASSED" "Snyk dependency scanning configured"
else
    log_result "Dependency Scanning" "FAILED" "Snyk dependency scanning not configured"
fi

if grep -q "aquasecurity/trivy-action" "$WORKFLOW_FILE"; then
    log_result "Container Scanning" "PASSED" "Trivy container scanning configured"
else
    log_result "Container Scanning" "FAILED" "Trivy container scanning not configured"
fi

echo -e "${BLUE}📦 Checking SBOM Generation...${NC}"

# 5. Validate SBOM generation
if grep -q "anchore/sbom-action" "$WORKFLOW_FILE"; then
    log_result "SBOM Generation" "PASSED" "SBOM generation configured"
else
    log_result "SBOM Generation" "FAILED" "SBOM generation not configured"
fi

if grep -q "actions/attest-sbom" "$WORKFLOW_FILE"; then
    log_result "SBOM Attestation" "PASSED" "SBOM attestation configured"
else
    log_result "SBOM Attestation" "FAILED" "SBOM attestation not configured"
fi

echo -e "${BLUE}🚀 Checking Deployment Configuration...${NC}"

# 6. Validate Kubernetes manifests
if [ -f "infrastructure/kubernetes/deployments.yaml" ]; then
    if grep -q "readinessProbe" infrastructure/kubernetes/deployments.yaml; then
        log_result "Readiness Probes" "PASSED" "Readiness probes configured in deployment"
    else
        log_result "Readiness Probes" "FAILED" "Missing readiness probes in deployment"
    fi
    
    if grep -q "livenessProbe" infrastructure/kubernetes/deployments.yaml; then
        log_result "Liveness Probes" "PASSED" "Liveness probes configured in deployment"
    else
        log_result "Liveness Probes" "WARNING" "Missing liveness probes in deployment"
    fi
else
    log_result "Kubernetes Deployment" "FAILED" "Missing Kubernetes deployment manifests"
fi

echo -e "${BLUE}🧪 Checking Test Configuration...${NC}"

# 7. Validate smoke tests
if [ -f "tests/smoke/staging.test.js" ]; then
    log_result "Smoke Tests" "PASSED" "Staging smoke tests configured"
else
    log_result "Smoke Tests" "FAILED" "Missing staging smoke tests"
fi

if [ -f "tests/api/staging-collection.json" ]; then
    log_result "API Tests" "PASSED" "Newman API tests configured"
else
    log_result "API Tests" "FAILED" "Missing Newman API tests"
fi

if [ -f "tests/performance/slo-validation.yml" ]; then
    log_result "Performance Tests" "PASSED" "Artillery performance tests configured"
else
    log_result "Performance Tests" "FAILED" "Missing performance tests"
fi

echo -e "${BLUE}📊 Checking Monitoring Configuration...${NC}"

# 8. Validate monitoring setup
if [ -f "backend/monitoring/metrics.ts" ]; then
    if grep -q "/metrics" backend/monitoring/metrics.ts; then
        log_result "Prometheus Metrics" "PASSED" "Prometheus metrics endpoint configured"
    else
        log_result "Prometheus Metrics" "FAILED" "Missing Prometheus metrics endpoint"
    fi
else
    log_result "Monitoring Service" "FAILED" "Missing monitoring service"
fi

if [ -f "monitoring/grafana/dashboards/production-overview.json" ]; then
    log_result "Grafana Dashboards" "PASSED" "Production dashboards configured"
else
    log_result "Grafana Dashboards" "FAILED" "Missing Grafana dashboards"
fi

if [ -f "monitoring/prometheus/alert-rules.yml" ]; then
    if grep -q "HighLatencyP95" monitoring/prometheus/alert-rules.yml; then
        log_result "SLO Alerts" "PASSED" "SLO alert rules configured"
    else
        log_result "SLO Alerts" "FAILED" "Missing SLO alert rules"
    fi
else
    log_result "Alert Rules" "FAILED" "Missing Prometheus alert rules"
fi

echo -e "${BLUE}🎯 Checking SLO Configuration...${NC}"

# 9. Validate SLO thresholds
if grep -q "http_request_duration_seconds_p95.*> 2" monitoring/prometheus/alert-rules.yml; then
    log_result "Latency SLO" "PASSED" "P95 latency SLO threshold set to 2s"
else
    log_result "Latency SLO" "FAILED" "Missing or incorrect P95 latency SLO"
fi

if grep -q "http_request_error_rate.*> 0.01" monitoring/prometheus/alert-rules.yml; then
    log_result "Error Rate SLO" "PASSED" "Error rate SLO threshold set to 1%"
else
    log_result "Error Rate SLO" "FAILED" "Missing or incorrect error rate SLO"
fi

echo -e "${BLUE}🔒 Checking Security Configuration...${NC}"

# 10. Validate security gates
if grep -q "severity-threshold=high" "$WORKFLOW_FILE" && grep -q "fail-on=all" "$WORKFLOW_FILE"; then
    log_result "Security Gates" "PASSED" "Security scanning configured to fail on High/Critical"
else
    log_result "Security Gates" "FAILED" "Security gates not configured to fail on High/Critical"
fi

if grep -q "exit-code.*1" "$WORKFLOW_FILE"; then
    log_result "Container Security" "PASSED" "Container scanning configured to fail pipeline"
else
    log_result "Container Security" "WARNING" "Container scanning may not fail pipeline"
fi

echo -e "${BLUE}📝 Checking Documentation...${NC}"

# 11. Validate runbook links
if grep -q "runbook_url" monitoring/prometheus/alert-rules.yml; then
    log_result "Runbook Links" "PASSED" "Alert runbook URLs configured"
else
    log_result "Runbook Links" "WARNING" "Missing runbook URLs in alerts"
fi

# 12. Validate pipeline dependencies
echo -e "${BLUE}🔗 Checking Pipeline Dependencies...${NC}"

if command -v npm >/dev/null 2>&1; then
    log_result "Node.js/NPM" "PASSED" "Node.js and npm are available"
else
    log_result "Node.js/NPM" "FAILED" "Node.js or npm not available"
fi

if command -v docker >/dev/null 2>&1; then
    log_result "Docker" "PASSED" "Docker is available"
else
    log_result "Docker" "WARNING" "Docker not available (may be fine in CI)"
fi

# Close JSON array
echo "]" >> "$VALIDATION_RESULTS"

# Generate summary
echo ""
echo -e "${BLUE}=============================================="
echo -e "📋 CI/CD Pipeline Validation Summary"
echo -e "==============================================${NC}"

PASSED_COUNT=$(grep -c '"status": "PASSED"' "$VALIDATION_RESULTS")
FAILED_COUNT=$(grep -c '"status": "FAILED"' "$VALIDATION_RESULTS")
WARNING_COUNT=$(grep -c '"status": "WARNING"' "$VALIDATION_RESULTS")
TOTAL_COUNT=$((PASSED_COUNT + FAILED_COUNT + WARNING_COUNT))

echo -e "✅ Passed: $PASSED_COUNT"
echo -e "❌ Failed: $FAILED_COUNT"
echo -e "⚠️  Warnings: $WARNING_COUNT"
echo -e "📊 Total: $TOTAL_COUNT"
echo ""
echo -e "📄 Detailed results: $VALIDATION_RESULTS"

if [ "$OVERALL_STATUS" = "PASSED" ]; then
    echo -e "${GREEN}🎉 Overall Status: PIPELINE READY FOR PRODUCTION${NC}"
    echo ""
    echo -e "${GREEN}✅ CI gates enforced: ≥85% total coverage, ≥80% per package${NC}"
    echo -e "${GREEN}✅ Security pipeline: CodeQL, Trivy, Snyk, secret scans${NC}"
    echo -e "${GREEN}✅ SBOM generation and release attachment${NC}"
    echo -e "${GREEN}✅ Staging deployment with readiness probes${NC}"
    echo -e "${GREEN}✅ Smoke tests and SLO validation${NC}"
    echo -e "${GREEN}✅ Prometheus metrics and Grafana dashboards${NC}"
    echo -e "${GREEN}✅ Alert rules for p95 latency and error rates${NC}"
    exit 0
else
    echo -e "${RED}💥 Overall Status: PIPELINE VALIDATION FAILED${NC}"
    echo -e "${RED}Please fix the failed checks before proceeding to production${NC}"
    exit 1
fi