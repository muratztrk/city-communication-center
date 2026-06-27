# AGENTS.md - City Communication Center

Agentic coding guidelines for the City Communication Center repository.

## Project Overview

**Multi-tenant city communication platform** with CQRS architecture:
- **Backend**: .NET 10 Web API with Clean Architecture
- **Frontend**: React 19 + TypeScript + Vite
- **Database**: PostgreSQL with Entity Framework Core
- **Patterns**: CQRS with MediatR, FluentValidation

## Build Commands

### Backend (.NET)
```bash
# Build entire solution
dotnet build backend/CityCommunicationCenter.sln

# Build specific project
dotnet build backend/src/CityCommunicationCenter.Api/CityCommunicationCenter.Api.csproj

# Run API
dotnet run --project backend/src/CityCommunicationCenter.Api

# Run Worker
dotnet run --project backend/src/CityCommunicationCenter.Worker

# Database migrations
dotnet ef migrations add <name> --project backend/src/CityCommunicationCenter.Infrastructure --startup-project backend/src/CityCommunicationCenter.Api
dotnet ef database update --project backend/src/CityCommunicationCenter.Infrastructure --startup-project backend/src/CityCommunicationCenter.Api
```

### Frontend (React/TypeScript)
```bash
cd frontend

# Install dependencies
npm install

# Development server
npm run dev

# Production build
npm run build

# Lint
npm run lint
```

### Docker
```bash
# Start all services
docker-compose up -d

# Rebuild API
docker-compose up -d --build api

# Rebuild frontend
docker-compose up -d --build frontend
```

Local docker runtime uses `frontend/` as the active SPA source. `frontend_old/` is archival and should not be used for startup/build work. Default host ports are frontend `13000`, API `15000`, and PostgreSQL `5432`.

## Testing

Current automated test assets:

```bash
# Browser E2E scaffold
cd tests/e2e
npm install
npx playwright install
npm test
```

Backend unit/integration tests are still not configured. When adding them:

```bash
# Create xUnit test project
dotnet new xunit -n CityCommunicationCenter.Tests

# Run all tests
dotnet test

# Run specific test
dotnet test --filter "FullyQualifiedName~TestClassName"

# Run with verbosity
dotnet test --logger "console;verbosity=detailed"
```

## Code Style Guidelines

### C# / .NET

- **Target Framework**: .NET 10
- **Nullable**: Enabled (`<Nullable>enable</Nullable>`)
- **Implicit Usings**: Enabled (`<ImplicitUsings>enable</ImplicitUsings>`)

#### Naming Conventions
- **PascalCase**: Classes, interfaces, methods, properties, public fields
- **camelCase**: Local variables, parameters, private fields
- **PascalCase with I prefix**: Interfaces (e.g., `ISocialMediaService`)
- **PascalCase ending in Async**: Async methods

#### File Organization
- One class/interface per file (mostly)
- Group related classes in feature folders
- `Common/` for shared abstractions
- `Features/<Feature>/Commands/` and `Features/<Feature>/Queries/` for CQRS

#### CQRS Pattern
```csharp
// Command example
public record CreateTaskCommand : ICommand<Guid>;
public class CreateTaskCommandHandler : IRequestHandler<CreateTaskCommand, Guid>

// Query example
public record GetTasksQuery : IQuery<PaginatedResult<TaskDto>>;
```

#### Entity Framework
- Use `IReadOnlyList<T>` for query results
- Configure entities in `Configurations/` folder
- Extend `AuditableTenantEntity` for tenant-scoped entities
- Use `DateTimeOffset.UtcNow` for timestamps

#### Error Handling
- Use custom middleware (`ExceptionMiddleware`)
- Return `SocialMediaResult.Fail()` for business errors
- Log with `ILogger<T>`

### TypeScript / React

- **Target**: ES2020, React 19
- **Strict**: TypeScript strict mode enabled

