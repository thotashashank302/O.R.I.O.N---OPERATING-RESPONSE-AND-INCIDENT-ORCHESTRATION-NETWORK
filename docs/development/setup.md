# Development setup

Use Node.js from `.nvmrc` and run `npm ci --ignore-scripts`. The lockfile is committed and CLI/database test dependencies are pinned.

Copy `.env.example` to `.env` on first setup. Configure a separate Supabase development project and explicitly provision your own accounts, memberships and role grants. Existing shared demo accounts are not automatically installed. Never copy them into production.

Apply repository migrations only to an empty isolated database or after reviewing the target migration history. For the locally isolated SQL suite, use `compose.test.yaml` and `npm run test:db`; it constructs modeled Auth/Storage schemas without contacting Supabase.

`npm run local:start` requires a production build, starts the website and polls the protected automation endpoint. `npm run local` starts the same worker alongside the development server. Local provider calls and email remain real when credentials are configured.

For recovery email, configure the development Auth redirect URL as `http://localhost:3000/auth/callback?next=/reset-password` and configure a sender. Test in the browser that requested the recovery link.

Run the baseline browser suite with placeholder public Supabase configuration if no hosted development project is available. Authenticated browser regressions require `ORION_E2E_PASSWORD` and optionally `ORION_E2E_EMAIL_DOMAIN`, with the role accounts referenced by that suite. Use an isolated dataset; no shared password is embedded in the test source.

Use `npm run package` to export source. Never add `.env`, local credentials, node_modules, generated screenshots or native database binaries to Git.
