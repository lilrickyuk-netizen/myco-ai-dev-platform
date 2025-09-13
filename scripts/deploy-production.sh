#!/bin/bash
set -e

# Myco Platform Production Deployment Script
# This script handles the complete production deployment process

echo "🚀 Myco Platform Production Deployment"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT="${ENVIRONMENT:-production}"
AWS_REGION="${AWS_REGION:-us-west-2}"
CLUSTER_NAME="myco-platform-${ENVIRONMENT}"
NAMESPACE="myco-platform"
IMAGE_TAG="${IMAGE_TAG:-latest}"
TERRAFORM_STATE_BUCKET="myco-platform-terraform-state"

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check required tools
    local required_tools=("aws" "kubectl" "terraform" "docker" "helm")
    
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" >/dev/null 2>&1; then
            log_error "$tool is required but not installed"
            exit 1
        fi
    done
    
    # Check AWS credentials
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        log_error "AWS credentials not configured"
        exit 1
    fi
    
    # Check Docker is running
    if ! docker ps >/dev/null 2>&1; then
        log_error "Docker is not running"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Function to build and push Docker images
build_and_push_images() {
    log_info "Building and pushing Docker images..."
    
    # Get AWS account ID
    AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
    
    # Login to ECR
    aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$ECR_REGISTRY"
    
    # List of services to build
    local services=("backend" "frontend" "ai-engine" "execution-engine")
    
    for service in "${services[@]}"; do
        if [ -d "$service" ]; then
            log_info "Building $service image..."
            
            # Create ECR repository if it doesn't exist
            aws ecr describe-repositories --repository-names "myco-platform/$service" --region "$AWS_REGION" >/dev/null 2>&1 || \
                aws ecr create-repository --repository-name "myco-platform/$service" --region "$AWS_REGION"
            
            # Build image
            docker build -t "$service:$IMAGE_TAG" "$service/"
            
            # Tag for ECR
            docker tag "$service:$IMAGE_TAG" "$ECR_REGISTRY/myco-platform/$service:$IMAGE_TAG"
            
            # Push to ECR
            docker push "$ECR_REGISTRY/myco-platform/$service:$IMAGE_TAG"
            
            log_success "$service image pushed to ECR"
        else
            log_warning "$service directory not found, skipping"
        fi
    done
    
    log_success "All images built and pushed successfully"
}

# Function to deploy infrastructure with Terraform
deploy_infrastructure() {
    log_info "Deploying infrastructure with Terraform..."
    
    cd infrastructure/terraform
    
    # Initialize Terraform
    terraform init \
        -backend-config="bucket=$TERRAFORM_STATE_BUCKET" \
        -backend-config="key=infrastructure/terraform.tfstate" \
        -backend-config="region=$AWS_REGION"
    
    # Plan deployment
    terraform plan \
        -var="environment=$ENVIRONMENT" \
        -var="aws_region=$AWS_REGION" \
        -out=tfplan
    
    # Apply deployment
    terraform apply tfplan
    
    # Get outputs
    EKS_CLUSTER_ENDPOINT=$(terraform output -raw cluster_endpoint)
    EKS_CLUSTER_NAME=$(terraform output -raw cluster_name)
    RDS_ENDPOINT=$(terraform output -raw rds_endpoint)
    REDIS_ENDPOINT=$(terraform output -raw redis_endpoint)
    
    log_success "Infrastructure deployed successfully"
    
    cd ../..
}

# Function to configure kubectl
configure_kubectl() {
    log_info "Configuring kubectl..."
    
    # Update kubeconfig
    aws eks update-kubeconfig \
        --region "$AWS_REGION" \
        --name "$EKS_CLUSTER_NAME"
    
    # Verify connection
    if kubectl cluster-info >/dev/null 2>&1; then
        log_success "kubectl configured successfully"
    else
        log_error "Failed to configure kubectl"
        exit 1
    fi
}

