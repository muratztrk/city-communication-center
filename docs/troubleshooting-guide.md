# Bakım ve Sorun Giderme Rehberi

Hazırlanma tarihi: 18 Haziran 2026

Bu doküman City Communication Center'da sık karşılaşılan sorunların hızlı teşhisi ve çözümü için hazırlanmıştır.

## 1. İlk Kontrol Listesi

Her sorunda önce şunları kontrol edin:

- API health check başarılı mı?
- Frontend doğru deploy edilmiş mi?
- Kullanıcı doğru tenant ile login olmuş mu?
- Browser console hatası var mı?
- API loglarında 4xx/5xx hata var mı?
- Veritabanı erişilebilir mi?
- Reverse proxy doğru path yönlendiriyor mu?

Health check:

```bash
curl -fsS https://API_ORIGIN/health
```

Docker durum:

```bash
docker compose ps
```

Loglar:

```bash
docker compose logs api --tail=200
docker compose logs frontend --tail=100
docker compose logs postgres --tail=100
```

## 2. Login Olunamıyor

Olası nedenler:

- Tenant ID yanlış.
- `Authentication:SigningKey` değişmiş.
- Issuer/audience hatalı.
- Kullanıcı pasif.
- LDAP ayarı hatalı.
- Local password hash yok veya yanlış.
- Adaptive auth ikinci faktör tamamlanmıyor.

Kontrol:

1. `/api/v1/auth/tenant-context` yanıtını kontrol edin.
2. `/connect/token` response status koduna bakın.
3. API loglarında auth hatası arayın.
4. Kullanıcının tenant, role ve department bilgisini doğrulayın.
5. LDAP kullanılıyorsa bağlantı ve kullanıcı credential testlerini çalıştırın.

## 3. Dashboard Boş veya Hatalı

Olası nedenler:

- Kullanıcı tenant claim'i yok.
- Dashboard report endpoint'i 500 dönüyor.
- Tenant filter yanlış tenant'a bakıyor.
- Frontend eski build kullanıyor.

Kontrol endpointleri:

```text
GET /api/v1/reports/dashboard
GET /api/v1/reports/dashboard-chart
```

Çözüm:

- Yeniden login olun.
- API loglarını kontrol edin.
- Frontend cache temizleyin.
- Deploy sonrası frontend rebuild doğrulayın.

## 4. Bildirim Okunmamış Sayısı Görünmüyor

Olası nedenler:

- `/api/v1/notifications/unread-count` hata dönüyor.
- SignalR bağlantısı kurulamıyor.
- Kullanıcıya ait notification yok.
- `NotificationReadCursor` okunmamış hesabını sıfırlamış.
- Frontend notification component render olmuyor.

Kontrol:

```text
GET /api/v1/notifications/unread-count
GET /api/v1/notifications
GET /hubs/notifications
```

Tarayıcıda Network sekmesinde SignalR bağlantısı `101 Switching Protocols` veya fallback transport ile başarılı olmalıdır.

## 5. Bildirim Detay Popup Kapanmıyor

Olası nedenler:

- URL query param temizlenmiyor.
- Modal state ve route state senkron değil.
- Detay component'i close callback'i çağırmıyor.

Kontrol:

1. Bildirimden detay açın.
2. Kapat butonuna basın.
3. URL'deki `taskId` veya `jobId` parametresi temizleniyor mu bakın.
4. Console error var mı kontrol edin.

## 6. Talep veya Görev Listesi Yanlış Kayıt Gösteriyor

Olası nedenler:

- Scope/view query param yanlış.
- Tenant filter yanlış.
- Kullanıcı rolü veya department ilişkisi yanlış.
- Süresi geçmiş filtreleri tamamlanmış kayıtları da içeriyor.

Kontrol:

```text
GET /api/v1/jobs
GET /api/v1/tasks
GET /api/v1/me
GET /api/v1/me/departments
```

Kullanıcının rolü, ana birimi ve ek birim ilişkileri doğrulanmalıdır.

## 7. "Gittiği Yer" veya Benzer Detay Alanı Boş

Olası nedenler:

- Liste query'sinde alan var ama detay query'sinde projection eksik.
- Frontend grid alanını farklı kaynaktan, popup farklı kaynaktan okuyor.
- Shared contract güncel değil.

Çözüm yaklaşımı:

