# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Multi-tenant city communication platform. Municipal operators receive citizen requests from social media channels (Facebook, Instagram, X, WhatsApp, Email, WebForm), route them to departments, convert them to Jobs and Tasks, and track workflow to completion.

**Stack:** .NET 10 Clean Architecture + CQRS (backend) · React 19 + Vite + TypeScript (frontend) · PostgreSQL · Docker Compose

---

## Commands

### Backend
```bash
dotnet build backend/CityCommunicationCenter.sln
dotnet run --project backend/src/CityCommunicationCenter.Api
dotnet run --project backend/src/CityCommunicationCenter.Worker

# EF migrations
dotnet ef migrations add <Name> --project backend/src/CityCommunicationCenter.Infrastructure --startup-project backend/src/CityCommunicationCenter.Api
dotnet ef database update --project backend/src/CityCommunicationCenter.Infrastructure --startup-project backend/src/CityCommunicationCenter.Api
```

### Frontend
```bash
cd frontend
npm install
npm run dev      # dev server (port 5173)
npm run build    # tsc -b && vite build
npm run lint
```

### Docker (default ports: frontend 13000, API 15000, PostgreSQL 5432)
```bash
docker-compose up -d
docker-compose up -d --build api       # rebuild API only
docker-compose up -d --build frontend  # rebuild frontend only
```

### E2E tests
```bash
cd tests/e2e && npm install && npx playwright install && npm test
```

---

## Architecture

### Backend (`backend/src/`)

| Project | Role |
|---|---|
| `CityCommunicationCenter.Api` | Controllers, OpenIddict token endpoint, SignalR hub, middleware, request pipeline |
| `CityCommunicationCenter.Application` | CQRS commands/queries (MediatR), FluentValidation, pipeline behaviors, use-case logic |
| `CityCommunicationCenter.Domain` | Entities, enums, no dependencies |
| `CityCommunicationCenter.Infrastructure` | EF Core DbContext, tenant context, social media integrations, Data Protection |
| `CityCommunicationCenter.Worker` | Background service (`WorkflowPollingWorker`) |

**Adding a new feature:** create a `Commands/` and `Queries/` folder under `Application/Features/<FeatureName>/`, add a controller in `Api/Controllers/`. Follow the existing CQRS pattern — command/query structs, a `IRequestHandler` or `ICommandHandler`, and FluentValidation validators in the same file or folder.

