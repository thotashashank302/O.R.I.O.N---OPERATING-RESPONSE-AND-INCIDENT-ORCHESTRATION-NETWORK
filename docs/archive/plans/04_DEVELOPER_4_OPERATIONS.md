# Developer 4 Plan - HOD, Staff Operations and Resolution Workflow

## Mission

Build the human execution side of ORION: HOD oversight, department queues, staff acknowledgement, progress, evidence submission and category-appropriate manual verification. Staff request resolution; they never close their own work.

Read the master plan first. Ask for and complete one numbered task at a time.

## UI preflight

Before building HOD or staff dashboards, ask the developer to upload the intended layout/template and clarify target roles, queue layout, mobile behavior, actions, evidence presentation, empty states and failure states. Inspect the reference before coding. Reuse the shared shell and status components.

## Part A - Hours 1-4: operational queues

### A1 - HOD dashboard foundation

- Show department incidents by priority, SLA risk, state and assignee.
- Provide filters for unacknowledged, escalated, awaiting approval and awaiting verification.
- Link to CR authorization supplied by Developer 2.

**Accept when:** HOD sees only authorized departments and can identify the most urgent case immediately.

### A2 - Staff work queue

- Show assigned tasks, dependency state, location, checklist, deadline and safe incident context.
- Provide accept/reject with reason.

**Accept when:** unrelated staff cannot access an assignment and blocked dependent work is clearly marked.

### A3 - State actions

- Implement acknowledge, start, blocked and progress update through Developer 1's state machine.
- Require a reason/evidence when marking blocked.

**Accept when:** UI cannot force an invalid transition or set an incident directly to resolved.

## Part B - Hours 4-10: execution and oversight

### B1 - Specialist action presentation

- Render the Specialist Agent's checklist and ordered dependencies.
- Allow staff to request clarification from the specialist/commander.
- Keep generated guidance advisory when safety approval is required.

**Accept when:** electrical and maintenance staff see different bounded instructions for the same flagship incident.

### B2 - Resolution submission

- Build `Submit for verification` form with cause, work performed, parts/equipment, remaining limitation and required evidence.
- Let category policy decide whether photo, diagnostic/test result or human functional check is required.

**Accept when:** incomplete required evidence is rejected before verification.

### B3 - HOD controls

- Allow HOD to reassign, escalate, approve bounded actions and override category/priority with a mandatory reason.
- Preserve every override in the append-only event log.
- Notify HOD only for high-risk, overdue, rejected or approval-required incidents to prevent alert fatigue.

**Accept when:** HOD can intervene without deleting or rewriting prior history.

### B4 - Internal issue verification

- Add manual functional checks for fan/AC, computer/projector and network issues.
- Permit appropriate verifier roles: CR, lab assistant-equivalent staff or HOD according to policy.

**Accept when:** an internal issue can be verified without pretending a photograph proves it works.

## Part C - Hours 10-16: failure, escalation and analytics

### C1 - Verification outcomes

- Show verified, needs-more-evidence and failed outcomes.
- Let staff respond to missing evidence without opening a duplicate assignment.
- Route failed outcomes back to the Commander.

**Accept when:** failed verification returns a clear reason and cannot silently close.

### C2 - Reopened incident experience

- Display Plan Version 1 versus Plan Version 2 and changed assignment/action.
- Highlight escalation owner and new deadline.

**Accept when:** staff and HOD understand why the incident reopened and what changed.

### C3 - Operational metrics

- Show counts for open, overdue, verification-failed and resolved incidents plus response time.
- Keep analytics institution/department scoped and exclude confidential details.

**Accept when:** principal/HOD views cannot reveal private complaint text through aggregates or drill-down.

### C4 - Demo and negative testing

- Rehearse accept, no-acknowledgement escalation, incomplete evidence and failed verification.
- Test direct-resolve attempts, cross-role access and dependency bypass.
- Stop feature development at Hour 13 and assist integration QA.

## Do not compromise

- Staff cannot close their own work.
- Evidence rules vary by category.
- HOD overrides require reasons and immutable history.
- Safety approval and task dependencies cannot be bypassed from the UI.

