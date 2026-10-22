# ORION hosted migration — 22 October 2026

The readiness migration was applied successfully to Supabase project ORION (`viieuwjfkrwicfpyvyvs`, Tokyo). The project was resumed from its paused state and reached ACTIVE_HEALTHY before schema changes.

| Item | Recorded value |
| --- | --- |
| Source file | `supabase/migrations/20261022144348_production_readiness.sql` |
| Source SHA-256 | `b2689b19bd9f4daf3ae8bd2846f79ac62d688ae9cf7c49acb53e908656eb9586` |
| Hosted migration | `20261022160438_production_readiness` |
| Application and worker | Matching source staged locally; deployment pending |

The Supabase migration tool assigned the hosted timestamp. The source file is preserved unchanged. Earlier hosted repair/hardening versions are `20260911143055` and `20260911143109`; their differing local timestamps were already documented. No historical migration was replayed and no hosted migration history was rewritten. Compare this mapping and actual schema before any future CLI push; a timestamp difference alone does not mean the migration needs application.

## Preconditions and verification

- The existing tables, legacy worker entrypoints, decision ledger, storage columns and service Storage SELECT grant matched the migration prerequisites.
- No queued/retry/running jobs, active worker leases or other application transactions were observed immediately before application. No local Node process had an ORION checkout as its working directory. These observations do not disable an independently configured external scheduler.
- An initial connector request expired. Schema and history checks showed it had not applied; one retry succeeded. The new history entry and schema were verified afterward.
- All eight child-table SELECT policies now enforce case checks.
- The three public worker entrypoints now require worker identity and claim attempt. No legacy public overloads remain. Missing claims are rejected with the expected serialization failure.
- All public `orion_*` and worker persistence RPCs inspected deny EXECUTE to anon/authenticated and grant it to service_role.
- Both new private tables have RLS enabled, no anon/authenticated SELECT grant, and service access. All three new safety/scope/upload triggers exist.
- An authenticated UUID without membership saw zero rows across incidents and eight child tables.
- Service feed and verification queue reads for nonexistent memberships returned empty arrays. Read and lease-fence smoke checks ran inside rolled-back transactions.
- Counts remained: 12 incidents, 9 tasks, 3 assignments, 4 evidence records, 3 verification records, 18 jobs and 3 outbox messages. Counts alone are not a content-integrity checksum.

## Remaining release gates

Deploy the matching app and worker before enabling traffic or automation; the old worker signatures are incompatible. GitHub publication, application deployment, Auth/Storage browser acceptance, provider delivery and restore rehearsal were not performed by this migration.

The health RPC reports five historical dead jobs, no expired leases or overdue ready jobs, and no tick heartbeat. The dead jobs predate this migration. Investigate their causes before retrying any job, and verify heartbeat after deploying the worker. A migration smoke check does not mark a worker tick successful.

The security advisor reports one warning: [leaked-password protection is disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). It also reports 19 informational RLS-without-policy notices; these tables currently deny client reads and use service access. Do not add permissive policies merely to clear the notices.

Performance notices include 92 [foreign keys without covering indexes](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys), one [missing primary key](https://supabase.com/docs/guides/database/database-linter?lint=0004_no_primary_key) on the existing upload-attempt log, and nine unused indexes. Review query workload and retention before adding or dropping indexes. Advisor notices do not establish measured performance at production scale.

## Follow-up: historical job recovery

After the project owner's explicit recovery request, source migration `20261022162420_allow_job_cancellation.sql` was applied as hosted version `20261022162548_allow_job_cancellation`. The enum adds a truthful terminal `cancelled` state; it does not change claim permissions or report a failed handler as successful.

Inspection found two obsolete jobs on an already-resolved incident, two exhausted/time-out planning jobs on unplanned incidents, and one planning job with an invalid legacy snapshot missing required context fields. A separate reviewed transaction locked the selected rows, checked incident states and versions and the absence of active work, cancelled all five originals, queued three fresh `commander_enqueue` replacements, and wrote five audit records linking replacements and reasons. The original job payloads, errors and attempt counts were preserved.

Verification: zero dead jobs, five audited cancellations with original errors, three queued recovery requests, and unchanged counts for incidents/tasks/assignments/evidence/verifications/outbox. No email was sent and no worker tick was fabricated. The three open reports still require the matching deployed worker and provider acceptance. Health remains unhealthy without a genuine worker heartbeat and while pending work ages.

Local regression verification now passes 114 PostgreSQL assertions, including cancellation exclusion from claims and preservation of unresolved-failure health semantics, plus 138 unit tests and TypeScript validation.

The organization API confirms the Free plan. The project owner subsequently declined paid plans, so native leaked-password protection remains disabled and explicitly deferred. No upgrade was purchased. The source now uses the existing local worker with no Vercel cron configured; see [free-plan operation](free-plan.md). Worker/provider credentials are absent from this checkout and its shell environment, so the three recovery requests remain queued and no completed worker heartbeat has been recorded.
