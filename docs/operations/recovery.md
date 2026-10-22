# Recovery and data handling

## Assignment ownership

Staff block/handover requests retain the existing owner. An authorized principal/admin or department-scoped HOD must explicitly transfer a selected current task through `POST /api/incidents/:id/override`, supplying the incident version, task_id, new_assignee_membership_id and a reason of at least ten characters. The transaction checks duty status, skills, capacity and current authority, releases the old assignment and creates the replacement, deadlines, outbox and audit together. A failed replacement leaves the old owner intact.

The same endpoint accepts new_verifier_membership_id for a submitted task. A replacement must be active, independent of the assignee and not the accused. The new reviewer uses `/verification` to inspect the current evidence.

## Failed jobs

Stop duplicate schedulers and inspect the job, lease owner, attempt count, associated audit and provider receipt before selecting recovery. Do not reset a running lease to “queued.” Expired leases are reclaimed by the worker; older claim generations cannot complete the new claim.

Dead jobs and uncertain external responses need an operator decision. In a reviewed service-only transaction, reset only the selected dead job's status to retry_wait, set due_at to now, clear its lease/worker, reset attempts, and append an audit event with the operator, target and reason. Preserve dedupe keys and original payloads. Before retrying email, reconcile provider receipt/idempotency state; before retrying an assignment, verify current plan/assignment state. This manual recovery operation is deliberately not exposed to an agent or a browser write endpoint.

When replay is obsolete, use the terminal job status `cancelled` and record the reason in audit_events. Preserve its last_error, payload and attempt count; cancellation does not mean the handler succeeded. For a stale or invalid Commander snapshot on a still-open incident, cancel the original job and atomically insert one deduplicated `commander_enqueue` replacement plus an audit link to its ID. This rebuilds the context from current incident data rather than replaying an old payload. Lock the selected jobs/incidents, check current incident versions and active work, and commit the cancellation, replacement and audit together.

The `allow_job_cancellation` enum migration must commit before a transaction uses the new value. Cancelled jobs are excluded by the worker claim predicate; unresolved dead jobs continue to appear in health. A queued replacement remains pending work until a deployed worker processes it.

## Database or release failure

Keep the previous source revision and a verified database backup. Stop workers before changing versions. Prefer a corrective forward migration; new worker signatures and transactions mean simply rolling back application code may be incompatible with the migrated database. Rehearse restoration into a separate target, including Auth identities, database state and private Storage objects. Validate access policies and one controlled lifecycle before reopening writes.

## Retention and privacy

Select an institution-approved retention policy before production. Include confidential cases, evidence photos, audit events, provider logs, orphan uploads, action tokens and backups; deletion must account for foreign keys, legal holds and accountability requirements. This change does not guess a retention duration or delete existing hosted data.

Private image previews expire after one minute. Legacy photographs without a verified owned-object registry binding cannot be previewed or accepted; retain their history and arrange an authorized evidence audit or fresh submission rather than guessing ownership. Upload tickets expire after two hours before first binding; bound evidence remains associated with its incident. Periodically inventory unbound tickets and orphan Storage objects under the approved policy. Never delete an object solely because a client request timed out: an incident transaction may have committed.

Document and test both database and private-object restore procedures. A database-only backup does not establish recovery of evidence images or provider delivery history.
