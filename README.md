# ORION — Operating Response & Incident Orchestration Network

**ORION** is an autonomous multi-agent campus operations and incident orchestration platform. It transforms unstructured campus complaints (facilities, electrical hazards, IT networks, equipment breakdowns, and confidential grievances) into versioned, dependency-aware resolution plans, assigns verified specialists, dispatches outbox notifications, and guarantees accountable human physical verification before any ticket can be closed.

---

## 🚀 Demo Accounts & Role Matrix

The controlled demo college (**ORION-DEMO / ORION Controlled Demo College**) is seeded with dedicated credentials for every institutional role.

### **Credentials**
> **Universal Demo Password:** `OrionDemo2026!`

| Role | Email | Target Dashboard | Key Capabilities |
|---|---|---|---|
| **Student** | `student.aiml@orion-demo.edu` | [`/student`](http://localhost:3000/student) | Lodge public or confidential incident reports, view live campus issue feed, answer AI location clarifications, upvote existing issues. |
| **Class Representative (CR)** | `cr.aiml@orion-demo.edu` | [`/cr`](http://localhost:3000/cr) | Report classroom infrastructure issues, inspect technician repairs at the **Verification Desk**, accept or reject repairs with cause. |
| **Staff (Facilities)** | `staff.facilities@orion-demo.edu` | [`/staff`](http://localhost:3000/staff) | Manage duty availability (**Available / Busy / Off-Duty**), acknowledge tasks, upload repair notes, functional tests, and photo evidence. |
| **Staff (Electrician)** | `staff.electrician@orion-demo.edu` | [`/staff`](http://localhost:3000/staff) | Handle electrical safety assignments, isolate hazards, submit safety clearance certificates. |
| **Head of Department (HOD)** | `hod.facilities@orion-demo.edu` | [`/hod`](http://localhost:3000/hod) | **Approval Console**: Review high-risk action requests, approve/reject hazardous plans with audit reasons, supervise department queue. |
| **Principal** | `principal@orion-demo.edu` | [`/principal`](http://localhost:3000/principal) | **Executive Oversight**: College setup & campus structure, department creation, student/staff roster management, role grant appointments. |

---

## 🤖 Autonomous Multi-Agent Loop

ORION orchestrates campus operations through 4 specialized AI agents powered by OpenAI-compatible LLM inference (default: `meta-llama/Llama-3.3-70B-Instruct` via Featherless):

```text
Student / CR Report
       │
       ▼
[ 1. Triage Agent ] ──► Classifies category & severity floor
       │                 Detects missing info ➔ Enqueues Clarification
       ▼
[ 2. Commander Agent ] ──► Generates DAG execution plan (tasks, dependencies, evidence policy)
       │                    Enforces approval requirements for hazardous actions
       ▼
[ 3. Specialist Agent ] ──► Queries live DB facts for eligible & available staff
       │                     Dispatches assignment outbox email with single-use action tokens
       ▼
[ Operations Staff ] ────► Acknowledges via email link or dashboard, performs physical fix,
       │                     uploads structured evidence (notes, test results, photos)
       ▼
[ 4. Verification Agent ] ──► Evaluates evidence completeness against safety rules
       │                       Enforces policy override: Physical/electrical work REQUIRES human check
       ▼
[ Human Verifier (CR / Reporter) ] ──► Physical inspection on-site
                                         ├── ACCEPT ➔ Incident RESOLVED
                                         └── REJECT ➔ Incident REOPENED ➔ Commander Replans
```

### Safety & Governance Guarantees
- **Human Verification Enforced**: Technicians cannot mark tickets "resolved". They submit work for verification.
- **Self-Approval Prohibited**: HODs and supervisors cannot approve actions requested for themselves or incidents they reported.
- **Multi-Tenant RLS**: Every database table enforces composite Row Level Security keys (`institution_id`).
- **Idempotent Durable Jobs**: Background tasks are leased and retried with exponential backoff; dead letters escalate to human supervisors.

---

## 🛠️ Technology Stack

- **Framework**: [Next.js 16 (App Router)](https://nextjs.org) with React 19
- **Database & Auth**: [Supabase](https://supabase.com) (PostgreSQL 15+, Row Level Security, Realtime)
- **AI / LLM Orchestration**: [Featherless AI](https://featherless.ai) (`meta-llama/Llama-3.3-70B-Instruct`)
- **Email Delivery**: [Resend](https://resend.com) & [React Email](https://react.email)
- **Styling**: Tailwind CSS v4
- **Testing**: [Vitest](https://vitest.dev) (Unit & Integration) & [Playwright](https://playwright.dev) (E2E & User Simulation)
- **Type Safety**: TypeScript 5.8 & Zod 3.24

---

## ⚡ Quick Start & Local Setup

### 1. Prerequisites
- Node.js 22+
- npm 10+

### 2. Clone & Install
```bash
git clone https://github.com/thotashashank302/O.R.I.O.N---OPERATING-RESPONSE-AND-INCIDENT-ORCHESTRATION-NETWORK.git
cd O.R.I.O.N---OPERATING-RESPONSE-AND-INCIDENT-ORCHESTRATION-NETWORK
npm install
```

### 3. Configure Environment Variables
Copy the template to `.env`:
```bash
cp .env.example .env
```
Ensure the following variables are configured:

```ini
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...

# AI Provider (Featherless)
FEATHERLESS_API_KEY=your_featherless_key
FEATHERLESS_BASE_URL=https://api.featherless.ai/v1
FEATHERLESS_MODEL=meta-llama/Llama-3.3-70B-Instruct

# Email Service (Resend)
RESEND_API_KEY=re_...
RESEND_FROM=ORION Operations <notifications@yourdomain.com>
APP_URL=http://localhost:3000
EMAIL_ACTION_SECRET=your_secure_random_action_secret
AUTOMATION_SECRET=your_secure_random_automation_secret
CRON_SECRET=your_cron_secret

# Demo Environment
DEMO_MODE=true
DEMO_RECIPIENT_ALLOWLIST=your_email@example.com
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Verification & Test Suite

Run the full verification pipeline to validate types, code quality, unit logic, production build, and end-to-end user journeys:

```bash
# 1. Typecheck
npm run typecheck

# 2. Linter
npm run lint

# 3. Unit & Integration Tests (101 tests across 13 suites)
npm run test

# 4. Production Build (all 34 static and dynamic routes)
npm run build

# 5. Playwright E2E Tests
npm run test:e2e
```

### Test Live Model & Lifecycle Journey
```bash
# Verify live Featherless AI model responses:
npx tsx --env-file=.env scripts/check-live-model.ts

# Run the complete 8-step end-to-end incident lifecycle:
npx tsx --env-file=.env scripts/run-demo-journey.ts
```

---

## 📦 Production Deployment

### Vercel Deployment
1. Connect this repository to **Vercel**.
2. Set the Environment Variables matching your production Supabase, Featherless, and Resend credentials.
3. Ensure `APP_URL` is set to your production Vercel deployment URL (e.g. `https://orion-incident-orchestration.vercel.app`).
4. Set `CRON_SECRET` to enable automated worker execution via Vercel Cron (`/api/automation/tick`).

---

## 👥 Team Responsibilities

- **Developer 1**: Core architecture, database migrations, state machines, durable worker, AI provider adapters, Commander agent.
- **Developer 2**: Identity, multi-tenant contexts, roster ingestion, role appointment system.
- **Developer 3**: Incident intake, evidence upload tickets, community voting, student feed, Triage agent.
- **Developer 4**: Staff operations, duty availability, evidence forms, HOD approvals, Verification agent.
- **Developer 5**: Unified design system, Specialist dispatch, tokenized action emails, outbox queue, notification feed.
