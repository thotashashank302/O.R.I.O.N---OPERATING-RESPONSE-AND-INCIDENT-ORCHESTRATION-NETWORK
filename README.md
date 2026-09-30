# ORION

Operating Response & Incident Orchestration Network (ORION) is a campus incident management application built with Next.js, Supabase, and AI-assisted orchestration. It helps institutions handle incident reporting, triage, staffing, verification, approvals, and follow-up actions in a structured and auditable workflow.

This repository contains the application code, background worker, database migrations, tests, and supporting documentation for the ORION platform.

## What ORION does

ORION is designed for a campus environment where incidents are reported by students or staff and then processed through a larger operational workflow. The platform supports:

- incident reporting from users
- triage and categorization of issues
- assignment of work to staff or departments
- verification and evidence collection
- approval gates for high-impact actions
- role-based dashboards for students, staff, HODs, principals, and administrators
- AI-assisted analysis and orchestration for recurring operational tasks
- email notifications and action flows

The overall goal is to move incidents from initial report to resolution in a way that is structured, traceable, and limited by user roles and institutional context.

## Core workflow

A typical ORION incident follows this pattern:

1. A user reports an incident or creates a request.
2. The system captures institutional and membership context.
3. The incident is triaged and classified.
4. Work is assigned to a relevant staff member or team.
5. The assignee collects evidence and submits a completion result.
6. The incident enters verification and approval steps if required.
7. The system records the final status and notifies relevant users.

The workflow is intentionally built around role checks, membership validity, and institutional scope so that users only see and act on data that they are authorized to access.

## Tech stack

- Frontend: Next.js + React + TypeScript
- Styling: Tailwind CSS
- Database and auth: Supabase
- AI orchestration: Featherless AI compatible OpenAI-style API
- Email: Resend
- Background processing: local worker script and scheduled polling
- Validation: Zod schemas
- Testing: Vitest and Playwright

## Prerequisites

Before running the project, make sure you have:

- Node.js 22 or newer
- npm
- a Supabase project configured for the app
- a Featherless AI API key (or a configured offline/demo mode)
- a Resend API key if email flows are enabled

## Quick start

From the repository root:

```bash
npm ci
cp .env.example .env
```

Fill in the required values in `.env` before starting the app. The repository includes environment templates, but you must provide your own credentials for Supabase, AI, and email integrations.

Then start the application:

```bash
npm run build
npm run local:start
```

Open the app in a browser at:

```text
http://localhost:3000
```

The local launcher starts the web app and a background worker. The worker polls for automation tasks every 10 seconds. 

## Development mode

For local development and automatic recompilation:

```bash
npm run local
```

For the site alone without the recurring worker:

```bash
npm run dev
```

## Environment variables

The repository expects the following key values. Most of them are defined in `.env.example`.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL used by the browser app |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-safe Supabase key |
| `SUPABASE_SECRET_KEY` | Server-side Supabase secret key |
| `APP_URL` | Public app base URL, usually `http://localhost:3000` locally |
| `FEATHERLESS_API_KEY` | API key for AI orchestration |
| `FEATHERLESS_BASE_URL` | Featherless endpoint |
| `FEATHERLESS_MODEL` | AI model name |
| `RESEND_API_KEY` | Email sending API key |
| `RESEND_FROM` | Verified sender email |
| `RESEND_WEBHOOK_SECRET` | Webhook signature verification secret |
| `EMAIL_ACTION_SECRET` | Secret used for email action tokens |
| `AUTOMATION_SECRET` | Shared secret used by the local worker |
| `DEMO_MODE` | Enables demo-only behavior when approved |

Important notes:

- Keep `.env` out of Git history.
- For local development, use a configured local app URL and valid credentials.
- `AUTOMATION_SECRET` must be at least 32 characters long.

## Demo and role-based access

This project includes demo accounts for a controlled internal environment. Do not publish the password or login details in public files.

Use the approved project administrator or secure secret manager to retrieve valid demo credentials before testing the app locally.

| Role | Email | Dashboard |
| --- | --- | --- |
| Student | `student.aiml@orion-demo.edu` | `/student` |
| Class representative | `cr.aiml@orion-demo.edu` | `/cr` |
| Electrician | `staff.electrician@orion-demo.edu` | `/staff` |
| Facilities staff | `staff.facilities@orion-demo.edu` | `/staff` |
| HOD | `hod.facilities@orion-demo.edu` | `/hod` |
| Principal | `principal@orion-demo.edu` | `/principal` |

