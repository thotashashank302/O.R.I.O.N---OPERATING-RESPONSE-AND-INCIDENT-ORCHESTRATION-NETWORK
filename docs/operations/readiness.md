# Production-readiness change record

This tracks the 20 findings from the 22 October review. “Implemented” refers to repository source; hosted activation and live acceptance remain separate.

| Finding | Repository change | Release verification |
| --- | --- | --- |
| 01 Confidential child reads | Shared case checks and child-table RLS; service reads use the same policy | Isolated SQL tests; hosted policies/grants and nonmember denial verified; live account acceptance pending |
| 02 Role revocation scope | Explicit institution guard, existing FK retained | Unit regressions |
| 03 Approval authority/concurrency | Current scoped operator checks, self-conflict denial, active-plan/hash binding, row-locked immutable decision | Concurrent approval and failure/rollback SQL tests |
| 04 Model-controlled safety | Matching trusted approval floor in application and database | Electrical false-approval regression |
| 05 Approval continuation | No pre-assignment reminder IDs; exact approved action executes transactionally | Full approval → one assignment/outbox/deadline test |
| 06 Assignment fallback | Removed fallback writes; authoritative RPC only | Rejection and uncertain-response regression |
| 07 Unsafe override | Explicit task/version, eligible staff checks and atomic transfer | Failed/successful replacement SQL tests |
| 08 Scope authorization | Server derives/checks CR, transport and club scope and current terms | Unauthorized scope SQL tests; multi-scope product acceptance pending |
| 09 Scheduler frequency | Continuous local worker; no paid Vercel cron configured | Worker credentials, uptime, scheduler auth and no-browser SLA test pending |
| 10 Handover reconciliation | Existing owner retained; explicit scoped transfer; replanning refuses live unreconciled ownership | Transfer rollback SQL tests; authenticated staff journey pending |
| 11 Evidence integrity | Owned ticket plus actual object metadata, locked append/version and audit | Missing/owned object and stale-assignment SQL tests |
| 12 Clarification partial state | Incident update, audit and durable planning intent commit together | Injected job failure rollback SQL test |
| 13 Worker races | Lease generation/owner checks, heartbeat renewal and stale escalation guards | Real claim/reclaim SQL tests and worker regressions |
| 14 Email redirection | Removed personal fallback; demo destinations fail closed | Recipient tests; actual sender/receipt/webhook acceptance pending |
| 15 Verifier interface | Shared verification desk, private evidence previews and exact-version decisions; action approval desk | Build/route tests; real authenticated browser journey pending |
| 16 Dependency advisories | Patched framework, test runner and affected transitive packages | Fresh production audit; remaining development-only advisories documented in release summary |
| 17 Reproducible CI | Pinned pg/CLI, isolated compose database and GitHub workflow | Local checks; hosted Actions execution and required branch checks pending |
| 18 Migration/restore evidence | Additive migration and coordinated deployment/restore runbooks | Target history reconciled and migration applied; restore rehearsal pending |
| 19 Feed limits | Authorized cursor pagination and aggregate vote facts in one RPC | Multi-page SQL regression and browser feed controls |
| 20 Operations/retention | Protected aggregate health endpoint and recovery/alert/retention runbooks | Monitor/budget activation, approved retention policy and restore drill pending |

The migration does not rewrite previously applied files or existing human verification history. Existing hosted workers must stop before the new function signatures are activated. Production data remains out of scope for local verification.

## Hosted activation — 22 October 2026

The migration is applied to ORION as `20261022160438_production_readiness`. Hosted policies, service grants, worker signatures and nonmember RLS denial passed verification; existing record counts are unchanged. Application/worker deployment and live acceptance remain pending. The [activation record](hosted-migration-2026-10-22.md) includes the local/hosted version mapping, health findings and advisor follow-ups.

The follow-up `allow_job_cancellation` migration is applied as `20261022162548`. Five historical failures were audited and cancelled; three fresh planning requests are queued for the updated worker. The cancellation regression brings the isolated PostgreSQL suite to 114 assertions.

The project owner selected Supabase Free and declined a paid upgrade. Native leaked-password protection remains disabled because Supabase restricts it to Pro and above; this risk is explicitly deferred, not reported as fixed. No paid scheduler is configured. See [free-plan operation](free-plan.md) for the remaining worker setup and release limits.

## Local verification — 22 October 2026

- Lint and TypeScript passed; the production build passed with placeholder public configuration.
- 138 unit/route tests passed across 17 files.
- 110 PostgreSQL assertions passed on a fresh disposable Compose database, including direct authenticated-role RLS reads, concurrent approval, rollback, lease reclaim and valid-evidence human closure.
- Six public browser checks passed; eight account-dependent browser cases were skipped because isolated accounts were not configured.
- Production dependency audit returned zero advisories. The full audit retains five development-package findings through one unpatched braces dependency chain; see [audit disposition](../testing/dependency-audit.md).
- Workflow and Compose YAML parsed successfully; documentation links were checked. Hosted GitHub Actions, Supabase Auth/Storage integration, AI/email delivery, deployment and restore/retention acceptance remain pending.
