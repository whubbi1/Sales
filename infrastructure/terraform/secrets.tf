# infrastructure/terraform/secrets.tf
# Gestion des secrets sensibles (Outlook, Copilot, DB)

# ─── Secrets Microsoft ────────────────────────────────────────────────────────
resource "aws_ssm_parameter" "ms_tenant_id" {
  name  = "/wcomply/${var.environment}/microsoft/tenant_id"
  type  = "SecureString"
  value = var.ms_tenant_id
}

resource "aws_ssm_parameter" "ms_client_id" {
  name  = "/wcomply/${var.environment}/microsoft/client_id"
  type  = "SecureString"
  value = var.ms_client_id
}

resource "aws_ssm_parameter" "ms_client_secret" {
  name  = "/wcomply/${var.environment}/microsoft/client_secret"
  type  = "SecureString"
  value = var.ms_client_secret
}

# ─── Secret complet (backup Secrets Manager) ─────────────────────────────────
resource "aws_secretsmanager_secret" "app_secrets" {
  name                    = "wcomply/${var.environment}/app-secrets"
  recovery_window_in_days = 7

  tags = { Name = "wcomply-app-secrets" }
}

resource "aws_secretsmanager_secret_version" "app_secrets" {
  secret_id = aws_secretsmanager_secret.app_secrets.id
  secret_string = jsonencode({
    ms_tenant_id     = var.ms_tenant_id
    ms_client_id     = var.ms_client_id
    ms_client_secret = var.ms_client_secret
    db_password      = var.db_password
  })
}

# ─── Certificat SSL (ACM) ─────────────────────────────────────────────────────
resource "aws_acm_certificate" "main" {
  domain_name               = var.domain_name
  subject_alternative_names = ["*.${var.domain_name}"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = { Name = "wcomply-ssl-cert" }
}
