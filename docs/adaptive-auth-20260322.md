# Tenant Resolution ve Adaptive Auth Rehberi

## Bu doküman neyi açıklar?

Bu belge, City Communication Center uygulamasında aşağıdaki üç ihtiyacı birlikte nasıl yönettiğimizi açıklar:

- On-prem kurulumlarda tek tenant ile tenant seçimi göstermeden giriş yapmak
- Cloud veya bizim host ettiğimiz çok tenantlı kurulumlarda tenant çözümleme mantığını standartlaştırmak
- İç ağ ve dış ağ için farklı kimlik doğrulama kuralları uygulamak

Bu doküman özellikle aşağıdaki sorulara cevap verir:

- Hangi durumda tenant otomatik bulunur?
- Hangi durumda kullanıcı tenant seçmek zorunda kalır?
- Trusted network, trusted proxy CIDR, trusted header ve Negotiate ne anlama gelir?
- VPN, kurum DNS'i ve iç ağ erişimi birlikte nasıl değerlendirilmelidir?
- Geliştirme ortamında bunu nasıl deneyebiliriz?

## Desteklenen kurulum modelleri

### 1. On-prem tek tenant

Beklenen davranış:

- Sistemde yalnızca 1 aktif tenant varsa login ekranında tenant seçimi gösterilmez.
- Kullanıcı doğrudan kurum bağlamında giriş yapar.
- UI, çok tenantlı bir platform hissi vermez.

Bu repo içinde artık uygulanan davranış budur.

### 2. Cloud çok tenant

Beklenen davranış:

- Ortak bir host altında birden fazla tenant varsa ve domain eşleşmesi yoksa kullanıcı tenant seçer.
- UI bu durumda seçimi açıkça ister.
- Tenant çözümleme otomatik değil, kontrollü olur.

### 3. Custom domain ile tenant'a kilitli erişim

Beklenen davranış:

- Müşteriye özel domain tanımlanır.
- İstek bu domain üzerinden geldiğinde tenant otomatik çözülür.
- Login ekranında tenant selector görünmez.
- Kullanıcı doğrudan kendi kurumu içinde çalışır.

Örnek:

- `iletisim.tire.bel.tr` yalnızca Tire Belediyesi tenant'ına bağlı olabilir.
- Bu domain üzerinden gelen kullanıcı hiçbir tenant listesi görmez.

## Tenant çözümleme sırası

Login başlangıcında backend artık tenant bağlamını şu sırayla çözmeye çalışır:

1. Request host bir tenant domain'i ile eşleşiyor mu?
2. Sistemde yalnızca 1 aktif tenant mı var?
3. Yukarıdakiler olmadıysa kullanıcı tenant seçmek zorunda mı?

Karar tablosu:

| Durum | Sonuç |
|---|---|
| Custom domain eşleşti | Tenant otomatik çözülür, selector gizlenir |
| Sadece 1 aktif tenant var | Tenant otomatik çözülür, selector gizlenir |
| Birden çok tenant var ve domain eşleşmesi yok | Selector gösterilir |
| Hiç tenant yok | Sistem bootstrap gerektirir |

## Şu an kodda uygulanan davranış

### Login UI

- `tenant-context` endpoint'i çağrılır.
- Eğer tenant otomatik çözüldüyse login ekranı sabit bir kurum kartı gösterir.
- Eğer tenant seçimi gerekiyorsa select alanı render edilir.
- Kullanıcıya gereksiz yere çok tenantlı SaaS hissi verilmez.

### Token alma

- `/connect/token` artık tek tenant kurulumlarında `tenant_id` olmadan da çalışabilir.
- Eğer tenant host veya single-tenant üzerinden çözülemiyorsa `tenant_id` hâlâ gereklidir.

### Interactive auth

- `/api/v1/auth/interactive/start`
- `/api/v1/auth/interactive/verify`

bu iki endpoint de artık tenant bilgisini host veya single-tenant mantığıyla çözebilir.

## Adaptive auth karar modeli

Adaptive auth mantığı tenant bazlı policy üzerinden çalışır.

Policy alanları özetle şunlardır:

- `automaticSignInEnabled`
- `automaticSignInMode`: `Disabled`, `TrustedHeader`, `Negotiate`
- `trustedNetworkCidrs`
- `trustedProxyCidrs`
- `identityHeaderName`
- `requireSecondFactorOutsideTrustedNetwork`
- `secondFactorProvider`: `Disabled`, `Mock`, `Webhook`
- `codeLength`
- `codeTtlSeconds`
- `allowMockCodePreview`
- `webhookUrl`