### Application layer patterns
- Uses [Mediator](https://github.com/martinothamar/Mediator) (not MediatR) — `Mediator.IMessage`, `Mediator.IPipelineBehavior`
- `ValidationBehavior<TRequest, TResponse>` auto-runs all `IValidator<TRequest>` in the pipeline
- `ForbiddenAccessException` → `ExceptionMiddleware` → HTTP 403 with RFC 7807 body
- `ValidationException` (FluentValidation) → `ExceptionMiddleware` → HTTP 400 `ValidationProblemDetails`
- All error/validation messages are in **Turkish**
- Enums serialize as strings globally (`JsonStringEnumConverter` in `AddJsonOptions`)

### Domain entities & key enums

**Entities:** `Tenant`, `TenantSetting`, `Department`, `ApplicationUser`, `SocialMessage`, `Job`, `JobDepartment`, `WorkTask`, `WorkflowApproval`, `AssignmentHistory`, `Notification`, `AuditLog`, `RoutingRule`, `PushSubscription`, `Attachment`

**`TaskStatus`**: `Waiting` → `Assigned` → `InProgress` → `PendingCloseApproval` → `Completed` / `Cancelled` / `Rejected` / `RevisionRequested`

**`RoleCode`**: `SystemAdmin`, `Operator`, `Manager`, `Staff`, `Reporter`

**`SocialChannel`**: `Facebook`, `Instagram`, `X`, `Email`, `WebForm`, `WhatsApp`, `Phone`, `Other`

### Task workflow authorization (`TaskWorkflowAuthorization.cs`)
- **Assign / approve close**: SystemAdmin or Manager of the assigned department
- **Assignee actions** (progress, complete): the assigned user or SystemAdmin
- **Claim from pool**: user must belong to `AssignedDepartmentId`; task must be `Waiting` with no `AssignedUserId`
- **Job completion**: auto-recomputed after every task status change — averaged `CompletionPercentage`; Job flips to `Completed` when all tasks reach `Completed`

### Multi-tenancy
- `ITenantContextAccessor` / `HttpTenantContextAccessor` resolves the active tenant per request
- EF Core global query filter applied when `TenantContext.ApplyQueryFilter == true`
- Tenant resolution priority: explicit `X-Tenant-Id` header → `CustomDomain` (Host header) → `SingleTenant` (one active tenant) → `ManualSelection`
- `AuditableTenantEntity` base class auto-sets `CreatedAtUtc` / `UpdatedAtUtc` in `SaveChangesAsync`

### Auth (OpenIddict degraded mode)
- Stateless password flow only (`POST /connect/token`), no authorization codes, no refresh tokens
- Access token lifetime: **8 hours**; session cookie: `__Host-ccc-session`, **480 min** sliding
- LDAP login (`Authentication:Ldap:Enabled=true`) + local user fallback (`Authentication:EnableLocalUsers`)
- Initial SystemAdmin password seeded from `Authentication:InitialPassword`
- `Database:ApplyMigrationsOnStartup` runs EF migrations on startup (enabled in dev and Docker, disabled in base config)

### SignalR
- Hub at `/hubs/notifications` (requires auth)
- On connect, user joins groups `user-{userId}` and `tenant-{tenantId}`
- Push via `INotificationPushService` → `SignalRNotificationPushService`

### File uploads
- Max size: **6 MB** (`MultipartBodyLengthLimit`)
- Stored in `uploads/` under API content root; served as static files at `/uploads/`

---

## Frontend (`frontend/src/`)

| Directory | Role |
|---|---|
| `api/client.ts` | Typed API client — all backend calls |
| `api/http.ts` | `fetchWithCredentials` (adds `credentials: include`) + `getAuthHeaders` (injects `Authorization`, `X-Tenant-Id`, `Accept-Language`) |
| `api/config.ts` | `API_BASE = ${VITE_API_ORIGIN \|\| window.location.origin}/api/v1`; `TENANT_ID` from `VITE_TENANT_ID` |
| `context/AuthContext.tsx` | Auth state, login/logout |
| `context/ThemeContext.tsx` | Light/dark theme |
| `pages/` | One component per route (Dashboard, Tasks, Jobs, SocialMessages, Users, Departments, Settings, AuditLogs, …) |
| `locales/` | i18n strings (Turkish + English) via `i18n.ts` |

**Error handling:** `ensureOk` in `http.ts` extracts validation errors, `detail`, `error_description`, or `title` from the response body, in that priority order.

---

## Local Development

### Without Docker (backend only)
- `appsettings.Development.json` targets `localhost:5432`, signing key `development-signing-key-1234567890`, initial password `Password123!`
- `ApplyMigrationsOnStartup=true` in dev — migrations run automatically on `dotnet run`
- Mock LDAP users available: `mehmet.arslan` / `selin.demir` / `e2e.ldap01`–`e2e.ldap08`, password `MockLdap!2026`

### With Docker
- Copy `.env` to set required vars (`CCC_DB_PASSWORD`, `CCC_SIGNING_KEY` are mandatory at runtime)
- `CCC_INITIAL_PASSWORD` seeds the first SystemAdmin password on fresh DB
- `CCC_TENANT_ID` bakes tenant ID into the frontend build (single-tenant deploy)
- `CCC_API_PUBLIC_ORIGIN` needed only when API and frontend are served from different origins

### Single-tenant frontend (local)
Create `frontend/.env.local`:
```
VITE_TENANT_ID=b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e
VITE_API_ORIGIN=http://localhost:15000
```

### OpenAPI / Scalar
Available in Development at `/api-docs` (Scalar UI) and `/openapi/{documentName}.json`.

### Demo seed data
Only runs when `SeedData:EnableDemoData=true`. Enabled in development config; off in base config. Safe to toggle for local testing.

---

## Important notes
- **Before implementing a Trello card, read [`docs/feature-invariants.md`](docs/feature-invariants.md)** (the "don't break X" rules) and follow the mandatory card workflow + build/lint gate in [`AGENTS.md`](AGENTS.md). Doc index: [`docs/README.md`](docs/README.md).
- `frontend_old/` is archival — do not use for builds or edits
- CORS in production requires `Cors:AllowedOrigins` to be set; dev allows all origins
- `ForwardedHeaders:AllowUntrustedForwardedHeaders=true` is only permitted in Development
- Rate limiting defaults: 120 requests/60 s per IP (500 in dev)
- Logs written to `logs/log-<date>.txt` (14-day retention) alongside console output
