# recreate-dev.ps1
# Recree les ressources ECS et RDS du compte WCOMPLY-WHUBBI
# Utilisation : .\recreate-dev.ps1

$REGION     = "eu-west-1"
$PROFILE    = "whubbi-new"
$ACCOUNT    = "882321772619"
$CLUSTER    = "whubbi-cluster-dev"
$IMAGE      = "$ACCOUNT.dkr.ecr.$REGION.amazonaws.com/whubbi-backend:v27"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   WHUBBI DEV - Recreation infrastructure" -ForegroundColor Cyan
Write-Host "   Compte : WCOMPLY-WHUBBI ($ACCOUNT)" -ForegroundColor Gray
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "   Ceci va recreer :" -ForegroundColor White
Write-Host "   - Base de donnees RDS PostgreSQL (~10 min)" -ForegroundColor Gray
Write-Host "   - Service ECS Fargate (~3 min)" -ForegroundColor Gray
Write-Host ""

$confirm = Read-Host "   Tapez OUI pour confirmer"
if ($confirm -ne "OUI") {
    Write-Host "   Recreation annulee" -ForegroundColor Green
    exit
}

$startTime = Get-Date

# --- 1. Recreer RDS ---
Write-Host "1/3 Creation de la base de donnees RDS..." -ForegroundColor Yellow

aws rds create-db-instance `
    --db-instance-identifier whubbi-postgres-dev `
    --db-instance-class db.t3.micro `
    --engine postgres `
    --engine-version 16 `
    --master-username whubbi_admin `
    --master-user-password "MotDePasseSecurise123!" `
    --db-name whubbi_db `
    --allocated-storage 20 `
    --vpc-security-group-ids sg-0bc70ae74dcdbfb42 `
    --db-subnet-group-name whubbi-subnet-group `
    --no-multi-az `
    --no-publicly-accessible `
    --storage-type gp2 `
    --region $REGION `
    --profile $PROFILE | Out-Null

Write-Host "   [OK] RDS en creation (attente 10 min)..." -ForegroundColor Green

# Attendre RDS
$attempt = 0
do {
    Start-Sleep -Seconds 30
    $attempt++
    $dbStatus = aws rds describe-db-instances `
        --db-instance-identifier whubbi-postgres-dev `
        --region $REGION --profile $PROFILE `
        --query "DBInstances[0].DBInstanceStatus" --output text 2>$null
    Write-Host "   RDS statut: $dbStatus ($attempt/20)" -ForegroundColor Gray
} while ($dbStatus -ne "available" -and $attempt -lt 20)

if ($dbStatus -eq "available") {
    Write-Host "   [OK] RDS prete !" -ForegroundColor Green
} else {
    Write-Host "   [!!] RDS prend plus de temps" -ForegroundColor Yellow
}

# --- 2. Recreer ECS service ---
Write-Host "2/3 Creation du service ECS..." -ForegroundColor Yellow

aws ecs create-service `
    --cluster $CLUSTER `
    --service-name whubbi-backend-service `
    --task-definition whubbi-backend `
    --desired-count 1 `
    --launch-type FARGATE `
    --network-configuration "awsvpcConfiguration={subnets=[subnet-08c93a4524d20825c,subnet-0b3a50e6403a72cde],securityGroups=[sg-099c85401553433da],assignPublicIp=ENABLED}" `
    --load-balancers "targetGroupArn=arn:aws:elasticloadbalancing:eu-west-1:882321772619:targetgroup/whubbi-backend-tg/2945d83dca36f6da,containerName=whubbi-backend,containerPort=8000" `
    --region $REGION `
    --profile $PROFILE | Out-Null

Write-Host "   [OK] Service ECS cree" -ForegroundColor Green

# --- 3. Resume ---
$duration = [math]::Round(((Get-Date) - $startTime).TotalMinutes, 1)
Write-Host "3/3 Verification..." -ForegroundColor Yellow

$ecsRunning = aws ecs describe-services `
    --cluster $CLUSTER --services whubbi-backend-service `
    --region $REGION --profile $PROFILE `
    --query "services[0].runningCount" --output text 2>$null

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   [OK] Infrastructure recreee en $duration minutes !" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "   Frontend : https://master.da3cm8ewfvjqw.amplifyapp.com" -ForegroundColor White
Write-Host "   API      : https://api.whubbi.wcomply.com" -ForegroundColor White
Write-Host ""
Write-Host "   ECS tasks running : $ecsRunning/1" -ForegroundColor Gray
Write-Host ""