# Function to install Helm charts
install_helm_charts() {
    log_info "Installing Helm charts..."
    
    # Add required Helm repositories
    helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
    helm repo add cert-manager https://charts.jetstack.io
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo add grafana https://grafana.github.io/helm-charts
    helm repo update
    
    # Create namespace
    kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
    
    # Install NGINX Ingress Controller
    helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
        --namespace ingress-nginx \
        --create-namespace \
        --set controller.metrics.enabled=true \
        --set controller.podAnnotations."prometheus\.io/scrape"="true" \
        --set controller.podAnnotations."prometheus\.io/port"="10254"
    
    # Install cert-manager for TLS certificates
    helm upgrade --install cert-manager cert-manager/cert-manager \
        --namespace cert-manager \
        --create-namespace \
        --set installCRDs=true
    
    # Install Prometheus monitoring
    helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
        --namespace monitoring \
        --create-namespace \
        --set grafana.adminPassword="admin123" \
        --set prometheus.prometheusSpec.retention="30d"
    
    log_success "Helm charts installed successfully"
}

# Function to deploy Kubernetes manifests
deploy_kubernetes_manifests() {
    log_info "Deploying Kubernetes manifests..."
    
    cd infrastructure/kubernetes
    
    # Update image tags in manifests
    AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
    
    # Apply namespace
    kubectl apply -f namespace.yaml
    
    # Apply database manifests
    kubectl apply -f postgres.yaml
    kubectl apply -f redis.yaml
    kubectl apply -f mongodb.yaml
    
    # Create secrets for database passwords
    kubectl create secret generic postgres-secret \
        --from-literal=POSTGRES_PASSWORD="$(openssl rand -base64 32)" \
        --namespace="$NAMESPACE" \
        --dry-run=client -o yaml | kubectl apply -f -
    
    # Apply application manifests
    for manifest in *.yaml; do
        if [[ "$manifest" != "namespace.yaml" && "$manifest" != "postgres.yaml" && "$manifest" != "redis.yaml" && "$manifest" != "mongodb.yaml" ]]; then
            # Replace image placeholders
            sed "s|{{ECR_REGISTRY}}|$ECR_REGISTRY|g; s|{{IMAGE_TAG}}|$IMAGE_TAG|g" "$manifest" | kubectl apply -f -
        fi
    done
    
    log_success "Kubernetes manifests deployed successfully"
    
    cd ../..
}

# Function to setup monitoring and logging
setup_monitoring() {
    log_info "Setting up monitoring and logging..."
    
    # Deploy application-specific monitoring configs
    kubectl apply -f monitoring/ -n "$NAMESPACE" || true
    
    # Create Grafana dashboards
    kubectl create configmap grafana-dashboards \
        --from-file=monitoring/grafana/dashboards/ \
        -n monitoring \
        --dry-run=client -o yaml | kubectl apply -f -
    
    log_success "Monitoring and logging setup complete"
}

