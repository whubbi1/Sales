# recreate-dev.ps1
# Recrée toute l'infrastructure DEV depuis zero
# Utilisation : .\recreate-dev.ps1

$TERRAFORM_DIR = "C:\whubbi\infrastructure\terraform"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   WHUBBI DEV - Recreation infrastructure" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "   Ceci va recreer toute l'infrastructure AWS DEV :" -ForegroundColor White
Write-Host "   - VPC + subnets + NAT Gateway (~2 min)" -ForegroundColor Gray
Write-Host "   - Base de donnees PostgreSQL (~10 min)" -ForegroundColor Gray
Write-Host "   - Cluster ECS + Load Balancer (~3 min)" -ForegroundColor Gray
Write-Host "   - Cognito + Secrets (~1 min)" -ForegroundColor Gray
Write-Host ""
Write-Host "   Duree totale estimee : 15-20 minutes" -ForegroundColor Yellow
Write-Host ""

$confirm = Read-Host "   Tapez OUI pour confirmer"

if ($confirm -ne "OUI") {
    Write-Host ""
    Write-Host "   Recreation annulee" -ForegroundColor Green
    Write-Host ""
    exit
}

Write-Host ""
Write-Host "Demarrage de la recreation..." -ForegroundColor Yellow
$startTime = Get-Date

Set-Location $TERRAFORM_DIR

terraform apply -var-file="terraform.dev.tfvars" -auto-approve

if ($LASTEXITCODE -eq 0) {
    $duration = [math]::Round(((Get-Date) - $startTime).TotalMinutes, 1)
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   [OK] Infrastructure recreee en $duration minutes !" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "   Outputs importants :" -ForegroundColor White
    terraform output alb_dns_name
    terraform output cognito_user_pool_id
    terraform output cognito_client_id
    terraform output ecr_repository_url
    Write-Host ""
    Write-Host "   Pour demarrer les services : .\start-dev.ps1" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "   [!!] Erreur lors de la recreation" -ForegroundColor Red
    Write-Host "   Verifiez les erreurs ci-dessus et relancez" -ForegroundColor Yellow
    Write-Host ""
}