#### Naming Conventions
- **PascalCase**: Components, interfaces, types
- **camelCase**: Functions, variables, properties
- **SCREAMING_SNAKE_CASE**: Constants

#### Component Structure
```tsx
// Named exports
export function ComponentName() { }

// Type imports
import type { Type } from './types';
```

#### React Patterns
- Use functional components with hooks
- State: `useState`, Effects: `useEffect`
- API calls: Centralized in `api/client.ts`

## Architecture Layers

```
CityCommunicationCenter.Api          # Controllers, Middleware
CityCommunicationCenter.Application    # CQRS Handlers, Contracts
CityCommunicationCenter.Domain         # Entities, Enums, Domain logic
CityCommunicationCenter.Infrastructure # EF, External services
CityCommunicationCenter.Shared         # Shared DTOs, Contracts
CityCommunicationCenter.Worker         # Background services
backend/                             # Backend solution, Dockerfile, and src/
frontend/                            # React SPA
```

## Dependencies

- **MediatR** 14.1.0 - CQRS dispatcher
- **FluentValidation** 12.1.1 - Input validation
- **EF Core** 10.0.3 - Application/infrastructure data access
- **OpenIddict** 7.4.0 - Stateless access-token issuance and validation pipeline
- **Npgsql EF Core Provider** 10.0.0 - PostgreSQL

## Database Provider Standards

- Default provider is PostgreSQL.
- Optional provider is SQL Server.
- Runtime and design-time database selection must come from configuration or explicit CLI args, not hardcoded connection strings.
- Provider-specific migration sets live under `backend/src/CityCommunicationCenter.Infrastructure/Migrations/PostgreSql/` and `backend/src/CityCommunicationCenter.Infrastructure/Migrations/SqlServer/`.
- Design-time contexts available for migration work:
    - `PostgreSqlCityCommunicationCenterDbContext`
    - `SqlServerCityCommunicationCenterDbContext`

### Migration Commands

```bash
# PostgreSQL migration
dotnet ef migrations add <name> --context PostgreSqlCityCommunicationCenterDbContext --output-dir Migrations/PostgreSql --project backend/src/CityCommunicationCenter.Infrastructure --startup-project backend/src/CityCommunicationCenter.Api

# SQL Server migration
dotnet ef migrations add <name> --context SqlServerCityCommunicationCenterDbContext --output-dir Migrations/SqlServer --project backend/src/CityCommunicationCenter.Infrastructure --startup-project backend/src/CityCommunicationCenter.Api
```

### Production Migration Checklist

Every new migration file must include EF discovery attributes (see `20260625123000_AddUserAdditionalRoles.cs`):

```csharp
[DbContext(typeof(CityCommunicationCenterDbContext))]
[Migration("YYYYMMDDHHMMSS_MigrationName")]
public partial class MigrationName : Migration
```

After prod deploy (`docker compose ... up -d --build api`), verify the migration landed:

```bash
docker compose exec -T postgres psql -U ccc -d city_communication_center \
  -c 'SELECT "MigrationId" FROM "__EFMigrationsHistory" ORDER BY "MigrationId" DESC LIMIT 5;'
```

If API logs show `column ... does not exist`, the schema is ahead of the migration history — apply the migration SQL manually and insert the matching `__EFMigrationsHistory` row before restarting the API.

## Auth Standards

### Canonical Token Flow
- Access-token issuance is standardized on OpenIddict.
- Canonical token endpoint: `/connect/token`
- Supported grants: `password`
- OpenIddict server runs in degraded/stateless mode with token storage disabled.
- Do not introduce refresh tokens, `offline_access`, or OpenIddict EF stores unless the storage model changes intentionally.
- Tenant selection is passed as custom token parameter: `tenant_id`

### Login Source Order
- `LoginCommand` authenticates local password hashes first.
- If local verification fails, LDAP bind is attempted.
- LDAP sign-in only succeeds for already linked application users.
- Missing LDAP users must be created or linked explicitly through directory search and the admin user-create flow.

