# Developer 5 progress

Status: core implementation complete locally; live communications and full shared UI remain blocked by external inputs.

Implemented:

- `SpecialistAgent` with a strict context/output schema, eligible-staff membership checks, current availability/capacity checks, required-profile checks, approval enforcement, critical-alert enforcement and evidence-policy preservation.
- Production worker handlers for `specialist` and `outbox_delivery` jobs.
- Transactional Specialist context/persistence functions that recheck the active plan, incident version, dependencies, staff capability version and workload before assigning.
- Generic React Email assignment template that excludes incident descriptions and other confidential details.
- Resend transport with deterministic provider idempotency keys, demo-recipient allowlisting and separate `sent` versus `delivered` state.
- Durable signed acknowledgement links scoped to token ID, assignment ID/version, intended membership, nonce and expiry. Only the nonce hash is stored in the token table; an authenticated encrypted envelope preserves an identical retry payload.
- Raw-body Resend webhook verification, provider-event deduplication and timestamp-aware status processing.
- Authenticated POST acknowledgement with current membership, active assignment, version, expiry and single-use checks enforced in one database transaction. GET only renders confirmation and never mutates state.
- Role-filtered incident timeline API, own-recipient notification API with optimistic version checks, timeline/notification components, and secure acknowledgement error/loading/success/mobile states.
- Confidential timeline RLS correction: `incident_events` now uses the same authorized incident read predicate instead of tenant-wide visibility.

Local verification on 4 September 2026:

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm test` passed: 22 tests in 5 files.
- `npx next build --webpack` passed. The default Turbopack build is blocked on this machine because its CSS helper cannot bind an internal port (`EPERM`), not by a compile error.
- `npm run test:e2e` passed: 3 Chromium tests, including 390×844 acknowledgement UI and missing-link behavior.
- Desktop and mobile review captures are in `.impeccable/review/`.

Still required before Developer 5 can be called externally complete:

- Complete the still-empty communications values in the current `.env`: `RESEND_FROM`, `RESEND_WEBHOOK_SECRET`, `DEMO_RECIPIENT_ALLOWLIST` and `DEMO_ADMIN_EMAILS`. The API/action/automation secret fields are present but have not been validated against live providers. Never commit any of them.
- Apply the migration to an isolated/linked Supabase project and run pgTAP plus authenticated two-user tests. No local Supabase CLI/database was available in this checkout.
- Send to controlled inboxes, retain provider IDs privately, receive signed webhooks and measure assignment-to-inbox latency. Fixture/build tests do not prove delivery.
- Supply/approve the UI reference before the shared application shell and D2 context selector are implemented. The current secure action page only extends the incumbent minimal visual system.
- Integrate D2 identity/context, D3 intake/Triage and D4 operations/Verification services for the full incident loop.
- Optional intro remains P2 and should be skipped until core integration is stable and its design/form is approved.
- Deployment, communications QA on the hosted URL, and demo recording/package remain pending.
