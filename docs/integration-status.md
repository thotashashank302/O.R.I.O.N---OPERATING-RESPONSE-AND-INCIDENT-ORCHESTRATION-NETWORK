# Integration status

Last updated: 4 September 2026.

| Gate | Status | Evidence / dependency |
| --- | --- | --- |
| D1–D5 branch integration | Verified locally | Identity, reporting, operations, UI/comms and orchestration compile together |
| Typecheck, lint and unit tests | Verified locally | 98/98 tests in 12 files pass |
| Production build and browser smoke | Verified locally | Webpack build generated 34 routes; 3/3 Chromium tests pass |
| Shared agent and HTTP contracts | Verified locally | TypeScript compile, schema fixtures and canonical context headers |
| Supabase schema/RLS/job functions | Applied and SQL-verified | 4 migrations; 34 public tables with RLS; private evidence buckets; cross-tenant rollback probe passed |
| Featherless adapter | Credential verified, inference pending | `GET /v1/plan` returned 200; selected 70B completion timed out |
| Triage, Commander, Specialist and Verification | Integrated and fixture verified | Live full-loop run requires controlled users and a responsive model request |
| Browser-independent durable worker | Unit verified | Live Cron/hosting timeout and lease recovery need deployed environment |
| Email/outbox integration | Implemented; send-only key recognized | Resend returned `restricted_api_key` for domain listing; controlled inbox delivery/webhook still required |
| Notifications, timeline and secure acknowledgement | Implemented and locally verified | Live authenticated two-user acceptance still requires controlled accounts |
| Shared product UI and context selector | Integrated locally | Hosted schema is ready; live authenticated UI acceptance remains |
| Full report-to-replan slice | Code and schema integrated | Runtime acceptance remains blocked by controlled users and Featherless inference latency |
| Deployment, video, submission receipt | Not performed | Requires user/team approval, accounts and official destination |

The four reviewed migrations were applied to the empty hosted ORION project. No email was sent and no deployment was made.