### Required Access-Token Claims
- `sub`
- `name` and `displayName`
- `email` when available
- `role`
- `tenant_id` and `tenantId`
- `tenant_name`

### Validation
- API authentication uses OpenIddict validation, not manual JWT bearer configuration.
- Access tokens are accepted through the local OpenIddict validation server configuration.
- Tenant resolution may still fall back to `X-Tenant-Id`, but auth-issued tenant claims are the preferred source.
- Anonymous endpoints that inherit from base API controllers must bypass tenant enforcement explicitly.

### Adaptive Tenant Authentication Standards
- Tenant-scoped adaptive auth settings are stored in `TenantSetting.AuthPolicyJson` and accessed through `ITenantAuthenticationPolicyService`.
- Internal-network automatic sign-in is tenant-driven and must use `TrustedHeader` or `Negotiate` modes; do not hardcode municipality-specific auth behavior outside this policy surface.
- Trusted-network detection is CIDR-based and must evaluate tenant-configured trusted proxy ranges before honoring forwarded client IP headers.
- External-network step-up authentication must use the interactive auth flow (`/api/v1/auth/interactive/start` and `/api/v1/auth/interactive/verify`) and finalize token issuance through the existing password grant with one-time exchange credentials.
- Do not add new OpenIddict grant types for tenant MFA/custom auth unless the platform intentionally changes the canonical token model.
- Direct `/connect/token` and legacy login endpoints must enforce tenant step-up rules for non-exchange credentials so external callers cannot bypass second-factor requirements.
- First on-prem tenant seed (`Tire Belediyesi`) is expected to use trusted-network automatic sign-in plus external-network second-factor validation; future municipalities may choose different combinations through the tenant policy settings.

## Contract Standards

### Shared Contracts vs Feature Models
- If a query or command returns the same public API shape exposed by a controller, the application handler should return the shared contract directly.
- Controllers should avoid remapping handler outputs into duplicate `*Response` records unless the endpoint is intentionally composing multiple sources or enforcing a compatibility shape.
- Shared public transport types belong in `CityCommunicationCenter.Shared.Contracts`.
- Feature-local projections should only exist when they are not the same as the public transport contract.

### Current Direct-Return Areas
- `Auth/GetTenants` returns `TenantSummaryResponse`
- `Departments` queries and create command return `DepartmentResponse`
- `Users` query returns `UserSummaryResponse`
- `Notifications` query returns `NotificationResponse`
- `Tasks` query/detail/create return `TaskSummaryResponse` and `TaskDetailResponse`
- `SocialMessages` query/detail/convert return `SocialMessageSummaryResponse`, `SocialMessageDetailResponse`, and `TaskSummaryResponse`

## Task Workflow Standards

- Department-pool tasks are represented by `AssignedDepartmentId` set with `AssignedUserId = null`.
- Task list filtering should extend `GET /api/v1/tasks` via scope-style query parameters instead of adding redundant list endpoints.
- Staff may claim a task from their own department pool only when the task is already in `Assigned` status; manager/system-admin assign and reassign flows remain canonical for explicit routing.

## Social Integration Standards

- Social media contracts used by the application layer live in `CityCommunicationCenter.Application.Abstractions`.
- Infrastructure owns tenant settings storage, HTTP clients, platform adapters, and tenant-aware client factory behavior.
- Keep platform-specific details such as Graph API payloads, X API routes, and WhatsApp webhook parsing inside infrastructure adapters.

## BE/FE Alignment Notes

