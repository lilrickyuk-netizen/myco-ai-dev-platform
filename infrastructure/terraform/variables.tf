# General variables
variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "myco-platform"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-west-2"
}

# VPC variables
variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

# EKS variables
variable "kubernetes_version" {
  description = "Kubernetes version"
  type        = string
  default     = "1.28"
}

variable "node_instance_types" {
  description = "List of instance types for the EKS node group"
  type        = list(string)
  default     = ["t3.medium"]
}

variable "node_desired_capacity" {
  description = "Desired number of nodes"
  type        = number
  default     = 2
}

variable "node_max_capacity" {
  description = "Maximum number of nodes"
  type        = number
  default     = 5
}

variable "node_min_capacity" {
  description = "Minimum number of nodes"
  type        = number
  default     = 1
}

# RDS variables
variable "create_rds" {
  description = "Whether to create RDS instance"
  type        = bool
  default     = true
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "db_allocated_storage" {
  description = "The allocated storage in gibibytes"
  type        = number
  default     = 20
}

variable "db_max_allocated_storage" {
  description = "The upper limit to which Amazon RDS can automatically scale the storage"
  type        = number
  default     = 100
}

variable "postgres_version" {
  description = "PostgreSQL version"
  type        = string
  default     = "15.4"
}

variable "db_backup_retention_period" {
  description = "The days to retain backups for"
  type        = number
  default     = 7
}

# ElastiCache variables
variable "create_elasticache" {
  description = "Whether to create ElastiCache instance"
  type        = bool
  default     = true
}

variable "redis_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.t3.micro"
}

variable "redis_num_cache_nodes" {
  description = "Number of cache nodes"
  type        = number
  default     = 1
}

# ALB variables
variable "create_alb" {
  description = "Whether to create Application Load Balancer"
  type        = bool
  default     = true
}

# Domain variables
variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = ""
}

variable "subdomain" {
  description = "Subdomain for the application"
  type        = string
  default     = "app"
}

# SSL certificate variables
variable "ssl_certificate_arn" {
  description = "ARN of the SSL certificate to use"
  type        = string
  default     = ""
}

# Monitoring variables
variable "enable_monitoring" {
  description = "Enable monitoring stack (Prometheus, Grafana)"
  type        = bool
  default     = true
}

variable "enable_logging" {
  description = "Enable logging stack (ELK)"
  type        = bool
  default     = true
}

# Security variables
variable "allowed_cidr_blocks" {
  description = "List of CIDR blocks allowed to access the cluster"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "enable_waf" {
  description = "Enable AWS WAF"
  type        = bool
  default     = false
}

# Backup variables
variable "backup_retention_days" {
  description = "Number of days to retain backups"
  type        = number
  default     = 30
}

variable "enable_point_in_time_recovery" {
  description = "Enable point in time recovery for databases"
  type        = bool
  default     = true
}

# Cost optimization variables
variable "enable_spot_instances" {
  description = "Enable spot instances for worker nodes"
  type        = bool
  default     = false
}

variable "spot_instance_types" {
  description = "List of spot instance types"
  type        = list(string)
  default     = ["t3.medium", "t3.large", "m5.large"]
}

# Auto-scaling variables
variable "enable_cluster_autoscaler" {
  description = "Enable cluster autoscaler"
  type        = bool
  default     = true
}

variable "enable_horizontal_pod_autoscaler" {
  description = "Enable horizontal pod autoscaler"
  type        = bool
  default     = true
}

# Tags
variable "tags" {
  description = "A map of tags to add to all resources"
  type        = map(string)
  default = {
    Project   = "myco-platform"
    ManagedBy = "terraform"
  }
}

# Feature flags
variable "enable_ai_features" {
  description = "Enable AI-specific features and resources"
  type        = bool
  default     = true
}

variable "enable_gpu_nodes" {
  description = "Enable GPU node groups for AI workloads"
  type        = bool
  default     = false
}

variable "gpu_instance_types" {
  description = "List of GPU instance types"
  type        = list(string)
  default     = ["g4dn.xlarge"]
}

# External services
variable "openai_api_key" {
  description = "OpenAI API key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "anthropic_api_key" {
  description = "Anthropic API key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "google_api_key" {
  description = "Google API key"
  type        = string
  sensitive   = true
  default     = ""
}

# Notification variables
variable "slack_webhook_url" {
  description = "Slack webhook URL for notifications"
  type        = string
  sensitive   = true
  default     = ""
}

variable "email_notifications" {
  description = "Email addresses for notifications"
  type        = list(string)
  default     = []
}

# Local development
variable "local_development" {
  description = "Configuration for local development"
  type = object({
    enabled = bool
    docker_registry = string
    namespace = string
  })
  default = {
    enabled = false
    docker_registry = "localhost:5000"
    namespace = "myco-dev"
  }
}