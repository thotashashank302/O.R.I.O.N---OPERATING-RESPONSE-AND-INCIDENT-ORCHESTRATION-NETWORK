# ORION

ORION is a multi-college incident coordination proof of concept. Its working expansion is **Operating Response and Incident Orchestration Network**; final branding still requires team confirmation.

Campus complaints often reach someone, but ownership, follow-up and proof of resolution get lost. ORION is designed for principals, administrators, HODs, class representatives, students and operational staff to move an incident from an authorized report to accountable human verification.

## Current implementation status

This checkout is the Developer 1 integration baseline, not the finished application.

Implemented and locally verified:

- Next.js 16 App Router, React, TypeScript, Tailwind and pinned lockfile.
- Shared role, incident, task, assignment, job, email, HTTP and agent contracts.
- Supabase migration for tenant-owned identity, incidents, plans, tasks, assignments, approvals, evidence, durable jobs, agent runs, outbox and audit state.
- Explicit Data API grants, RLS foundations, fresh-membership helpers and confidential-case read rules.
- Featherless OpenAI-compatible server adapter with timeout, schema validation, one bounded repair attempt and visible failures.
- Commander module with severity-floor, eligible-profile, dependency-cycle, maximum-task and material-replan enforcement.
- Specialist module with fresh staff eligibility/capacity checks, approval and evidence-policy safeguards, and transactional assignment persistence.
- Per-agent tool allowlists; model output cannot directly run SQL, change permissions, contact arbitrary recipients or close physical work.
- Persistent worker contract with leases, priority for urgent/outbox jobs, idempotency fields, bounded retries and dead-job human escalation.
- Safe cancellation, duplicate-link, 24-hour reopen and verified-task carry-forward policy helpers.
- Protected automation tick and tightly gated “Simulated deadline” route.
- Resend outbox transport, generic React Email notification, verified/deduplicated webhooks, signed single-use acknowledgement, own-recipient notifications and authorized incident timeline.
- Unit/fixture coverage, responsive browser checks and a production build.

Not yet integrated or externally verified:

- Real registration/role administration and two-tenant sessions (Developer 2).
- Report/vote/private-intake UI and Triage module (Developer 3).
- Staff actions, evidence, human verification and Verification module (Developer 4).
- Shared product shell and D2 context selector (Developer 5; blocked on the approved UI reference).
- Applied Supabase migration/RLS tests, live Featherless calls, real email receipt, hosted Cron, deployed E2E, public URL, video and submission receipt.
- P1 transport/club/feedback surfaces and P2 3D intro/map/analytics.

## Autonomous incident loop

The planned loop is more than routing an email:

1. **Triage** classifies untrusted report text, identifies missing context and suggests safe same-scope duplicates.
2. **Commander** creates a versioned, dependency-aware plan with bounded tasks, evidence policies and approval gates.
3. **Specialist** selects current eligible staff from database facts and proposes only allowlisted actions.
4. **Verification** evaluates structured evidence while designated humans inspect photos and perform functional/safety checks.
5. Deterministic jobs monitor acknowledgement and verifier deadlines with the browser closed. A failure returns current facts to Commander; a valid replan must change an assignment, task, dependency, evidence requirement or escalation route.

One underlying Featherless model may power all four modules, but each module has its own prompt, Zod schema, tool permissions and persisted run. No hidden chain-of-thought is stored.

## Architecture and safety boundaries

```text
Next.js route/service
  -> fresh Supabase membership + scope check
  -> durable job (leased and deduplicated)
  -> owner agent -> common Featherless adapter -> Zod validation
  -> allowlisted server tool -> transactional state/outbox
  -> staff action + evidence -> AI assistance + required human verification
  -> resolve, remain pending, escalate, or create a changed plan version
```

Every tenant-owned row carries `institution_id`; composite foreign keys prevent cross-tenant references. Authorization comes from current memberships and time-bounded role grants, never editable user metadata or a client-supplied role. Inactive membership is checked again on protected work. Confidential cases are excluded from broad reads and duplicate processing, and the accused identity is denied access.

