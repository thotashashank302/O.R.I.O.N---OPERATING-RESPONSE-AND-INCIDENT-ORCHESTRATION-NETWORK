# ORION - 16-Hour Master Implementation Plan

## Product identity

**ORION** means **Operational Response & Intelligent Orchestration Network**.

ORION is a role-based, multi-college campus operations platform. CRs raise public departmental incidents, eligible students vote to express impact, any verified student can privately report safety or CR-related complaints, and four connected AI agents coordinate each incident until it reaches a verified resolution.

The website is the control surface. The agent workflow is the product:

`Report -> Triage -> Plan -> Delegate -> Act -> Monitor -> Verify -> Replan or close`

## Sixteen-hour success definition

By Hour 16 the team must have one deployed, mobile-responsive application that demonstrates:

1. Principal creates a college and authorizes an HOD.
2. HOD authorizes a CR and operational staff.
3. CR creates a public incident with a photo and location.
4. Students in the relevant department vote once.
5. A private safety/CR complaint bypasses the public feed and voting.
6. The four-agent workflow creates and executes an incident plan.
7. A real assignment email is sent to a controlled test inbox.
8. A missed acknowledgement causes a reminder or escalation.
9. Staff submit a resolution for verification instead of directly closing it.
10. Failed verification reopens the incident and causes a visibly changed plan.
11. Every decision and action appears in an audit timeline.
12. A short 3D ORION introduction runs smoothly and can be skipped.

## Scope boundaries

### Must work end to end

- Institution onboarding and role authorization.
- Student, CR, HOD, principal/admin, and operations-staff experiences.
- Public incidents, department voting, confidential reports, assignment, acknowledgement, resolution evidence, verification, escalation, and replanning.
- Electrical, cleaning/maintenance, IT/network, security/access, hostel, and transport categories through one configurable specialist-agent design.
- Test-inbox email delivery and in-app notification fallback.
- One polished flagship demo: water leakage near a hostel electrical switchboard.

### Thin but present

- Club president authorization and club request list.
- College blocks, rooms, departments, transport routes, and asset counts.
- Basic campus analytics.

### Not in the 16-hour build

- Production integrations with college ERP systems.
- Real emergency-service contact, automatic power shutdown, door unlocking, disciplinary action, or payments.
- Hardware sensors, native mobile apps, full predictive maintenance, or complex GIS maps.
- Fully autonomous handling of sensitive complaints.

## Fixed technical direction

- **Application:** Next.js App Router, TypeScript, Tailwind CSS.
- **Backend:** Next.js server routes/actions.
- **Database, files and identity:** Supabase Auth, Postgres, Storage and Row Level Security.
- **AI:** OpenAI-compatible provider adapter configured with `AI_BASE_URL`, `AI_API_KEY`, and `AI_MODEL`; structured JSON validated with Zod. This allows the organizer-required model/provider to be swapped in without rewriting the workflow.
- **Email:** Resend adapter targeting controlled team inboxes, with an in-app outbox as a visible fallback.
- **3D:** React Three Fiber/Three.js, loaded only on the public introduction screen.
- **Deployment:** Vercel plus Supabase.
- **Shared state:** Postgres incident state and append-only incident-event timeline.

Do not add a heavy multi-agent framework during the hackathon. The four agents are separate server modules with distinct prompts, schemas, tools, permissions and event records, coordinated by an explicit state machine.

## The four meaningful agents

### Triage Agent

- Understands the report and photo metadata.
- Extracts category, location, affected asset, impact and safety signals.
- Asks one targeted clarification when required.
- Finds likely duplicates and recommends merging.
- Produces a structured `TriageResult`.

### Incident Commander

- Owns the incident lifecycle.
- Calculates priority using safety first, then criticality, impact/votes, recurrence and waiting time.
- Activates only relevant specialist profiles.
- Creates an ordered task graph with dependencies.
- Selects assignees using role, skill, zone, availability and workload.
- Escalates, retries, or creates a revised plan after failure.
- Requires human approval for dangerous, sensitive or irreversible actions.

### Specialist Agent

- Uses one reusable engine with electrical, facilities, IT, security, hostel and transport profiles.
- Generates department-specific diagnosis and action checklists.
- Requests missing information and assigns human staff.
- Sends the assignment email and records delivery.
- Reviews staff updates before forwarding them for verification.

### Verification Agent

- Is independent from the specialist that proposed the work.
- Selects evidence requirements by incident category.
- Checks staff notes, photos, test results and authorized human confirmation.
- Returns `verified`, `needs_more_evidence`, or `failed` with reasons.
- On failure, hands control back to the commander for replanning.

