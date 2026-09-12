# Workflow security remediation — 11 September 2026

The supplied findings are valid. Findings 4–6 and 9/12 overlap: independent writes and broad RPC fallbacks bypassed transactional safeguards. The fixes below are implemented in source and verified locally. **The workflow repair and hardening migrations have now been applied to the connected ORION Supabase database with user approval.**

| Finding | Change |
| --- | --- |
| 1: HOD verification bypass | Human task verification requires explicit task designation and active membership in its institution. HOD role possession grants no exception. Accused members and the current assignee cannot verify. Agent and escalation work is worker-only. |
| 2: Evidence version | The locked task must be submitted with the exact current evidence version. Notes, functional tests and machine-readable policy kinds must come from its completed current assignment. Confirmation requires a current agent review; free-text evidence policies remain subject to agent and physical human review. |
| 3: Audit identity | Human decisions store the verifier membership and their own audit event. New human records without an actor violate a database constraint. Legacy records are preserved without inventing missing identities. |
| 4: Concurrent verification | Incident/task locks plus a unique task/evidence decision ledger prevent duplicate or conflicting decisions. State, audit and durable replan request commit together. |
| 5: Reporter race | Reporter confirmation uses only its locked, expected-version database transaction. |
| 6: Unsafe fallbacks | Removed TypeScript persistence fallbacks from reporter, Commander and Specialist paths. An uncertain result never triggers another implementation of the writes. |
| 7: Upload sizes | Strict schema rejects strings, NaN, infinity, zero, negatives, fractions and sizes over 5MB before signing. Storage's independent 5MB bucket limit remains required. |
| 8: Upload quota | Membership/institution-scoped rolling-hour quota in Postgres, serialized across connections; no process-local Map. |
| 9/12: Partial intake | One transaction writes incident, attachments, triage run, audit, operation result and durable Commander-enqueue job. It enforces quota under a membership lock. Location lookup errors stop creation. HTTP intake requires a UUID operationId. The form retains the exact payload and uploaded keys for retries after an uncertain response. |
| 10: Automation errors | Stable public failure message; details stay in server logs. |
| 11: Authorization errors | Membership/grant lookup failures stop authorization and return controlled HTTP 503 responses across callers. |
| 13: Coverage | Added failure-injection and concurrency coverage described below. |

Background agent verification also persists atomically, checks the submitted state/version after the model call, and ignores duplicate or late results. A `commander_enqueue` job records planning intent inside the triggering transaction; its worker builds the existing canonical Commander context and deduplicates the actual Commander job by operation identity. A missing staff profile now retries visibly instead of silently losing planning intent.

## Verified locally

- 124 unit/API tests passed, including invalid upload numbers, unavailable authorization data, quota-store failure, generic automation errors, and uncertain RPC responses in all three former fallback paths.
- 50 assertions passed against native PostgreSQL 18 in a separate temporary database: concurrent human/reporter decisions, stale/missing/wrong-uploader evidence, forbidden HOD/cross-tenant/confidential-accused/self-verification, audit identity, one replan, shared quota, duplicate intake, attachment/audit/agent-write rollback, agent retry/late completion, service-role access and revoked browser RPC access.
- A synthetic database journey exercised intake → Commander persistence → Specialist persistence → staff acknowledge/start → evidence → agent review → duplicate human rejection → one replan → materially changed plan → final human confirmation. No provider call or email delivery was made by this database test.
- ESLint, TypeScript and the production webpack build passed. The production build used a separate temporary checkout so the running localhost build was not replaced.

The local suite alone does **not** establish real JWT/browser acceptance against the new RPCs, live AI output, or email receipt. Supabase platform auth/storage schemas were stubbed only in the isolated SQL test database.

## Activation

1. Apply missing repository migrations in timestamp order to the intended database, including the workflow repair and JSONB fix if still pending, then `20260911140852_harden_workflow_transactions.sql`.
2. Deploy/rebuild the matching application and worker together. Older workers do not recognize `commander_enqueue`; stop them before applying the new migration and restart the updated worker afterward.
3. Run the controlled authenticated journey on that database and check its audit and job results. For local operation, use `npm run local:start` after `npm run build`.

### Activated with user approval

- Hosted project: ORION (`viieuwjfkrwicfpyvyvs`). The repair and hardening migrations both returned success.
- Hosted migration versions are `20260911143055` (repair) and `20260911143109` (hardening). Local filenames remain `20260904230125` and `20260911140852`. The migration service assigned application-time versions; automatic approval review rejected rewriting hosted migration history. **Review this mapping before a future CLI push; do not reapply the same migrations merely because timestamps differ.**
- A hosted rollback-only regression passed wrong-staff rejection, stale assignment versions, missing evidence, pending agent review, durable verification scheduling, human closure, and restricted RPC permissions. Its synthetic rows were rolled back.
- The production build passed and `npm run local:start` restarted localhost:3000 with its worker polling successfully every 10 seconds. Empty ticks reported zero retried/dead jobs.
- Supabase advisors reported informational no-policy notices for intentionally service-only tables and an existing [leaked-password protection setting](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Authentication configuration was not changed.
- Live AI output, email receipt and a new authenticated browser journey remain outside these activation checks.

## Repeat the isolated SQL tests

`scripts/test-security-db.mjs` connects only to `127.0.0.1:55439` using a dedicated test server (`postgres` / `local-test-only`), creates its own `orion_security_*` database, applies the actual migrations, runs assertions, and drops that test database. It never reads `.env` or a hosted connection URL. It needs a separately installed `pg` package; set `ORION_TEST_PG_MODULE` to that package's `lib/index.js` path. Native PostgreSQL binaries are deliberately excluded from the source package.

Reference for database function transactions and restricted invoker permissions: [Supabase database functions](https://supabase.com/docs/guides/database/functions).
