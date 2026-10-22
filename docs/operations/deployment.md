# Deployment and automation

The application and worker must use the same release and migration state. Applying source changes alone does not update a hosted database.

1. Record the target application revision, migration history, installed function signatures and backup/restore point. The earlier security report records differing local/hosted migration timestamps; reconcile actual schema before pushing any migration. Do not replay a historical migration merely because its timestamp differs.
2. Stop old workers. The readiness migration replaces worker entrypoints with lease-fenced signatures. Mixed old/new workers are unsupported.
3. Test the complete migration set on an empty isolated database, and rehearse the forward migration against a sanitized copy of the target schema.
4. Apply `20261022144348_production_readiness.sql`, then deploy the matching application and worker. This migration is already applied to ORION (`viieuwjfkrwicfpyvyvs`) as hosted version `20261022160438`; see the [activation record](hosted-migration-2026-10-22.md). Do not apply it again to that project.
5. Configure environment values from `.env.example`. `AUTOMATION_SECRET`, `CRON_SECRET` and `EMAIL_ACTION_SECRET` require independently generated random values of at least 32 characters. Never expose server secrets in NEXT_PUBLIC variables.
6. Use exactly one primary scheduler. The selected setup uses `npm run local:start` to run the existing continuous worker on an available machine; no Vercel cron or paid plan is configured. Vercel Hobby's daily cron cannot satisfy the workflow's deadlines. Keep the worker machine awake and connected. An independently configured scheduler may call POST /api/automation/tick with an Authorization bearer token, but do not run duplicate schedulers. See [free-plan operation](free-plan.md).
7. Set APP_URL to the actual reachable origin, configure Auth redirect allowlists, and verify Resend sender ownership and webhook signature configuration.
8. Run the authenticated acceptance journey below before using real sensitive reports.

## Health and alerting

GET `/api/automation/health` requires the same automation credential as tick and returns only aggregate health information. It reports queue age, dead jobs, expired leases, time since the last completed tick and overall health. HTTP 503 indicates an unavailable/unhealthy worker or a backlog needing investigation. Authenticated credentials must remain in monitor secret configuration, not a URL.

Configure an external alert for failed ticks, a health 503, increasing overdue age, or expired leases. Set provider cost budgets and alerts in the provider accounts. Source configuration does not establish that these monitors or budgets are active.

If no tick has completed, health is unhealthy until the worker starts. Dead jobs require investigation even after newer work succeeds. A recovered/superseded job is not evidence that every previous external effect was absent.

## Acceptance journey

Use disposable accounts in one institution and an adversarial member in another. Submit an ordinary report and an approval-required report. Check real model output, scoped operator approval, assignment email receipt, signed webhook delivery, login-bound acknowledgement, evidence upload, agent review and an independent human decision. Repeat with rejection, a staff handover and a temporary provider failure, leaving all browsers closed while a future reminder becomes due.

Record the exact deployed SHA, schema migration version, outcome and limits in the release record. Do not label a successful build or an isolated SQL test as live-provider acceptance.