Karar akışı:

1. Tenant çözümlenir.
2. İstek için efektif istemci IP'si bulunur.
3. Bu IP tenant'ın trusted network sınırları içinde mi diye bakılır.
4. İç ağdaysa otomatik kurumsal giriş denenir.
5. Dış ağdaysa gerekiyorsa ikinci faktör zorlanır.
6. Son adımda mevcut `/connect/token` password grant akışı korunur.

## Trusted network, trusted proxy, trusted header, Negotiate ne demek?

### Trusted network CIDR

Bu, "iç ağ" kabul edeceğimiz istemci IP aralıklarıdır.

Örnekler:

- `10.0.0.0/8`
- `172.16.0.0/12`
- `192.168.0.0/16`
- VPN havuzu olarak `10.50.0.0/16`

Bir istek bu aralıklardan geliyorsa sistem onu iç ağ gibi değerlendirebilir.

Önemli nokta:

- Burada esas olan DNS adı değil, efektif istemci IP'sidir.
- Yani `kurum.local` ya da `vpn.kurum.tr` kullanılması tek başına iç ağ sayılması için yeterli değildir.

### Trusted proxy CIDR

Bu alan, hangi reverse proxy veya gateway IP'lerine güveneceğimizi belirler.

Amaç:

- `X-Forwarded-For` gibi header'ları herkesten kabul etmemek
- Sadece bizim kontrol ettiğimiz proxy'den geliyorsa istemci IP'sini forwarded chain içinden okumak

Kural:

- Uygulama önce immediate remote IP'ye bakar.
- Bu IP `trustedProxyCidrs` içinde ise `X-Forwarded-For` dikkate alınır.
- Değilse client doğrudan bağlandı varsayılır ve forwarded header yok sayılır.

Bu güvenlik için kritiktir.

### TrustedHeader modu

Bu modda uygulama, kullanıcı kimliğini doğrudan browser'dan almaz.
Kimliği önce bir reverse proxy veya SSO katmanı doğrular, sonra uygulamaya güvenilir bir header bırakır.

Örnek akış:

1. Kullanıcı kurum ağı içinden gelir.
2. IIS / reverse proxy / gateway Kerberos veya başka kurumsal auth ile kullanıcıyı doğrular.
3. Proxy uygulamaya örneğin `X-Authenticated-User: TIRE\\zeynep.kara` gibi bir header iletir.
4. Uygulama sadece trusted proxy arkasında ise bu header'ı kabul eder.

Ne zaman uygundur?

- Kurum zaten merkezi SSO veya reverse proxy kullanıyorsa
- Kerberos/SPNEGO proxy katmanında sonlandırılacaksa
- Uygulamaya doğrudan Windows auth yüklemek istenmiyorsa

Güvenlik şartı:

- Public ingress tarafında bu header kesinlikle temizlenmeli veya overwrite edilmelidir.
- İstemci kendi başına bu header'ı gönderip login olamamalıdır.

### Negotiate modu

Bu modda uygulama browser'ı doğrudan `Negotiate` challenge ile karşılar.

Ne zaman uygundur?

- On-prem kurulum
- Aynı origin veya aynı intranet zone
- Domain joined istemciler
- Tarayıcının integrated Windows authentication desteklediği senaryo

Artı yönleri:

- Ek header gateway'i gerektirmeyebilir

Eksi yönleri:

- Browser, proxy ve domain ayarları daha hassastır
- Internet üzerinden çalışan cloud dağıtımlarda genelde ideal değildir

## VPN senaryosu nasıl düşünülmeli?

Sorudaki kritik nokta buydu: aynı VPN içinde, aynı ağda, hatta kurum domain'i çözülüyor olsa bile sistem bunu nasıl değerlendirmeli?

Cevap:

- Karar DNS adına göre değil, efektif istemci IP'sine göre verilmelidir.
- Eğer kullanıcı VPN'e bağlandığında istemcinin IP'si veya proxy'nin gördüğü orijinal IP, `trustedNetworkCidrs` içindeyse bu istek iç ağ sayılabilir.
- Eğer kullanıcı VPN kullanıyor ama trafik public bir edge üstünden çıkıyor ve uygulama sadece public NAT IP görüyor ise istek dış ağ gibi değerlendirilebilir.

Doğru yaklaşım:

