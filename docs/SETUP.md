# Guide de Configuration — Wcomply sur AWS

## Vue d'ensemble

Ce guide vous accompagne étape par étape pour mettre en place l'infrastructure complète de Wcomply.

---

## Étape 1 — Prérequis à installer

```bash
# AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip && sudo ./aws/install

# Terraform
brew install terraform   # macOS
# ou : https://developer.hashicorp.com/terraform/downloads

# GitHub CLI
brew install gh   # macOS
# ou : https://cli.github.com/

# Docker Desktop : https://www.docker.com/products/docker-desktop/

# Node.js 20 : https://nodejs.org/
# Python 3.11 : https://www.python.org/
```

---

## Étape 2 — Créer le repository GitHub

```bash
# Se connecter à GitHub
gh auth login

# Créer l'organisation (si pas encore faite)
# → Aller sur https://github.com/organizations/new

# Créer le repo
gh repo create votre-org/wcomply \
  --private \
  --description "Application de gestion commerciale Wcomply" \
  --clone

# Copier les fichiers du projet
cp -r /chemin/vers/wcomply/* ./wcomply/
cd wcomply

# Premier commit
git add .
git commit -m "feat: initialisation infrastructure Wcomply"
git push origin main
```

---

## Étape 3 — Configurer AWS

### 3.1 Créer un compte AWS IAM pour Terraform

```bash
# Configurer vos credentials AWS root (une seule fois)
aws configure
# AWS Access Key ID: [votre clé]
# AWS Secret Access Key: [votre secret]
# Default region name: eu-west-1
# Default output format: json

# Créer un utilisateur IAM dédié Terraform
aws iam create-user --user-name wcomply-terraform

# Attacher les permissions nécessaires
aws iam attach-user-policy \
  --user-name wcomply-terraform \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess

# Créer les clés d'accès
aws iam create-access-key --user-name wcomply-terraform
# → Notez l'AccessKeyId et SecretAccessKey !
```

### 3.2 Créer le bucket S3 pour le state Terraform

```bash
# Créer le bucket S3
aws s3api create-bucket \
  --bucket wcomply-terraform-state \
  --region eu-west-1 \
  --create-bucket-configuration LocationConstraint=eu-west-1

# Activer le versioning
aws s3api put-bucket-versioning \
  --bucket wcomply-terraform-state \
  --versioning-configuration Status=Enabled

# Activer le chiffrement
aws s3api put-bucket-encryption \
  --bucket wcomply-terraform-state \
  --server-side-encryption-configuration '{
    "Rules": [{"ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"}}]
  }'

# Créer la table DynamoDB pour les locks
aws dynamodb create-table \
  --table-name wcomply-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region eu-west-1
```

### 3.3 Déployer l'infrastructure avec Terraform

```bash
cd infrastructure/terraform

# Créer le fichier de variables
cat > terraform.tfvars << EOF
aws_region       = "eu-west-1"
environment      = "prod"
db_password      = "MotDePasseSecurisé123!"
ms_tenant_id     = "votre-tenant-id"
ms_client_id     = "votre-client-id"
ms_client_secret = "votre-client-secret"
domain_name      = "wcomply.com"
EOF

# Initialiser Terraform
terraform init

# Prévisualiser les changements
terraform plan

# Déployer (⚠️ va créer des ressources AWS facturées)
terraform apply
```

---

## Étape 4 — Configurer Azure AD pour Outlook

1. Aller sur https://portal.azure.com
2. **Azure Active Directory** → **App registrations** → **New registration**
3. Remplir :
   - Name : `Wcomply`
   - Supported account types : `Accounts in this organizational directory only`
   - Redirect URI : `https://auth-wcomply-prod.auth.eu-west-1.amazoncognito.com/oauth2/idpresponse`
4. **API permissions** → Add permission → Microsoft Graph :
   - `Mail.Read` / `Mail.Send`
   - `Calendars.Read` / `Calendars.ReadWrite`
   - `User.Read`
   - `offline_access`
5. **Certificates & secrets** → New client secret → Copier la valeur
6. **Overview** → Copier **Application (client) ID** et **Directory (tenant) ID**

---

## Étape 5 — Configurer les secrets GitHub Actions

```bash
# Depuis le dossier du projet
gh secret set AWS_ACCESS_KEY_ID       --body "votre_key"
gh secret set AWS_SECRET_ACCESS_KEY   --body "votre_secret"
gh secret set COGNITO_USER_POOL_ID    --body "eu-west-1_XXXXXXXX"
gh secret set COGNITO_CLIENT_ID       --body "votre_client_id"
gh secret set COGNITO_DOMAIN          --body "https://auth-wcomply-prod.auth.eu-west-1.amazoncognito.com"
gh secret set AMPLIFY_APP_ID          --body "votre_amplify_app_id"
```

---

## Étape 6 — Configurer AWS Amplify (Frontend)

```bash
# Installer Amplify CLI
npm install -g @aws-amplify/cli

# Connecter votre repo GitHub à Amplify
# → Console AWS → Amplify → New app → Host web app → GitHub
# → Sélectionner le repo wcomply → branche main → dossier frontend/

# Variables d'environnement à configurer dans Amplify Console :
NEXT_PUBLIC_API_URL=https://api.wcomply.com
NEXT_PUBLIC_COGNITO_USER_POOL_ID=eu-west-1_XXXXXXXX
NEXT_PUBLIC_COGNITO_CLIENT_ID=votre_client_id
NEXT_PUBLIC_COGNITO_DOMAIN=https://auth-wcomply-prod.auth.eu-west-1.amazoncognito.com
```

---

## Étape 7 — Premier déploiement Backend

```bash
# Se connecter à ECR
aws ecr get-login-password --region eu-west-1 | \
  docker login --username AWS --password-stdin \
  VOTRE_ACCOUNT_ID.dkr.ecr.eu-west-1.amazonaws.com

# Build et push de l'image
cd backend
docker build -t wcomply-backend .
docker tag wcomply-backend:latest \
  VOTRE_ACCOUNT_ID.dkr.ecr.eu-west-1.amazonaws.com/wcomply-backend:latest
docker push \
  VOTRE_ACCOUNT_ID.dkr.ecr.eu-west-1.amazonaws.com/wcomply-backend:latest
```

---

## Architecture finale déployée

```
Internet
    │
Route 53 (wcomply.com)
    │
    ├── app.wcomply.com ──→ AWS Amplify (Next.js)
    │
    └── api.wcomply.com ──→ ALB
                              │
                           ECS Fargate
                           (FastAPI)
                              │
                    ┌─────────┼──────────┐
                    ▼         ▼          ▼
                  RDS      Cognito    Secrets
               PostgreSQL  (Auth)    Manager
                              │
                         Microsoft
                        (Outlook + Copilot)
```

## Coûts estimés (AWS eu-west-1)

| Service | Coût mensuel estimé |
|---------|---------------------|
| RDS PostgreSQL (db.t3.medium) | ~60€ |
| ECS Fargate (2 tasks) | ~40€ |
| ALB | ~20€ |
| Amplify | ~5€ |
| Cognito (jusqu'à 50k users) | Gratuit |
| Secrets Manager | ~1€ |
| **Total estimé** | **~130€/mois** |
