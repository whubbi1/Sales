# infrastructure/terraform/variables.tf

variable "aws_region" {
  description = "Région AWS principale"
  type        = string
  default     = "eu-west-1"  # Paris est eu-west-3, Ireland est eu-west-1
}

variable "environment" {
  description = "Environnement (dev, staging, prod)"
  type        = string
  default     = "prod"
}

variable "app_name" {
  description = "Nom de l'application"
  type        = string
  default     = "whubbi"
}

# ─── Base de données ────────────────────────────────────────────────────────
variable "db_name" {
  description = "Nom de la base de données PostgreSQL"
  type        = string
  default     = "whubbi_db"
}

variable "db_username" {
  description = "Nom d'utilisateur PostgreSQL"
  type        = string
  default     = "whubbi_admin"
  sensitive   = true
}

variable "db_password" {
  description = "Mot de passe PostgreSQL (utiliser AWS Secrets Manager en prod)"
  type        = string
  sensitive   = true
}

variable "db_instance_class" {
  description = "Type d'instance RDS"
  type        = string
  default     = "db.t3.medium"
}

# ─── ECS / Backend ──────────────────────────────────────────────────────────
variable "backend_image" {
  description = "Image Docker du backend FastAPI (ECR URI)"
  type        = string
  default     = ""
}

variable "backend_cpu" {
  description = "CPU alloué au conteneur Fargate (unités)"
  type        = number
  default     = 512
}

variable "backend_memory" {
  description = "Mémoire allouée au conteneur Fargate (MB)"
  type        = number
  default     = 1024
}

# ─── Microsoft / Outlook ────────────────────────────────────────────────────
variable "ms_tenant_id" {
  description = "Microsoft Tenant ID (Azure AD)"
  type        = string
  sensitive   = true
}

variable "ms_client_id" {
  description = "Microsoft Client ID (App Registration)"
  type        = string
  sensitive   = true
}

variable "ms_client_secret" {
  description = "Microsoft Client Secret"
  type        = string
  sensitive   = true
}

# ─── Domaine ────────────────────────────────────────────────────────────────
variable "domain_name" {
  description = "Nom de domaine principal (ex: whubbi.com)"
  type        = string
  default     = "whubbi.com"
}