1. VPN istemci havuzunu net olarak bilin.
2. O havuzu `trustedNetworkCidrs` içine ekleyin.
3. Arada reverse proxy varsa onun IP'lerini `trustedProxyCidrs` içine ekleyin.
4. Proxy'nin `X-Forwarded-For` veya eşdeğeri ile gerçek istemci IP'sini doğru geçirdiğini doğrulayın.
5. Yalnızca trusted proxy'den gelen forwarded zinciri kabul edin.

Kısa kural:

- DNS çözülmesi iç ağ kararı için yeterli değildir.
- VPN havuzu ve proxy zinciri doğru tanımlanmışsa iç ağ kabul edilir.

## Önerilen topolojiler

### A. On-prem + reverse proxy + kurumsal SSO

Öneri:

- `automaticSignInMode = TrustedHeader`
- Proxy tarafında kurumsal auth
- Uygulama tarafında trusted header okuma

Ne zaman en iyi seçim?

- Kurum zaten IIS, ARR, WAP, Apache, Nginx, Traefik veya benzeri bir ön katman kullanıyorsa

### B. On-prem + doğrudan Windows integrated auth

Öneri:

- `automaticSignInMode = Negotiate`

Ne zaman mantıklı?

- Uygulama doğrudan intranet'te yayınlanıyorsa
- Browser ve domain policy'leri kontrol altındaysa

### C. Cloud çok tenant + dış ağ kullanıcıları

Öneri:

- Otomatik iç ağ girişini kapat veya sadece belirli private bağlantılar için aç
- Dış ağ için ikinci faktör kullan
- Custom domain varsa tenant'ı host üzerinden çöz

### D. Hybrid + site-to-site VPN veya kullanıcı VPN'i

Öneri:

- VPN client IP havuzunu `trustedNetworkCidrs` içine ekle
- Reverse proxy varsa proxy CIDR'larını `trustedProxyCidrs` içine ekle
- Hâlâ public IP görünüyorsa bunu iç ağ sanma

## Neden exchange ticket kullanıyoruz?

Bu repoda kanonik token modeli hâlâ password grant üzerinden gidiyor.
Bu yüzden adaptive auth sonrasında yeni bir OpenIddict grant type açmıyoruz.

Yerine:

1. İç ağ otomatik login veya dış ağ 2FA başarıyla tamamlanır.
2. Backend kısa ömürlü, tek kullanımlık bir exchange ticket üretir.
3. Frontend bunu yine mevcut `/connect/token` akışıyla değiştirir.

Bu yaklaşımın faydaları:

- Mevcut frontend auth storage bozulmaz
- Token shape aynı kalır
- API client beklentileri korunur
- MFA politikası `/connect/token` üzerinden bypass edilemez

## Geliştirme ortamında nasıl deneriz?

### 1. Tek tenant kurulumu doğrulama

Beklenen sonuç:

- Login ekranında tenant select görünmez
- Kurum kartı görünür

Adımlar:

1. Docker stack'i ayağa kaldırın.
2. `http://localhost:13000` açın.
3. Login ekranında tenant seçimi olmadığını doğrulayın.

Bu repo içinde Playwright ile de doğrulanmıştır.

### 2. Custom domain çözümleme doğrulama

Beklenen sonuç:

- Domain eşleştiğinde tenant otomatik çözülür

Adımlar:

1. Admin olarak tenant settings içinden domain tanımlayın.
2. Reverse proxy veya test istemcisi üzerinden `Host` header'ını bu domain olacak şekilde isteği gönderin.
3. `/api/v1/auth/tenant-context` yanıtında `resolutionMode = CustomDomain` bekleyin.

PowerShell örneği:

```powershell
$headers = @{ Host = 'portal.tire.bel.tr' }
Invoke-RestMethod -Uri 'http://localhost:15000/api/v1/auth/tenant-context' -Headers $headers
```

### 3. Trusted header ile iç ağ otomatik login doğrulama

Beklenen sonuç:

- İç ağ IP'si ve güvenilir header ile kullanıcı doğrudan dashboard'a düşer

Mantık:

- `X-Forwarded-For` iç ağ IP'si gibi görünmeli
- immediate proxy IP trusted proxy aralığında olmalı
- `X-Authenticated-User` benzeri kimlik header'ı geçilmeli

Test yaklaşımı:

- E2E testte ekstra header ile istek gönderilir
- Geliştirme ortamında reverse proxy ile de denenebilir

### 4. Dış ağ + ikinci faktör doğrulama

