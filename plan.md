# Current Delivery Status

## Verified Now

1. Backend targets `.NET 10` and `dotnet build backend/CityCommunicationCenter.sln` passes.
2. Docker Compose runs with PostgreSQL instead of SQL Server.
3. API startup applies SQL-file migrations and optional demo seed in development.
4. Frontend production build passes with runtime-aware API origin handling.
5. Playwright E2E suite passes against the Dockerized PostgreSQL stack.

## Completed Work

1. Replaced SQL Server-oriented local runtime with PostgreSQL in `docker-compose.yml`.
2. Migrated backend runtime images and project targets to `.NET 10`.
3. Added PostgreSQL startup migration runner and SQL migration files under `backend/src/CityCommunicationCenter.Infrastructure/Persistence/Migrations/`.
4. Moved demo seed behavior behind config with development-only defaults.
5. Added forwarded-header handling, rate limiting, and database-backed `/health` checks.
6. Expanded E2E coverage for dashboard, departments, users, routing settings, social-task workflow, and task workflow branches.

## Remaining Production Follow-Ups

1. Persist ASP.NET Core Data Protection keys in Dokploy so auth and encrypted payloads survive container replacement.
2. Override development secrets and seeded local-user password with Dokploy environment variables.
3. Keep `Database:ApplyMigrationsOnStartup=false` in production and only provide `Authentication:InitialPassword` during first-time bootstrap.
4. Tighten observability for production: request correlation, central log shipping, and alerting.
5. Add backend unit/integration tests if release confidence needs to go beyond the current browser suite.

## Deployment Model

**Single-tenant frontend**: Each municipality gets its own frontend deployment with `VITE_TENANT_ID` baked in at build time.
- `VITE_TENANT_ID` is read from `VITE_TENANT_ID` env var in `frontend/src/api/config.ts`.
- When set, `getTenantLoginContext()` sends `X-Tenant-Id` header → backend resolves to that tenant → `hideTenantSelector: true` → no municipality picker shown.
- Backend resolution priority: explicit tenant ID (header) > custom domain (Host) > single-tenant fallback > manual selection.
- For local dev: `frontend/.env.local` sets `VITE_TENANT_ID=b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e` (Tire Belediyesi).
- For Docker: `.env` has `CCC_TENANT_ID` → docker-compose passes `VITE_TENANT_ID` build arg to frontend image.

## Release Gate

1. `dotnet build backend/CityCommunicationCenter.sln`
2. `cd frontend && npm run lint`
3. `cd frontend && npm run build`
4. `docker compose up -d`
5. `cd tests/e2e && npm test`