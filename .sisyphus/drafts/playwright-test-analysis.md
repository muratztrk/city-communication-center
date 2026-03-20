# Draft: Playwright Test Altyapı Analizi ve Task Assign Test Planı

## Amaç
Mevcut Playwright test altyapısını analiz edip task assign özellikleri için detaylı test caseleri planlamak.

## Mevcut Playwright Test Altyapısı

### Yapı
- **Test dizini**: `tests/e2e/specs/`
- **Mevcut testler**: 
  - `auth-navigation.spec.ts` - Login ve temel navigasyon testi
  - `settings.spec.ts` - Ayarlar ekranı testi
- **Config**: `tests/e2e/playwright.config.ts`
  - Base URL: `http://localhost:3000`
  - Browser: Chromium
  - Parallel: false (sequential)
  - Screenshot/video: sadece failure durumunda
- **Page Object Model**: Yok (henüz)
- **Fixtures/Helpers**: Yok (login fonksiyonu her test dosyasında tekrarlanıyor)

### Mevcut Test Pattern'i
```typescript
const ADMIN_EMAIL = 'admin@tire.bel.tr';
const ADMIN_PASSWORD = 'password123';
const TIRE_TENANT_ID = 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e';

async function login(page) {
  await page.goto('/');
  await page.getByLabel('Belediye').selectOption(TIRE_TENANT_ID);
  await page.getByLabel('Kullanıcı Adı / E-posta').fill(ADMIN_EMAIL);
  await page.getByLabel('Şifre').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Giriş Yap' }).click();
  await expect(page.getByRole('heading', { name: '📊 Kontrol Paneli' })).toBeVisible();
}
```

## Kritik Bulgu: Task Assign Özelliği Frontend'de Yok!

### Backend Durumu
- **API Endpoint**: `POST /api/v1/tasks/{taskId}/assign`
- **Request**: `{ DepartmentId?: guid, UserId?: guid, ActionType: string }`
- **Command**: `AssignTask.cs` - Tam implementasyon var
- **Logic**: Task status "Draft" veya "Assigned" olmalı, assignment history tutuluyor

### Frontend Durumu
- **`client.ts` içinde assignTask fonksiyonu YOK**
- **`TasksPage.tsx` içinde assign butonu/formu YOK**
- Mevcut aksiyonlar: submit, approve, complete (ama assign yok!)

### Task Status Flow
```
Draft → Submit → PendingApproval → Approve → Assigned → Complete → Completed
```

### Task Assign Nerede Olmalı?
TasksPage.tsx'de şu durumlarda görünmeli:
- `currentStatus === 'PendingApproval'` - Onaylandığında otomatik assign
- `currentStatus === 'Assigned'` - Re-assign yapılabilir
- Yeni bir "Assign" butonu ve modal/dialog gerekiyor

## Demo Kullanıcılar (Test için hazır)
- admin@tire.bel.tr / password123
- ali.yildiz@tire.bel.tr / password123
- Tenant ID: b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e

## İncelenecek Konular
1. Playwright config ve setup
2. Mevcut test dosyaları
3. Page Object Model yapısı
4. Task assign özellikleri
5. Frontend komponentleri
6. Backend API'leri

## Planlanan Test Caseler (Taslak)
- Task assign happy path
- Task assign validation errors
- Task assign permission checks
- Task assign edge cases

## Notlar
- Agent araştırması devam ediyor
- Direct file incelemesi yapılabilir
