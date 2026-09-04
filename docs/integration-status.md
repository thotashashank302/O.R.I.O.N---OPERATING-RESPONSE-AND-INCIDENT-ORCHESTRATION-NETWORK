# Integration status

Last updated: 4 September 2026.

| Gate | Status | Evidence / dependency |
| --- | --- | --- |
| D1–D5 branch integration | Verified locally | Identity, reporting, operations, UI/comms and orchestration compile together |
| Typecheck, lint and unit tests | Verified locally | 98/98 tests in 12 files pass |
| Production build and browser smoke | Verified locally | Webpack build generated 34 routes; 3/3 Chromium tests pass |
| Shared agent and HTTP contracts | Verified locally | TypeScript compile, schema fixtures and canonical context headers |
| Supabase schema/RLS/job functions | Implemented, not applied | Project responds but `public.institutions` is absent; Docker daemon is unresponsive, so pgTAP was not run |
| Featherless adapter | Credential verified, inference pending | `GET /v1/plan` returned 200; selected 70B completion timed out |
| Triage, Commander, Specialist and Verification | Integrated and fixture verified | Live full-loop run requires the applied database and a responsive model request |
| Browser-independent durable worker | Unit verified | Live Cron/hosting timeout and lease recovery need deployed environment |
| Email/outbox integration | Implemented; send-only key recognized | Resend returned `restricted_api_key` for domain listing; controlled inbox delivery/webhook still required |
| Notifications, timeline and secure acknowledgement | Implemented and locally verified | Live authenticated two-user/RLS test requires applied Supabase migration |
| Shared product UI and context selector | Integrated locally | Live authenticated acceptance requires applied Supabase schema |
| Full report-to-replan slice | Code integrated | Runtime acceptance blocked by unapplied schema and external provider latency |
| Deployment, video, submission receipt | Not performed | Requires user/team approval, accounts and official destination |

No email was sent and no remote schema was changed during this pass. No deployment or public-repository mutation has been made.
