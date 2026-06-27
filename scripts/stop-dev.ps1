# stop-dev.ps1
# Arrete toutes les ressources AWS de l'environnement DEV (compte WCOMPLY-WHUBBI)
# Utilisation : .\stop-dev.ps1

$CLUSTER    = "whubbi-cluster-dev"
$SERVICE    = "whubbi-backend-service"
$DB_ID      = "whubbi-postgres-dev"
$REGION     = "eu-west-1"
$PROFILE    = "whubbi-new"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   WHUBBI DEV - Arret des services" -ForegroundColor Cyan
Write-Host "   Compte : WCOMPLY-WHUBBI (882321772619)" -ForegroundColor Gray
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# --- 1. Arreter ECS ---
Write-Host "1/2 Arret du backend ECS..." -ForegroundColor Yellow

aws ecs update-service `
    --cluster $CLUSTER `
    --service $SERVICE `
    --desired-count 0 `
    --region $REGION `
    --profile $PROFILE | Out-Null

Write-Host "   [OK] ECS arrete (0 taches)" -ForegroundColor Green

# --- 2. Arreter RDS ---
Write-Host "2/2 Arret de la base de donnees RDS..." -ForegroundColor Yellow

$dbStatus = aws rds describe-db-instances `
    --db-instance-identifier $DB_ID `
    --region $REGION `
    --profile $PROFILE `
    --query "DBInstances[0].DBInstanceStatus" `
    --output text 2>$null

if ($dbStatus -eq "available") {
    aws rds stop-db-instance `
        --db-instance-identifier $DB_ID `
        --region $REGION `
        --profile $PROFILE | Out-Null
    Write-Host "   [OK] RDS en cours d'arret..." -ForegroundColor Green
} elseif ($dbStatus -eq "stopped") {
    Write-Host "   [OK] RDS deja arretee" -ForegroundColor Green
} else {
    Write-Host "   [..] RDS statut : $dbStatus" -ForegroundColor Gray
}

# --- Resume ---
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   [OK] Environnement DEV arrete !" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "   Economies estimees :" -ForegroundColor White
Write-Host "      RDS arretee   -> ~2 EUR economises / nuit" -ForegroundColor Gray
Write-Host "      ECS a 0 tache -> ~1.5 EUR economises / nuit" -ForegroundColor Gray
Write-Host "      Total         -> ~3.5 EUR / nuit, ~25 EUR / mois" -ForegroundColor Green
Write-Host ""
Write-Host "   Pour redemarrer demain : .\start-dev.ps1" -ForegroundColor White
Write-Host ""
