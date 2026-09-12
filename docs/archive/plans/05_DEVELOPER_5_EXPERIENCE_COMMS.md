# Developer 5 Plan - Product Experience, 3D Intro, Communications and QA

## Mission

Create ORION's coherent visual language and make agent actions tangible through the 3D introduction, shared components, timeline, email, notifications and final experience QA. Visual quality must support the working logic rather than hide missing behavior.

Read the master plan first. Ask for and complete one numbered task at a time.

## UI preflight

Before any UI implementation, ask the developer to upload the supplied template/reference and clarify layout, typography, colors, assets, target routes, interaction behavior, mobile behavior and required states. Inspect the upload and list missing requirements. Do not overwrite a supplied design with a generic dashboard. If no template arrives within the time box, establish the shared fallback tokens in the master plan and get Team Lead approval.

## Part A - Hours 1-4: shared experience foundation

### A1 - Design system

- Implement typography, colors, spacing, surfaces, buttons, fields, cards, tables, badges, dialogs, toasts and skeletons.
- Define semantic status colors; do not use red decoratively.
- Provide responsive app shell and role navigation.

**Accept when:** Developers 2-4 can build without creating competing buttons, cards or status styles.

### A2 - 3D ORION prototype

- Build the 5-7 second node-and-network sequence from the master plan.
- Reveal ORION and its full form.
- Add Skip, reduced-motion behavior and static mobile fallback.

**Accept when:** intro loads lazily, never blocks sign-in and remains smooth on the available demo laptop.

### A3 - Email adapter foundation

- Implement Resend adapter, controlled-recipient allowlist and in-app outbox fallback.
- Create assignment, reminder, escalation and evidence-request templates.
- Strip confidential detail from messages unless the recipient is explicitly authorized.

**Accept when:** one test assignment reaches the controlled inbox and records a delivery/fallback event exactly once.

## Part B - Hours 4-10: agent visibility and communication

### B1 - Agent activity timeline

- Render agent, decision summary, tool action, timestamp, plan version and status.
- Visually distinguish Triage, Commander, Specialist, Verification and deterministic scheduler events.
- Never expose hidden chain-of-thought or secrets.

**Accept when:** a judge can understand the workflow without reading logs or source code.

### B2 - Notifications

- Build in-app notification center with read/unread state and role-aware deep links.
- Support assignment, acknowledgement, reminder, escalation, approval, evidence and resolution events.

**Accept when:** each notification opens an authorized destination and fails safely for revoked access.

### B3 - Deterministic SLA runner UI support

- Work with Developer 1 on due-event display and a clearly labeled demo-time acceleration control.
- Show production SLA and accelerated demo interval separately.
- Avoid presenting simulated passage of time as real.

**Accept when:** the demo can trigger reminder/escalation reliably without duplicate emails.

### B4 - Cross-role consistency

- Review principal, HOD, staff, CR and student screens against shared components.
- Fix hierarchy, spacing, responsive behavior, loading, empty, error and permission states.

**Accept when:** the product feels like one platform rather than five separately generated apps.

## Part C - Hours 10-16: polish, accessibility and delivery

### C1 - Final 3D optimization

- Cap pixel ratio, pause when hidden, dispose resources and test reduced-motion/mobile fallback.
- Remove the 3D dependency from authenticated dashboard bundles where possible.
- If quality gate fails, keep static mobile and desktop 3D only.

**Accept when:** intro does not delay the core demo or degrade dashboard performance.

### C2 - Responsive/accessibility QA

- Test keyboard navigation, focus visibility, contrast, labels, dialogs, form errors and mobile overflow.
- Ensure severity is communicated by text/icon as well as color.

**Accept when:** critical demo flows work without a mouse and at the agreed mobile viewport.

### C3 - Communication failure states

- Test missing email key, provider rejection, duplicate retry and unauthorized recipient.
- Show actionable fallback state without falsely claiming delivery.

**Accept when:** ORION remains demonstrable through the in-app outbox if external email fails.

### C4 - Demo capture and final sweep

- Prepare deterministic screen state and clean test inbox.
- Help record the three-minute video and capture a backup recording.
- Verify the deployed application in incognito and on the demo device.
- Stop feature work at Hour 13; after that, only repair or polish verified paths.

## Do not compromise

- Supplied UI references take priority over invented layouts.
- 3D must be skippable, accessible and performance-safe.
- No false email-delivery claims.
- Agent decisions must be understandable without exposing private reasoning.
- Core workflow polish comes before decorative extra screens.

