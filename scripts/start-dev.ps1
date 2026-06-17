# start-dev.ps1
# Demarre toutes les ressources AWS de l'environnement DEV
# Utilisation : .\start-dev.ps1

$CLUSTER    = "whubbi-cluster-dev"
$SERVICE    = "whubbi-backend-service"
$DB_ID      = "whubbi-postgres-dev"
$REGION     = "eu-west-1"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   WHUBBI DEV - Demarrage des services" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# --- 1. Demarrer RDS ---
Write-Host "1/3 Demarrage de la base de donnees RDS..." -ForegroundColor Yellow

$dbStatus = aws rds describe-db-instances `
    --db-instance-identifier $DB_ID `
    --region $REGION `
    --query "DBInstances[0].DBInstanceStatus" `
    --output text 2>$null

if ($dbStatus -eq "stopped") {
    aws rds start-db-instance `
        --db-instance-identifier $DB_ID `
        --region $REGION | Out-Null
    Write-Host "   [OK] RDS en cours de demarrage (3-5 minutes)..." -ForegroundColor Green
} elseif ($dbStatus -eq "available") {
    Write-Host "   [OK] RDS deja demarree" -ForegroundColor Green
} else {
    Write-Host "   [..] RDS statut : $dbStatus" -ForegroundColor Gray
}

# --- 2. Demarrer ECS ---
Write-Host "2/3 Demarrage du backend ECS..." -ForegroundColor Yellow

aws ecs update-service `
    --cluster $CLUSTER `
    --service $SERVICE `
    --desired-count 1 `
    --region $REGION | Out-Null

Write-Host "   [OK] ECS backend demarre (1 tache)" -ForegroundColor Green

# --- 3. Attendre RDS ---
Write-Host "3/3 Attente que la base de donnees soit prete..." -ForegroundColor Yellow

$maxAttempts = 20
$attempt = 0

do {
    Start-Sleep -Seconds 15
    $attempt++
    $dbStatus = aws rds describe-db-instances `
        --db-instance-identifier $DB_ID `
        --region $REGION `
        --query "DBInstances[0].DBInstanceStatus" `
        --output text 2>$null
    Write-Host "   Statut RDS : $dbStatus ($attempt/$maxAttempts)" -ForegroundColor Gray
} while ($dbStatus -ne "available" -and $attempt -lt $maxAttempts)

if ($dbStatus -eq "available") {
    Write-Host "   [OK] Base de donnees prete !" -ForegroundColor Green
} else {
    Write-Host "   [!!] RDS prend plus de temps, verifiez la console AWS" -ForegroundColor Yellow
}

# --- Resume ---
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   [OK] Environnement DEV demarre !" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "   Frontend : https://dev.whubbi.wcomply.com" -ForegroundColor White
Write-Host "   API      : https://api.dev.whubbi.wcomply.com" -ForegroundColor White
Write-Host ""
Write-Host "   Pour arreter : .\stop-dev.ps1" -ForegroundColor Gray
Write-Host ""
