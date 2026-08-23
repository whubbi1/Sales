# Whubbi remediation — remaining work (handoff)

This picks up from the Whubbi Remediation plan (companion doc to the ADG Convergence
Audit / Platform Blueprint, 2026-08-20). Part A items 1 and 2 are done — see
**PR #1**: https://github.com/whubbi1/Sales/pull/1 (`fix/server-side-auth-and-https`,
open, not yet merged, not yet applied to real infra).

No AWS access was available for any of this work. Everything below that needs AWS
(applying Terraform, IAM changes, running against live infra) is written but
**unverified beyond static/syntax checks** — treat it as a draft to review with real
credentials, not as done.

## Before starting anything new

1. Review and merge PR #1.
2. Apply the Terraform in it. It will block on `aws_acm_certificate_validation.main`
   until someone with DNS access for `wcomply.com` adds the CNAME record from the
   `acm_validation_records` output — that's expected, not a bug.
3. Deploy backend and frontend **together**. The backend starts enforcing
   `Authorization: Bearer` on (almost) every route the moment it deploys; the
   frontend only starts sending that header once *its* build is live. A gap between
   the two deploys means either a window where auth is fully open (frontend old,
   backend old — fine) or a window where every logged-in user gets 401s (backend
   new, frontend old) or, less likely, no real risk the other way round. This repo's
   existing CI has no deploy gating (see item 3 below), so backend.yml and
   frontend.yml can land at different times on their own — push both, don't rely on
   one push doing both.

## Part A — remaining security items (this week, independent of Part B)

| Sev | Issue | Fix | Needs AWS/infra access? |
|---|---|---|---|
| **Critical** | Every push to `master` deploys to prod, ungated | Require the test/lint job to pass before merge via branch protection. Remove `continue-on-error` from the frontend quality job and make the deploy job depend on it (`needs: quality`). Add a GitHub Environment with required reviewers on the production deploy step for both `backend.yml` and `frontend.yml`. | GitHub repo admin only, no AWS |
| Moderate | Database SSL disabled | Set `sslmode=require` (or `verify-full` with the RDS CA bundle) in `database.py`'s connection args instead of `ssl=None`. | No — pure code |
| Moderate | Wildcard CORS | Replace `allow_origins=["*"]` with the real frontend origin(s) per environment; disable `allow_credentials` unless every allowed origin is explicit. Lower urgency now that auth is Bearer-token-based rather than cookie-based (see PR #1), but still worth closing. | No — pure code |
| Moderate | No real schema migrations | Adopt Alembic: generate a baseline migration matching the current schema, delete the ad-hoc `ALTER TABLE IF NOT EXISTS` block from `main.py`'s startup path, run `alembic upgrade head` as an explicit deploy step instead. | Needs a DB connection to generate/verify the baseline against |
| Moderate | Long-lived IAM keys in CI | Switch both workflows to GitHub OIDC + `AssumeRole` (`aws-actions/configure-aws-credentials`), then deactivate and delete the long-lived access keys from IAM. See gotchas below — SmartHubbi hit two real issues doing this exact thing. | Yes — IAM role creation |
| Moderate | No high availability | Enable RDS Multi-AZ (single-flag change) and add a second NAT gateway. | Yes — infra change |
| Minor | Stray commit of an agent's working directory | Delete `backend/home/claude/whubbi-backend/` from the tree. No secrets found in it, so a full history purge can wait for a routine cleanup pass. | No — pure code |
| Minor | Terraform state hardcoded to `prod` | Parameterize the S3 backend key per environment and remove the `"prod"` default from `variable "environment"`. | No — pure code, but changing the backend key needs care with existing state |

The four "pure code" rows (DB SSL, CORS, stray directory, Terraform state key) can be
done the same way PR #1 was: written and validated locally (Docker for
Python/Terraform checks, local `npm`/`tsc`/`eslint` for the frontend), then opened as
a PR — no AWS access required to get them merge-ready.

## Part B — architecture rebuild (6–8 weeks, after Part A ships)

