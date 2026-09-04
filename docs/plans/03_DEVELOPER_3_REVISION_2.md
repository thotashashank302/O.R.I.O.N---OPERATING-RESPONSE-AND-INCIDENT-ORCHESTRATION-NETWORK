# Developer 3 — Student/CR Reporting, Voting and Reporter Verification
Read the master, contracts and verification file. Own reporting, voting, private intake and reporter-facing incident pages. D4 owns work execution; D5 supplies timeline components.

## Working protocol
One numbered task at a time, with verification and approval. Ask for the developer's UI template/layout before implementation, including mobile report flow and private-case treatment. Do not invent role rules or shared schema changes.

## Part A — Report intake (0–2 hours)
### A1. Build the report contract and form
Collect category suggestion, description, permitted location and optional private photos. Treat reporter text/category as untrusted input, not agent instructions. Use the private upload service and limits from technical contracts.
Accept: CR can submit a routine class issue; a persisted incident triggers an orchestration job.
Verify: incomplete location, invalid upload, repeated submission and tenant access.
Photos are human evidence; the selected text-only model cannot inspect them.

### A2. Build issue list and voting
Show only cases authorized for the viewer. Enforce unique voter/incident and atomic votes. Explain that votes measure impact, not emergency severity; update aggregate counts without leaking voter identities.
Accept: students can vote in their permitted scope; duplicate requests do not inflate count.
Verify: concurrency, cross-college vote and confidential issue exclusion.

### A3. Build incident detail shell
Compose D5 timeline and later D4 work details without editing their components. Display status, next action, ownership and pending clarification.
Accept: empty/loading/error/forbidden states work on mobile.
Handoff: D1 gets real new incidents and context, not static demo-only records.

## Part B — Exceptions and safe communication (2–5 hours)
### B1. Private and emergency intake
Any verified student may report emergency/safety or CR misconduct privately, without CR approval. Route via authorized case-access policy, excluding the accused. Show approved campus contact information if available; never fabricate a helpline or imply AI is emergency services.
Accept: private complaints never appear in public lists, vote feeds, broad notifications or unrestricted attachments.
Verify: student direct report, accused access denial and no sensitive content in email summaries.

### B2. Clarification and evidence
Implement reporter answers to requested fields; validate expected incident version and queue the appropriate next agent step. Store photo evidence privately with expiring access.
Accept: a missing-room case resumes only after needed details are supplied.
Verify: unauthorized answer, stale version and expired attachment access.

### B3. Authorized special-scope reporting
Add minimal route issue form for verified riders and club issue form for authorized presidents; reuse incident handling. Do not apply CR-only restrictions to these exceptions.
Accept: correct route/club scope reaches the matching operations queue.
If behind, retain eligibility and a compact shared form rather than separate polished dashboards.

## Part C — Confirmation and end-to-end quality (5–7.5 hours)
### C1. Reporter-side functional verification
Build the designated CR/lab/HOD confirmation experience from D1's policy. Show staff's submitted test/evidence and let the authorized verifier accept or reject with a reason.
Accept: staff submission alone never closes the incident; rejection creates a verification result that triggers replanning.
Verify: unrelated student cannot close; stale/double decisions are rejected. A photo is not proof that an internal fault is fixed.

### C2. Reporting tests and accessibility
Test report, vote, private intake, clarification and verification on mobile and keyboard. Cover rate-limit feedback and retry without duplicate incidents.
Accept: all P0 reporting/privacy tests in 08 pass with actual API checks.

### C3. Demo contribution
Prepare a fresh live incident description and controlled attachments created within allowed hours. Give D1 actual feature/limitation notes and D5 a reporter demo sequence.
Do not publish student IDs, private photos or personal complaint details in the public repository/video.

## Revision 2 — integrate into existing parts
Read 09 and 10 before execution.
- A1: own src/server/agents/triage.ts using D1's common provider/types; implement structured category/clarification/duplicate-candidate output and fixture tests.
- A2: implement confirmed routine duplicate linking with distinct-voter counting, under 09's policy; do not auto-merge or expose private cases.
- B1: enforce explicit category/privacy routing, not a single generic public complaint form.
- B2/C1: add safe cancellation/reopen actions and pending-verifier feedback; use D1/D4 policy, not client-only checks.
- C2: test duplicate/lifecycle cases CORE-03/04.
- C3: if P0 passes, implement P1 private post-resolution feedback and CORE-07. Do not conflate feedback with functional verification.
