#!/bin/bash

# Trivy Security Scanning Script for AI Development Platform
set -e

# Configuration
SEVERITY="${SEVERITY:-HIGH,CRITICAL}"
OUTPUT_FORMAT="${OUTPUT_FORMAT:-json}"
SCAN_TYPE="${SCAN_TYPE:-all}"
TRIVY_CONFIG="${TRIVY_CONFIG:-security/trivy/trivy-config.yaml}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting Trivy Security Scan for AI Development Platform${NC}"

# Check if Trivy is installed
if ! command -v trivy &> /dev/null; then
    echo -e "${RED}Trivy not found. Installing...${NC}"
    
    # Install Trivy
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        brew install trivy
    else
        echo -e "${RED}Unsupported OS. Please install Trivy manually.${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}Trivy installed successfully${NC}"
fi

# Create reports directory
mkdir -p security/reports/trivy
mkdir -p security/reports/trivy/images
mkdir -p security/reports/trivy/filesystem
mkdir -p security/reports/trivy/config

# Update Trivy database
echo -e "${YELLOW}Updating Trivy vulnerability database...${NC}"
trivy image --download-db-only

# Function to scan with Trivy
run_trivy_scan() {
    local scan_type=$1
    local target=$2
    local output_file=$3
    local extra_args=${4:-}
    
    echo -e "${YELLOW}Running $scan_type scan on $target...${NC}"
    
    local cmd="trivy $scan_type $target --format $OUTPUT_FORMAT --severity $SEVERITY $extra_args"
    
    if [ -f "$TRIVY_CONFIG" ]; then
        cmd="$cmd --config $TRIVY_CONFIG"
    fi
    
    # Run scan and capture exit code
    if eval "$cmd" > "$output_file" 2>&1; then
        echo -e "${GREEN}✅ $scan_type scan completed for $target${NC}"
        return 0
    else
        local exit_code=$?
        echo -e "${RED}❌ $scan_type scan failed for $target (exit code: $exit_code)${NC}"
        
        # Show summary of findings
        if [ -f "$output_file" ] && [ "$OUTPUT_FORMAT" = "json" ]; then
            local vuln_count=$(jq -r '.Results[]?.Vulnerabilities // [] | length' "$output_file" 2>/dev/null | awk '{sum+=$1} END {print sum+0}')
            if [ "$vuln_count" -gt 0 ]; then
                echo -e "${RED}Found $vuln_count vulnerabilities${NC}"
            fi
        fi
        
        return $exit_code
    fi
}

# Track overall exit code
OVERALL_EXIT_CODE=0

# 1. Filesystem scanning
if [ "$SCAN_TYPE" = "all" ] || [ "$SCAN_TYPE" = "filesystem" ]; then
    echo -e "${BLUE}=== Filesystem Security Scan ===${NC}"
    
    # Scan current directory
    if ! run_trivy_scan "fs" "." "security/reports/trivy/filesystem/root.json" "--security-checks vuln,config,secret"; then
        OVERALL_EXIT_CODE=1
    fi
    
    # Scan specific directories for secrets and misconfigurations
    for dir in backend frontend ai-engine execution-engine template-engine validation-engine; do
        if [ -d "$dir" ]; then
            if ! run_trivy_scan "fs" "$dir" "security/reports/trivy/filesystem/${dir}.json" "--security-checks config,secret"; then
                OVERALL_EXIT_CODE=1
            fi
        fi
    done
fi

# 2. Container image scanning
if [ "$SCAN_TYPE" = "all" ] || [ "$SCAN_TYPE" = "image" ]; then
    echo -e "${BLUE}=== Container Image Security Scan ===${NC}"
    
    # Build images first
    echo -e "${YELLOW}Building Docker images...${NC}"
    docker-compose build > /dev/null 2>&1 || true
    
    # Get list of images
    IMAGES=$(docker images --format "table {{.Repository}}:{{.Tag}}" | grep -E "(ai-dev-platform|myco)" | grep -v "<none>" || true)
    
    if [ -n "$IMAGES" ]; then
        while IFS= read -r image; do
            if [ -n "$image" ] && [ "$image" != "REPOSITORY:TAG" ]; then
                echo -e "${YELLOW}Scanning Docker image: $image${NC}"
                
                # Clean image name for filename
                safe_name=$(echo "$image" | sed 's/[^a-zA-Z0-9.-]/_/g')
                
                if ! run_trivy_scan "image" "$image" "security/reports/trivy/images/${safe_name}.json" "--security-checks vuln,config,secret"; then
                    OVERALL_EXIT_CODE=1
                fi
            fi
        done <<< "$IMAGES"
    else
        echo -e "${YELLOW}No Docker images found to scan${NC}"
    fi