Timers and SLA checks are deterministic application logic, not a fifth LLM agent.

## Shared product contracts

### Roles

`principal`, `campus_admin`, `hod`, `cr`, `student`, `department_supervisor`, `field_staff`, `transport_admin`, `club_president`, `faculty_coordinator`

### Visibility

- `public_department`: eligible department students can view and vote.
- `restricted`: reporter and assigned operational/academic roles can view.
- `confidential`: reporter and explicitly authorized officials only; never appears in public counts or email lists.

### Incident states

`reported`, `triaging`, `needs_clarification`, `planned`, `awaiting_approval`, `assigned`, `acknowledged`, `in_progress`, `submitted_for_verification`, `resolved`, `reopened`, `escalated`, `cancelled`

### Minimum tables

- `institutions`, `departments`, `campus_locations`
- `profiles`, `institution_memberships`, `cr_assignments`, `staff_capabilities`
- `student_roster`, `transport_enrollments`, `club_terms`
- `incidents`, `incident_votes`, `incident_links`
- `incident_plans`, `incident_tasks`, `assignments`
- `resolution_evidence`, `approvals`, `notifications`, `email_outbox`
- `incident_events`

Only Developer 1 changes shared enums or table contracts after Hour 2.

### Required structured outputs

- `TriageResult`: category, secondary risks, location, impact, confidence, clarification question, duplicate candidates.
- `IncidentPlan`: priority, explanation, specialists, ordered tasks, dependencies, SLA, approval requirement.
- `SpecialistAction`: department profile, assignee criteria, checklist, communication action, evidence expected.
- `VerificationDecision`: verdict, missing evidence, confidence, failure reason, recommended next action.

Do not display hidden chain-of-thought. Display concise decision explanations and every tool action.

## UI intake gate for every developer

Before implementing any assigned screen, the developer's coding agent must ask the developer:

1. Upload the supplied UI template, screenshot, Figma export, or reference.
2. Identify the route and user role for the screen.
3. Confirm desktop/mobile target and required interactions.
4. Identify loading, empty, success, validation, permission-denied and failure states.
5. Confirm whether existing shared components must be reused.

The agent should inspect the uploaded reference before coding and state what assets/data it still needs. It must not invent user facts or silently replace the supplied design. If no template is available within the time box, use the shared fallback design: deep navy/graphite surfaces, high-contrast typography, cyan for active intelligence, amber for attention, red only for danger, rounded cards, restrained motion, and a persistent agent-activity rail.

## 3D ORION introduction

Time box: 90 minutes of implementation plus 30 minutes of optimization.

- Begin with a dark campus-grid environment.
- Four luminous nodes labeled Triage, Commander, Specialist and Verification orbit a central incident signal.
- A red incident pulse causes the nodes to connect in sequence.
- The network converges into the word **ORION**.
- Reveal the full form: **Operational Response & Intelligent Orchestration Network**.
- Transition directly into sign-in/college selection after 5-7 seconds.
- Include Skip, keyboard access, `prefers-reduced-motion`, mobile static fallback and lazy loading.
- No audio dependency and no large external 3D model.
- If frame rate or loading misses the Hour 12 quality gate, switch mobile to the static fallback and retain 3D only for capable desktop devices.

## Sixteen-hour execution clock

### Hour 0-1 - Alignment and setup

- Developer 1 creates the repository, app, environment template, branch rules, route skeleton and shared types.
- Team reviews this master plan and each member's plan.
- Every developer submits their UI reference or accepts the fallback design.
- Freeze the flagship incident and test accounts.

**Gate:** App boots, everyone has a branch, environment keys are identified, and no one is inventing a separate schema.

### Hour 1-4 - Part A: independent foundations

- Developer 1: schema, auth helpers, shared event contract and AI provider adapter.
- Developer 2: college onboarding, membership and authorization foundation.
- Developer 3: CR report form, student incident feed and voting foundation.
- Developer 4: HOD/staff queues and incident-state controls.
- Developer 5: design system, shell, 3D prototype and email adapter.

**Gate:** Each member demonstrates their Part A locally and commits. Developer 1 merges only passing work.

### Hour 4-10 - Part B: working product flows

- Connect role authorization to route permissions.
- Connect public/private reports to storage and database.
- Implement four agent modules and incident state machine.
- Connect staff assignment, acknowledgement, progress and verification submission.
- Connect real test email, notification outbox and accelerated demo timers.

**Gate:** At Hour 10 the flagship incident can travel from CR submission to staff assignment and appear in all relevant dashboards.

