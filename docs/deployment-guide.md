# Kurulum ve Deployment Rehberi

Hazırlanma tarihi: 18 Haziran 2026

Bu doküman City Communication Center uygulamasının lokal geliştirme, Docker runtime, sunucu deploy, doğrulama ve rollback süreçlerini açıklar.

## 1. Bileşenler

Uygulama üç ana runtime bileşeninden oluşur:

- PostgreSQL veritabanı
- ASP.NET Core API
- React frontend static build

Aktif frontend kaynağı `frontend/` dizinidir. `frontend_old/` arşivdir ve build/deploy için kullanılmamalıdır.

## 2. Gereksinimler

Lokal geliştirme için:

- .NET 10 SDK
- Node.js ve npm
- Docker ve Docker Compose
- PostgreSQL client araçları opsiyonel

Sunucu için:

- Docker Engine
- Docker Compose plugin
- HTTPS reverse proxy
- Kalıcı volume yedekleme stratejisi
- Production environment secret yönetimi

## 3. Önemli Environment Değişkenleri

Zorunlu veya kritik değişkenler:

| Değişken | Amaç |
| --- | --- |
| `CCC_DB_PASSWORD` | PostgreSQL parolası |
| `CCC_SIGNING_KEY` | Access token signing key |
| `CCC_FRONTEND_PUBLIC_ORIGIN` | Browser'dan erişilen frontend origin |
| `CCC_API_PUBLIC_ORIGIN` | Browser'dan erişilen API origin |
| `CCC_TENANT_ID` | Tek tenant frontend build için tenant ID |
| `CCC_AUTH_ISSUER` | Token issuer |
| `CCC_AUTH_AUDIENCE` | Token audience |
| `CCC_KNOWN_PROXY_0` | Reverse proxy IP'si |
| `CCC_SOCIAL_WEBHOOK_SECRET` | Opsiyonel sosyal webhook shared secret |

Tire Belediyesi tenant ID:

```text
b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e
```

## 4. Lokal Backend Build

```bash
dotnet build backend/CityCommunicationCenter.sln
```

API'yi lokal çalıştırmak için:

```bash
dotnet run --project backend/src/CityCommunicationCenter.Api
```

Worker'ı çalıştırmak için:

```bash
dotnet run --project backend/src/CityCommunicationCenter.Worker
```

## 5. Lokal Frontend Build

```bash
cd frontend
npm install
npm run lint
npm run build
```

Development server:

```bash
cd frontend
npm run dev
```

## 6. Docker Compose ile Çalıştırma

Kök dizinde:

```bash
docker compose up -d
```

Varsayılan portlar:

| Servis | Port |
| --- | --- |
| Frontend | `13000` |
| API | `15000` |
| PostgreSQL | `5432` |

Sadece API rebuild:

```bash
docker compose up -d --build api
```

Sadece frontend rebuild:

```bash
docker compose up -d --build frontend
```

## 7. Production Deploy Akışı

Önerilen sıralama:

1. Sunucuda branch'in güncel olduğundan emin olun.
2. `.env` dosyasında production secret ve origin değerlerini kontrol edin.
3. Frontend ve API image'larını rebuild edin.
4. Container'ları ayağa kaldırın.
5. API health check'i doğrulayın.
6. Frontend'de login ve dashboard'u kontrol edin.
7. Kritik iş akışlarından en az birini manuel test edin.

Örnek:

```bash
git pull
docker compose up -d --build
curl -fsS https://API_ORIGIN/health
```

## 8. Migration Davranışı

Docker ortamında API başlangıcında migration uygular:

```text
Database__ApplyMigrationsOnStartup=true
```

Bu davranış production'da kolaylık sağlar ancak büyük migration'larda bakım penceresi planlanmalıdır.

Manuel migration üretmek için:

```bash
dotnet ef migrations add <MigrationName> \
  --context PostgreSqlCityCommunicationCenterDbContext \
  --output-dir Migrations/PostgreSql \
  --project backend/src/CityCommunicationCenter.Infrastructure \
  --startup-project backend/src/CityCommunicationCenter.Api
```

## 9. Deploy Sonrası Kontrol Listesi

- `/health` endpoint'i `200` dönüyor mu?
- Frontend ana sayfa açılıyor mu?
- Kullanıcı login olabiliyor mu?
- Dashboard veri getiriyor mu?
- Bildirim ikonu ve okunmamış sayı çalışıyor mu?
- Taleplerim ve Görevlerim ekranları açılıyor mu?
- WhatsApp webhook callback URL internetten erişilebilir mi?
- Upload klasörü volume'a bağlı mı?
- Data Protection key volume'u kalıcı mı?
- API loglarında migration veya auth hatası var mı?

## 10. Rollback Yaklaşımı

Rollback için önerilen yaklaşım:

1. Sorunlu deploy commit'ini tespit edin.
2. Önce uygulama image'ını önceki commit'ten rebuild edin.
3. Migration uygulanmışsa veritabanı değişikliğinin geriye uyumlu olup olmadığını kontrol edin.
4. Veri kaybı riski varsa backup restore planı uygulayın.
5. Rollback sonrası `/health`, login ve temel akışları doğrulayın.

Migration rollback otomatik yapılmamalıdır. Her migration veri etkisi açısından ayrı değerlendirilmelidir.

## 11. Backup Önerileri

Yedeklenmesi gerekenler:

- PostgreSQL volume veya dump
- Upload volume
- Data Protection key volume
- Production `.env` secret değerleri

Örnek PostgreSQL dump:

```bash
docker compose exec postgres pg_dump -U ccc city_communication_center > backup.sql
```

## 12. Sık Deploy Sorunları

Değişiklikler görünmüyor:

- Frontend image rebuild edilmemiş olabilir.
- Browser cache veya service worker eski bundle servis ediyor olabilir.
- Reverse proxy eski container'a yönlendiriyor olabilir.

Login çalışmıyor:

- `CCC_SIGNING_KEY`, issuer veya audience hatalı olabilir.
- Tenant ID build-time olarak yanlış verilmiş olabilir.
- LDAP ayarları veya local user seed eksik olabilir.

WhatsApp webhook doğrulanmıyor:

- Callback URL public HTTPS değil.
- Verify token Meta ile uygulamada farklı.
- Reverse proxy API path'ini yanlış yönlendiriyor.
- Sertifika zinciri geçersiz.
