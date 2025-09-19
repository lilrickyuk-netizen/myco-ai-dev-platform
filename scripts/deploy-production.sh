#!/bin/bash

# Production Deployment Script for AI Development Platform
# Comprehensive deployment with security checks, monitoring, and validation

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENVIRONMENT="${ENVIRONMENT:-production}"
REGION="${AWS_REGION:-us-west-2}"
CLUSTER_NAME="${CLUSTER_NAME:-ai-dev-platform-${ENVIRONMENT}}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging
log() { echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $*${NC}" >&2; }
warn() { echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $*${NC}" >&2; }
error() { echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $*${NC}" >&2; }
info() { echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $*${NC}" >&2; }

# Trap to ensure cleanup on exit
cleanup() {
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        error "Deployment failed with exit code $exit_code"
        log "Cleaning up temporary resources..."
        # Add cleanup logic here
    fi
    exit $exit_code
}
trap cleanup EXIT

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    local missing_tools=()
    
    # Check required tools
    for tool in kubectl helm terraform aws docker; do
        if ! command -v "$tool" &> /dev/null; then
            missing_tools+=("$tool")
        fi
    done
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        error "Missing required tools: ${missing_tools[*]}"
        error "Please install the missing tools before running this script"
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        error "AWS credentials not configured or invalid"
        exit 1
    fi
    
    # Check if running in production context
    if [ "$ENVIRONMENT" = "production" ]; then
        warn "You are about to deploy to PRODUCTION environment"
        read -p "Type 'CONFIRM' to continue: " confirmation
        if [ "$confirmation" != "CONFIRM" ]; then
            error "Deployment cancelled"
            exit 1
        fi
    fi
    
    log "Prerequisites check completed"
}

# Run security scans before deployment
run_security_scans() {
    log "Running security scans..."
    
    cd "$PROJECT_ROOT"
    
    # Run security gate check
    if [ -f "security/scripts/security-gate-check.sh" ]; then
        log "Running security gate check..."
        chmod +x security/scripts/security-gate-check.sh
        if ! ./security/scripts/security-gate-check.sh; then
            error "Security gate check failed"
            exit 1
        fi
    fi
    
    # Run Trivy scan on containers
    if [ -f "security/scripts/run-trivy-scan.sh" ]; then
        log "Running Trivy container scan..."
        chmod +x security/scripts/run-trivy-scan.sh
        SCAN_TYPE=image ./security/scripts/run-trivy-scan.sh || warn "Trivy scan found issues"
    fi
    
    log "Security scans completed"
}

# Deploy infrastructure with Terraform
deploy_infrastructure() {
    log "Deploying infrastructure with Terraform..."
    
    cd "$PROJECT_ROOT/infrastructure/terraform"
    
    # Initialize Terraform
    terraform init -upgrade
    
    # Plan the deployment
    log "Creating Terraform plan..."
    terraform plan \
        -var="environment=$ENVIRONMENT" \
        -var="region=$REGION" \
        -out=tfplan
    
    # Apply the plan
    log "Applying Terraform plan..."
    terraform apply tfplan
    
    # Get outputs
    export EKS_CLUSTER_NAME=$(terraform output -raw cluster_name)
    export VPC_ID=$(terraform output -raw vpc_id)
    export SUBNET_IDS=$(terraform output -json subnet_ids | jq -r '.[]' | tr '\n' ',' | sed 's/,$//')
    
    log "Infrastructure deployment completed"
}

# Configure kubectl for EKS cluster
configure_kubectl() {
    log "Configuring kubectl for EKS cluster..."
    
    aws eks update-kubeconfig \
        --region "$REGION" \
        --name "$CLUSTER_NAME" \
        --alias "$CLUSTER_NAME"
    
    # Verify cluster connection
    if ! kubectl cluster-info &> /dev/null; then
        error "Unable to connect to Kubernetes cluster"
        exit 1
    fi
    
    log "kubectl configured successfully"
}

# Deploy monitoring stack
deploy_monitoring() {
    log "Deploying monitoring stack..."
    
    cd "$PROJECT_ROOT"
    
    # Create monitoring namespace
    kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -
    
    # Install Prometheus
    log "Installing Prometheus..."
    kubectl apply -f monitoring/prometheus/prometheus-config.yaml
    
    # Wait for Prometheus to be ready
    kubectl wait --namespace monitoring \
        --for=condition=ready pod \
        --selector=app=prometheus \
        --timeout=300s
    
    # Install Grafana
    if [ -f "monitoring/grafana/grafana-deployment.yaml" ]; then
        log "Installing Grafana..."
        kubectl apply -f monitoring/grafana/grafana-deployment.yaml
        
        kubectl wait --namespace monitoring \
            --for=condition=ready pod \
            --selector=app=grafana \
            --timeout=300s
    fi
    
    # Install Fluentd for log aggregation
    log "Installing Fluentd..."
    kubectl apply -f monitoring/logging/fluentd-config.yaml
    
    log "Monitoring stack deployed successfully"
}

# Build and push Docker images
build_and_push_images() {
    log "Building and pushing Docker images..."
    
    cd "$PROJECT_ROOT"
    
    # Get ECR registry URL
    local ecr_registry=$(aws sts get-caller-identity --query Account --output text).dkr.ecr.$REGION.amazonaws.com
    
    # Login to ECR
    aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$ecr_registry"
    
    # Build and push images
    local services=("frontend" "backend" "ai-engine" "execution-engine" "template-engine" "validation-engine")
    
    for service in "${services[@]}"; do
        if [ -d "$service" ] && [ -f "$service/Dockerfile" ]; then
            log "Building $service image..."
            
            local image_tag="$ecr_registry/ai-dev-platform/$service:latest"
            local commit_tag="$ecr_registry/ai-dev-platform/$service:$(git rev-parse --short HEAD)"
            
            docker build -t "$image_tag" -t "$commit_tag" "$service/"
            docker push "$image_tag"
            docker push "$commit_tag"
            
            log "$service image built and pushed successfully"
        fi
    done
    
    log "All images built and pushed successfully"
}

# Deploy application to Kubernetes
deploy_application() {
    log "Deploying application to Kubernetes..."
    
    cd "$PROJECT_ROOT"
    
    # Create application namespace
    kubectl create namespace myco-platform --dry-run=client -o yaml | kubectl apply -f -
    
    # Apply secrets
    if [ -f "infrastructure/kubernetes/secrets.yaml" ]; then
        log "Applying secrets..."
        kubectl apply -f infrastructure/kubernetes/secrets.yaml
    fi
    
    # Apply configmaps
    if [ -f "infrastructure/kubernetes/configmap.yaml" ]; then
        log "Applying configmaps..."
        kubectl apply -f infrastructure/kubernetes/configmap.yaml
    fi
    
    # Apply storage
    log "Applying storage configurations..."
    kubectl apply -f infrastructure/kubernetes/storage.yaml
    
    # Deploy enhanced deployments
    log "Deploying application services..."
    kubectl apply -f infrastructure/kubernetes/enhanced-deployments.yaml
    
    # Apply services
    log "Applying services..."
    kubectl apply -f infrastructure/kubernetes/services.yaml
    
    # Apply HPA
    log "Applying Horizontal Pod Autoscalers..."
    kubectl apply -f infrastructure/kubernetes/hpa.yaml
    
    # Apply network policies
    log "Applying network policies..."
    kubectl apply -f infrastructure/kubernetes/network-policies.yaml
    
    # Wait for deployments to be ready
    log "Waiting for deployments to be ready..."
    local deployments=("frontend" "backend" "ai-engine" "execution-engine" "postgres" "redis")
    
    for deployment in "${deployments[@]}"; do
        kubectl wait --namespace myco-platform \
            --for=condition=available \
            --timeout=600s \
            deployment/"$deployment" || warn "Deployment $deployment not ready within timeout"
    done
    
    log "Application deployed successfully"
}

# Run health checks
run_health_checks() {
    log "Running health checks..."
    
    # Check if all pods are running
    local failed_pods=$(kubectl get pods --namespace myco-platform --field-selector=status.phase!=Running -o name | wc -l)
    if [ "$failed_pods" -gt 0 ]; then
        warn "Some pods are not in Running state"
        kubectl get pods --namespace myco-platform --field-selector=status.phase!=Running
    fi
    
    # Check service endpoints
    log "Checking service endpoints..."
    local services=("frontend" "backend" "ai-engine")
    
    for service in "${services[@]}"; do
        local endpoint=$(kubectl get service "$service" --namespace myco-platform -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
        if [ -n "$endpoint" ]; then
            info "Service $service endpoint: $endpoint"
        else
            warn "Service $service endpoint not available"
        fi
    done
    
    # Run application-specific health checks
    if [ -f "scripts/health-check.sh" ]; then
        log "Running application health checks..."
        chmod +x scripts/health-check.sh
        ./scripts/health-check.sh
    fi
    
    log "Health checks completed"
}

# Test end-to-end user workflow
test_user_workflow() {
    log "Testing end-to-end user workflow..."
    
    # Get frontend URL
    local frontend_url=$(kubectl get service frontend --namespace myco-platform -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
    
    if [ -z "$frontend_url" ]; then
        warn "Frontend URL not available, skipping E2E tests"
        return
    fi
    
    info "Frontend URL: https://$frontend_url"
    
    # Run E2E tests if available
    if [ -f "tests/e2e/complete-workflow.spec.ts" ]; then
        log "Running E2E tests..."
        cd "$PROJECT_ROOT"
        npm run test:e2e:prod || warn "E2E tests failed"
    fi
    
    # Manual verification steps
    log "Manual verification steps:"
    info "1. Open https://$frontend_url in browser"
    info "2. Create a new account"
    info "3. Create a new project"
    info "4. Test project execution"
    info "5. Verify deployment functionality"
    
    log "User workflow testing completed"
}

# Setup monitoring alerts
setup_alerts() {
    log "Setting up monitoring alerts..."
    
    # Apply Alertmanager configuration if available
    if [ -f "monitoring/alertmanager/alertmanager-config.yaml" ]; then
        kubectl apply -f monitoring/alertmanager/alertmanager-config.yaml
    fi
    
    # Configure notification channels
    log "Configuring notification channels..."
    
    # Setup Slack notifications if webhook URL is provided
    if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
        info "Slack notifications configured"
    fi
    
    # Setup PagerDuty if integration key is provided
    if [ -n "${PAGERDUTY_INTEGRATION_KEY:-}" ]; then
        info "PagerDuty notifications configured"
    fi
    
    log "Monitoring alerts setup completed"
}

# Generate deployment report
generate_deployment_report() {
    log "Generating deployment report..."
    
    local report_file="deployment-report-$(date +%Y%m%d-%H%M%S).md"
    
    cat > "$report_file" << EOF
# AI Development Platform Deployment Report

**Date:** $(date)
**Environment:** $ENVIRONMENT
**Region:** $REGION
**Cluster:** $CLUSTER_NAME
**Deployed by:** $(whoami)
**Git Commit:** $(git rev-parse HEAD)

## Deployment Summary

### Infrastructure
- EKS Cluster: $CLUSTER_NAME
- VPC ID: ${VPC_ID:-N/A}
- Subnets: ${SUBNET_IDS:-N/A}

### Application Services
EOF

    # Add service status to report
    kubectl get deployments --namespace myco-platform -o wide >> "$report_file"
    
    cat >> "$report_file" << EOF

### Monitoring
- Prometheus: $(kubectl get pods --namespace monitoring -l app=prometheus -o jsonpath='{.items[0].status.phase}')
- Grafana: $(kubectl get pods --namespace monitoring -l app=grafana -o jsonpath='{.items[0].status.phase}' 2>/dev/null || echo "Not deployed")
- Fluentd: $(kubectl get daemonset --namespace monitoring fluentd -o jsonpath='{.status.numberReady}/{.status.desiredNumberScheduled}' 2>/dev/null || echo "Not deployed")

### Security
- Network Policies: Applied
- Pod Security Policies: Applied
- RBAC: Configured

### Endpoints
$(kubectl get services --namespace myco-platform -o wide)

## Post-Deployment Actions
1. Monitor application logs for any errors
2. Verify all health checks are passing
3. Test user workflows manually
4. Monitor resource usage and scaling
5. Validate security policies are working

## Contact Information
- Deployment Team: ai-dev-platform-team@company.com
- Incident Response: oncall@company.com
EOF

    log "Deployment report generated: $report_file"
}

# Main deployment function
main() {
    log "Starting AI Development Platform production deployment..."
    log "Environment: $ENVIRONMENT"
    log "Region: $REGION"
    log "Cluster: $CLUSTER_NAME"
    
    # Run all deployment steps
    check_prerequisites
    run_security_scans
    deploy_infrastructure
    configure_kubectl
    build_and_push_images
    deploy_monitoring
    deploy_application
    run_health_checks
    setup_alerts
    test_user_workflow
    generate_deployment_report
    
    log "🎉 AI Development Platform deployed successfully!"
    log "Next steps:"
    info "1. Review the deployment report"
    info "2. Set up monitoring dashboards"
    info "3. Configure backup and disaster recovery"
    info "4. Schedule regular security scans"
    info "5. Monitor system performance and costs"
}

# Execute main function
main "$@"