fi

# 3. Kubernetes configuration scanning
if [ "$SCAN_TYPE" = "all" ] || [ "$SCAN_TYPE" = "config" ]; then
    echo -e "${BLUE}=== Kubernetes Configuration Scan ===${NC}"
    
    if [ -d "infrastructure/kubernetes" ]; then
        if ! run_trivy_scan "config" "infrastructure/kubernetes" "security/reports/trivy/config/kubernetes.json" "--security-checks config"; then
            OVERALL_EXIT_CODE=1
        fi
    fi
    
    # Scan Docker Compose files
    for file in docker-compose*.yml; do
        if [ -f "$file" ]; then
            filename=$(basename "$file" .yml)
            if ! run_trivy_scan "config" "$file" "security/reports/trivy/config/${filename}.json" "--security-checks config"; then
                OVERALL_EXIT_CODE=1
            fi
        fi
    done
fi

# 4. Repository scanning (SBOM and license compliance)
if [ "$SCAN_TYPE" = "all" ] || [ "$SCAN_TYPE" = "repo" ]; then
    echo -e "${BLUE}=== Repository Security Scan ===${NC}"
    
    # Generate SBOM (Software Bill of Materials)
    echo -e "${YELLOW}Generating SBOM...${NC}"
    trivy repo . --format spdx-json --output security/reports/trivy/sbom.spdx.json || true
    
    # License scanning
    echo -e "${YELLOW}Scanning licenses...${NC}"
    trivy repo . --scanners license --format json --output security/reports/trivy/licenses.json || true
fi

# Generate summary report
echo -e "${YELLOW}Generating summary report...${NC}"

cat > security/reports/trivy/summary.md << EOF
# Trivy Security Scan Summary

**Scan Date:** $(date)
**Scan Configuration:**
- Severity: $SEVERITY
- Format: $OUTPUT_FORMAT
- Scan Type: $SCAN_TYPE

## Scan Results

### Filesystem Scans
EOF

# Add filesystem scan results
for report in security/reports/trivy/filesystem/*.json; do
    if [ -f "$report" ]; then
        component=$(basename "$report" .json)
        vulnerabilities=$(jq -r '[.Results[]?.Vulnerabilities // []] | flatten | length' "$report" 2>/dev/null || echo "0")
        secrets=$(jq -r '[.Results[]?.Secrets // []] | flatten | length' "$report" 2>/dev/null || echo "0")
        echo "- **$component**: $vulnerabilities vulnerabilities, $secrets secrets" >> security/reports/trivy/summary.md
    fi
done

echo "" >> security/reports/trivy/summary.md
echo "### Container Image Scans" >> security/reports/trivy/summary.md

for report in security/reports/trivy/images/*.json; do
    if [ -f "$report" ]; then
        image=$(basename "$report" .json)
        vulnerabilities=$(jq -r '[.Results[]?.Vulnerabilities // []] | flatten | length' "$report" 2>/dev/null || echo "0")
        echo "- **$image**: $vulnerabilities vulnerabilities" >> security/reports/trivy/summary.md
    fi
done

echo "" >> security/reports/trivy/summary.md
echo "### Configuration Scans" >> security/reports/trivy/summary.md

for report in security/reports/trivy/config/*.json; do
    if [ -f "$report" ]; then
        config=$(basename "$report" .json)
        misconfigs=$(jq -r '[.Results[]?.Misconfigurations // []] | flatten | length' "$report" 2>/dev/null || echo "0")
        echo "- **$config**: $misconfigs misconfigurations" >> security/reports/trivy/summary.md
    fi
done

# Generate consolidated findings
echo -e "${YELLOW}Generating consolidated findings...${NC}"
trivy repo . --format table --output security/reports/trivy/findings.txt || true

# Final status
if [ $OVERALL_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ All Trivy security scans passed!${NC}"
    echo "" >> security/reports/trivy/summary.md
    echo "## Overall Status: ✅ PASSED" >> security/reports/trivy/summary.md
else
    echo -e "${RED}❌ Some Trivy security scans failed!${NC}"
    echo "" >> security/reports/trivy/summary.md
    echo "## Overall Status: ❌ FAILED" >> security/reports/trivy/summary.md
fi

echo -e "${GREEN}Trivy scan completed. Reports saved to security/reports/trivy/${NC}"

# Show quick summary
echo -e "${BLUE}=== Quick Summary ===${NC}"
if [ -f "security/reports/trivy/findings.txt" ]; then
    tail -20 security/reports/trivy/findings.txt
fi

exit $OVERALL_EXIT_CODE