Staff submit work for verification; they do not directly resolve incidents. Photos stay private and are human-reviewed because the starting model is text-only. High-risk physical, emergency, access-control and sensitive-case decisions remain human responsibilities.

## Local setup

Requirements: Node.js 22+ and npm.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Configure placeholders in `.env.local`; never commit credentials. The browser may receive only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. `SUPABASE_SECRET_KEY`, Featherless, scheduler, Resend and action-token secrets are server-only.

Apply the migration to an isolated linked/local Supabase project, then regenerate `src/contracts/database.ts` from that project before feature integration. Do not reset shared or production data.

```bash
npx supabase migration list --local
npx supabase db push
npx supabase test db
```

Optional non-personal demo fixtures require an approved isolated demo project and `DEMO_MODE=true`:

```bash
npm run seed:demo
```

The seed deliberately does not create users, passwords, role grants, inboxes or private incidents. Those must use authorized flows and team-controlled accounts.

## Featherless configuration

The default model ID is `meta-llama/Llama-3.3-70B-Instruct` through `POST /v1/chat/completions`, temperature `0.1`, concurrency one and a 30-second timeout. Account access, latency and the exact model must be confirmed with a real request before claiming AI-01. A fixture response proves parsing and safeguards, not live provider availability.

## Scheduler and communications

Configure Supabase Cron (or an approved equivalent) to call `POST /api/automation/tick` every minute with `Authorization: Bearer <AUTOMATION_SECRET>`. The route awaits a bounded worker and leaves unfinished persistent jobs for a later tick; it does not rely on detached work or browser timers. Verify the deployed function timeout before enabling it.

Email is modeled as `queued -> sending -> sent -> delivered|failed|bounced|suppressed`. `sent` means provider acceptance; `delivered` means the recipient server accepted it; neither means a staff member acknowledged work. Acknowledgement is a separate authenticated POST. The outbox, transport, webhook and action-link code are locally implemented; controlled-inbox and webhook evidence are still required before real delivery is claimed working.

## Verification

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run test:e2e
```

Current local result: typecheck and lint passed; 22 unit tests in 5 files passed; the production Webpack build passed; three Chromium E2E tests passed; and desktop/mobile acknowledgement captures were visually checked. Supabase pgTAP, two-tenant user-token tests, live provider/email tests and deployed recovery tests still require their runtimes and credentials. See `docs/integration-status.md` and the developer progress files for exact evidence and blockers.

## Controlled demo

Use an isolated demo college and distinct team-controlled Principal, HOD, CR, Staff A, Staff B and Student accounts. Never publish passwords, real student identifiers, private complaint data, provider IDs or signed attachment URLs. “Simulated deadline” may advance a selected job only when demo mode, allowlisted email, active demo-college membership and a current principal/admin grant all match.

## Deployment, video and screenshots

- Deployed application: **not deployed from this checkout**.
- Three-minute video: **not supplied**.
- Product screenshots: **not supplied**.

These links must be added only after the integrated commit is deployed and checked from a clean session. No public repository, hosted resource or submission was created by this implementation pass.

## Team responsibilities

- Developer 1 / Shashank: architecture, shared contracts, migration integration, authorization policy, provider/runner, Commander, jobs, integration, release and README.
- Developer 2: identity, college setup, roster and role administration.
- Developer 3: reports, voting, private intake, reporter actions and Triage.
- Developer 4: staff operations, evidence, approvals, human verification and Verification.
- Developer 5: shared UI, Specialist, email/outbox/webhooks, notifications, timeline and demo production.

See `docs/OWNERSHIP.md` for paths and handoff rules. Standard foundations used here are Next.js, React, Tailwind CSS, Supabase JS/SSR, Zod, Vitest and Playwright. No proprietary assets or copied UI templates are included.
