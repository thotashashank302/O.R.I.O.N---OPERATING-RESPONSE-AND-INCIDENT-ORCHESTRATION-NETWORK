# Developer 2 Plan - Institution, Identity and Role Authorization

## Mission

Build the trusted organizational network the agents operate on: colleges, locations, rosters, memberships, role appointments and capability lookup. Privileged roles are appointed, never self-selected.

Read the master plan first. Ask for and complete one numbered task at a time.

## UI preflight

Before building onboarding or authorization screens, ask the developer to upload the intended layout/template and clarify principal/admin/HOD routes, mobile behavior, form steps, validation, empty states and confirmation states. Reuse the shared shell. If no template arrives by the task deadline, use the fallback design in the master plan.

## Part A - Hours 1-4: institution foundation

### A1 - College onboarding

- Build principal sign-up entry and institution creation form.
- Capture institution name/code, verified email domain when available, address and essential campus metadata.
- Make the creator a pending principal until the demo verification rule succeeds.

**Accept when:** one principal creates an isolated institution without seeing any other institution.

### A2 - Campus structure

- Add departments, blocks, floors, rooms/labs and basic asset counts.
- Keep forms fast; asset counts are metadata, not full inventory management.

**Accept when:** the incident form can query valid locations for the selected institution.

### A3 - Student roster and membership

- Support demo CSV/preseeded roster lookup using institution plus roll number.
- Pair roster match with verified email identity.
- Never use roll number alone as authentication.

**Accept when:** an unknown roll number is rejected and a valid student is assigned the correct department/year/section.

## Part B - Hours 4-10: appointments and role tools

### B1 - Privileged-role appointment

- Principal can appoint campus admin, HOD and club/faculty leadership.
- HOD/admin can appoint CRs, department supervisors and field staff within authorized scope.
- Record inviter, start date, expiry date and active/revoked state.

**Accept when:** users cannot promote themselves and expired CR appointments stop granting CR actions.

### B2 - CR authorization

- Assign CR by department, section, academic year and term.
- Support boy/girl CR labels as institution metadata without hard-coding gender permissions.
- Add revoke/replace flow with audit event.

**Accept when:** five AIML sections can each have two active CR appointments and the HOD can replace one safely.

### B3 - Staff capabilities

- Add skill, department, campus zone, availability and workload fields.
- Expose a server-side assignee-candidate lookup for the Specialist Agent.

**Accept when:** the agent can request available electrical staff for a hostel zone without receiving cleaners or other-college users.

### B4 - Transport and clubs

- Add transport enrollment verification with route/bus metadata.
- Add club-president term plus faculty coordinator.
- Keep both thin; do not build full transport or event-management products.

**Accept when:** only verified route users can vote on routine route issues, and expired presidents lose club-management permission.

## Part C - Hours 10-16: dashboards, policy and hardening

### C1 - Principal/admin overview

- Show institution setup progress, role appointments and basic department/location counts.
- Add high-risk approval queue entry point supplied by Developer 1.

**Accept when:** principal can understand who has authority without opening raw database views.

### C2 - HOD authorization experience

- Show pending members, active CRs, staff capability gaps and expiring terms.
- Add clear confirmation and undo/revoke safeguards.

**Accept when:** HOD can complete the demo appointment flow in under 30 seconds.

### C3 - Authorization tests

- Test self-promotion, cross-department appointment, expired terms and cross-institution access.
- Test that confidential-role metadata is not exposed to students.

**Accept when:** every negative test returns a safe permission error and no sensitive payload.

### C4 - Handoff and polish

- Document role lookup and candidate lookup contracts for Developers 1, 3 and 4.
- Supply deterministic demo accounts and credentials through the approved secret-sharing method, not the repository.
- Help with final mobile and empty-state QA after Hour 13.

## Do not compromise

- No client-side-only authorization.
- No roll-number-only authentication.
- No permanent CR/president appointment without a term.
- No principal bottleneck for individual field-staff administration.

