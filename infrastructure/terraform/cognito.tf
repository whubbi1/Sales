# infrastructure/terraform/cognito.tf
# Authentification AWS Cognito avec Microsoft SSO (Outlook)

resource "aws_cognito_user_pool" "main" {
  name = "whubbi-user-pool-${var.environment}"

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length    = 12
    require_lowercase = true
    require_numbers   = true
    require_symbols   = true
    require_uppercase = true
  }

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

  mfa_configuration = "OPTIONAL"
  software_token_mfa_configuration {
    enabled = true
  }

  user_pool_add_ons {
    advanced_security_mode = "ENFORCED"
  }

  tags = { Name = "whubbi-cognito" }
}

# App Client frontend — sans Microsoft tant que l'IDP n'est pas configure
resource "aws_cognito_user_pool_client" "frontend" {
  name         = "whubbi-frontend-client"
  user_pool_id = aws_cognito_user_pool.main.id

  generate_secret = false

  allowed_oauth_flows                  = ["code"]
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_scopes                 = ["email", "openid", "profile"]

  callback_urls = [
    "https://${var.domain_name}/auth/callback",
    "http://localhost:3000/auth/callback"
  ]

  logout_urls = [
    "https://${var.domain_name}",
    "http://localhost:3000"
  ]

  # Microsoft sera ajoute apres configuration Azure AD
  supported_identity_providers = ["COGNITO", "Microsoft"]
  depends_on = [aws_cognito_identity_provider.microsoft]
  
  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }

  access_token_validity  = 1
  id_token_validity      = 1
  refresh_token_validity = 30
}

# App Client backend — authentification directe sans OAuth
resource "aws_cognito_user_pool_client" "backend" {
  name         = "whubbi-backend-client"
  user_pool_id = aws_cognito_user_pool.main.id

  generate_secret                      = true
  allowed_oauth_flows_user_pool_client = false

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH"
  ]
}

# Domaine Cognito
resource "aws_cognito_user_pool_domain" "main" {
  domain       = "auth-whubbi-${var.environment}"
  user_pool_id = aws_cognito_user_pool.main.id
}

# Identity Pool
resource "aws_cognito_identity_pool" "main" {
  identity_pool_name               = "whubbi_identity_pool_${var.environment}"
  allow_unauthenticated_identities = false

  cognito_identity_providers {
    client_id               = aws_cognito_user_pool_client.frontend.id
    provider_name           = aws_cognito_user_pool.main.endpoint
    server_side_token_check = true
  }
}

# Provider Microsoft pour SSO
resource "aws_cognito_identity_provider" "microsoft" {
  user_pool_id  = aws_cognito_user_pool.main.id
  provider_name = "Microsoft"
  provider_type = "OIDC"

  provider_details = {
    client_id                 = var.ms_client_id
    client_secret             = var.ms_client_secret
    attributes_request_method = "GET"
    oidc_issuer               = "https://login.microsoftonline.com/${var.ms_tenant_id}/v2.0"
    authorize_scopes          = "openid email profile offline_access"
  }

  attribute_mapping = {
    email       = "email"
    name        = "name"
    username    = "sub"
    given_name  = "given_name"
    family_name = "family_name"
  }
}
