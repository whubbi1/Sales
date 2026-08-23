# infrastructure/terraform/secrets.tf
# Gestion des secrets sensibles (Outlook, Copilot, DB)

# ─── Secrets Microsoft ────────────────────────────────────────────────────────
resource "aws_ssm_parameter" "ms_tenant_id" {
  name  = "/whubbi/${var.environment}/microsoft/tenant_id"
  type  = "SecureString"
  value = var.ms_tenant_id
}

resource "aws_ssm_parameter" "ms_client_id" {
  name  = "/whubbi/${var.environment}/microsoft/client_id"
  type  = "SecureString"
  value = var.ms_client_id
}

resource "aws_ssm_parameter" "ms_client_secret" {
  name  = "/whubbi/${var.environment}/microsoft/client_secret"
  type  = "SecureString"
  value = var.ms_client_secret
}

# ─── Secret complet (backup Secrets Manager) ─────────────────────────────────
resource "aws_secretsmanager_secret" "app_secrets" {
  name                    = "whubbi/${var.environment}/app-secrets"
  recovery_window_in_days = 7

  tags = { Name = "whubbi-app-secrets" }
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

  tags = { Name = "whubbi-ssl-cert" }
}

# There's no Route53 zone in this Terraform root (DNS for wcomply.com is managed
# externally), so the validation CNAME(s) below can't be created automatically.
# `terraform apply` will block on this resource until whoever has DNS access adds
# the record(s) from the `acm_validation_records` output — that's expected, not
# a bug; increase the timeout below if that DNS change takes a while to land.
resource "aws_acm_certificate_validation" "main" {
  certificate_arn = aws_acm_certificate.main.arn

  timeouts {
    create = "45m"
  }
}
