# In-memory reporting fixtures

These models support `tests/unit/reporting-lifecycle.test.ts`. They keep state in
Maps and simulate an earlier reporting design. They are not persistence services,
authorization policy, or a deployable backend. Application code must not import them.

Production reporting uses `src/server/reporting/persistent-service.ts`, API routes
and transactional SQL migrations. Security behavior is covered separately by the
route/security tests and isolated PostgreSQL runner.
