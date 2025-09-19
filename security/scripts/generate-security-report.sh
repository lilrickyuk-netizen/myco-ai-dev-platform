#!/bin/bash

# Comprehensive Security Report Generator for AI Development Platform
# Aggregates all security scan results and policy compliance status

set -e

# Configuration
REPORT_DIR="security/reports/consolidated"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
REPORT_FILE="$REPORT_DIR/security-report-$TIMESTAMP.md"
JSON_REPORT="$REPORT_DIR/security-report-$TIMESTAMP.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() { echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $*${NC}" >&2; }
warn() { echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $*${NC}" >&2; }
error() { echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $*${NC}" >&2; }
info() { echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $*${NC}" >&2; }

# Create reports directory
mkdir -p "$REPORT_DIR"

log "Generating comprehensive security report..."

# Initialize JSON report structure
cat > "$JSON_REPORT" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)",
  "environment": "${ENVIRONMENT:-development}",
  "cluster": "${CLUSTER_NAME:-ai-dev-platform}",
  "region": "${AWS_REGION:-us-west-2}",
  "scan_results": {
    "sonarqube": {},
    "snyk": {},
    "trivy": {},
    "gatekeeper": {},
    "network_policies": {},
    "rbac": {}
  },
  "compliance": {
    "cis_benchmark": {},
    "nist": {},
    "soc2": {}
  },
  "vulnerabilities": {
    "critical": 0,
    "high": 0,
    "medium": 0,
    "low": 0
  },
  "summary": {
    "overall_status": "unknown",
    "risk_level": "unknown",
    "recommendations": []
  }
}
EOF

# Function to analyze SonarQube results
analyze_sonarqube() {
    log "Analyzing SonarQube results..."
    
    local sonar_issues=0
    local sonar_status="not_run"
    
    # Check for SonarQube reports
    if [ -d "security/reports/sonarqube" ]; then
        sonar_status="completed"
        # Count issues from SonarQube reports (would need actual SonarQube API integration)
        local issues_file="security/reports/sonarqube/issues.json"
        if [ -f "$issues_file" ]; then
            sonar_issues=$(jq -r '.issues | length' "$issues_file" 2>/dev/null || echo "0")
        fi
    fi
    
    # Update JSON report
    jq --arg status "$sonar_status" --arg issues "$sonar_issues" \
       '.scan_results.sonarqube = {"status": $status, "issues": ($issues | tonumber)}' \
       "$JSON_REPORT" > "$JSON_REPORT.tmp" && mv "$JSON_REPORT.tmp" "$JSON_REPORT"
    
    echo "$sonar_issues"
}

# Function to analyze Snyk results
analyze_snyk() {
    log "Analyzing Snyk results..."
    
    local critical=0
    local high=0
    local medium=0
    local low=0
    local status="not_run"
    
    if [ -d "security/reports/snyk" ]; then
        status="completed"
        
        # Aggregate vulnerabilities from all Snyk reports
        for report in security/reports/snyk/*.json; do
            if [ -f "$report" ]; then
                local file_critical=$(jq -r '[.vulnerabilities[]? | select(.severity == "critical")] | length' "$report" 2>/dev/null || echo "0")
                local file_high=$(jq -r '[.vulnerabilities[]? | select(.severity == "high")] | length' "$report" 2>/dev/null || echo "0")
                local file_medium=$(jq -r '[.vulnerabilities[]? | select(.severity == "medium")] | length' "$report" 2>/dev/null || echo "0")
                local file_low=$(jq -r '[.vulnerabilities[]? | select(.severity == "low")] | length' "$report" 2>/dev/null || echo "0")
                
                critical=$((critical + file_critical))
                high=$((high + file_high))
                medium=$((medium + file_medium))
                low=$((low + file_low))
            fi
        done
    fi
    
    # Update JSON report
    jq --arg status "$status" \
       --arg critical "$critical" \
       --arg high "$high" \
       --arg medium "$medium" \
       --arg low "$low" \
       '.scan_results.snyk = {
         "status": $status,
         "vulnerabilities": {
           "critical": ($critical | tonumber),
           "high": ($high | tonumber),
           "medium": ($medium | tonumber),
           "low": ($low | tonumber)
         }
       }' \
       "$JSON_REPORT" > "$JSON_REPORT.tmp" && mv "$JSON_REPORT.tmp" "$JSON_REPORT"
    
    echo "$critical $high $medium $low"
}

# Function to analyze Trivy results
analyze_trivy() {
    log "Analyzing Trivy results..."
    
    local critical=0
    local high=0
    local medium=0
    local low=0
    local secrets=0
    local misconfigs=0
    local status="not_run"
    
    if [ -d "security/reports/trivy" ]; then
        status="completed"
        
        # Aggregate vulnerabilities from all Trivy reports
        for report in security/reports/trivy/**/*.json; do
            if [ -f "$report" ]; then
                local file_critical=$(jq -r '[.Results[]?.Vulnerabilities[]? | select(.Severity == "CRITICAL")] | length' "$report" 2>/dev/null || echo "0")
                local file_high=$(jq -r '[.Results[]?.Vulnerabilities[]? | select(.Severity == "HIGH")] | length' "$report" 2>/dev/null || echo "0")
                local file_medium=$(jq -r '[.Results[]?.Vulnerabilities[]? | select(.Severity == "MEDIUM")] | length' "$report" 2>/dev/null || echo "0")
                local file_low=$(jq -r '[.Results[]?.Vulnerabilities[]? | select(.Severity == "LOW")] | length' "$report" 2>/dev/null || echo "0")
                local file_secrets=$(jq -r '[.Results[]?.Secrets[]?] | length' "$report" 2>/dev/null || echo "0")
                local file_misconfigs=$(jq -r '[.Results[]?.Misconfigurations[]?] | length' "$report" 2>/dev/null || echo "0")
                
                critical=$((critical + file_critical))
                high=$((high + file_high))
                medium=$((medium + file_medium))
                low=$((low + file_low))
                secrets=$((secrets + file_secrets))
                misconfigs=$((misconfigs + file_misconfigs))
            fi
        done
    fi
    
    # Update JSON report
    jq --arg status "$status" \
       --arg critical "$critical" \
       --arg high "$high" \
       --arg medium "$medium" \
       --arg low "$low" \
       --arg secrets "$secrets" \
       --arg misconfigs "$misconfigs" \
       '.scan_results.trivy = {
         "status": $status,
         "vulnerabilities": {
           "critical": ($critical | tonumber),
           "high": ($high | tonumber),
           "medium": ($medium | tonumber),
           "low": ($low | tonumber)
         },
         "secrets": ($secrets | tonumber),
         "misconfigurations": ($misconfigs | tonumber)
       }' \
       "$JSON_REPORT" > "$JSON_REPORT.tmp" && mv "$JSON_REPORT.tmp" "$JSON_REPORT"
    
    echo "$critical $high $medium $low $secrets $misconfigs"
}

