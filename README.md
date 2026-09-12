# ORION

Operating Response & Incident Orchestration Network: a campus incident application
built with Next.js, Supabase, Featherless AI and Resend.

## Start here

Requires Node.js 22+ and npm. From the repository root:

```sh
npm ci
cp .env.example .env # first setup only; keep an existing configured .env
```

Fill in the provider credentials in `.env`. Use `APP_URL=http://localhost:3000`
for local use; `AUTOMATION_SECRET` must contain at least 32 characters.

```sh
npm run build
npm run local:start
```

Open **http://localhost:3000**. Keep the terminal running and the computer awake.
The launcher starts the website and a background worker, polling every 10 seconds
after the previous tick completes. Ctrl+C stops both. Rebuild after source changes.
For development with automatic recompilation, use `npm run local`.
`npm run dev` starts only the website, without the recurring worker.

The launcher sets `APP_URL` to localhost for its process. Supabase, AI and email
still use the configured online services. Queued work may update the connected
database and send notifications. Vercel cron restrictions do not apply to this
local worker. Local email links open on this computer; public webhooks need a
reachable URL.

For password recovery, allow
`http://localhost:3000/auth/callback?next=/reset-password` in Supabase Auth URL
Configuration and configure its email sender. Open the recovery link in the
browser that requested it.

## Project map

| Folder | Purpose |
| --- | --- |
| `src/app/` | Next.js pages, layouts and API routes |
| `src/features/` | Feature interfaces, shared dashboard shell and contracts |
| `src/contracts/` | Shared schemas and types |
| `src/server/` | Authentication, persistence, agents and background workflows |
| `src/emails/` | Email templates used by the notification transport |
| `src/lib/` | Shared utilities |
| `public/` | Assets served by the website, including the login photograph |
| `supabase/migrations/` | Ordered database migration history; do not edit applied migrations |
| `supabase/tests/` | SQL regression checks |
| `scripts/` | Local launcher, worker, diagnostics and packaging tools |
| `tests/unit/` | Unit and route regression tests |
| `tests/e2e/` | Browser smoke and regression tests |
| `tests/fixtures/` | Test-only simulations; never import into application code |
| `docs/` | Current contracts, ownership, product/design notes and review results |
| `docs/archive/` | Historical plans, handoff progress and non-executable schema drafts |

The persisted reporting implementation is `src/server/reporting/persistent-service.ts`;
API routes and database migrations enforce production workflow rules. The old
in-memory reporting models live exclusively in test fixtures.

## Demo access

These accounts belong to the existing controlled demo database. They are not
created automatically by installing the project. Password: `OrionDemo2026!`.

| Role | Email | Dashboard |
| --- | --- | --- |
| Student | `student.aiml@orion-demo.edu` | `/student` |
| Class representative | `cr.aiml@orion-demo.edu` | `/cr` |
| Electrician | `staff.electrician@orion-demo.edu` | `/staff` |
| Facilities staff | `staff.facilities@orion-demo.edu` | `/staff` |
| HOD | `hod.facilities@orion-demo.edu` | `/hod` |
| Principal | `principal@orion-demo.edu` | `/principal` |

## Commands and verification

| Command | Purpose |
| --- | --- |
| `npm run local` | Development website and recurring worker |
| `npm run local:start` | Built website and recurring worker |
| `npm run lint` | ESLint checks |
| `npm run typecheck` | TypeScript checks |
| `npm test` | Unit and route tests |
| `npm run build` | Production build |
| `npm run test:e2e` | Browser checks; install Chromium with `npx playwright install chromium` first |
| `npm run package` | Create `dist/ORION_CLEAN_WORKING_SOURCE.zip` (requires Python 3) |

Run verification commands serially. Browser tests use localhost and the existing
demo accounts; action/failure regressions intercept writes. They do not prove a
complete live incident lifecycle or email delivery.

The isolated PostgreSQL security runner and its setup are documented in
[Security remediation](docs/SECURITY_REMEDIATION.md). `scripts/check-live-model.ts`
is an optional live provider diagnostic. `scripts/seed-demo.ts` writes demo
institution structure; it does not provision the login accounts above.

## Documentation

- [API contract](docs/API_CONTRACT.md) and [team ownership](docs/OWNERSHIP.md)
- [Product scope](docs/PRODUCT.md) and [visual design](docs/DESIGN.md)
- [Security remediation and database validation](docs/SECURITY_REMEDIATION.md)
- [Browser debugging results](docs/BROWSER_DEBUG_REVIEW.md)
- [Historical handoff archive](docs/archive/README.md)

## Sharing and disk space

`npm run package` includes source, configuration templates, documentation, tests
and migrations. It excludes credentials, installed dependencies, build caches,
Git history, screenshots and previous archives. The ZIP is generated and ignored
by Git. After extracting, follow the setup steps above with your own `.env`.

`node_modules/` and `.next/` account for most installed disk usage. They are ignored
by Git and excluded from the ZIP, but are needed to run the installed application.
