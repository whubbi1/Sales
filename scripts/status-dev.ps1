# status-dev.ps1
# Verifie le statut de toutes les ressources AWS DEV
# Utilisation : .\status-dev.ps1

$CLUSTER    = "whubbi-cluster-dev"
$SERVICE    = "whubbi-backend-service"
$DB_ID      = "whubbi-postgres-dev"
$REGION     = "eu-west-1"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   WHUBBI DEV - Statut des services" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# --- RDS ---
$dbStatus = aws rds describe-db-instances `
    --db-instance-identifier $DB_ID `
    --region $REGION `
    --query "DBInstances[0].DBInstanceStatus" `
    --output text 2>$null

if ($dbStatus -eq "available") {
    $dbIcon = "[ON] "
    $dbColor = "Green"
} elseif ($dbStatus -eq "stopped") {
    $dbIcon = "[OFF]"
    $dbColor = "Red"
} else {
    $dbIcon = "[...]"
    $dbColor = "Yellow"
}

Write-Host "   $dbIcon Base de donnees RDS : $dbStatus" -ForegroundColor $dbColor

# --- ECS ---
$ecsRunning = aws ecs describe-services `
    --cluster $CLUSTER `
    --services $SERVICE `
    --region $REGION `
    --query "services[0].runningCount" `
    --output text 2>$null

$ecsDesired = aws ecs describe-services `
    --cluster $CLUSTER `
    --services $SERVICE `
    --region $REGION `
    --query "services[0].desiredCount" `
    --output text 2>$null

if ([int]$ecsRunning -gt 0) {
    $ecsIcon = "[ON] "
    $ecsColor = "Green"
} else {
    $ecsIcon = "[OFF]"
    $ecsColor = "Red"
}

Write-Host "   $ecsIcon Backend ECS       : $ecsRunning/$ecsDesired taches actives" -ForegroundColor $ecsColor

# --- Cout estime ---
Write-Host ""
Write-Host "   Cout estime :" -ForegroundColor White

if ($dbStatus -eq "available") {
    Write-Host "      RDS      : ~0.08 EUR/heure" -ForegroundColor Gray
} else {
    Write-Host "      RDS      : 0 EUR (arretee)" -ForegroundColor Green
}

if ([int]$ecsRunning -gt 0) {
    Write-Host "      ECS      : ~0.06 EUR/heure" -ForegroundColor Gray
} else {
    Write-Host "      ECS      : 0 EUR (arrete)" -ForegroundColor Green
}

Write-Host "      NAT GW   : ~0.04 EUR/heure (toujours actif)" -ForegroundColor Yellow
Write-Host ""

# --- Actions disponibles ---
Write-Host "   Actions disponibles :" -ForegroundColor White
Write-Host "      .\start-dev.ps1   -> Demarrer tous les services" -ForegroundColor Gray
Write-Host "      .\stop-dev.ps1    -> Arreter tous les services" -ForegroundColor Gray
Write-Host "      .\destroy-dev.ps1 -> Supprimer toute l'infrastructure" -ForegroundColor Gray
Write-Host ""