# Function to check Gatekeeper policy compliance
check_gatekeeper_compliance() {
    log "Checking Gatekeeper policy compliance..."
    
    local violations=0
    local status="not_configured"
    
    if kubectl get constrainttemplates &> /dev/null; then
        status="active"
        
        # Check for policy violations
        local constraint_types=$(kubectl get constrainttemplates -o jsonpath='{.items[*].spec.crd.spec.names.kind}')
        
        for constraint_type in $constraint_types; do
            local constraint_violations=$(kubectl get "$constraint_type" -o json 2>/dev/null | \
                jq -r '.items[]?.status?.violations[]?' | wc -l || echo "0")
            violations=$((violations + constraint_violations))
        done
    fi
    
    # Update JSON report
    jq --arg status "$status" \
       --arg violations "$violations" \
       '.scan_results.gatekeeper = {
         "status": $status,
         "violations": ($violations | tonumber)
       }' \
       "$JSON_REPORT" > "$JSON_REPORT.tmp" && mv "$JSON_REPORT.tmp" "$JSON_REPORT"
    
    echo "$violations"
}

# Function to check network policies
check_network_policies() {
    log "Checking network policies..."
    
    local policies=0
    local coverage="none"
    
    if kubectl get networkpolicies --all-namespaces &> /dev/null; then
        policies=$(kubectl get networkpolicies --all-namespaces --no-headers | wc -l)
        
        if [ "$policies" -gt 0 ]; then
            coverage="partial"
            
            # Check if critical namespaces have network policies
            local critical_namespaces=("myco-platform" "monitoring")
            local covered_namespaces=0
            
            for ns in "${critical_namespaces[@]}"; do
                local ns_policies=$(kubectl get networkpolicies -n "$ns" --no-headers 2>/dev/null | wc -l || echo "0")
                if [ "$ns_policies" -gt 0 ]; then
                    covered_namespaces=$((covered_namespaces + 1))
                fi
            done
            
            if [ "$covered_namespaces" -eq "${#critical_namespaces[@]}" ]; then
                coverage="complete"
            fi
        fi
    fi
    
    # Update JSON report
    jq --arg policies "$policies" \
       --arg coverage "$coverage" \
       '.scan_results.network_policies = {
         "count": ($policies | tonumber),
         "coverage": $coverage
       }' \
       "$JSON_REPORT" > "$JSON_REPORT.tmp" && mv "$JSON_REPORT.tmp" "$JSON_REPORT"
    
    echo "$policies $coverage"
}

