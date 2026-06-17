# API Entegrasyon Rehberi

Hazırlanma tarihi: 18 Haziran 2026

Bu doküman City Communication Center API'sine entegre olacak istemciler için temel auth, tenant, endpoint ve hata yönetimi bilgilerini içerir.

## 1. Base URL

Production ortamında base URL kurulumdan kurulumaya değişir.

Örnek:

```text
https://yenitim.tire.bel.tr
```

API path'leri genellikle şu prefix ile başlar:

```text
/api/v1
```

Token endpoint istisna olarak root seviyededir:

```text
/connect/token
```

## 2. Authentication

Canonical token endpoint:

```http
POST /connect/token
Content-Type: application/x-www-form-urlencoded
```

Desteklenen grant:

```text
password
```

Örnek request:

```http
grant_type=password
username=testmudur
password=********
tenant_id=b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e
```

Başarılı yanıtta access token döner. API çağrılarında:

```http
Authorization: Bearer <access_token>
```

## 3. Tenant Header

Tek tenant frontend deploy modelinde frontend login context çağrılarında `X-Tenant-Id` gönderebilir.

```http
X-Tenant-Id: b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e
```

Token alındıktan sonra tenant bilgisi access token claim'leri üzerinden taşınır.

## 4. Response Format Yaklaşımı

API çoğu endpoint'te JSON response döner. Validasyon ve hata durumlarında problem details formatına yakın standart hata yanıtları kullanılır.

Yaygın HTTP status kodları:

| Kod | Anlam |
| --- | --- |
| `200` | Başarılı |
| `201` | Kayıt oluşturuldu |
| `204` | İşlem başarılı, body yok |
| `400` | Validasyon veya iş kuralı hatası |
| `401` | Kimlik doğrulama gerekli |
| `403` | Yetki yok |
| `404` | Kayıt bulunamadı |
| `429` | Rate limit |
| `500` | Sunucu hatası |

## 5. Auth Endpointleri

| Method | Path | Amaç |
| --- | --- | --- |
| `POST` | `/connect/token` | Access token üretir |
| `POST` | `/api/v1/auth/login` | Legacy/login uyumluluk endpoint'i |
| `POST` | `/api/v1/auth/session/login` | Cookie session login |
| `POST` | `/api/v1/auth/session/logout` | Cookie session logout |
| `GET` | `/api/v1/auth/session/me` | Session kullanıcı bilgisi |
| `POST` | `/api/v1/auth/interactive/start` | Adaptive auth başlatır |
| `POST` | `/api/v1/auth/interactive/verify` | Adaptive auth doğrular |
| `GET` | `/api/v1/auth/tenant-context` | Tenant login context |
| `POST` | `/api/v1/auth/reset-local-password` | Yerel parola sıfırlama |
| `GET` | `/api/v1/auth/me` | Kullanıcı bilgisi |
| `GET` | `/api/v1/auth/tenants` | Tenant listesi |
| `POST` | `/api/v1/auth/bootstrap` | İlk kurulum/bootstrap |

## 6. Talep Endpointleri

| Method | Path | Amaç |
| --- | --- | --- |
| `GET` | `/api/v1/jobs` | Talep listeler |
| `GET` | `/api/v1/jobs/{jobId}` | Talep detayını getirir |
| `POST` | `/api/v1/jobs` | Talep oluşturur |
| `PUT` | `/api/v1/jobs/{jobId}` | Talep günceller |
| `DELETE` | `/api/v1/jobs/{jobId}` | Talep siler |
| `POST` | `/api/v1/jobs/{jobId}/cancel` | Talebi iptal eder |
| `POST` | `/api/v1/jobs/{jobId}/return` | Talebi geri gönderir |
| `POST` | `/api/v1/jobs/{jobId}/owner-approval/approve` | Sahip birim onayı verir |
| `POST` | `/api/v1/jobs/{jobId}/owner-approval/reject` | Sahip birim onayını reddeder |
| `POST` | `/api/v1/jobs/{jobId}/target-approval/{departmentId}/approve` | Hedef birim onayı verir |
| `POST` | `/api/v1/jobs/{jobId}/target-approval/{departmentId}/reject` | Hedef birim onayını reddeder |
| `POST` | `/api/v1/jobs/{jobId}/coordinating-departments` | Koordine birimleri ekler |
| `POST` | `/api/v1/jobs/{jobId}/manager-note` | Müdür notu ekler |
| `GET` | `/api/v1/jobs/{jobId}/audit-log` | Talep denetim geçmişi |

## 7. Görev Endpointleri

| Method | Path | Amaç |
| --- | --- | --- |
| `GET` | `/api/v1/tasks` | Görev listeler |
| `GET` | `/api/v1/tasks/{taskId}` | Görev detayı |
| `POST` | `/api/v1/tasks` | Görev oluşturur |
| `POST` | `/api/v1/tasks/routine` | Rutin görev oluşturur |
| `POST` | `/api/v1/tasks/{taskId}/assign` | Görev atar |
| `POST` | `/api/v1/tasks/{taskId}/claim` | Departman havuzu görevini sahiplenir |
| `POST` | `/api/v1/tasks/{taskId}/complete` | Görevi tamamlar |
| `POST` | `/api/v1/tasks/{taskId}/approve-close` | Kapanışı onaylar |
| `POST` | `/api/v1/tasks/{taskId}/reject-close` | Kapanışı reddeder |
| `POST` | `/api/v1/tasks/{taskId}/cancel` | Görevi iptal eder |
| `POST` | `/api/v1/tasks/{taskId}/request-revision` | Revizyon ister |
| `POST` | `/api/v1/tasks/{taskId}/approve-revision` | Revizyonu onaylar |
| `POST` | `/api/v1/tasks/{taskId}/reject-revision` | Revizyonu reddeder |
| `POST` | `/api/v1/tasks/{taskId}/progress` | İlerleme günceller |
| `GET` | `/api/v1/tasks/{taskId}/audit-log` | Görev denetim geçmişi |