This is the larger, longer-term item: moving Whubbi off Terraform/Amplify onto the
same CDK-on-Fargate-behind-ALB pattern SmartHubbi and NirvanaScout use — same
pattern, fully independent code, no shared library (per the "applications should not
share anything" decision). Full detail is in the Whubbi Remediation artifact; the
seven steps are:

1. Stand up Dev and Test on Whubbi's own CDK, alongside the still-live Terraform Prod
2. Move the frontend off Amplify Hosting SSR onto Fargate-behind-shared-ALB
3. Keep FastAPI on Fargate — deliberately, no Lambda rewrite
4. Migrate the database to Aurora Serverless v2 + RDS Proxy
5. Move to per-audience Cognito pools (keeping the working Entra ID federation)
6. Write Whubbi's own gated 10-stage pipeline (build once → Dev → smoke → approve →
   Test → verify → approve → Prod → post-deploy check)
7. Validate parity in Test against prod-equivalent data/traffic, then cut over by DNS
   weight and decommission the old stack

Don't start this until Part A has shipped and merged.

## Things learned this session — read before touching the same code again

- **Cognito has two app clients**: `frontend` (OAuth/PKCE, the one that actually
  issues the ID tokens the browser sends) and `backend` (`ALLOW_USER_PASSWORD_AUTH`,
  unrelated). Any JWT `aud` check must be against `frontend`'s client ID — the
  `backend` one is a red herring.
- **Python decorator/default-arg evaluation is import-time, top-to-bottom, not
  lazy.** A route decorated with `dependencies=[Depends(require_whubbi_access)]`
  before `require_whubbi_access` is defined lower in the file raises `NameError` at
  import time. If you add more protected routes, keep the dependency function
  defined near the top of `settings.py`, before any route that references it.
- **No pip/venv locally** — validate Python changes via Docker:
  `docker run --rm -v $(pwd):/app -w /app python:3.12-slim sh -c "pip install -q -r requirements.txt && python -c 'from app.main import app; print(len(app.routes))'"`
- **No local Terraform binary** — validate via Docker:
  `docker run --rm -v $(pwd):/workspace -w /workspace hashicorp/terraform:1.9 init -backend=false && ... validate`
- **Node/npm ARE available locally** (unlike Python/Terraform) — `npm install`,
  `npx tsc --noEmit`, `npx eslint <files>` all work directly, no Docker needed. Undo
  `npm install`'s incidental `package-lock.json` churn before committing
  (`git checkout -- frontend/package-lock.json`) and `rm -rf node_modules` — it
  regenerates dependency-resolution metadata even when you didn't change any
  dependency.
- **GitHub OIDC trust policies**: if this org has "immutable IDs" enabled, the `sub`
  claim format is `repo:{owner}@{owner_id}/{repo}@{repo_id}:ref:...`, not the classic
  `repo:org/repo:ref:...` — check by decoding a real token in a debug CI step before
  assuming the classic format. AWS also requires the trust policy to condition on
  `sub` or `job_workflow_ref` specifically, not `repository`/`ref` claims separately.
- **Repo push access**: the `SmartHubbiMain` GitHub account needed to be explicitly
  added as a collaborator on `whubbi1/Sales` (Settings → Collaborators and teams →
  Add people) before `git push`/`gh pr create` worked here — a plain `gh auth login`
  wasn't enough.

## Explicitly out of scope / deliberately not touched in PR #1

Don't rediscover these as "new" bugs — they were seen and consciously deferred:

- `bot.py`'s `/messages` (Bot Framework webhook) has no signature verification of its
  own — a separate auth gap (Microsoft Bot Framework JWT, not Cognito).
- `outlook.py`'s `/status` and `/connect` still accept `email` as a client-supplied
  query parameter rather than deriving it from the verified token. They're now
  gated by `require_whubbi_access` (must be a real logged-in WHUBBI member), but a
  logged-in user could still technically query/act using someone else's `email`
  value. Not restructured — would be a larger behavioral change than the auth fix
  called for.
- The MCP server mount and `bot.router` were left completely untouched — different
  or no comparable auth scheme, explicitly out of scope for the Cognito JWT work.
