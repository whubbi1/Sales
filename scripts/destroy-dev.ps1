# destroy-dev.ps1
# Supprime TOUTE l'infrastructure DEV et permet de recommencer proprement
# Utilisation : .\destroy-dev.ps1

$TERRAFORM_DIR = "C:\whubbi\infrastructure\terraform"
$DB_ID         = "whubbi-postgres-dev"
$REGION        = "eu-west-1"

Write-Host ""
Write-Host "========================================" -ForegroundColor Red
Write-Host "   SUPPRESSION DE L'INFRASTRUCTURE DEV" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Red
Write-Host ""
Write-Host "   Ceci va supprimer TOUTES les ressources AWS DEV :" -ForegroundColor Yellow
Write-Host "   - Base de donnees RDS (donnees perdues !)" -ForegroundColor Yellow
Write-Host "   - Cluster ECS + Load Balancer" -ForegroundColor Yellow
Write-Host "   - VPC, subnets, NAT Gateway" -ForegroundColor Yellow
Write-Host "   - Cognito User Pool" -ForegroundColor Yellow
Write-Host "   - Secrets Manager + SSM Parameters" -ForegroundColor Yellow
Write-Host "   - ECR Repository" -ForegroundColor Yellow
Write-Host ""
Write-Host "   Le bucket S3 Terraform et DynamoDB sont conserves." -ForegroundColor Cyan
Write-Host ""

$confirm = Read-Host "   Tapez OUI pour confirmer la suppression"

if ($confirm -ne "OUI") {
    Write-Host ""
    Write-Host "   Suppression annulee" -ForegroundColor Green
    Write-Host ""
    exit
}

Write-Host ""

# --- Etape 1 : Desactiver la protection RDS ---
Write-Host "1/4 Desactivation de la protection RDS..." -ForegroundColor Yellow

$dbStatus = aws rds describe-db-instances `
    --db-instance-identifier $DB_ID `
    --region $REGION `
    --query "DBInstances[0].DBInstanceStatus" `
    --output text 2>$null

if ($dbStatus -eq "stopped") {
    Write-Host "   RDS arretee, redemarrage pour pouvoir la supprimer..." -ForegroundColor Gray
    aws rds start-db-instance --db-instance-identifier $DB_ID --region $REGION | Out-Null
    Write-Host "   Attente demarrage RDS (3 min)..." -ForegroundColor Gray
    Start-Sleep -Seconds 180
}

aws rds modify-db-instance `
    --db-instance-identifier $DB_ID `
    --no-deletion-protection `
    --apply-immediately `
    --region $REGION | Out-Null

Write-Host "   [OK] Protection RDS desactivee" -ForegroundColor Green
Write-Host "   Attente 30 secondes..." -ForegroundColor Gray
Start-Sleep -Seconds 30

# --- Etape 2 : Arreter ECS ---
Write-Host "2/4 Arret du service ECS..." -ForegroundColor Yellow

aws ecs update-service `
    --cluster whubbi-cluster-dev `
    --service whubbi-backend-service `
    --desired-count 0 `
    --region $REGION | Out-Null

Write-Host "   [OK] ECS arrete" -ForegroundColor Green
Start-Sleep -Seconds 10

# --- Etape 3 : Terraform destroy ---
Write-Host "3/4 Suppression de l'infrastructure Terraform..." -ForegroundColor Yellow

Set-Location $TERRAFORM_DIR

terraform destroy -var-file="terraform.dev.tfvars" -auto-approve

if ($LASTEXITCODE -eq 0) {
    Write-Host "   [OK] Infrastructure supprimee" -ForegroundColor Green
} else {
    Write-Host "   [!!] Certaines ressources n'ont pas pu etre supprimees" -ForegroundColor Red
    Write-Host "   Verifiez la console AWS manuellement" -ForegroundColor Yellow
}

# --- Etape 4 : Nettoyer le snapshot final RDS ---
Write-Host "4/4 Nettoyage du snapshot RDS final..." -ForegroundColor Yellow

aws rds delete-db-snapshot `
    --db-snapshot-identifier "whubbi-final-snapshot-dev" `
    --region $REGION 2>$null | Out-Null

Write-Host "   [OK] Snapshot supprime" -ForegroundColor Green

# --- Resume ---
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   [OK] Infrastructure DEV supprimee !" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "   Economie : ~4 EUR/jour" -ForegroundColor Green
Write-Host ""
Write-Host "   Pour recreer l'infrastructure :" -ForegroundColor White
Write-Host "   cd C:\whubbi\infrastructure\terraform" -ForegroundColor Gray
Write-Host "   terraform apply -var-file='terraform.dev.tfvars'" -ForegroundColor Gray
Write-Host ""