# Function to check RBAC configuration
check_rbac() {
    log "Checking RBAC configuration..."
    
    local roles=$(kubectl get roles --all-namespaces --no-headers | wc -l)
    local cluster_roles=$(kubectl get clusterroles --no-headers | wc -l)
    local role_bindings=$(kubectl get rolebindings --all-namespaces --no-headers | wc -l)
    local cluster_role_bindings=$(kubectl get clusterrolebindings --no-headers | wc -l)
    
    # Check for overly permissive bindings
    local risky_bindings=0
    
    # Check for cluster-admin bindings (high risk)
    local cluster_admin_bindings=$(kubectl get clusterrolebindings -o json | \
        jq -r '.items[] | select(.roleRef.name == "cluster-admin") | .metadata.name' | wc -l)
    risky_bindings=$((risky_bindings + cluster_admin_bindings))
    
    # Update JSON report
    jq --arg roles "$roles" \
       --arg cluster_roles "$cluster_roles" \
       --arg role_bindings "$role_bindings" \
       --arg cluster_role_bindings "$cluster_role_bindings" \
       --arg risky_bindings "$risky_bindings" \
       '.scan_results.rbac = {
         "roles": ($roles | tonumber),
         "cluster_roles": ($cluster_roles | tonumber),
         "role_bindings": ($role_bindings | tonumber),
         "cluster_role_bindings": ($cluster_role_bindings | tonumber),
         "risky_bindings": ($risky_bindings | tonumber)
       }' \
       "$JSON_REPORT" > "$JSON_REPORT.tmp" && mv "$JSON_REPORT.tmp" "$JSON_REPORT"
    
    echo "$risky_bindings"
}

# Function to calculate overall risk level
calculate_risk_level() {
    local critical_vulns=$1
    local high_vulns=$2
    local secrets=$3
    local gatekeeper_violations=$4
    local risky_rbac=$5
    
    local risk_score=0
    
    # Calculate risk score based on findings
    risk_score=$((risk_score + critical_vulns * 10))
    risk_score=$((risk_score + high_vulns * 5))
    risk_score=$((risk_score + secrets * 15))
    risk_score=$((risk_score + gatekeeper_violations * 3))
    risk_score=$((risk_score + risky_rbac * 8))
    
    local risk_level="low"
    if [ "$risk_score" -gt 50 ]; then
        risk_level="critical"
    elif [ "$risk_score" -gt 25 ]; then
        risk_level="high"
    elif [ "$risk_score" -gt 10 ]; then
        risk_level="medium"
    fi
    
    echo "$risk_level"
}

