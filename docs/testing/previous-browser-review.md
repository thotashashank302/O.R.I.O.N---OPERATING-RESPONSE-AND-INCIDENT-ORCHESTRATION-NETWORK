# Website and code exploration

Explored six authenticated demo roles: student, CR, electrician, facilities staff, HOD and principal. Waited for the client feeds and roster to load, inspected navigation and controls, and checked desktop/mobile rendering. No unhandled browser errors or horizontal overflow appeared in those dashboard checks.

## Reproduced and repaired

- Feed failures were displayed as an empty feed with an unsupported claim that all systems were operational. Student and CR feeds now report the failure, offer retry, and clear the error after a successful response.
- Incident details ignored the API's `isReporter` flag. Clarification and reporter-confirmation controls, related feed actions and the CR verification desk now respect reporter ownership. The server remains the authority for mutations.
- Incident load errors could remain after a successful retry. There is now a retry control and successful loading clears the prior error. Back links return to the current role's dashboard.
- Reporter action errors used browser alerts. They now remain inline, preserve the form, and validate rejection reasons before submission. Confirming a repair no longer promises immediate closure when dependent work remains.
- A failed acknowledgement request left the button disabled on “Confirming…” with an unhandled promise rejection. Network failures now expose a retryable message and re-enable the button.
- Vote and notification network failures were silent or unhandled. Errors now appear inline; vote retries clear the error and update the displayed count on success.
- Staff location labels ignored the incident's reported location text. They now fall back to that text when no mapped campus location exists.

## Validation

- 124 unit/API tests passed.
- Nine focused browser regressions passed in `tests/e2e/exploration-regressions.spec.ts`: student/CR feed failure and retry, non-reporter controls and role-aware navigation, detail retry and inline conflict handling, acknowledgement/vote/notification network failures, handover cancellation, and principal role-dialog/setup-tab navigation.
- Five baseline browser checks passed: homepage, mobile login, unauthenticated route protection, and acknowledgement-page desktop/mobile behavior.
- TypeScript, ESLint, production webpack build and `git diff --check` passed.
- The updated production app and worker are running at http://localhost:3000. Worker checks continue every 10 seconds; observed idle ticks had no retries or dead jobs.

The error-path browser tests intercept requests and provide synthetic responses. They do not submit real reports, confirm repairs, change roles, mark notifications read, or send emails. Existing records and assignments were not changed by these tests. A new live AI/provider/email lifecycle was not exercised. Login imagery and page composition were preserved.

The source changes are local and have not been committed or pushed as part of this exploration. Database activation and migration-history notes remain in `SECURITY_REMEDIATION.md`.

## Source cleanup — 12 September 2026

- Removed tracked ZIP/screenshots, an unused error helper, the obsolete in-memory
  demo runner, and the older browser suite with optional assertions and live writes.
  The focused browser regressions remain the default suite.
- Moved five in-memory reporting models into test fixtures without changing their
  behavior. Kept executable migrations, runtime routes and the login photograph intact.
- Grouped original handoff plans/progress and draft SQL under `docs/archive/`;
  moved product/design notes into `docs/` and replaced duplicated setup instructions
  with a single root README and project map.
- Added repeatable source packaging. Generated ZIPs/screenshots are ignored by Git;
  Playwright screenshots now use its standard `test-results/` output.
- After cleanup: 124 unit/API tests, 14 browser checks, lint, TypeScript and diff
  whitespace checks passed. The ZIP was extracted to a temporary directory and its
  production build passed using the existing dependency installation and local
  environment. This was not a fresh dependency install or a new live incident journey.
- ZIP checks confirmed credentials/build output were excluded and the executable
  migrations and login photo matched the working source byte-for-byte. Temporary
  build output was removed after verification. No push was performed.

## Pre-push functional cross-check — 12 September 2026

Two additional error-handling defects were repaired:

- Incident/vote database read failures could appear as a missing record or zero
  votes. They now return a controlled, retryable HTTP 503 instead of misleading data.
- Missing or malformed campus-context headers and expired/invalid authorization
  could fall through to HTTP 500. Authentication is now checked first, with shared
  HTTP 401/403 handling for authorization errors and HTTP 503 for unavailable
  authorization storage. Fresh membership and role validation remain enforced.

The initial direct API audit omitted the required campus-context headers. After
correcting the audit to use the authenticated context, all six real demo accounts
passed UI login, dashboard rendering, incident feed/detail/timeline reads, 390px
mobile overflow checks, sign-out and unauthenticated denial after sign-out. Each
feed returned 12 existing incidents. No unhandled browser errors or failed page
requests were observed in those flows.

131 unit/API tests and 50 isolated PostgreSQL assertions passed. ESLint,
TypeScript and the production build passed; the updated local app and worker were
restarted. Consecutive idle worker ticks reported zero retries or dead jobs.

This checks real authenticated reads and session behavior, plus isolated database
writes and intercepted UI error paths. It does not prove every feature is bug-free:
a new live report → AI assignment → physical repair → human verification → email
receipt journey was not performed, nor were production Vercel deployment or inbox
receipt verified. Login imagery and layouts remain unchanged.

The final 14-test browser regression run also passed against the rebuilt app.