Beklenen sonuç:

- Public IP ile gelen istekte doğrudan token verilmez
- Kullanıcı ikinci doğrulamaya düşer

Örnek test mantığı:

- `X-Forwarded-For: 203.0.113.15`
- Kullanıcı adı ve şifre girilir
- Mock code preview alınır
- Kod doğrulanır
- Sonra dashboard açılır

### 5. Direkt password grant bypass denemesi

Beklenen sonuç:

- Dış ağdan gelen ve ikinci faktörü tamamlamamış password grant 401 dönmelidir

Bu da repoda test kapsamına dahil edildi.

## Reverse proxy tarafında nelere dikkat etmeliyiz?

Minimum kontrol listesi:

1. Uygulama `X-Forwarded-Host`, `X-Forwarded-For` ve `X-Forwarded-Proto` zincirini doğru almalı.
2. Public taraftan gelen `X-Authenticated-User` benzeri header'lar silinmeli.
3. Proxy'nin kendi IP aralıkları `trustedProxyCidrs` içine eklenmeli.
4. Eğer custom domain kullanılacaksa proxy original host bilgisini korumalı.
5. Frontend ve API aynı custom domain üzerinden yayınlanmıyorsa `VITE_API_ORIGIN` açıkça yönetilmeli.

## Şu an eksik veya sonraki iş olabilecek alanlar

Bu kısım özellikle dürüst durum özeti içindir.

### 1. Sıfır tenant bootstrap deneyimi

Şu an tenant yoksa sistem login için uygun değil.
Bootstrap endpoint var, ancak sıfır tenant kurulumunu yöneten özel bir ilk kurulum UI akışı henüz ayrı bir ürün akışı olarak kurgulanmış değil.

### 2. Custom domain benzersizliği veritabanı seviyesinde değil

Şu an uygulama seviyesinde aynı domain'in iki tenant'a yazılması engelleniyor.
Ama bunu DB-level unique constraint veya normalized host index ile daha da sertleştirmek ileride faydalı olacaktır.

### 3. Wildcard domain eşleşmesi yok

Şu an yaklaşım exact host eşleşmesi üzerine kurulu.
Örneğin `*.belediye.gov.tr` gibi wildcard veya çok katmanlı alias desteği ayrıca tasarlanmadı.

### 4. Proxy ürününe özel örnek konfigürasyonlar burada yok

Bu belgede kavramlar ve uygulama mantığı var.
Ama IIS, Nginx, Traefik, HAProxy veya kurumun kullandığı ürün için birebir config snippet'leri ayrıca hazırlanabilir.

## Bu repo içinde doğrulanan durum

Kod tarafında doğrulanan başlıklar:

- Tek tenant kurulumunda tenant selector gizlenmesi
- `/connect/token` için single-tenant auto resolution
- Custom domain ile tenant context çözümleme
- Trusted header iç ağ otomatik login
- Dış ağ mock 2FA akışı
- Dış ağdan doğrudan password grant blokajı
- Settings ekranından tenant auth policy yönetimi

## Uygulama içindeki temel dosya yüzeyleri

İncelemek isterseniz ana dosyalar şunlardır:

- `backend/src/CityCommunicationCenter.Api/Controllers/V1/AuthController.cs`
- `backend/src/CityCommunicationCenter.Application/Features/Auth/Queries/GetTenantLoginContextQuery.cs`
- `backend/src/CityCommunicationCenter.Infrastructure/Services/InteractiveAuthenticationService.cs`
- `backend/src/CityCommunicationCenter.Infrastructure/Services/TenantAuthenticationPolicyService.cs`
- `frontend/src/pages/LoginPage.tsx`
- `frontend/src/api/auth.ts`
- `frontend/src/pages/SettingsPageTenantAuth.tsx`

## Kısa öneri

İlk on-prem müşteri için en güvenli ve yönetilebilir varsayılan kombinasyon çoğu zaman şudur:

- tek tenant
- tenant selector gizli
- custom domain veya sabit intranet adresi
- iç ağ için `TrustedHeader`
- dış ağ için `Mock` yerine gerçek bir webhook/SMS/e-posta tabanlı ikinci faktör

Eğer kurum tamamen Windows domain ağı içinde ise ve browser politikalarını yönetebiliyorsa `Negotiate` da düşünülür. Ancak operasyonel açıdan çoğu kurumda reverse proxy üstünden `TrustedHeader` yönetimi daha kontrollü olur.
