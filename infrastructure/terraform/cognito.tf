# infrastructure/terraform/cognito.tf
# Authentification AWS Cognito avec Microsoft SSO (Outlook)

resource "aws_cognito_user_pool" "main" {
  name = "wcomply-user-pool-${var.environment}"

  # Connexion par email
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length    = 12
    require_lowercase = true
    require_numbers   = true
    require_symbols   = true
    require_uppercase = true
  }

  # Attributs utilisateur personnalisés pour Wcomply
  schema {
    name                = "company"
    attribute_data_type = "String"
    mutable             = true
    string_attribute_constraints {
      min_length = 1
      max_length = 100
    }
  }

  schema {
    name                = "role"
    attribute_data_type = "String"
    mutable             = true
    string_attribute_constraints {
      min_length = 1
      max_length = 50
    }
  }

  # MFA optionnel
  mfa_configuration = "OPTIONAL"
  software_token_mfa_configuration {
    enabled = true
  }

  # Tokens
  user_pool_add_ons {
    advanced_security_mode = "ENFORCED"
  }

  tags = { Name = "wcomply-cognito" }
}

# App Client pour le frontend Next.js
resource "aws_cognito_user_pool_client" "frontend" {
  name         = "wcomply-frontend-client"
  user_pool_id = aws_cognito_user_pool.main.id

  generate_secret = false  # Public client (SPA)

  allowed_oauth_flows                  = ["code"]
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_scopes                 = ["email", "openid", "profile"]

  callback_urls = [
    "https://${var.domain_name}/auth/callback",
    "http://localhost:3000/auth/callback"  # Dev local
  ]

  logout_urls = [
    "https://${var.domain_name}",
    "http://localhost:3000"
  ]

  # Fédération avec Microsoft
  supported_identity_providers = ["COGNITO", "Microsoft"]

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }

  access_token_validity  = 1
  id_token_validity      = 1
  refresh_token_validity = 30
}

# App Client pour le backend FastAPI
resource "aws_cognito_user_pool_client" "backend" {
  name         = "wcomply-backend-client"
  user_pool_id = aws_cognito_user_pool.main.id

  generate_secret                      = true  # Confidential client
  allowed_oauth_flows                  = ["client_credentials"]
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_scopes                 = ["wcomply/read", "wcomply/write"]
}

# Domaine Cognito
resource "aws_cognito_user_pool_domain" "main" {
  domain       = "auth-wcomply-${var.environment}"
  user_pool_id = aws_cognito_user_pool.main.id
}

# ─── Fédération Microsoft (Outlook/Azure AD) ─────────────────────────────────
resource "aws_cognito_identity_provider" "microsoft" {
  user_pool_id  = aws_cognito_user_pool.main.id
  provider_name = "Microsoft"
  provider_type = "OIDC"

  provider_details = {
    client_id                 = var.ms_client_id
    client_secret             = var.ms_client_secret
    attributes_request_method = "GET"
    oidc_issuer               = "https://login.microsoftonline.com/${var.ms_tenant_id}/v2.0"
    authorize_scopes          = "openid email profile offline_access Calendars.Read Mail.Read"
  }

  attribute_mapping = {
    email       = "email"
    name        = "name"
    username    = "sub"
    given_name  = "given_name"
    family_name = "family_name"
  }
}

# Identity Pool pour accès aux ressources AWS
resource "aws_cognito_identity_pool" "main" {
  identity_pool_name               = "wcomply_identity_pool_${var.environment}"
  allow_unauthenticated_identities = false

  cognito_identity_providers {
    client_id               = aws_cognito_user_pool_client.frontend.id
    provider_name           = aws_cognito_user_pool.main.endpoint
    server_side_token_check = true
  }
}
