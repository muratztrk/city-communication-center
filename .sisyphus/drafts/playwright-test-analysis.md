# Draft: Playwright Test Altyapi Analizi ve Task Assign Test Plani

## Amac
Mevcut Playwright test altyapisini analiz edip task assign ozellikleri icin detayli test caseleri planlamak.

## Mevcut Playwright Test Altyapisi

### Yapi
- Test dizini: `tests/e2e/specs/`
- Mevcut testler:
  - `auth-navigation.spec.ts` - login ve temel navigasyon testi
  - `settings.spec.ts` - ayarlar ekrani testi
  - `task-workflow.spec.ts` - gorev akislari
  - `social-task-flow.spec.ts` - sosyal mesajdan goreve akisi
- Config: `tests/e2e/playwright.config.ts`
  - Base URL default: `http://localhost:13000`
  - Browser: Chromium
  - Parallel: dosya bazli, config'te `workers: 1`
  - Screenshot/video: failure odakli
- Helpers: `tests/e2e/specs/helpers.ts`

### Mevcut Test Pattern'i
```typescript
const ADMIN_EMAIL = 'admin@tire.bel.tr';
const ADMIN_PASSWORD = process.env.CCC_INITIAL_PASSWORD;
const TIRE_TENANT_ID = 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e';
```

## Kritik Bulgu: Task Assign Ozelligi Frontend'de Yok

### Backend Durumu
- API endpoint: `POST /api/v1/tasks/{taskId}/assign`
- Request: `{ DepartmentId?: guid, UserId?: guid, ActionType: string }`
- Command: `AssignTask.cs`
- Logic: task status `Draft` veya `Assigned` olmali, assignment history tutuluyor

### Frontend Durumu
- `client.ts` icinde assignTask fonksiyonu yok
- `TasksPage.tsx` icinde assign butonu/formu yok
- Mevcut aksiyonlar: submit, approve, complete

### Task Status Flow
`Draft -> Submit -> PendingApproval -> Approve -> Assigned -> Complete -> Completed`

## Demo Kullanicilar
- `admin@tire.bel.tr / $CCC_INITIAL_PASSWORD`
- `ali.yildiz@tire.bel.tr / $CCC_INITIAL_PASSWORD`
- Tenant ID: `b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e`

## Incelenecek Konular
1. Playwright config ve setup
2. Mevcut test dosyalari
3. Page Object Model yapisi
4. Task assign ozellikleri
5. Frontend komponentleri
6. Backend API'leri

## Planlanan Test Caseler (Taslak)
- Task assign happy path
- Task assign validation errors
- Task assign permission checks
- Task assign edge cases

## Notlar
- Arastirma notu olarak tutulur
- Seed local-user sifreleri migration icinde hardcode degil, `CCC_INITIAL_PASSWORD` ile bootstrap edilir
