# destroy-dev.ps1
# Supprime les ressources ECS et RDS du compte WCOMPLY-WHUBBI
# NOTE : Pas de Terraform dans ce compte — suppression manuelle via AWS CLI
# Utilisation : .\destroy-dev.ps1

$CLUSTER    = "whubbi-cluster-dev"
$SERVICE    = "whubbi-backend-service"
$DB_ID      = "whubbi-postgres-dev"
$REGION     = "eu-west-1"
$PROFILE    = "whubbi-new"

Write-Host ""
Write-Host "========================================" -ForegroundColor Red
Write-Host "   SUPPRESSION DE L'INFRASTRUCTURE DEV" -ForegroundColor Red
Write-Host "   Compte : WCOMPLY-WHUBBI (882321772619)" -ForegroundColor Gray
Write-Host "========================================" -ForegroundColor Red
Write-Host ""
Write-Host "   Ceci va supprimer :" -ForegroundColor Yellow
Write-Host "   - Service ECS (whubbi-backend-service)" -ForegroundColor Yellow
Write-Host "   - Base de donnees RDS (donnees perdues !)" -ForegroundColor Yellow
Write-Host ""
Write-Host "   Conserves : ALB, VPC, Cognito, ECR, Amplify" -ForegroundColor Cyan
Write-Host ""

$confirm = Read-Host "   Tapez OUI pour confirmer"
if ($confirm -ne "OUI") {
    Write-Host "   Suppression annulee" -ForegroundColor Green
    exit
}

# --- 1. Arreter ECS ---
Write-Host "1/3 Arret du service ECS..." -ForegroundColor Yellow
aws ecs update-service --cluster $CLUSTER --service $SERVICE --desired-count 0 --region $REGION --profile $PROFILE | Out-Null
Start-Sleep -Seconds 15
aws ecs delete-service --cluster $CLUSTER --service $SERVICE --region $REGION --profile $PROFILE --force | Out-Null
Write-Host "   [OK] Service ECS supprime" -ForegroundColor Green

# --- 2. Supprimer RDS ---
Write-Host "2/3 Suppression de la base de donnees RDS..." -ForegroundColor Yellow

$dbStatus = aws rds describe-db-instances `
    --db-instance-identifier $DB_ID --region $REGION --profile $PROFILE `
    --query "DBInstances[0].DBInstanceStatus" --output text 2>$null

if ($dbStatus -eq "stopped") {
    Write-Host "   RDS arretee, redemarrage pour suppression..." -ForegroundColor Gray
    aws rds start-db-instance --db-instance-identifier $DB_ID --region $REGION --profile $PROFILE | Out-Null
    Start-Sleep -Seconds 120
}

aws rds modify-db-instance --db-instance-identifier $DB_ID --no-deletion-protection --apply-immediately --region $REGION --profile $PROFILE | Out-Null
Start-Sleep -Seconds 10
aws rds delete-db-instance --db-instance-identifier $DB_ID --skip-final-snapshot --region $REGION --profile $PROFILE | Out-Null
Write-Host "   [OK] RDS en cours de suppression..." -ForegroundColor Green

# --- 3. Resume ---
Write-Host "3/3 Nettoyage termine" -ForegroundColor Yellow
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   [OK] Ressources supprimees !" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "   Pour recreer : .\recreate-dev.ps1" -ForegroundColor Gray
Write-Host ""