1. Grid response payload'ını kontrol edin.
2. Detail response payload'ını kontrol edin.
3. Backend detail DTO mapping'i liste mapping'iyle karşılaştırın.
4. Frontend popup field binding'ini doğrulayın.

## 8. WhatsApp Webhook Doğrulanmıyor

Meta hatası:

```text
The callback URL or verify token couldn't be validated.
```

Olası nedenler:

- Callback URL HTTPS değil.
- DNS public değil.
- Sertifika geçersiz.
- Verify token farklı.
- Reverse proxy API'ye yönlendirmiyor.
- Tenant ID URL'de yanlış.

Kontrol:

```bash
curl -i "https://DOMAIN/api/v1/social/webhooks/whatsapp/TENANT_ID?hub.mode=subscribe&hub.verify_token=TOKEN&hub.challenge=test"
```

Beklenen: challenge body içinde dönmelidir.

## 9. WhatsApp Mesaj Gelmiyor

Olası nedenler:

- Meta webhook `messages` field aboneliği yok.
- Access token yetkisi eksik.
- Phone Number ID yanlış.
- WABA ID yanlış.
- API POST webhook parse edemiyor.
- Meta app development/live modu uyumsuz.

Kontrol:

- Meta webhook delivery logs
- API logs
- Social messages ekranı
- WhatsApp ayar ekranı Test Et sonucu

## 10. WhatsApp Cevap Gönderilemiyor

Olası nedenler:

- 24 saatlik müşteri hizmet penceresi kapanmış.
- Template kullanılmıyor.
- Template onaylı değil.
- Token geçersiz.
- Phone Number ID yanlış.

Çözüm:

- Template mesaj deneyin.
- Meta token izinlerini kontrol edin.
- Phone Number ID'yi doğrulayın.
- API loglarında Graph API response'unu inceleyin.

## 11. Deploy Sonrası Değişiklikler Görünmüyor

Olası nedenler:

- Frontend rebuild edilmemiş.
- Eski container çalışıyor.
- Browser cache veya service worker eski bundle servis ediyor.
- Reverse proxy eski host'a gidiyor.

Kontrol:

```bash
docker compose ps
docker compose images
docker compose logs frontend --tail=50
```

Çözüm:

1. Frontend image rebuild edin.
2. Container'ı yeniden başlatın.
3. Browser hard refresh yapın.
4. Gerekirse service worker unregister edin.

## 12. Dosya Upload Çalışmıyor

Olası nedenler:

- Dosya boyutu limitin üzerinde.
- Upload volume bağlı değil.
- API container içinde `/app/uploads` yazılabilir değil.
- Reverse proxy body size limiti düşük.

Kontrol:

- API multipart limit yaklaşık 6 MB.
- Reverse proxy `client_max_body_size` kontrol edin.
- Docker volume bağlı mı bakın.

## 13. API 429 Dönüyor

Olası neden:

- Rate limiting devrede.

Çözüm:

- Client tekrar deneme sıklığını azaltın.
- Production ihtiyaca göre `RateLimiting:PermitLimit` değerini ayarlayın.
- Reverse proxy arkasında gerçek client IP ile forwarded header güvenini kontrol edin.

## 14. Veritabanı Bağlanmıyor

Olası nedenler:

- PostgreSQL container sağlıksız.
- Connection string yanlış.
- Parola değişmiş.
- Volume bozulmuş veya disk dolmuş.

Kontrol:

```bash
docker compose ps postgres
docker compose logs postgres --tail=100
docker compose exec postgres pg_isready -U ccc -d city_communication_center
```

## 15. Migration Hatası

Olası nedenler:

- Migration production verisiyle uyumsuz.
- EF tooling/runtime sürüm farkı.
- Veritabanında manuel değişiklik yapılmış.

Çözüm:

1. Hata veren migration adını bulun.
2. Staging verisiyle tekrar deneyin.
3. Gerekirse migration'ı veri koruyacak şekilde düzeltin.
4. Production'da manuel rollback yapmadan önce backup alın.

## 16. Acil Durum Bilgi Toplama

Sorun raporunda şu bilgiler olmalıdır:

- Kullanıcı adı ve rolü
- Tenant
- Ekran URL'si
- Saat
- Yapılan işlem
- Beklenen sonuç
- Gerçek sonuç
- Browser console hatası
- API response status/body
- İlgili API log satırları

Bu bilgiler olmadan özellikle yetki, tenant ve bildirim sorunlarını teşhis etmek zorlaşır.
