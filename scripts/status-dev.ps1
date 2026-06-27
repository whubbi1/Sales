# status-dev.ps1
# Verifie le statut de toutes les ressources AWS DEV (compte WCOMPLY-WHUBBI)
# Utilisation : .\status-dev.ps1

$CLUSTER    = "whubbi-cluster-dev"
$SERVICE    = "whubbi-backend-service"
$DB_ID      = "whubbi-postgres-dev"
$REGION     = "eu-west-1"
$PROFILE    = "whubbi-new"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   WHUBBI DEV - Statut des services" -ForegroundColor Cyan
Write-Host "   Compte : WCOMPLY-WHUBBI (882321772619)" -ForegroundColor Gray
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# --- RDS ---
$dbStatus = aws rds describe-db-instances `
    --db-instance-identifier $DB_ID `
    --region $REGION `
    --profile $PROFILE `
    --query "DBInstances[0].DBInstanceStatus" `
    --output text 2>$null

if ($dbStatus -eq "available") {
    $dbIcon = "[ON] "; $dbColor = "Green"
} elseif ($dbStatus -eq "stopped") {
    $dbIcon = "[OFF]"; $dbColor = "Red"
} else {
    $dbIcon = "[...]"; $dbColor = "Yellow"
}
Write-Host "   $dbIcon RDS PostgreSQL : $dbStatus" -ForegroundColor $dbColor

# --- ECS ---
$ecsSvc = aws ecs describe-services `
    --cluster $CLUSTER `
    --services $SERVICE `
    --region $REGION `
    --profile $PROFILE `
    --query "services[0].{running:runningCount,desired:desiredCount,taskDef:taskDefinition}" `
    --output json 2>$null | ConvertFrom-Json

$ecsRunning = $ecsSvc.running
$ecsDesired = $ecsSvc.desired
$taskDef = ($ecsSvc.taskDef -split "/")[-1]

if ([int]$ecsRunning -gt 0) {
    $ecsIcon = "[ON] "; $ecsColor = "Green"
} else {
    $ecsIcon = "[OFF]"; $ecsColor = "Red"
}
Write-Host "   $ecsIcon ECS Backend    : $ecsRunning/$ecsDesired taches ($taskDef)" -ForegroundColor $ecsColor

# --- API Health ---
Write-Host ""
Write-Host "   Test API..." -ForegroundColor Gray
try {
    $response = Invoke-WebRequest -Uri "https://api.whubbi.wcomply.com/health" -TimeoutSec 5 -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "   [ON]  API WHUBBI       : Healthy" -ForegroundColor Green
    }
} catch {
    Write-Host "   [OFF] API WHUBBI       : Indisponible" -ForegroundColor Red
}

# --- Amplify ---
$amplifyStatus = aws amplify list-jobs `
    --app-id da3cm8ewfvjqw `
    --branch-name master `
    --region $REGION `
    --profile $PROFILE `
    --query "jobSummaries[0].status" `
    --output text 2>$null

Write-Host "   [ON]  Amplify Frontend : Dernier build = $amplifyStatus" -ForegroundColor Green

# --- Cout estime ---
Write-Host ""
Write-Host "   Cout estime (ce moment) :" -ForegroundColor White
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
Write-Host "      ALB      : ~0.02 EUR/heure (toujours actif)" -ForegroundColor Yellow
Write-Host ""

# --- URLs ---
Write-Host "   URLs :" -ForegroundColor White
Write-Host "      Frontend : https://master.da3cm8ewfvjqw.amplifyapp.com" -ForegroundColor Gray
Write-Host "      API      : https://api.whubbi.wcomply.com" -ForegroundColor Gray
Write-Host ""

# --- Actions ---
Write-Host "   Actions :" -ForegroundColor White
Write-Host "      .\start-dev.ps1   -> Demarrer tous les services" -ForegroundColor Gray
Write-Host "      .\stop-dev.ps1    -> Arreter tous les services" -ForegroundColor Gray
Write-Host ""
