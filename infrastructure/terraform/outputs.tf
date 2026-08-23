# infrastructure/terraform/outputs.tf

output "vpc_id" {
  description = "ID du VPC principal"
  value       = aws_vpc.main.id
}

output "rds_endpoint" {
  description = "Endpoint de la base de données RDS"
  value       = aws_db_instance.postgres.endpoint
  sensitive   = true
}

output "ecr_repository_url" {
  description = "URL du registre Docker ECR"
  value       = aws_ecr_repository.backend.repository_url
}

output "alb_dns_name" {
  description = "DNS du Load Balancer (à pointer dans Route53)"
  value       = aws_lb.main.dns_name
}

output "cognito_user_pool_id" {
  description = "ID du User Pool Cognito"
  value       = aws_cognito_user_pool.main.id
}

output "cognito_client_id" {
  description = "Client ID Cognito pour le frontend"
  value       = aws_cognito_user_pool_client.frontend.id
}

output "cognito_domain" {
  description = "Domaine Cognito pour l'authentification"
  value       = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${var.aws_region}.amazoncognito.com"
}

output "ecs_cluster_name" {
  description = "Nom du cluster ECS"
  value       = aws_ecs_cluster.main.name
}

output "acm_validation_records" {
  description = "Enregistrements CNAME a creer chez le fournisseur DNS pour valider le certificat ACM (aucune zone Route53 geree ici) - terraform apply restera bloque sur aws_acm_certificate_validation.main tant qu'ils ne sont pas en place et propages"
  value = {
    for dvo in aws_acm_certificate.main.domain_validation_options : dvo.domain_name => {
      name  = dvo.resource_record_name
      type  = dvo.resource_record_type
      value = dvo.resource_record_value
    }
  }
}

output "next_steps" {
  description = "Prochaines étapes après terraform apply"
  value = <<-EOT
    ✅ Infrastructure déployée !

    Prochaines étapes :
    1. Ajoutez le(s) enregistrement(s) CNAME de l'output acm_validation_records
       chez votre fournisseur DNS (terraform apply reste bloqué jusque-là)
    2. Configurez votre DNS : pointez ${var.domain_name} vers ${aws_lb.main.dns_name}
    3. Poussez votre image Docker vers : ${aws_ecr_repository.backend.repository_url}
    4. Configurez AWS Amplify pour le frontend Next.js
    5. Mettez à jour vos secrets Microsoft dans SSM Parameter Store

    Variables pour votre frontend (.env.local) :
    NEXT_PUBLIC_COGNITO_USER_POOL_ID=${aws_cognito_user_pool.main.id}
    NEXT_PUBLIC_COGNITO_CLIENT_ID=${aws_cognito_user_pool_client.frontend.id}
    NEXT_PUBLIC_API_URL=https://api.${var.domain_name}
  EOT
}
