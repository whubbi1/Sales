# Wcomply — Application de Gestion Commerciale

## Stack Technique
- **Frontend** : Next.js 14 (React)
- **Backend** : Python / FastAPI
- **Base de données** : PostgreSQL (AWS RDS)
- **Hébergement** : AWS (Amplify + ECS Fargate + RDS)
- **Auth** : AWS Cognito + Microsoft SSO (Outlook)
- **IA** : Microsoft Copilot / Azure OpenAI

---

## Architecture AWS

```
┌─────────────────────────────────────────────────────┐
│                    Route 53 (DNS)                   │
└──────────────────────┬──────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
  AWS Amplify     API Gateway      CloudFront
  (Frontend)      (Backend)        (Assets)
  Next.js         ↓
                ECS Fargate
                (FastAPI)
                  │
        ┌─────────┼─────────┐
        ▼         ▼         ▼
      RDS       Cognito   Secrets
   PostgreSQL   (Auth)    Manager
```

---

## Structure du Projet

```
wcomply/
├── .github/
│   └── workflows/          # CI/CD GitHub Actions
│       ├── frontend.yml    # Deploy frontend → AWS Amplify
│       └── backend.yml     # Deploy backend → AWS ECS
├── infrastructure/
│   └── terraform/          # Infrastructure as Code
│       ├── main.tf
│       ├── variables.tf
│       ├── outputs.tf
│       ├── rds.tf          # Base de données PostgreSQL
│       ├── ecs.tf          # Conteneurs FastAPI
│       ├── cognito.tf      # Authentification
│       └── secrets.tf      # Gestion des secrets
├── frontend/               # Application Next.js
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   └── lib/
│   │       └── msalConfig.ts  # Config Outlook/Microsoft
│   └── package.json
├── backend/                # API FastAPI
│   ├── app/
│   │   ├── main.py
│   │   ├── routers/
│   │   ├── models/
│   │   └── services/
│   │       ├── outlook.py  # Intégration Outlook
│   │       └── copilot.py  # Intégration Copilot
│   ├── requirements.txt
│   └── Dockerfile
└── docs/
    └── SETUP.md            # Guide de démarrage
```

---

## Démarrage Rapide

### Prérequis
- AWS CLI configuré (`aws configure`)
- Terraform >= 1.5
- Node.js >= 18
- Python >= 3.11
- Docker
- GitHub CLI (`gh`)

### 1. Cloner & configurer
```bash
git clone https://github.com/votre-org/wcomply.git
cd wcomply
cp .env.example .env
# Remplir les variables dans .env
```

### 2. Déployer l'infrastructure AWS
```bash
cd infrastructure/terraform
terraform init
terraform plan
terraform apply
```

### 3. Lancer en local
```bash
# Backend
cd backend && pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend
cd frontend && npm install
npm run dev
```
