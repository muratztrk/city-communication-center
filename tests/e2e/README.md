# E2E Tests

Bu klasor aktif `frontend/` SPA ve API icin Playwright smoke/regression senaryolarini barindirir. Task listeleri yeni scope modeline, auth akislari interactive/adaptive modele, LDAP onboarding ise explicit admin linking modeline gore test edilir.

## Varsayilan Adresler

- Frontend: `http://localhost:13000`
- API: `http://localhost:15000`

## Kurulum

```bash
cd tests/e2e
npm install
npx playwright install
```

## Calistirma

```bash
npm test
```

Local docker-compose ile ayni portlarda calistirmak icin:

```bash
copy ..\.env.example ..\.env
cd ..
docker compose up -d --build
set CCC_INITIAL_PASSWORD=<.env icindeki ayni deger>
cd tests\e2e
npm test
```

Alternatif host tanimlamak icin:

```bash
set CCC_BASE_URL=http://localhost:13000
set CCC_API_BASE_URL=http://localhost:15000
npm test
```

## Seed Ve Kimlik Bilgileri

- `CCC_INITIAL_PASSWORD`, seed local kullanicilarla birebir ayni olmalidir.
- Varsayilan actor hesaplari:
	- `admin`
	- `zeynep.kara`
	- `emre.celik`
- Bu environment variable tanimli degilse testler fail-fast davranir.

## Aktif Kapsam

- `/connect/token` password grant contract'i ve tenant resolution varyantlari
- Tek tenant login UX'i ve custom-domain tenant context
- Trusted network / external network adaptive auth davranislari
- Invalid login geri bildirimi
- Session restore ve logout cleanup
- Dashboard ve temel navigation smoke
- Departments create/list akisi
- Users ekraninda local create ve explicit LDAP linking akisi
- Settings ekraninda explicit LDAP onboarding metni, auto-provision kontrolunun yoklugu, auth policy ve role visibility
- Routing settings CRUD ve test endpoint'i
- Tasks ekraninda scope bazli gorunumler:
	- `mine`
	- `department-pool`
	- `pending-approval`
	- `all`
- Task workflow varyantlari:
	- manual approval flow
	- department-pool claim flow
	- rejection branch
	- manager-less direct assignment
	- assignment validation guardrail
	- department-filtered assignee listesi
- Departman bazli social message routing, task conversion ve cok kullanicili kapatma akisi
- Social-to-task fallback title davranisi

## Ozel Notlar

- Frontend task tab'lari ve buton isimleri degisirse ilgili task/social spec'leri ayni is kapsaminda guncellenmelidir.
- LDAP onboarding ile ilgili UI kopyasi degisirse `settings.spec.ts` ve `user-management.spec.ts` birlikte gozden gecirilmelidir.
- Social messages ekraninda yonlendirme semantigi degisirse `social-task-flow.spec.ts`, `FEATURES.md` ve `SCENARIOS.md` birlikte gozden gecirilmelidir.
- Scope davranisi degisirse `task-workflow.spec.ts`, `social-task-flow.spec.ts`, `FEATURES.md` ve `SCENARIOS.md` birlikte guncellenmelidir.

## Kaynak Belgeler

- Senaryo ayrintilari: `SCENARIOS.md`
- Feature/env inventory: `FEATURES.md`

Note: Playwright config repo root `.env` dosyasini otomatik yukler; `CCC_INITIAL_PASSWORD` ve varsayilan host/port ayarlari buradan alinabilir.
