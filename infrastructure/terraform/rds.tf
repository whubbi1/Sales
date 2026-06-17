# infrastructure/terraform/rds.tf
# Base de données PostgreSQL sur AWS RDS

# Security Group pour RDS
resource "aws_security_group" "rds" {
  name        = "whubbi-rds-sg"
  description = "Acces PostgreSQL uniquement depuis ECS"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "PostgreSQL depuis ECS"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "whubbi-rds-sg" }
}

# Subnet Group pour RDS (subnets privés uniquement)
resource "aws_db_subnet_group" "main" {
  name       = "whubbi-db-subnet-group"
  subnet_ids = aws_subnet.private[*].id

  tags = { Name = "Wcomply DB Subnet Group" }
}

# Instance RDS PostgreSQL
resource "aws_db_instance" "postgres" {
  identifier = "whubbi-postgres-${var.environment}"

  engine               = "postgres"
  engine_version       = "16.14"
  instance_class       = var.db_instance_class
  allocated_storage    = 20
  max_allocated_storage = 100  # Auto-scaling jusqu'à 100 GB
  storage_encrypted    = true

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false  # JAMAIS public !

  backup_retention_period = 7      # 7 jours de backups
  backup_window           = "03:00-04:00"
  maintenance_window      = "Mon:04:00-Mon:05:00"

  deletion_protection = true       # Protection contre suppression accidentelle
  skip_final_snapshot = false
  final_snapshot_identifier = "whubbi-final-snapshot-${var.environment}"

  # Performance Insights
  performance_insights_enabled = true

  # Logs
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  tags = { Name = "whubbi-postgres-${var.environment}" }
}

# Paramètre SSM pour l'URL de la base de données
resource "aws_ssm_parameter" "db_url" {
  name  = "/whubbi/${var.environment}/database/url"
  type  = "SecureString"
  value = "postgresql://${var.db_username}:${var.db_password}@${aws_db_instance.postgres.endpoint}/${var.db_name}"

  tags = { Name = "whubbi-db-url" }
}
