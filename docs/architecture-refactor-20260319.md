# Architecture Refactor Log

## Ozet

Bu calismada API katmanindaki dogrudan `DbContext` kullanimi kaldirildi, controller aksiyonlari MediatR/CQRS akisina tasindi, tenant baglami attribute + EF query filter ile merkezilestirildi ve kimlik dogrulama tarafinda yerel kullanici + LDAP fallback destekleyen stateless token akisi duzenlendi.

## Yapilan Ana Degisiklikler

### Tenant Altyapisi

- `TenantRequiredAttribute` ve `ValidateTenantFilter` eklendi.
- `ApiControllerBase` constructor bagimliligindan cikarildi; tenant baglami artik `HttpContext.RequestServices` uzerinden alinuyor.
- `TenantContext` yapisina `ApplyQueryFilter` bilgisi eklendi.
- `CityCommunicationCenterDbContext` icine tenant bazli `HasQueryFilter` tanimlandi.
- Query filter sadece aktif HTTP tenant baglami varken devreye giriyor; seed ve startup gibi request disi senaryolarda filtre kapali kaliyor.

### CQRS ve Controller Donusumu

Asagidaki controller aksiyonlari MediatR uzerine tasindi:

- `AuthController`
- `AdminController`
- `DepartmentsController`
- `MeController`
- `NotificationsController`
- `ReportsController`
- `RoutingController`
- `SocialMessagesController`
- `SocialSettingsController`
- `SocialWebhooksController`
- `TasksController`
- `UsersController`

Eklenen feature dosyalari:

- `Application/Features/Auth/AuthFeature.cs`
- `Application/Features/Admin/AdminFeature.cs`
- `Application/Features/Me/MeFeature.cs`
- `Application/Features/Notifications/NotificationsFeature.cs`
- `Application/Features/Reports/ReportsFeature.cs`
- `Application/Features/Routing/RoutingFeature.cs`
- `Application/Features/Social/SocialMessagesFeature.cs`
- `Application/Features/Tasks/TasksFeature.cs`
- `Application/Features/Users/UsersFeature.cs`

Bu feature dosyalarinda command/query/validator/handler ayni dosyada tutuldu.

### Validation ve Hata Yonetimi

- `FluentValidation` pipeline davranisi korunarak kullanildi.
- API katmanina `ExceptionMiddleware` eklendi.
- `ValidationException` artik 400 `ProblemDetails` cevabina donusturuluyor.
- Beklenmeyen hatalar 500 `ProblemDetails` cevabina donusturuluyor.

### Global Using Standardizasyonu

- Her backend projesinde ortak namespace'ler `GlobalUsings.cs` icinde merkezilestirildi.
- Sadece proje genelinde yaygin ve guvenli namespace'ler global yapildi; feature-ozel namespace'ler lokal `using` olarak birakildi.
- `Api` projesinde controller ortaklari, `Application` projesinde handler ve abstraction ortaklari, `Domain` projesinde `Common` ve `Enums`, `Infrastructure` projesinde adapter ve service ortaklari tek noktadan yonetiliyor.

### Kimlik Dogrulama ve LDAP

- `IUserAuthenticationService` ve `IAuthenticationModeProvider` abstractions eklendi.
- `UserAuthenticationService` ile su akisi kuruldu:
  - yerel kullanici icin paylasilan development/local password dogrulamasi
  - LDAP etkinse LDAP bind denemesi
  - LDAP ile gelen ama sistemde kayitli olmayan kullanici icin otomatik kullanici provision islemi
- `LdapAuthenticationService` eklendi.
- `Authentication` konfigurasyon bolumu eklendi:
  - `EnableLocalUsers`
  - `LocalUserPassword`
  - `Issuer`
  - `Audience`
  - `SigningKey`
  - `Ldap.*`

### Token Akisi

- `/connect/token` endpoint sozlesmesi korundu.
- Token uretimi stateless JWT olarak duzenlendi.
- Token dogrulamasi OpenIddict validation + local server entegrasyonu ile yapiliyor.
- Access token imzalari icin simetrik key korunurken, OpenIddict server gereksinimi nedeniyle identity-token senaryolari icin ephemeral asimetrik signing key de kaydediliyor.
- Degraded mode icin password grant isteklerini kabul eden ozel `ValidateTokenRequestContext` handler'i eklendi; boylece client store gerektirmeden `/connect/token` passtrough akisi korunuyor.
- `AuthController` artik MediatR tabanli auth komutlarini cagiriyor; controller seviyesinde `DbContext` kullanmiyor.

### Docker ve Konfigurasyon

- `docker-compose.yml` icindeki auth env degiskenleri yeni `Authentication__*` yapisina tasindi.
- PostgreSQL baglanti bilgileri korunarak API env degiskenleri guncellendi.

## Dogrulama

Asagidaki kontroller basariyla calistirildi:

- `dotnet build backend/CityCommunicationCenter.sln`
- `frontend` dizininde `npm run build`
- `frontend` dizininde `npm run lint`
- Lokal smoke test:
  - `GET /api/v1/auth/tenants`
  - `POST /connect/token`
  - token + `X-Tenant-Id` ile `GET /api/v1/departments`

## Notlar

- Tenant baglami olmayan istekler tenant-required endpointlerde filtre seviyesinde reddedilir.
- Request disi calisan seed/migration akislari query filter nedeniyle etkilenmez.
- LDAP varsayilan olarak kapali gelir; aktif etmek icin `Authentication:Ldap:Enabled=true` ve baglanti alanlari doldurulmalidir.