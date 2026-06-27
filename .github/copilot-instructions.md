# Copilot Instructions — City Communication Center

Follow the shared, tool-agnostic project rules (read these — do not duplicate them here):

- **[AGENTS.md](../AGENTS.md)** — build commands, code style, CQRS/feature patterns, auth &
  tenant standards, and the **mandatory Trello card workflow + build/lint gate**.
- **[docs/feature-invariants.md](../docs/feature-invariants.md)** — read the relevant section
  **before changing code**; these are the "don't break X" rules that prevent regressions.
  Add a new line here after a change introduces a new invariant.
- **[CLAUDE.md](../CLAUDE.md)** — project overview/architecture (kept in sync with AGENTS.md).

Reminders:
- Backend validation/error messages are **Turkish**; frontend strings go through i18n.
- Before a change is "done": `dotnet build backend/CityCommunicationCenter.sln` and
  `cd frontend && npm run build && npm run lint` must be green.
- ⚠️ Pushing `main` auto-deploys **PRODUCTION** (real Tire data); push both `main` and `master`.

Trello automation lives in `scripts/trello/` and the `.github/agents/trello-doing.agent.md` agent.
