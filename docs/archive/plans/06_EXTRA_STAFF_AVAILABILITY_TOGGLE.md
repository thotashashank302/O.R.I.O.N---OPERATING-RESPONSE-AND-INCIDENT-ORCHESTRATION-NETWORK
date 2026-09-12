# Extra Feature - Staff Availability Toggle

## Applies to

- **Developer 1:** Agent assignment logic and integration
- **Developer 2:** Staff identity, authorization and database state
- **Developer 4:** Staff-facing availability toggle and operational UI

This is an addition to the ORION 16-hour implementation plan. Each developer should complete only their assigned section and coordinate through the shared contracts below.

## Feature objective

Operational staff must be able to tell ORION whether they are currently available for new work.

Staff-controlled availability:

- `available`: may receive new assignments.
- `busy`: already working; receive new work only when the Incident Commander explicitly treats it as urgent and policy permits.
- `off_duty`: must not receive new assignments.

This is separate from the administrator-controlled account status:

- `active`: account is authorized to use ORION.
- `inactive`: account access/assignment eligibility is disabled by an authorized administrator or HOD.

An inactive account can never be selected, regardless of staff availability.

## Shared behavior contract

### Assignment eligibility

The Specialist Agent may select a staff member only when:

1. Account status is `active`.
2. Availability is `available`, or it is `busy` and the incident is eligible for urgent override.
3. Staff capability matches the incident category.
4. Staff belongs to the correct institution and authorized department/zone.
5. The staff member has not exceeded the configured workload limit.

### Status-change behavior

- Changing to `available` makes the person eligible for new assignments.
- Changing to `busy` keeps existing assignments and normally prevents additional routine assignments.
- Changing to `off_duty` keeps history but prevents new assignments.
- If a staff member with open assignments chooses `off_duty`, ORION must ask whether the existing tasks should remain assigned or be handed back for reassignment.
- If an administrator changes the account to `inactive`, all uncompleted assignments must be returned to the Incident Commander for immediate reassignment or escalation.
- Every change must record actor, previous value, new value, timestamp and optional reason.

## Developer 2 - Identity and database work

### Task 2X-A - Add availability fields

- Add `account_status` with values `active` and `inactive`.
- Add `availability_status` with values `available`, `busy` and `off_duty`.
- Add `availability_updated_at` and `availability_updated_by`.
- Default newly authorized field staff to `off_duty` until they explicitly become available.

**Acceptance:** A staff profile stores account and availability states independently.

### Task 2X-B - Authorization rules

- Staff can update only their own `availability_status`.
- Principal/Admin/HOD can change `account_status` only within their authorized institution and scope.
- Staff cannot activate their own inactive account.
- Students, CRs and unrelated departments cannot change either field.

**Acceptance:** Direct API/database attempts to bypass these rules fail safely.

### Task 2X-C - Candidate lookup contract

- Extend the staff-candidate query to return account status, availability, workload, capability and zone.
- Exclude inactive and off-duty staff at the server/database layer.
- Return busy staff separately so Developer 1 can apply urgent-override policy.

**Acceptance:** Routine candidate lookup never returns inactive or off-duty staff.

## Developer 4 - Staff UI and operations work

### Task 4X-A - Availability control

- Add a clearly visible availability control to the staff dashboard header.
- Use three explicit choices: `Available`, `Busy`, and `Off duty`.
- Show current state using text and icon as well as color.
- Show saving, saved and failed-to-update states.

**Acceptance:** Staff can change their availability from desktop and mobile, and refresh preserves the selected state.

### Task 4X-B - Open-assignment warning

- When staff with open work selects `Off duty`, show a confirmation dialog.
- Offer `Keep my current tasks` and `Return tasks for reassignment`.
- Do not silently abandon existing assignments.

**Acceptance:** The selected choice produces the correct assignment events and audit entry.

### Task 4X-C - HOD/Admin staff list

- Show account status and current availability beside each staff member.
- Provide the authorized account `Active/Inactive` toggle separately from availability.
- Require confirmation and reason before deactivating someone with open assignments.
- Do not allow HOD/Admin to impersonate a staff member's availability toggle.

**Acceptance:** The two concepts are visually distinct and cannot be confused.

### Task 4X-D - Queue feedback

- Show why an assignment cannot be given: off duty, inactive, capability mismatch, zone mismatch or workload limit.
- Show a clear `No eligible staff available` state with escalation status.

**Acceptance:** HOD can understand why ORION did not assign a person without inspecting logs.

## Developer 1 - Agent and integration work

### Task 1X-A - Eligibility filter

- Update Specialist Agent tools to consume Developer 2's candidate lookup.
- Prefer `available` staff ranked by capability, zone and workload.
- Never allow the LLM to bypass inactive/off-duty filtering.

**Acceptance:** Even if an AI response names an ineligible user, the assignment tool rejects it.

### Task 1X-B - Busy urgent override

- Allow busy-staff selection only for high/critical incidents when policy permits.
- Require the Incident Commander to record the urgency reason.
- Notify the selected staff member and HOD that an urgent override occurred.

**Acceptance:** Routine incidents cannot be assigned to busy staff through prompt manipulation or direct API calls.

### Task 1X-C - Reassignment events

- On `Return tasks for reassignment` or administrator deactivation, emit an assignment-release event.
- Ask the Incident Commander to select the next eligible person.
- If no candidate exists, escalate to department supervisor/HOD instead of looping.
- Add retry limits and idempotency to avoid duplicate emails.

**Acceptance:** One availability change causes at most one reassignment per open task and preserves full history.

### Task 1X-D - Agent timeline

- Record safe user-facing events such as:
  - `Staff member is now off duty.`
  - `Assignment returned for reassignment.`
  - `ORION selected the next available electrician.`
  - `No eligible staff available; escalated to HOD.`
- Do not expose sensitive account details or hidden model reasoning.

**Acceptance:** Judges can see that availability changes dynamically affect autonomous planning.

## Integration sequence

1. Developer 2 completes Task 2X-A and publishes the shared types.
2. Developer 2 completes authorization and candidate lookup.
3. Developer 4 implements the staff and HOD/Admin interfaces.
4. Developer 1 connects candidate selection and reassignment logic.
5. Developers 1, 2 and 4 run the joint scenarios below.

## Joint acceptance scenarios

1. Available electrician receives a routine electrical assignment.
2. Off-duty electrician is never considered.
3. Busy electrician is skipped for a routine incident.
4. Busy electrician may receive a critical incident only with a recorded urgent override.
5. Staff switching off duty can retain or return existing tasks.
6. Returned work is assigned once to the next eligible person.
7. Admin deactivation immediately blocks new work and releases unfinished assignments.
8. No eligible staff causes HOD escalation instead of repeated emails or an infinite agent loop.
9. Unauthorized users cannot manipulate another person's availability or account status.
10. Every state change and reassignment appears in the audit timeline.

## Time box

Budget **45-60 minutes total per involved developer**, performed after their foundational Part A contracts are stable. If time is constrained, preserve database rules, agent filtering and the basic three-state staff control before adding advanced visual polish.