# Generate recommendations based on findings
generate_recommendations() {
    local recommendations=()
    
    # Get current vulnerability counts
    local critical_vulns=$(jq -r '.scan_results.snyk.vulnerabilities.critical + .scan_results.trivy.vulnerabilities.critical' "$JSON_REPORT" 2>/dev/null || echo "0")
    local high_vulns=$(jq -r '.scan_results.snyk.vulnerabilities.high + .scan_results.trivy.vulnerabilities.high' "$JSON_REPORT" 2>/dev/null || echo "0")
    local secrets=$(jq -r '.scan_results.trivy.secrets' "$JSON_REPORT" 2>/dev/null || echo "0")
    local gatekeeper_violations=$(jq -r '.scan_results.gatekeeper.violations' "$JSON_REPORT" 2>/dev/null || echo "0")
    
    if [ "$critical_vulns" -gt 0 ]; then
        recommendations+=("Address $critical_vulns critical vulnerabilities immediately")
    fi
    
    if [ "$high_vulns" -gt 5 ]; then
        recommendations+=("Prioritize fixing $high_vulns high severity vulnerabilities")
    fi
    
    if [ "$secrets" -gt 0 ]; then
        recommendations+=("Remove $secrets exposed secrets from code and containers")
    fi
    
    if [ "$gatekeeper_violations" -gt 0 ]; then
        recommendations+=("Fix $gatekeeper_violations policy violations")
    fi
    
    # Add general recommendations
    recommendations+=("Implement regular security scanning in CI/CD pipeline")
    recommendations+=("Enable automatic dependency updates")
    recommendations+=("Conduct regular security audits")
    recommendations+=("Implement least privilege access controls")
    
    # Update JSON report with recommendations
    local recommendations_json=$(printf '%s\n' "${recommendations[@]}" | jq -R . | jq -s .)
    jq --argjson recs "$recommendations_json" '.summary.recommendations = $recs' \
       "$JSON_REPORT" > "$JSON_REPORT.tmp" && mv "$JSON_REPORT.tmp" "$JSON_REPORT"
}

# Main execution
main() {
    log "Starting comprehensive security analysis..."
    
    # Run all security checks
    local sonar_issues=$(analyze_sonarqube)
    local snyk_results=($(analyze_snyk))
    local trivy_results=($(analyze_trivy))
    local gatekeeper_violations=$(check_gatekeeper_compliance)
    local network_policy_info=($(check_network_policies))
    local risky_rbac=$(check_rbac)
    
    # Calculate totals
    local total_critical=$((${snyk_results[0]:-0} + ${trivy_results[0]:-0}))
    local total_high=$((${snyk_results[1]:-0} + ${trivy_results[1]:-0}))
    local total_medium=$((${snyk_results[2]:-0} + ${trivy_results[2]:-0}))
    local total_low=$((${snyk_results[3]:-0} + ${trivy_results[3]:-0}))
    local total_secrets=${trivy_results[4]:-0}
    
    # Update vulnerability totals in JSON
    jq --arg critical "$total_critical" \
       --arg high "$total_high" \
       --arg medium "$total_medium" \
       --arg low "$total_low" \
       '.vulnerabilities = {
         "critical": ($critical | tonumber),
         "high": ($high | tonumber),
         "medium": ($medium | tonumber),
         "low": ($low | tonumber)
       }' \
       "$JSON_REPORT" > "$JSON_REPORT.tmp" && mv "$JSON_REPORT.tmp" "$JSON_REPORT"
    
    # Calculate risk level
    local risk_level=$(calculate_risk_level "$total_critical" "$total_high" "$total_secrets" "$gatekeeper_violations" "$risky_rbac")
    
    # Determine overall status
    local overall_status="pass"
    if [ "$total_critical" -gt 0 ] || [ "$total_secrets" -gt 0 ]; then
        overall_status="fail"
    elif [ "$total_high" -gt 5 ] || [ "$gatekeeper_violations" -gt 0 ]; then
        overall_status="warning"
    fi
    
    # Update summary in JSON
    jq --arg status "$overall_status" \
       --arg risk "$risk_level" \
       '.summary.overall_status = $status | .summary.risk_level = $risk' \
       "$JSON_REPORT" > "$JSON_REPORT.tmp" && mv "$JSON_REPORT.tmp" "$JSON_REPORT"
    
    # Generate recommendations
    generate_recommendations
    
    # Generate markdown report
    generate_markdown_report
    
    log "Security report generated successfully:"
    info "Markdown report: $REPORT_FILE"
    info "JSON report: $JSON_REPORT"
    
    # Print summary
    echo
    echo "=== SECURITY SUMMARY ==="
    echo "Overall Status: $overall_status"
    echo "Risk Level: $risk_level"
    echo "Critical Vulnerabilities: $total_critical"
    echo "High Vulnerabilities: $total_high"
    echo "Secrets Found: $total_secrets"
    echo "Policy Violations: $gatekeeper_violations"
    echo "========================"
}

