# ORION ownership and integration contract

Shared dependencies, `src/contracts`, `src/server/auth`, `src/server/db`, `src/server/orchestration`, root configuration, migrations, integration tests, release configuration and root README are Developer 1 owned. Schema proposals from feature owners require lead review before integration.

| Owner | Paths and responsibilities |
| --- | --- |
| D1 / Shashank | shared contracts; migration integration; authorization policies; provider/runner; Commander; jobs; lifecycle; integration; release |
| D2 | `src/features/identity`, `institutions`, `role-management`; identity routes and screens; identity SQL proposals |
| D3 | `src/features/reporting`, `voting`, `private-complaints`; reporting routes; `src/server/agents/triage.ts` |
| D4 | `src/features/operations`, `staff-availability`, `resolution`; operations routes; `src/server/agents/verification.ts` |
| D5 | `src/components`, `src/features/intro`, `notifications`, `agent-timeline`; email routes/services; `src/server/agents/specialist.ts` |

Branch convention: `developer-N/<slice>`. Each developer works in a separate checkout and hands the lead a commit SHA, changed paths, checks, contract changes and blockers. Do not switch five branches in one shared checkout.

Agent module contract is exported from `src/server/agents/index.ts`. Modules receive an `AgentInput<TContext>`, call the common provider, return a validated `AgentOutput<TResult>`, and never execute arbitrary SQL, code, permissions or communications. Only the lead-owned tool runner executes allowlisted actions with server-side authorization.