The exact password must be provided through the approved environment or secure documentation, not committed to the repository.

## Application structure

| Folder | Purpose |
| --- | --- |
| `src/app/` | Next.js pages, layouts, and API routes |
| `src/features/` | Feature-level UI and logic |
| `src/contracts/` | Shared TypeScript contracts, schemas, and types |
| `src/server/` | Auth, persistence, AI orchestration, and background workflow code |
| `src/emails/` | Email templates |
| `src/lib/` | Shared utility code |
| `public/` | Assets served by the app |
| `supabase/migrations/` | Database migration history |
| `supabase/tests/` | SQL regression tests |
| `scripts/` | Local launcher, worker, diagnostics, and packaging utilities |
| `tests/unit/` | Unit and route regression tests |
| `tests/e2e/` | Browser-based regression tests |
| `tests/fixtures/` | Test-only simulation data |
| `docs/` | Product, ownership, API, and security documentation |
| `docs/archive/` | Historical documentation and archived design notes |

## Useful commands

| Command | Purpose |
| --- | --- |
| `npm run local` | Start the app and recurring worker in local development |
| `npm run local:start` | Start the production build and worker locally |
| `npm run dev` | Start the site without the worker |
| `npm run lint` | Run ESLint checks |
| `npm run typecheck` | Run TypeScript validation |
| `npm test` | Run unit and route tests |
| `npm run build` | Create a production build |
| `npm run test:e2e` | Run browser-level regression checks |
| `npm run package` | Create a packaged clean source archive |

## Security and operational notes

- Do not commit credentials, tokens, or private environment files.
- Keep `.env` local to your workstation.
- The project uses authenticated membership checks and scoped authorization in its workflow logic.
- The database has migration-based checks and access restrictions for sensitive tables.
- Email and automation webhooks should only be used with their configured secrets.
- The local worker is intended for local testing and development; production deployments should use the environment and security controls appropriate for your hosting setup.

## Documentation

The repository includes several supporting guides:

- [README.md](README.md) — project overview and setup
- [docs/API_CONTRACT.md](docs/API_CONTRACT.md) — API and orchestration contracts
- [docs/OWNERSHIP.md](docs/OWNERSHIP.md) — team ownership and responsibilities
- [docs/PRODUCT.md](docs/PRODUCT.md) — product scope
- [docs/DESIGN.md](docs/DESIGN.md) — design direction
- [docs/SECURITY_REMEDIATION.md](docs/SECURITY_REMEDIATION.md) — security remediation and validation notes
- [docs/BROWSER_DEBUG_REVIEW.md](docs/BROWSER_DEBUG_REVIEW.md) — browser and UI review results
- [docs/archive/README.md](docs/archive/README.md) — historical archive information

## Validation and verification

The project includes automated and targeted validation commands. You can verify the app with:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

The repository also contains browser and SQL regression checks for safe workflow behavior. These tests help validate common user interactions, failure modes, and database constraints, but they do not replace full production validation against live credentials and hosted systems.

## Troubleshooting

### Application does not start

Check that:

- Node.js 22+ is installed
- dependencies were installed with `npm ci`
- `.env` contains valid credentials
- your `AUTOMATION_SECRET` is at least 32 characters

### AI features do not work

Check:

- `FEATHERLESS_API_KEY` is set
- `FEATHERLESS_BASE_URL` is correct
- the model name is valid for the provider

### Email features do not work

Check:

- `RESEND_API_KEY` is set
- `RESEND_FROM` is configured and verified
- `EMAIL_ACTION_SECRET` is set
- `APP_URL` matches your environment

### Local worker fails

Check that:

- the app is running
- `AUTOMATION_SECRET` matches the app configuration
- the origin and URL are reachable from the local environment

## Final note

ORION is a workflow-heavy application with multiple moving parts. The important thing to understand is that the platform is not just a dashboard — it is a governance and operations loop that combines authentication, role-based permissions, work assignment, verification, AI decision support, and notification-driven actions.

For a more complete understanding, read the documentation in `docs/` and the API contract before making changes to business logic or sensitive flows.
