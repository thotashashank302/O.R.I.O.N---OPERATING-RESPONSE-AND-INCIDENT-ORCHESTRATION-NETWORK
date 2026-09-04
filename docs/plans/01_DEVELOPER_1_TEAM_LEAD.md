# Developer 1 Plan - Team Lead, Architecture and Agent Orchestration

## Mission

You own the heaviest path: repository health, shared contracts, security boundaries, the four-agent engine, integration, deployment and the final demo. You do not build every screen; you make every contributor's work operate as one product.

Read `00_MASTER_IMPLEMENTATION_PLAN.md` before starting. Give your coding agent one numbered task at a time.

## UI preflight

Before touching the app shell, agent timeline or principal overview, ask the developer to upload the intended layout/template and specify route, role, mobile behavior, interactions and states. Inspect it before implementation. If none is supplied by the Part A deadline, use the master fallback design without blocking backend work.

## Part A - Hours 0-4: contracts and foundation

### A1 - Bootstrap and safeguards

- Create Next.js TypeScript project, lint/typecheck scripts and environment template.
- Establish routes for intro, auth and role dashboards.
- Create the five branches and merge policy.
- Add placeholder adapters; never commit secrets.

**Accept when:** every team member can run the same app and typecheck succeeds.

### A2 - Freeze shared contracts

- Define roles, visibility levels, incident states and agent output schemas.
- Define database schema and migrations for the master-plan tables.
- Add organization scoping to every tenant-owned record.
- Add append-only incident event helper.

**Accept when:** Developers 2-5 can import shared types and schema names without creating duplicates.

### A3 - Auth and authorization core

- Implement server-side session helper and role/capability checks.
- Add baseline RLS policies; never trust a role supplied by the client.
- Add protected route layout and permission-denied state.

**Accept when:** a student cannot load principal/HOD/staff data through either UI or direct request.

### A4 - AI provider contract

- Build one provider adapter with structured Zod output and timeout/error handling.
- Add prompt/version metadata to agent events.
- Add a deterministic mock provider for integration tests and demo fallback.

**Accept when:** one fixture produces a validated `TriageResult`, and malformed AI output fails safely.

## Part B - Hours 4-10: four-agent workflow

### B1 - Triage Agent

- Consume incident text, metadata, vote count and image reference.
- Return category, risks, confidence, clarification and duplicates.
- Store explanation and agent event.

**Accept when:** an incomplete report asks one question and the flagship report identifies water plus electrical risk.

### B2 - Incident Commander

- Implement safety-first priority calculation.
- Produce versioned plans, relevant specialist profiles, ordered tasks, dependencies, SLA and approvals.
- Never let votes override a safety classification.

**Accept when:** the flagship plan isolates the area before electrical/leak/cleaning completion.

### B3 - Specialist Agent and tools

- Implement parameterized profiles for facilities, electrical, IT, security, hostel and transport.
- Give the agent bounded tools: role lookup, assignee selection, task creation, evidence request and email dispatch.
- Record every tool invocation as an incident event.

**Accept when:** only relevant specialists activate and the selected human has a matching capability/zone.

### B4 - Verification Agent

- Implement category-specific evidence policies and three verdicts.
- Ensure the verifier is a separate call/module from the specialist.
- Hand failures back to Commander with explicit reasons.

**Accept when:** incomplete evidence cannot close an incident.

### B5 - State machine and policy guardrails

- Centralize allowed transitions.
- Require approval for dangerous, sensitive, expensive or irreversible action types.
- Add idempotency so retries cannot duplicate assignments/emails.

**Accept when:** invalid transitions, duplicate tool calls and unapproved high-risk actions are rejected.

## Part C - Hours 10-16: integration, replanning and delivery

### C1 - Replanning

- Trigger Plan Version 2 on failed verification, rejected assignment or exhausted SLA escalation.
- Require a materially changed assignee, task, evidence request or escalation path.
- Show the difference between plan versions.

**Accept when:** the flagship failed resolution visibly changes the response plan.

### C2 - Integration gates

- Merge one developer at a time after their acceptance checks.
- Resolve contracts centrally; do not allow parallel versions of roles/statuses/components.
- Run typecheck and core workflow after every merge.

**Accept when:** all four role flows operate against the same incident record.

### C3 - Security and resilience

- Test cross-college and cross-role access.
- Sanitize confidential audit events and email content.
- Add provider timeout, email fallback and retry limits.
- Prevent infinite replanning and reminder loops.

**Accept when:** a private incident cannot be inferred from public feeds, counts or event text.

### C4 - Deployment and demo control

- Configure Vercel/Supabase environments and seed deterministic accounts.
- Add a clearly labeled demo-only control for accelerating SLA events.
- Verify deployed auth callbacks, storage, AI provider and email.

**Accept when:** the three-minute flow completes from a clean/incognito session.

### C5 - Final ownership

- Freeze features at Hour 13.
- Lead all-hands bug triage.
- Confirm README architecture, safety boundary, setup and agent definitions.
- Rehearse explanation of why ORION is agentic and why human roles are not AI agents.

## Do not compromise

- Shared contracts and tenant isolation.
- A real failed-verification replan.
- Visible tool actions rather than hidden claims.
- Honest demo-time acceleration.
- A working core over additional dashboard breadth.