## 8. Sosyal Mesaj Endpointleri

| Method | Path | Amaç |
| --- | --- | --- |
| `GET` | `/api/v1/social/messages` | Sosyal mesaj listeler |
| `POST` | `/api/v1/social/messages` | Sosyal mesaj oluşturur |
| `GET` | `/api/v1/social/messages/{messageId}` | Sosyal mesaj detayı |
| `POST` | `/api/v1/social/messages/{messageId}/categorize` | Mesaj kategorisi belirler |
| `POST` | `/api/v1/social/messages/{messageId}/route` | Mesajı birime yönlendirir |
| `POST` | `/api/v1/social/messages/{messageId}/convert` | Mesajı talebe dönüştürür |
| `POST` | `/api/v1/social/messages/{messageId}/convert-to-job` | Mesajı talebe dönüştürür |
| `DELETE` | `/api/v1/social/messages/{messageId}` | Mesaj siler |
| `GET` | `/api/v1/social/messages/{messageId}/conversation` | Konuşma geçmişi |
| `POST` | `/api/v1/social/messages/{messageId}/reply` | Mesaja cevap gönderir |
| `GET` | `/api/v1/social/messages/{messageId}/conversation/media/{entryId}` | Medya içeriği |

## 9. Webhook Endpointleri

| Method | Path | Amaç |
| --- | --- | --- |
| `POST` | `/api/v1/social/webhooks/{channel}` | Genel sosyal webhook |
| `GET` | `/api/v1/social/webhooks/whatsapp/{tenantId}` | WhatsApp webhook verify |
| `POST` | `/api/v1/social/webhooks/whatsapp/{tenantId}` | WhatsApp mesaj webhook |

## 10. Admin Endpointleri

| Method | Path | Amaç |
| --- | --- | --- |
| `GET` | `/api/v1/admin/tenants/{tenantId}/settings` | Tenant ayarları |
| `PUT` | `/api/v1/admin/tenants/{tenantId}/settings` | Tenant ayarlarını günceller |
| `PUT` | `/api/v1/admin/tenants/{tenantId}/role-page-access` | Rol sayfa erişimleri |
| `GET/PUT` | `/api/v1/admin/tenants/{tenantId}/appearance` | Görünüm ayarları |
| `GET/PUT` | `/api/v1/admin/tenants/{tenantId}/working-hours` | Çalışma saatleri |
| `GET/PUT` | `/api/v1/admin/tenants/{tenantId}/ldap-settings` | LDAP ayarları |
| `POST` | `/api/v1/admin/tenants/{tenantId}/ldap-settings/test-connectivity` | LDAP bağlantı testi |
| `POST` | `/api/v1/admin/tenants/{tenantId}/ldap-settings/test-user-credentials` | LDAP kullanıcı testi |
| `GET/PUT` | `/api/v1/admin/tenants/{tenantId}/authentication-policy` | Adaptive auth policy |
| `GET/PUT` | `/api/v1/admin/tenants/{tenantId}/sms-settings` | SMS ayarları |
| `GET/PUT` | `/api/v1/admin/tenants/{tenantId}/file-storage-settings` | Dosya ayarları |
| `GET/PUT` | `/api/v1/admin/tenants/{tenantId}/syslog-settings` | Syslog ayarları |
| `GET/PUT` | `/api/v1/admin/tenants/{tenantId}/sla-weekend-settings` | SLA hafta sonu ayarları |
| `POST` | `/api/v1/admin/workflows/publish` | Workflow publish |
| `GET` | `/api/v1/admin/audit-logs` | Denetim kayıtları |

## 11. Diğer Endpoint Grupları

| Grup | Örnek Path |
| --- | --- |
| Kullanıcılar | `/api/v1/users` |
| Birimler | `/api/v1/departments` |
| Benim profilim | `/api/v1/me` |
| Bildirimler | `/api/v1/notifications` |
| Raporlar | `/api/v1/reports/dashboard` |
| Ekler | `/api/v1/attachments/jobs/{jobId}` |
| Routing | `/api/v1/admin/routing` |
| WhatsApp şablonları | `/api/v1/whatsapp-templates` |
| Vatandaş konuşmaları | `/api/v1/citizen-conversations` |

## 12. Entegrasyon Tavsiyeleri

- Her request'te `Authorization` header gönderin.
- Tenant ID'yi token öncesinde doğru belirleyin.
- Idempotent olmayan `POST` çağrılarını client tarafında tekrar denerken dikkatli olun.
- Webhook endpoint'lerinde provider imza/secret doğrulaması production'da açık olmalıdır.
- `429` yanıtı alındığında exponential backoff uygulayın.
- `400` validasyon hatalarını kullanıcıya anlamlı şekilde gösterin.
