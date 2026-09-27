# infrastructure/terraform/cognito_portal.tf
# Authentification AWS Cognito pour le Partner Portal (portal.wcomply.com) — pool
# SEPARE de whubbi-user-pool (cognito.tf), reserve aux contacts CRM invites. Acces
# invitation-only : portal_invitations/portal_users (backend) determinent l'acces
# reel, ce pool ne fait qu'authentifier l'identite.
#
# Prerequis MANUELS avant `terraform apply` (voir variables.tf) :
#   - Azure AD : app registration MULTI-TENANT ("Accounts in any organizational
#     directory") distincte de l'app interne — portal_ms_client_id/secret.
#   - Google Cloud : client OAuth 2.0 "Web application" avec les redirect URIs
#     du domaine Cognito ci-dessous — google_client_id/secret.

resource "aws_cognito_user_pool" "portal" {
  name = "whubbi-portal-user-pool-${var.environment}"

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  # External users manage their own account via Microsoft/Google — no local
  # password to enforce a strict policy on, but Cognito requires one regardless.
  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = false
    require_uppercase = true
  }

  mfa_configuration = "OPTIONAL"
  software_token_mfa_configuration {
    enabled = true
  }

  tags = { Name = "whubbi-portal-cognito" }
}

locals {
  # Lets Microsoft be wired up and applied before Google is ready — the Google IdP
  # resource below is skipped entirely until both vars are set, so an empty
  # google_client_secret doesn't fail the apply for everyone else.
  google_idp_enabled = var.google_client_id != "" && var.google_client_secret != ""
}

resource "aws_cognito_user_pool_client" "portal" {
  name         = "whubbi-portal-client"
  user_pool_id = aws_cognito_user_pool.portal.id

  generate_secret = false

  allowed_oauth_flows                  = ["code"]
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_scopes                 = ["email", "openid", "profile"]

  callback_urls = [
    "https://portal.wcomply.com/portal/auth/callback",
    "http://localhost:3000/portal/auth/callback",
  ]

  logout_urls = [
    "https://portal.wcomply.com",
    "http://localhost:3000",
  ]

  supported_identity_providers = concat(
    ["COGNITO", "Microsoft"],
    local.google_idp_enabled ? ["Google"] : [],
  )
  # depends_on must be a static list (no concat/conditional) — referencing the base
  # resource address (no index) covers portal_google whether count is 0 or 1.
  depends_on = [
    aws_cognito_identity_provider.portal_microsoft,
    aws_cognito_identity_provider.portal_google,
  ]

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }

  access_token_validity  = 1
  id_token_validity      = 1
  refresh_token_validity = 30
}

resource "aws_cognito_user_pool_domain" "portal" {
  domain       = "auth-whubbi-portal-${var.environment}"
  user_pool_id = aws_cognito_user_pool.portal.id
}

# Multi-tenant Microsoft — any organization's Entra ID account, unlike cognito.tf's
# aws_cognito_identity_provider.microsoft which is scoped to wcomply's own tenant.
resource "aws_cognito_identity_provider" "portal_microsoft" {
  user_pool_id  = aws_cognito_user_pool.portal.id
  provider_name = "Microsoft"
  provider_type = "OIDC"

  provider_details = {
    client_id                 = var.portal_ms_client_id
    client_secret             = var.portal_ms_client_secret
    attributes_request_method = "GET"
    oidc_issuer               = "https://login.microsoftonline.com/organizations/v2.0"
    authorize_scopes          = "openid email profile"
  }

  attribute_mapping = {
    email       = "email"
    name        = "name"
    username    = "sub"
    given_name  = "given_name"
    family_name = "family_name"
  }
}

resource "aws_cognito_identity_provider" "portal_google" {
  count         = local.google_idp_enabled ? 1 : 0
  user_pool_id  = aws_cognito_user_pool.portal.id
  provider_name = "Google"
  provider_type = "Google"

  provider_details = {
    client_id                 = var.google_client_id
    client_secret             = var.google_client_secret
    authorize_scopes          = "openid email profile"
  }

  attribute_mapping = {
    email       = "email"
    name        = "name"
    username    = "sub"
    given_name  = "given_name"
    family_name = "family_name"
  }
}

output "portal_cognito_user_pool_id" {
  value = aws_cognito_user_pool.portal.id
}

output "portal_cognito_client_id" {
  value = aws_cognito_user_pool_client.portal.id
}

output "portal_cognito_domain" {
  value = "https://${aws_cognito_user_pool_domain.portal.domain}.auth.${var.aws_region}.amazoncognito.com"
}
