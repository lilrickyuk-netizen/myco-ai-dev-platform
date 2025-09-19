# Enhanced Terraform Variables for AI Development Platform

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "region" {
  description = "AWS region"
  type        = string
  default     = "us-west-2"
}

variable "gcp_project_id" {
  description = "Google Cloud Project ID for multi-cloud deployment"
  type        = string
  default     = ""
}

variable "gcp_region" {
  description = "Google Cloud region"
  type        = string
  default     = "us-west2"
}

variable "owner" {
  description = "Owner tag for resources"
  type        = string
  default     = "ai-dev-platform-team"
}

# Network Configuration
variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
  default     = ["10.0.10.0/24", "10.0.20.0/24", "10.0.30.0/24"]
}

# EKS Cluster Configuration
variable "kubernetes_version" {
  description = "Kubernetes version for EKS cluster"
  type        = string
  default     = "1.28"
}

variable "cluster_endpoint_public_access" {
  description = "Enable public access to EKS cluster endpoint"
  type        = bool
  default     = true
}

variable "cluster_endpoint_public_access_cidrs" {
  description = "CIDR blocks that can access the public EKS cluster endpoint"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "ssh_key_name" {
  description = "AWS Key Pair name for SSH access to worker nodes"
  type        = string
  default     = ""
}

# Node Group Configuration
variable "node_instance_types" {
  description = "EC2 instance types for general node group"
  type        = list(string)
  default     = ["t3.large", "t3.xlarge"]
}

variable "compute_instance_types" {
  description = "EC2 instance types for compute-intensive workloads"
  type        = list(string)
  default     = ["c5.2xlarge", "c5.4xlarge"]
}

variable "min_nodes" {
  description = "Minimum number of nodes in general node group"
  type        = number
  default     = 2
}

variable "max_nodes" {
  description = "Maximum number of nodes in general node group"
  type        = number
  default     = 10
}

variable "desired_nodes" {
  description = "Desired number of nodes in general node group"
  type        = number
  default     = 3
}

variable "max_compute_nodes" {
  description = "Maximum number of compute nodes"
  type        = number
  default     = 5
}

variable "desired_compute_nodes" {
  description = "Desired number of compute nodes"
  type        = number
  default     = 0
}

# RDS Configuration
variable "use_rds" {
  description = "Whether to create RDS instance"
  type        = bool
  default     = true
}

variable "postgres_version" {
  description = "PostgreSQL version for RDS"
  type        = string
  default     = "15.4"
}

variable "rds_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.medium"
}

variable "rds_allocated_storage" {
  description = "Initial allocated storage for RDS (GB)"
  type        = number
  default     = 100
}

variable "rds_max_allocated_storage" {
  description = "Maximum allocated storage for RDS (GB)"
  type        = number
  default     = 1000
}

variable "database_name" {
  description = "Name of the database"
  type        = string
  default     = "aidevplatform"
}

variable "database_username" {
  description = "Username for the database"
  type        = string
  default     = "postgres"
}

variable "backup_retention_period" {
  description = "Database backup retention period (days)"
  type        = number
  default     = 7
}

variable "backup_window" {
  description = "Database backup window"
  type        = string
  default     = "07:00-09:00"
}

variable "maintenance_window" {
  description = "Database maintenance window"
  type        = string
  default     = "sun:05:00-sun:07:00"
}

variable "deletion_protection" {
  description = "Enable deletion protection for RDS"
  type        = bool
  default     = true
}

# ElastiCache Configuration
variable "use_elasticache" {
  description = "Whether to create ElastiCache cluster"
  type        = bool
  default     = true
}

variable "redis_node_type" {
  description = "ElastiCache Redis node type"
  type        = string
  default     = "cache.t3.medium"
}

variable "redis_num_cache_nodes" {
  description = "Number of cache nodes in Redis cluster"
  type        = number
  default     = 2
}

# Load Balancer Configuration
variable "alb_deletion_protection" {
  description = "Enable deletion protection for ALB"
  type        = bool
  default     = false
}

# ECR Configuration
variable "ecr_repositories" {
  description = "List of ECR repositories to create"
  type        = list(string)
  default     = ["frontend", "backend", "ai-engine", "execution-engine", "template-engine", "validation-engine"]
}

# Monitoring Configuration
variable "log_retention_days" {
  description = "CloudWatch log retention period (days)"
  type        = number
  default     = 30
}

variable "enable_monitoring" {
  description = "Enable comprehensive monitoring stack"
  type        = bool
  default     = true
}

