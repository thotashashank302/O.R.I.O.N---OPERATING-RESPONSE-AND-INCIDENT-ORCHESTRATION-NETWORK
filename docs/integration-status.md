# Integration status

Last updated: 4 September 2026.

| Gate | Status | Evidence / dependency |
| --- | --- | --- |
| Baseline install, typecheck, lint, unit tests, build, browser smoke | Verified locally | `package-lock.json`; commands recorded in D1 progress |
| Shared agent and HTTP contracts | Verified locally | TypeScript compile and schema fixtures |
| Supabase schema/RLS/job functions | Implemented, not applied | Requires linked/local Supabase; pgTAP not run |
| Featherless adapter | Fixture verified | Key is present locally; live request and account entitlement are not verified |
| Commander, Specialist and common tool runner | Fixture verified | Awaiting Triage and Verification modules for full loop |
| Browser-independent durable worker | Unit verified | Live Cron/hosting timeout and lease recovery need deployed environment |
| Email/outbox integration | Implemented and locally verified | Live sender, controlled inboxes, webhook secret and applied migration still required |
| Notifications, timeline and secure acknowledgement | Implemented and locally verified | Live authenticated two-user/RLS test requires applied Supabase migration |
| Shared product UI | Blocked on approved reference | Secure action UI exists; full shell/context selector intentionally not invented |
| Full report-to-replan slice | Blocked | Awaiting Developers 2–4 services, applied database and live providers |
| Deployment, video, submission receipt | Not performed | Requires user/team approval, accounts and official destination |

No external success is inferred from fixture tests. No deployment or public-repository mutation has been made.
