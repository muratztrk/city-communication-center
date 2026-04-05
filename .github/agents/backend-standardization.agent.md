---
name: backend-standardization
description: Enforce backend standards for auth, contracts, CQRS responses, and package alignment in City Communication Center.
tools: ["codebase", "editFiles", "terminal", "search", "githubRepo", "context7"]
---

# City Communication Center Backend Standards

Use these rules when working on this repository:

1. Always use Context7 for external library documentation, especially OpenIddict, EF Core, ASP.NET Core auth, and frontend build tooling.
2. Keep the backend canonical for auth, tenancy, route shapes, and workflow semantics.
3. Authentication standard:
   - OpenIddict 7.4.0 is the canonical token system.
   - Canonical token endpoint is `/connect/token`.
   - Supported grant is `password`.
   - OpenIddict runs in degraded/stateless mode with token storage disabled.
   - Do not add OpenIddict EF stores, refresh tokens, or `offline_access` unless the repository intentionally adopts persistent token storage.
   - Frontend clients send `tenant_id` during password login.
   - Access tokens must include `sub`, `name`, `displayName`, `role`, `tenant_id`, `tenantId`, and `tenant_name`; include `email` when available.
4. Login standard:
   - `LoginCommand` authenticates local password hashes first.
   - If local auth fails, LDAP bind is attempted.
   - LDAP bind may refresh an already linked `ApplicationUser`, but must not create missing users during login.
   - Missing LDAP users are onboarded only through the explicit admin directory-search plus create/link flow.
5. Contract standard:
   - If a handler output matches the public API contract, return the shared contract directly from the handler.
   - Do not create feature-local `*View` or controller-side `new XxxResponse(...)` mappings for identical shapes.
   - Only keep controller mapping when the endpoint intentionally aggregates multiple sources or preserves a distinct compatibility shape.
6. CQRS naming standard:
   - Query request type: `Query`
   - Command request type: `Command`
   - Query/command response type: shared public contract when exposed directly by the controller
   - Use feature-local `*View` or `*Result` only when the shape is not the public transport contract.
7. Package/version standard:
   - Keep all source projects on `.NET 10`.
   - Keep EF Core packages aligned on the same patch family.
   - Do not leave mixed auth stacks like manual JWT bearer plus OpenIddict in the same runtime path.
8. Social settings persistence standard:
   - Tenant social media settings are stored in the database, not in memory.
   - Sensitive channel credentials are encrypted with ASP.NET Core Data Protection before persistence.
   - Data Protection keys must remain persistent across restarts; Docker development uses `/app/.keys` volume-backed key storage.
9. Seed and startup standard:
   - Static install/demo data is seeded through EF Core migrations, not appsettings-driven runtime seeding.
   - Local user passwords are bootstrapped separately through `Authentication:InitialPassword` and must not be hardcoded into migrations.
   - Do not reintroduce broad startup seed orchestration for production paths.
10. Workflow standard:
   - The canonical business flow is documented in `docs/current-task-flow.md`.
   - Social messages may be routed to a department, converted into a task, submitted for manager approval, assigned to staff, completed, and closed.
   - `SubmitTask` should resolve department-manager approval when available instead of bypassing directly to assignment.
11. Social integration architecture standard:
   - Social media contracts that application code depends on must live in `CityCommunicationCenter.Application.Abstractions`.
   - Infrastructure implements those contracts through platform adapters and tenant-aware factories.
   - Do not move platform-specific HTTP details into the application layer.
12. Database provider standard:
   - PostgreSQL is the default provider.
   - SQL Server support is optional but first-class.
   - Resolve provider and connection string through configuration instead of hardcoded design-time defaults.
   - Use provider-specific migration sets for PostgreSQL and SQL Server contexts.
13. Migration baseline standard:
   - The repository now includes provider-specific initial migration sets in addition to the prior baseline history.
   - New schema work should extend the matching provider-specific migration set instead of reusing a single mixed-provider chain.
14. Validation rule:
   - After auth or contract changes, run `dotnet build backend/CityCommunicationCenter.sln`.
   - After frontend auth or role-visibility changes, run `npm run lint` and `npm run build` in `frontend`.
   - After frontend auth changes, run `npm run build` in `frontend`.
   - Active local frontend source is `frontend/`; do not treat `frontend_old/` as the runtime app.
   - For end-to-end changes, prefer Docker validation on `http://localhost:15000` and `http://localhost:13000`.
   - For workflow or persistence changes, also run `tests/e2e npm test` against the Docker runtime when feasible.