variable "enable_prometheus" {
  description = "Enable Prometheus monitoring"
  type        = bool
  default     = true
}

variable "enable_grafana" {
  description = "Enable Grafana dashboards"
  type        = bool
  default     = true
}

variable "enable_fluentd" {
  description = "Enable Fluentd for log aggregation"
  type        = bool
  default     = true
}

# Security Configuration
variable "enable_pod_security_policy" {
  description = "Enable Pod Security Policy"
  type        = bool
  default     = true
}

variable "enable_network_policy" {
  description = "Enable Network Policy"
  type        = bool
  default     = true
}

variable "enable_encryption_at_rest" {
  description = "Enable encryption at rest for all supported services"
  type        = bool
  default     = true
}

variable "enable_encryption_in_transit" {
  description = "Enable encryption in transit for all supported services"
  type        = bool
  default     = true
}

# Backup and Disaster Recovery
variable "enable_cross_region_backup" {
  description = "Enable cross-region backup for critical data"
  type        = bool
  default     = false
}

variable "backup_region" {
  description = "Secondary region for backups"
  type        = string
  default     = "us-east-1"
}

# Auto Scaling Configuration
variable "enable_cluster_autoscaler" {
  description = "Enable Kubernetes Cluster Autoscaler"
  type        = bool
  default     = true
}

variable "enable_horizontal_pod_autoscaler" {
  description = "Enable Horizontal Pod Autoscaler"
  type        = bool
  default     = true
}

variable "enable_vertical_pod_autoscaler" {
  description = "Enable Vertical Pod Autoscaler"
  type        = bool
  default     = false
}

# Cost Optimization
variable "enable_spot_instances" {
  description = "Enable SPOT instances for cost optimization"
  type        = bool
  default     = true
}

variable "spot_instance_types" {
  description = "EC2 instance types for SPOT instances"
  type        = list(string)
  default     = ["t3.large", "t3.xlarge", "t3.2xlarge"]
}

# Development and Testing
variable "enable_dev_tools" {
  description = "Enable development and debugging tools"
  type        = bool
  default     = false
}

variable "enable_chaos_engineering" {
  description = "Enable Chaos Engineering tools (Chaos Monkey, etc.)"
  type        = bool
  default     = false
}

# External Integrations
variable "enable_external_dns" {
  description = "Enable External DNS for automatic DNS management"
  type        = bool
  default     = true
}

variable "dns_zone_name" {
  description = "DNS zone name for External DNS"
  type        = string
  default     = ""
}

variable "enable_cert_manager" {
  description = "Enable Cert Manager for automatic SSL certificates"
  type        = bool
  default     = true
}

variable "cert_manager_email" {
  description = "Email for Let's Encrypt certificate requests"
  type        = string
  default     = ""
}

# Multi-cloud Configuration
variable "enable_multi_cloud" {
  description = "Enable multi-cloud deployment"
  type        = bool
  default     = false
}

variable "gcp_node_count" {
  description = "Number of nodes in GCP GKE cluster"
  type        = number
  default     = 3
}

variable "gcp_machine_type" {
  description = "Machine type for GCP GKE nodes"
  type        = string
  default     = "n1-standard-4"
}

# Compliance and Governance
variable "enable_compliance_scanning" {
  description = "Enable compliance scanning (CIS benchmarks, etc.)"
  type        = bool
  default     = true
}

variable "enable_policy_enforcement" {
  description = "Enable policy enforcement with OPA Gatekeeper"
  type        = bool
  default     = true
}

variable "compliance_frameworks" {
  description = "List of compliance frameworks to enforce"
  type        = list(string)
  default     = ["CIS", "NIST", "SOC2"]
}

# Performance and Optimization
variable "enable_gpu_nodes" {
  description = "Enable GPU nodes for ML workloads"
  type        = bool
  default     = false
}

variable "gpu_instance_types" {
  description = "EC2 instance types with GPU support"
  type        = list(string)
  default     = ["p3.2xlarge", "p3.8xlarge"]
}

variable "max_gpu_nodes" {
  description = "Maximum number of GPU nodes"
  type        = number
  default     = 2
}

# Notification and Alerting
variable "slack_webhook_url" {
  description = "Slack webhook URL for notifications"
  type        = string
  default     = ""
  sensitive   = true
}

variable "pagerduty_integration_key" {
  description = "PagerDuty integration key for alerts"
  type        = string
  default     = ""
  sensitive   = true
}

variable "email_notifications" {
  description = "List of email addresses for notifications"
  type        = list(string)
  default     = []
}