### Hour 10-13 - Part C: closure, replanning and product breadth

- Implement evidence policies, verifier outcomes, reopening and revised plans.
- Add private-report permissions and sanitized audit events.
- Add thin transport and club views using the same authorization model.
- Finish 3D intro, responsive states and agent timeline.
- Seed deterministic demo data.

**Gate:** At Hour 13 one successful resolution and one failed/replanned resolution both work end to end.

### Hour 13-15 - Integration and hardening

- All developers stop feature creation.
- Run the complete acceptance matrix on desktop and mobile.
- Fix authorization leaks, broken state transitions, email failures, loading states and layout regressions.
- Verify confidential incidents never appear in public feeds, analytics, emails, or logs visible to ordinary users.
- Test provider failure and email fallback.

### Hour 15-16 - Submission and rehearsal

- Deploy the final candidate and test it in a private/incognito window.
- Confirm public repository, meaningful incremental commits, README and setup instructions.
- Record the three-minute demo using deterministic seed data.
- Rehearse the live demo and two-minute Q&A.
- Freeze code 20 minutes before the deadline unless fixing a demo-blocking issue.

## Five-person ownership and handoffs

| Developer | Ownership | Critical handoff |
|---|---|---|
| 1 - Team Lead | Architecture, database contracts, auth/RLS, four-agent engine, integration, deployment | Stable contracts by Hour 2; integrated build at every gate |
| 2 - Identity Platform | Institution setup, college structure, roster, memberships, authorizations, club terms | Role lookup and authorization APIs to Developers 3 and 4 |
| 3 - Student/CR | Public/private intake, uploads, feed, voting, clarification and reporter verification | Valid incident records and votes to Developer 1 |
| 4 - Operations | HOD/staff dashboards, assignment lifecycle, evidence and manual verification | Valid staff actions/evidence to agent engine |
| 5 - Experience/Comms | Shared UI, 3D intro, timeline presentation, email, notifications and QA | Reusable components and working communication tools |

## Vibe-coding working protocol

- Each developer receives only the current task from their Part A/B/C queue, not a giant implementation prompt.
- The coding agent must restate the acceptance check before editing.
- After the task: run checks, show changed files, explain the flow, and wait for the developer to approve the next task.
- One feature branch per developer: `dev1-core`, `dev2-identity`, `dev3-student-cr`, `dev4-operations`, `dev5-experience`.
- Commit after each verified task using `feat(area): outcome`, `fix(area): issue`, or `test(area): coverage`.
- No unreviewed direct pushes to the integration branch.
- Schema changes, role changes and state changes require Developer 1 approval.
- Prefer small shared interfaces over copying components or types.

## End-to-end acceptance matrix

1. Unauthorized users cannot self-assign privileged roles.
2. Roll number is checked against the institution roster and paired with verified email login.
3. A CR can report only within an active authorization term.
4. One eligible student can cast only one vote; votes influence impact but cannot outrank safety policy.
5. A private safety/CR complaint is invisible to ordinary students and unrelated staff.
6. Triage asks for clarification on an incomplete report.
7. Commander activates multiple specialist profiles for a cross-department incident.
8. Task dependencies prevent cleaning from being marked ready before leak/electrical work.
9. Assignment email reaches the controlled test inbox and records delivery/fallback.
10. Missing acknowledgement triggers a reminder/escalation without an LLM deciding the clock.
11. Staff cannot directly set `resolved`; they can only submit evidence for verification.
12. Verification requirements differ by incident type.
13. Failed verification produces a new plan version and visible changed action.
14. High-risk action enters `awaiting_approval` and cannot execute without an authorized human.
15. Agent/provider or email failure produces a recoverable state and visible retry/fallback.
16. The complete demo works on a mobile viewport without horizontal overflow.

## Three-minute demo story

- **0:00-0:15:** ORION 3D intro and one-sentence problem.
- **0:15-0:35:** Principal/HOD authorization hierarchy.
- **0:35-1:00:** CR reports hostel water leaking near a switchboard; students vote.
- **1:00-1:35:** Triage identifies dual risk; Commander produces an ordered plan; relevant specialist actions are delegated.
- **1:35-1:55:** Test email is delivered; simulated SLA expiry triggers a transparent reminder/escalation.
- **1:55-2:25:** Staff submit incomplete evidence; Verification rejects it.
- **2:25-2:45:** Commander reopens and creates Plan Version 2 with a changed assignee/action.
- **2:45-3:00:** Principal dashboard shows auditability, safety approvals and verified resolution.

The presenter must explicitly say that demo time is accelerated and that real production intervals are policy-configured.