### Current Status (2025-03-18)
**Build Status**: ✅ `dotnet build backend/CityCommunicationCenter.sln`
**Frontend Build Status**: ✅ `npm run build`
**Frontend Lint Status**: ✅ `npm run lint`
**Docker Validation**: ✅ `docker compose up -d` with API on `15000`, frontend on `13000`, PostgreSQL on `5432`
**Playwright Validation**: ✅ `tests/e2e npm test` with 3 passing scenarios, including multi-user social-task workflow
**Browser Validation**: ✅ Login, dashboard, tasks, social messages, departments, users, and audit screens verified against Docker runtime
**Health Check**: ✅ `GET /health` returned `200`
**Alignment Status**: ✅ TaskStatus aligned, auth flow standardized on stateless OpenIddict + LDAP/local login, and social-task workflow verified end to end

### Enum Alignment (FIXED)
**TaskStatus**: BE ve FE artık uyumlu çalışıyor
- **Önceki durum**: BE `New` kullanıyordu, FE `Draft` bekliyordu
- **Şu anki durum**: Her ikisi de `Draft` kullanıyor
- **Değiştirilen dosyalar**:
  - `CreateTask.cs`: `TaskStatus.New` → `TaskStatus.Draft`
  - `ConvertSocialMessageToTask.cs`: `TaskStatus.New` → `TaskStatus.Draft`
  - `AssignTask.cs`: Status check `New` → `Draft`
  - `SubmitTask.cs`: Status check `New` → `Draft`

### Enum Parsing (Enhanced in BE)
Güvenli enum parsing (case-insensitive):

```csharp
// In CreateTask.cs - Handler
private static TEnum ParseEnum<TEnum>(string value) where TEnum : struct, Enum
{
    if (string.IsNullOrWhiteSpace(value))
        throw new ArgumentException($"{typeof(TEnum).Name} değeri boş olamaz.");
    
    // Try direct parse first (case-insensitive)
    if (Enum.TryParse<TEnum>(value, true, out var result))
        return result;
    
    // Try with spaces removed (e.g., "Internal Request" -> "InternalRequest")
    var normalizedValue = value.Replace(" ", "");
    if (Enum.TryParse<TEnum>(normalizedValue, true, out result))
        return result;
    
    throw new ArgumentException($"Geçersiz {typeof(TEnum).Name} değeri: {value}");
}
```

**Geçerli enum değerleri**:
- **TaskType**: `CitizenRequest`, `InternalRequest`, `ApprovalTask`
- **SourceType**: `Manual`, `SocialMessage`, `Integration`
- **TaskStatus**: `Draft`, `PendingApproval`, `Assigned`, `InProgress`, `Completed`, `Closed`, `Rejected`

### FluentValidation Pipeline (Working)
- `ValidationBehavior.cs`: Otomatik validasyon pipeline'da çalışıyor
- `ExceptionMiddleware.cs`: Türkçe hata mesajları FE'ye dönüyor
- **Response format**: `ValidationProblemDetails` RFC 7807 standardı
- **Hata mesajları**: Türkçe (örnek: "Görev başlığı gereklidir.", "Geçersiz TaskType değeri")

### Infrastructure Improvements (Context7 Best Practices)
1. **Pipeline Behaviors**: MediatR pipeline'da ValidationBehavior ve AuditLoggingBehavior
2. **Global Error Handling**: ExceptionMiddleware tüm hataları yakalıyor
3. **ProblemDetails**: RFC 7807 standardı kullanılarak tutarlı API hata yanıtları
4. **Enum Serialization**: JSON string olarak serileştiriliyor
5. **Token Lifecycle**: OpenIddict degraded mode ile stateless password flow aktif, refresh token yok
6. **Claim Destinations**: Access token'a giden claim'ler OpenIddict claim destinations ile açıkça tanımlanıyor

