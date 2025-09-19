#!/bin/bash

# Snyk Security Scanning Script for AI Development Platform
set -e

# Configuration
SNYK_TOKEN="${SNYK_TOKEN:-}"
FAIL_ON="${FAIL_ON:-high}"
OUTPUT_FORMAT="${OUTPUT_FORMAT:-json}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting Snyk Security Scan for AI Development Platform${NC}"

# Check if Snyk CLI is installed
if ! command -v snyk &> /dev/null; then
    echo -e "${RED}Snyk CLI not found. Installing...${NC}"
    npm install -g snyk
    echo -e "${GREEN}Snyk CLI installed successfully${NC}"
fi

# Authenticate with Snyk if token is provided
if [ -n "$SNYK_TOKEN" ]; then
    echo -e "${YELLOW}Authenticating with Snyk...${NC}"
    snyk auth "$SNYK_TOKEN"
else
    echo -e "${YELLOW}No SNYK_TOKEN provided, using existing authentication${NC}"
fi

# Create reports directory
mkdir -p security/reports/snyk

# Function to run Snyk test with error handling
run_snyk_test() {
    local path=$1
    local name=$2
    local extra_args=${3:-}
    
    echo -e "${YELLOW}Scanning $name in $path...${NC}"
    
    cd "$path"
    
    # Run vulnerability test
    if snyk test --severity-threshold="$FAIL_ON" --json $extra_args > "../security/reports/snyk/${name}-vulnerabilities.json" 2>&1; then
        echo -e "${GREEN}✅ No high severity vulnerabilities found in $name${NC}"
        SNYK_EXIT_CODE=0
    else
        SNYK_EXIT_CODE=$?
        echo -e "${RED}❌ Vulnerabilities found in $name${NC}"
        
        # Generate human-readable report
        snyk test --severity-threshold="$FAIL_ON" $extra_args || true
    fi
    
    # Run code analysis (if supported)
    if snyk code test --json > "../security/reports/snyk/${name}-code.json" 2>/dev/null; then
        echo -e "${GREEN}✅ Code analysis completed for $name${NC}"
    else
        echo -e "${YELLOW}⚠️  Code analysis not available for $name${NC}"
    fi
    
    # Monitor for continuous monitoring (only in CI)
    if [ "$CI" = "true" ]; then
        echo -e "${YELLOW}Setting up monitoring for $name...${NC}"
        snyk monitor --project-name="ai-dev-platform-$name" $extra_args || true
    fi
    
    cd - > /dev/null
    return $SNYK_EXIT_CODE
}

# Track overall exit code
OVERALL_EXIT_CODE=0

# Scan frontend
if [ -d "frontend" ]; then
    if ! run_snyk_test "frontend" "frontend" ""; then
        OVERALL_EXIT_CODE=1
    fi
fi

# Scan backend
if [ -d "backend" ]; then
    if ! run_snyk_test "backend" "backend" ""; then
        OVERALL_EXIT_CODE=1
    fi
fi

# Scan Python services
for service in ai-engine agents execution-engine template-engine validation-engine; do
    if [ -d "$service" ] && [ -f "$service/requirements.txt" ]; then
        if ! run_snyk_test "$service" "$service" ""; then
            OVERALL_EXIT_CODE=1
        fi
    fi
done

# Scan Docker images
echo -e "${YELLOW}Scanning Docker images...${NC}"

# Build images first
docker-compose build > /dev/null 2>&1 || true

# Get list of images
IMAGES=$(docker images --format "table {{.Repository}}:{{.Tag}}" | grep -E "(ai-dev-platform|myco)" | grep -v "<none>" || true)

if [ -n "$IMAGES" ]; then
    while IFS= read -r image; do
        if [ -n "$image" ] && [ "$image" != "REPOSITORY:TAG" ]; then
            echo -e "${YELLOW}Scanning Docker image: $image${NC}"
            
            # Clean image name for filename
            safe_name=$(echo "$image" | sed 's/[^a-zA-Z0-9.-]/_/g')
            
            if snyk container test "$image" --json > "security/reports/snyk/docker-${safe_name}.json" 2>&1; then
                echo -e "${GREEN}✅ No high severity vulnerabilities found in $image${NC}"
            else
                echo -e "${RED}❌ Vulnerabilities found in $image${NC}"
                snyk container test "$image" --severity-threshold="$FAIL_ON" || OVERALL_EXIT_CODE=1
            fi
        fi
    done <<< "$IMAGES"
else
    echo -e "${YELLOW}No Docker images found to scan${NC}"
fi

# Generate summary report
echo -e "${YELLOW}Generating summary report...${NC}"

cat > security/reports/snyk/summary.md << EOF
# Snyk Security Scan Summary

**Scan Date:** $(date)
**Scan Configuration:**
- Fail on: $FAIL_ON severity and above
- Output format: $OUTPUT_FORMAT

## Scanned Components

### Application Components
EOF

# Add scan results to summary
for report in security/reports/snyk/*-vulnerabilities.json; do
    if [ -f "$report" ]; then
        component=$(basename "$report" -vulnerabilities.json)
        vulnerabilities=$(jq -r '.vulnerabilities | length' "$report" 2>/dev/null || echo "0")
        echo "- **$component**: $vulnerabilities vulnerabilities found" >> security/reports/snyk/summary.md
    fi
done

echo "" >> security/reports/snyk/summary.md
echo "### Docker Images" >> security/reports/snyk/summary.md

for report in security/reports/snyk/docker-*.json; do
    if [ -f "$report" ]; then
        image=$(basename "$report" .json | sed 's/docker-//')
        vulnerabilities=$(jq -r '.vulnerabilities | length' "$report" 2>/dev/null || echo "0")
        echo "- **$image**: $vulnerabilities vulnerabilities found" >> security/reports/snyk/summary.md
    fi
done

# Final status
if [ $OVERALL_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ All Snyk security scans passed!${NC}"
    echo "## Overall Status: ✅ PASSED" >> security/reports/snyk/summary.md
else
    echo -e "${RED}❌ Some Snyk security scans failed!${NC}"
    echo "## Overall Status: ❌ FAILED" >> security/reports/snyk/summary.md
fi

echo -e "${GREEN}Snyk scan completed. Reports saved to security/reports/snyk/${NC}"

exit $OVERALL_EXIT_CODE