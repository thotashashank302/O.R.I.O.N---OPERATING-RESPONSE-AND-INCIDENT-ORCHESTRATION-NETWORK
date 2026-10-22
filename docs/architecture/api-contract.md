# API and orchestration contract

Cookie authentication establishes the user. Requests operating in a selected institution supply `x-orion-institution-id` and `x-orion-membership-id`. These headers are untrusted preferences: the server reloads membership, institution and current role grants before authorizing them. Worker secrets and service database keys never belong in a browser.

JSON responses place results in `data` and failures in `error`; operational failures use stable public messages. Use the specific version field in the table below. A stale or already-decided mutation returns a conflict; an uncertain database response never invokes an alternative implementation of its writes.

| Endpoint | Contract |
| --- | --- |
| `GET /api/incidents?cursor=…` | Authorized page of up to 50 incidents and nextCursor. Votes are aggregated in the same database call. Treat the cursor as opaque. |
| `POST /api/incidents` | Validated report with a retained operationId. The transaction enforces reporting role/scope and intake quota and commits report, attachments, audit and planning intent together. |
| `GET /api/incidents/:id` | Uses the same case policy as database RLS. Reporter-only actions remain explicitly marked. |
| `POST /api/incidents/:id/clarifications` | answer (2–1000 characters) and expectedVersion; atomically records clarification, audit and durable planning intent. |
| `POST /api/incidents/:id/confirm` | Reporter decision, reason and expectedVersion. The authoritative transaction inspects current submitted task/evidence versions and designated independent verifier rules. |
| `POST /api/approvals/:id/decision` | Current principal/admin or scoped HOD; decision, action_payload_hash, plan_version, optional reason (required for rejection). Locks the current case/task/approval, prevents self/conflicted/stale decisions and executes the exact approved payload. |
| `POST /api/incidents/:id/override` | Current scoped operator; expected_version and reason. Priority-only changes use new_priority. Assignment/verifier replacement requires a specific task_id plus new_assignee_membership_id or new_verifier_membership_id. All writes and audit commit together. |
| `POST /api/assignments/:id/actions` | Current assignee; action and expected_version. The database is the only mutation implementation. Block/handover preserves ownership pending explicit operator transfer. |
| `POST /api/uploads` | fileName, integer fileSize, permitted mimeType and optional incidentId. Returns a private signed upload and owned registry key. |
| `GET /api/tasks/:id/evidence` | Case-authorized current evidence with private photo links expiring after 60 seconds. Refresh to obtain new links. |
| `POST /api/tasks/:id/evidence` | Current active assignee; kind, content, optional storage_key and expected_assignment_version. Checks a real owned object for photos and commits append/audit under locks. |
| `GET /api/verification` | Current member's designated submitted tasks from active, readable plans. |
| `POST /api/tasks/:id/verify` | evidence_version, human_result (`confirmed`/`rejected`), rejection_reason and trigger=`human`. Only the designated active independent verifier may decide. |
| `POST /api/staff/me/availability` | Current staff context and expected_version; off-duty staff with open work choose keep or handover. Availability, ownership request and audit commit together. |
| `GET /api/automation/health` | Automation Bearer credential; aggregate queue/tick health only. Returns 503 when unhealthy/unavailable. |
| `GET or POST /api/automation/tick` | Scheduler-only strong Bearer credential; awaits bounded worker completion and records heartbeat. Vercel cron uses GET. |
| `POST /api/webhooks/resend` | Signature-verified, deduplicated, timestamp-aware delivery state. Provider events do not acknowledge staff work. |
| `POST /api/email-actions/acknowledge` | Authenticated user, single-use signed token and exact current assignment version, nonce and expiry. GET links do not mutate. |
| `GET or PATCH /api/notifications` | Selected-context headers; only the member's own notifications. Read updates use expectedVersion. |
| `GET /api/incidents/:id/timeline` | Selected-context headers and case authorization; safe events only. |

The `/approvals` and `/verification` desks expose the corresponding human workflows. Sensitive operations reload authority at commit time; displaying a control is never authorization.

## Worker boundary

Registered jobs are commander_enqueue, commander, specialist, verification, ack_reminder, assignment_escalation, verifier_reminder, verifier_escalation and outbox_delivery. Triage executes during intake. Job claim identity consists of job ID, worker ID and attempt generation. Persistence, renewal and completion reject an expired/reclaimed claim. Model calls remain bounded and model text cannot lower the trusted approval floor.

Replanning refuses unreconciled active assignments. An operator must explicitly transfer ownership instead of allowing a replacement plan to silently abandon an existing owner. Pending approvals bind exact staff/checklist/evidence JSON and active plan version; the decision transaction does not regenerate an action through an LLM.

All new public ORION RPCs are service-only and the new child-table RLS policies remain effective for direct authenticated database reads. The generated database contract records the required fenced signatures; stop older workers before activating the additive migration.