# Function to run health checks
run_health_checks() {
    log_info "Running health checks..."
    
    # Wait for deployments to be ready
    kubectl wait --for=condition=available deployment --all -n "$NAMESPACE" --timeout=600s
    
    # Check pod status
    kubectl get pods -n "$NAMESPACE"
    
    # Check services
    kubectl get services -n "$NAMESPACE"
    
    # Check ingress
    kubectl get ingress -n "$NAMESPACE"
    
    # Test application endpoints
    INGRESS_IP=$(kubectl get service ingress-nginx-controller -n ingress-nginx -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
    
    if [ -n "$INGRESS_IP" ]; then
        log_info "Application will be available at: https://$INGRESS_IP"
        
        # Wait for ingress to be ready
        sleep 30
        
        # Test health endpoint
        if curl -f "http://$INGRESS_IP/health" >/dev/null 2>&1; then
            log_success "Health check passed"
        else
            log_warning "Health check failed - application may still be starting"
        fi
    fi
    
    log_success "Health checks complete"
}

# Function to setup CI/CD
setup_cicd() {
    log_info "Setting up CI/CD pipeline..."
    
    # Create GitHub Actions secrets (if using GitHub)
    if [ -f ".github/workflows/deploy.yml" ]; then
        log_info "GitHub Actions workflow detected"
        echo "Please add the following secrets to your GitHub repository:"
        echo "- AWS_ACCESS_KEY_ID"
        echo "- AWS_SECRET_ACCESS_KEY"
        echo "- AWS_REGION"
        echo "- EKS_CLUSTER_NAME"
    fi
    
    # Setup ArgoCD (if using GitOps)
    if command -v argocd >/dev/null 2>&1; then
        log_info "Setting up ArgoCD for GitOps..."
        
        # Install ArgoCD
        kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f -
        kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
        
        # Wait for ArgoCD to be ready
        kubectl wait --for=condition=available deployment argocd-server -n argocd --timeout=600s
        
        log_success "ArgoCD installed"
    fi
}

# Function to backup and restore procedures
setup_backup() {
    log_info "Setting up backup procedures..."
    
    # Create backup CronJob for databases
    cat <<EOF | kubectl apply -f -
apiVersion: batch/v1
kind: CronJob
metadata:
  name: database-backup
  namespace: $NAMESPACE
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: postgres:15-alpine
            command:
            - /bin/bash
            - -c
            - |
              pg_dump \$DATABASE_URL > /backup/db-backup-\$(date +%Y%m%d-%H%M%S).sql
              aws s3 cp /backup/db-backup-*.sql s3://myco-platform-backups/
            env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: postgres-secret
                  key: DATABASE_URL
            volumeMounts:
            - name: backup-storage
              mountPath: /backup
          volumes:
          - name: backup-storage
            emptyDir: {}
          restartPolicy: OnFailure
EOF
    
    log_success "Backup procedures configured"
}

# Function to setup security
setup_security() {
    log_info "Setting up security configurations..."
    
    # Install network policies
    kubectl apply -f security/network-policies/ -n "$NAMESPACE" || true
    
    # Install Pod Security Standards
    kubectl label namespace "$NAMESPACE" \
        pod-security.kubernetes.io/enforce=restricted \
        pod-security.kubernetes.io/audit=restricted \
        pod-security.kubernetes.io/warn=restricted
    
    # Install OPA Gatekeeper (if available)
    if kubectl get crd configs.config.gatekeeper.sh >/dev/null 2>&1; then
        kubectl apply -f security/gatekeeper/ || true
    fi
    
    log_success "Security configurations applied"
}

# Function to display deployment summary
show_deployment_summary() {
    echo ""
    echo "🎉 Production Deployment Complete!"
    echo "================================="
    echo ""
    echo "Deployment Summary:"
    echo "- Environment: $ENVIRONMENT"
    echo "- Region: $AWS_REGION"
    echo "- Cluster: $EKS_CLUSTER_NAME"
    echo "- Namespace: $NAMESPACE"
    echo "- Image Tag: $IMAGE_TAG"
    echo ""
    
    # Get service endpoints
    echo "Service Endpoints:"
    kubectl get ingress -n "$NAMESPACE" -o custom-columns=NAME:.metadata.name,HOSTS:.spec.rules[*].host,ADDRESS:.status.loadBalancer.ingress[*].hostname --no-headers | while read line; do
        echo "  $line"
    done
    echo ""
    
    echo "Monitoring:"
    GRAFANA_URL=$(kubectl get ingress grafana -n monitoring -o jsonpath='{.spec.rules[0].host}' 2>/dev/null || echo "Not configured")
    echo "  Grafana: https://$GRAFANA_URL"
    echo "  Username: admin"
    echo "  Password: admin123"
    echo ""
    
    echo "Next Steps:"
    echo "1. Configure DNS records for your domains"
    echo "2. Update TLS certificates"
    echo "3. Configure backup retention policies"
    echo "4. Set up alerting rules"
    echo "5. Review security configurations"
    echo ""
    
    log_success "Deployment completed successfully! 🚀"
}

# Main deployment process
main() {
    log_info "Starting production deployment..."
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            --region)
                AWS_REGION="$2"
                shift 2
                ;;
            --image-tag)
                IMAGE_TAG="$2"
                shift 2
                ;;
            --skip-build)
                SKIP_BUILD=true
                shift
                ;;
            --skip-infrastructure)
                SKIP_INFRASTRUCTURE=true
                shift
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Run deployment steps
    check_prerequisites
    
    if [ "$SKIP_BUILD" != "true" ]; then
        build_and_push_images
    fi
    
    if [ "$SKIP_INFRASTRUCTURE" != "true" ]; then
        deploy_infrastructure
    fi
    
    configure_kubectl
    install_helm_charts
    deploy_kubernetes_manifests
    setup_monitoring
    setup_security
    setup_backup
    setup_cicd
    run_health_checks
    show_deployment_summary
}

# Run main function with all arguments
main "$@"