### Persistence and Workflow Hardening (2025-03-18)
1. **Social Settings Storage**: Social media channel settings tenant bazli `TenantSocialMediaSettings` tablosunda saklaniyor.
2. **Secret Protection**: Hassas sosyal medya credential alanlari ASP.NET Core Data Protection ile sifreleniyor.
3. **Key Persistence**: Data Protection key'leri konfigurable path altinda tutuluyor; Docker development ortaminda `/app/.keys` volume ile kalici.
4. **Seed Gating**: Demo seed sadece `SeedData:EnableDemoData=true` oldugunda calisiyor; base config'de kapali, development config'de acik.
5. **Migration Baseline**: EF migration zinciri temizlenip tek bir yeni baseline `20260318123015_InitialCreate` uzerinden devam ediyor.
6. **Workflow Validation**: Sosyal mesajin departmana yonlendirilmesi, goreve donusturulmesi, mudur onayi, personel atamasi, tamamlama ve kapatma akisi cok kullanicili Playwright senaryosuyla dogrulandi.

### Known Follow-Ups
1. Tenant çözümleme davranışı halen claim + header kombinasyonuna izin veriyor; auth claim tabanlı tek-path sertleştirmesi sonraki sertleştirme işi.
2. Gorev onaylama, atama ve kapatma yetkileri ek authorization kurallariyla daha da sertlestirilebilir.
3. EF CLI tool zinciri runtime ile ayni 10.x patch serisine alinabilir; migration uretiminde tool/runtime uyari gurultusu kaldirilir.

## Single-Tenant Frontend Deployment

- Her belediye için ayrı bir frontend build deploy edilir; `VITE_TENANT_ID` build-time env var ile tenant sabitlenir.
- Frontend `getTenantLoginContext()` call'ında `X-Tenant-Id` header gönderir → backend `TenantId` resolution mode ile tek tenant döndürür → municipality seçim ekranı gösterilmez.
- Backend resolution priority: `TenantId` (explicit header) > `CustomDomain` (Host header) > `SingleTenant` (tek aktif tenant) > `ManualSelection`.
- Tire Belediyesi tenant ID: `b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e`.
- Local dev: `frontend/.env.local` → `VITE_TENANT_ID=b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e`, `VITE_API_ORIGIN=http://localhost:5160`.
- Docker: `.env` `CCC_TENANT_ID` → `docker-compose.yml` `VITE_TENANT_ID` build arg → `frontend/Dockerfile` `ARG VITE_TENANT_ID`.

### Build Durumu
```
✅ dotnet build backend/CityCommunicationCenter.sln
✅ frontend npm run build
✅ frontend npm run lint
✅ docker compose up -d
✅ tests/e2e npm test
```

## Kart İş Akışı ve Doğrulama Kapısı (ZORUNLU)

Trello kartlarını yaparken eskiyi bozmamak için her kart şu döngüden geçer:

1. **Önce oku:** Koda dokunmadan, dokunacağın alanın bölümünü
   [`docs/feature-invariants.md`](docs/feature-invariants.md)'den oku. Doc indeksi:
   [`docs/README.md`](docs/README.md).
2. **Uygula:** Kartı, o alandaki invariant'ları bozmadan gerçekleştir. Belirsizse
   (tek-satır/çelişkili kart, görsel gerektiren) **koda başlamadan netleştir**.
3. **Doğrulama kapısı (push'tan ÖNCE, atlanamaz):**
   - Backend dokunulduysa: `dotnet build backend/CityCommunicationCenter.sln` → **yeşil**.
   - Frontend dokunulduysa: `cd frontend && npm run build && npm run lint` → **yeşil**
     (mevcut, ilgisiz JobsPage hook uyarısı kabul edilebilir).
   - Yeşil değilse **push etme**. Demo seed yok → runtime E2E yerine kod + build + (varsa) görsel.
4. **Sonra güncelle:** Yeni öğrendiğin bir "bozulabilir kural"ı `feature-invariants.md`'ye
   tek satır ekle; kartı `tasks/todo.md`'ye işle.
5. **Push:** `main` **ve** `master`'a. ⚠️ `main` = PRODUCTION auto-deploy (gerçek Tire verisi).

## Git Workflow

- Commit after completing logical units of work
- No force push to main
- Follow existing code style in surrounding files
