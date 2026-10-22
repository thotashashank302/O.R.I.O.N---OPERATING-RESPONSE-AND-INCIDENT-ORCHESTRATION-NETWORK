# Operate without a paid platform upgrade

The project owner selected Supabase Free. No plan purchase, paid scheduler, or hosting upgrade is configured by this delivery. Model and email services still require valid credentials and sufficient provider quota; using the local worker does not make third-party usage free.

## Current hosted state

Both readiness and job-cancellation migrations are applied. Five historical failures were cancelled with their original errors, payloads and attempt counts retained. Two were obsolete because their incident was resolved; three have fresh canonical planning requests queued. Every cancellation has an audit record, with replacement IDs where applicable.

The recovered reports are still pending planning. The health RPC reports zero dead jobs and no expired leases, but remains unhealthy because the three requests are overdue and no genuine worker tick has completed. No incident was falsely marked resolved.

## Start the existing worker

1. In the working checkout, copy `.env.example` to `.env` only if no configured file exists. Keep credentials out of Git and source exports.
2. Configure the ORION Supabase URL, publishable key and server secret key. Configure the existing Featherless account/model and Resend sender/webhook credentials. Do not paste secrets into chat.
3. Generate independent random values of at least 32 characters for AUTOMATION_SECRET and EMAIL_ACTION_SECRET. CRON_SECRET is optional when no external cron is used.
4. Run `npm ci --ignore-scripts`, `npm run build`, then `npm run local:start`. It starts the web server and polls its protected worker endpoint every ten seconds after the previous tick finishes.
5. Keep the process and machine running with network access. Closing all browsers is supported; stopping the process or sleeping the machine pauses automation.
6. Verify that the three recovery requests are processed, a real heartbeat appears, and approval-required actions reach the operator desk. Physical work still requires scoped human approval. Check actual provider outcomes and authenticated evidence/verification before a release.

No real credential file is installed in this checkout. Required Supabase server, Featherless, Resend and automation credentials were absent when checked. Therefore this handoff does not claim that the worker or provider acceptance has run.

## Limits retained on Free

- Native leaked-password protection remains disabled. [Supabase requires Pro or above](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). The owner declined that upgrade. Do not suppress the advisor warning or describe an application-only check as equivalent backend enforcement.
- Free Supabase projects can pause after inactivity; current limits are documented on [Supabase pricing](https://supabase.com/pricing). This setup does not establish uninterrupted production availability.
- There is no Vercel cron in the source configuration. [Hobby cron permits daily execution](https://vercel.com/docs/cron-jobs/usage-and-pricing), which is insufficient for acknowledgement and verification deadlines.
- Live Auth/Storage integration, real email/AI delivery, continuous unattended uptime, restoration and retention acceptance remain release gates.

Use the [readiness record](readiness.md) to distinguish completed source/database work from the remaining operating checks.