# Function to generate markdown report
generate_markdown_report() {
    cat > "$REPORT_FILE" << EOF
# AI Development Platform Security Report

**Generated:** $(date)
**Environment:** ${ENVIRONMENT:-development}
**Cluster:** ${CLUSTER_NAME:-ai-dev-platform}
**Region:** ${AWS_REGION:-us-west-2}

## Executive Summary

$(jq -r '.summary | "**Overall Status:** " + .overall_status + "\n**Risk Level:** " + .risk_level' "$JSON_REPORT")

## Vulnerability Summary

| Severity | Count |
|----------|-------|
$(jq -r '.vulnerabilities | "| Critical | " + (.critical | tostring) + " |"' "$JSON_REPORT")
$(jq -r '.vulnerabilities | "| High | " + (.high | tostring) + " |"' "$JSON_REPORT")
$(jq -r '.vulnerabilities | "| Medium | " + (.medium | tostring) + " |"' "$JSON_REPORT")
$(jq -r '.vulnerabilities | "| Low | " + (.low | tostring) + " |"' "$JSON_REPORT")

## Scan Results

### SonarQube SAST
$(jq -r '.scan_results.sonarqube | "- Status: " + .status + "\n- Issues: " + (.issues | tostring)' "$JSON_REPORT")

### Snyk Dependency Scanning
$(jq -r '.scan_results.snyk | "- Status: " + .status + "\n- Critical: " + (.vulnerabilities.critical | tostring) + "\n- High: " + (.vulnerabilities.high | tostring)' "$JSON_REPORT")

### Trivy Container Scanning
$(jq -r '.scan_results.trivy | "- Status: " + .status + "\n- Critical: " + (.vulnerabilities.critical | tostring) + "\n- High: " + (.vulnerabilities.high | tostring) + "\n- Secrets: " + (.secrets | tostring) + "\n- Misconfigurations: " + (.misconfigurations | tostring)' "$JSON_REPORT")

### Policy Compliance (Gatekeeper)
$(jq -r '.scan_results.gatekeeper | "- Status: " + .status + "\n- Violations: " + (.violations | tostring)' "$JSON_REPORT")

### Network Security
$(jq -r '.scan_results.network_policies | "- Policies: " + (.count | tostring) + "\n- Coverage: " + .coverage' "$JSON_REPORT")

### RBAC Configuration
$(jq -r '.scan_results.rbac | "- Roles: " + (.roles | tostring) + "\n- Cluster Roles: " + (.cluster_roles | tostring) + "\n- Risky Bindings: " + (.risky_bindings | tostring)' "$JSON_REPORT")

## Recommendations

$(jq -r '.summary.recommendations[] | "- " + .' "$JSON_REPORT")

## Detailed Findings

For detailed vulnerability information, please refer to the individual scan reports:
- SonarQube: security/reports/sonarqube/
- Snyk: security/reports/snyk/
- Trivy: security/reports/trivy/

## Next Steps

1. **Immediate Actions:**
   - Address all critical vulnerabilities
   - Remove any exposed secrets
   - Fix policy violations

2. **Short-term (1 week):**
   - Address high severity vulnerabilities
   - Implement missing security controls
   - Update security policies

3. **Long-term (1 month):**
   - Establish regular security scanning
   - Implement automated remediation
   - Conduct security training

## Contact Information

- Security Team: security@company.com
- DevOps Team: devops@company.com
- Emergency: security-incident@company.com

---
*This report was generated automatically by the AI Development Platform security scanner.*
EOF
}

# Execute main function
main "$@"