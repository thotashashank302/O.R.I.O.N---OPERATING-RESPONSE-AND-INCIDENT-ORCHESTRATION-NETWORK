# Shared API and orchestration contract

All successful JSON responses use `{ "data": ..., "requestId": "..." }`; failures use `{ "error": { "code": "...", "message": "..." }, "requestId": "..." }`. Mutations require a current authenticated membership, scope checks, Zod validation and `expectedVersion`; stale requests return `409`.

The complete endpoint ownership matrix remains in the handoff package. This checkout currently implements:

- `POST /api/automation/tick`: scheduler-only Bearer secret; runs a bounded leased worker and awaits completion.
- `POST /api/demo/advance`: available only in demo mode; requires a real authenticated user, allowlisted email, active demo-college membership and current principal/admin grant. It advances only a selected queued/retry job and logs “Simulated deadline.”
- `POST /api/webhooks/resend`: verifies the raw body with Resend's signing secret, deduplicates provider events and records timestamp-aware transport state. It returns `503` for verified events that cannot be persisted so delivery can be retried.
- `POST /api/email-actions/acknowledge`: cookie-authenticated, single-use assignment acknowledgement. The signed token is checked against the current user, membership, assignment version, nonce hash and expiry in one transaction.
- `GET|PATCH /api/notifications`: requires `x-orion-institution-id` and `x-orion-membership-id`; returns only the selected member's notifications and marks one read with `expectedVersion`.
- `GET /api/incidents/[incidentId]/timeline`: requires the same selected-context headers and returns only safe events after the caller passes confidential-incident read authorization.

The common agent output schemas are `TriageResult`, `IncidentPlan`, `SpecialistAction` and `VerificationDecision`. The Commander validates a maximum of five tasks, unique IDs, known dependencies, an acyclic graph, eligible profiles, the deterministic severity floor and material change on replanning.

Job handlers are intentionally registered by owner. The production worker currently registers Commander, Specialist and outbox delivery. Triage and Verification handlers must still be supplied by Developers 3 and 4 before the complete loop can be claimed.
