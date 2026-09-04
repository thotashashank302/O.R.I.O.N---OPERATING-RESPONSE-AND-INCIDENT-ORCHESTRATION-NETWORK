# Developer 3 Plan - Student and CR Incident Experience

## Mission

Build the trustworthy front door to ORION: public CR-raised department incidents, student impact voting, private safety/CR reporting, clarification and reporter-side tracking.

Read the master plan first. Ask for and complete one numbered task at a time.

## UI preflight

Before building the report form, feed or private-report experience, ask the developer to upload the intended layout/template and identify target route, mobile layout, interactions, photo treatment, form states and accessibility requirements. Inspect the reference before coding. Use shared components and the fallback design only when no template is supplied within the task window.

## Part A - Hours 1-4: intake foundation

### A1 - Role-aware student shell

- Build student feed/navigation and CR-only create action.
- Show active college, department and section context.
- Hide privileged actions rather than only disabling them, while preserving server enforcement.

**Accept when:** a normal student cannot open the public incident creation action.

### A2 - CR public incident form

- Capture title/description, location, photo, affected asset and immediate-danger flag.
- Use institution locations supplied by Developer 2.
- Store the photo through the shared storage policy.

**Accept when:** a valid active CR creates an incident with a durable image reference and audit event.

### A3 - Public incident feed and voting

- Show category, priority, status, location, vote count and concise agent explanation.
- Limit voting to eligible institution/department members and one vote per user.
- Do not allow vote totals to directly set safety priority.

**Accept when:** duplicate voting fails safely and unrelated department students cannot vote.

## Part B - Hours 4-10: private reporting and agent interaction

### B1 - Confidential report flow

- Allow every verified student to report emergency/safety issues or complaints about CRs.
- Skip public feed and voting.
- Display exactly who may access the report before submission.
- Avoid including sensitive detail in broad email notifications.

**Accept when:** the report is visible to the reporter and authorized recipients but absent from public queries/counts.

### B2 - Triage clarification

- Render `needs_clarification` state and the Triage Agent's single focused question.
- Submit the response and resume orchestration.

**Accept when:** an incomplete location report pauses, accepts clarification and continues without creating a second incident.

### B3 - Duplicate/related incident experience

- Show a non-destructive suggestion when the agent finds a likely duplicate.
- Preserve each reporter while linking or merging into a parent incident.
- Transfer impact without leaking private incident data.

**Accept when:** two public reports can become one operational incident with both reporters retained.

### B4 - Student status experience

- Show a readable progress timeline based on safe incident events.
- Translate technical agent events into concise user-facing status.
- Add notification/read indicators.

**Accept when:** students can tell what is happening without seeing hidden reasoning or confidential staff data.

## Part C - Hours 10-16: verification and quality

### C1 - Reporter/CR confirmation

- For eligible categories, let the CR/requester confirm fixed or still failing.
- Ask category-specific functional questions rather than demanding a photo for every issue.
- Send rejection reason to the Verification Agent.

**Accept when:** “still failing” moves the incident to verification failure/reopen through server logic.

### C2 - Category-specific evidence presentation

- Cleaning/leak: before/after visual evidence.
- Electrical/AC/fan: technician test plus authorized functional confirmation.
- IT/network: diagnostic result plus affected-user check.
- Security/access: action log plus requester confirmation.
- Transport: transport action plus next-service confirmation.

**Accept when:** the UI requests only the correct confirmation type for the incident.

### C3 - Mobile and accessibility pass

- Optimize report creation, voting and timeline for a common mobile viewport.
- Add photo preview/removal, progress, error retry, focus states and readable severity labels.
- Respect reduced motion.

**Accept when:** the complete student/CR path works with keyboard and mobile dimensions without overflow.

### C4 - Demo preparation

- Seed the flagship CR report and eligible voters through shared seed tools.
- Rehearse live submission and a private-report privacy proof.
- Stop new features at Hour 13 and assist end-to-end testing.

## Do not compromise

- Public complaint creation remains CR-authorized.
- Every verified student retains a private direct safety/CR complaint channel.
- Voting is one-person/one-vote and is only an impact signal.
- Private report content never appears in public UI, counts or broad notifications.

