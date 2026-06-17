# Operasyon ve Admin Rehberi

Hazırlanma tarihi: 18 Haziran 2026

Bu doküman sistem yöneticilerinin City Communication Center uygulamasını operasyonel olarak nasıl yöneteceğini açıklar.

## 1. Admin Rolü

`SystemAdmin` rolü sistem ayarları, kullanıcılar, birimler, sosyal entegrasyonlar, rol erişimleri ve denetim kayıtları üzerinde yönetim yetkisine sahiptir.

Temel admin ekranları:

- Ayarlar
- Kullanıcılar
- Birimler
- Denetim kayıtları
- Sosyal mesajlar
- WhatsApp konuşmaları
- Dashboard ve raporlar

## 2. Tenant Ayarları

Tenant ayarları belediye bazlıdır. Başlıca ayar grupları:

- Kurum adı ve temel bilgiler
- Görünüm/tema
- Çalışma saatleri
- SLA hafta sonu davranışı
- LDAP ayarları
- Adaptive authentication policy
- SMS ayarları
- Dosya saklama ayarları
- Syslog ayarları
- Sosyal kanal ayarları
- Rol/sayfa erişimleri

Gizli alanlar veritabanında Data Protection ile korunur.

## 3. Kullanıcı Yönetimi

Kullanıcı ekranında yapılabilen işlemler:

- Kullanıcı listeleme
- Kullanıcı arama
- Manuel kullanıcı oluşturma
- Kullanıcı güncelleme
- Kullanıcı silme/pasifleştirme
- AD/LDAP dizininden kullanıcı arama
- AD/LDAP senkronizasyonu
- Yerel parola sıfırlama

Kullanıcı oluştururken dikkat edilecek alanlar:

- Kullanıcı adı
- Ad soyad/görünen ad
- E-posta
- Rol
- Birim
- Yönetici
- Kullanıcı kaynağı
- Aktiflik durumu

## 4. Rol Yönetimi

Sistem rolleri:

- `SystemAdmin`: Sistem yöneticisi.
- `Manager`: Birim müdürü/yöneticisi.
- `Operator`: Vatandaş/sosyal kanal operatörü.
- `Staff`: Personel.
- `Reporter`: Rapor kullanıcısı.

Rol sayfa erişimleri Ayarlar ekranından tenant bazlı düzenlenebilir. Dashboard her rol için açık kalır. Settings ekranı yalnızca `SystemAdmin` için kullanılabilir.

## 5. Birim Yönetimi

Birim ekranında:

- Birim oluşturulur.
- Birim adı ve tipi güncellenir.
- Birim müdürü atanır.
- Birim silinir veya pasifleştirilir.

Birim değişiklikleri talep ve görev yönlendirmelerini etkileyebilir. Aktif iş yükü olan birimlerde silme işlemi yapılmadan önce bağlı kayıtlar kontrol edilmelidir.

## 6. LDAP Yönetimi

LDAP ayarları tenant bazlıdır.

Yönetilecek bilgiler:

- LDAP server adresi
- Port ve güvenlik modu
- Base DN
- Bind kullanıcı bilgileri
- Kullanıcı arama filtresi
- Grup/rol eşleme yaklaşımı

Admin ekranında iki test yapılmalıdır:

- Bağlantı testi
- Kullanıcı credential testi

LDAP login yalnızca uygulamaya linklenmiş kullanıcılar için başarılı olur. Dizin içinde bulunan ama uygulamada olmayan kullanıcı önce oluşturulmalı veya eşleştirilmelidir.

## 7. Adaptive Authentication Yönetimi

Tenant authentication policy şunları yönetir:

- İç ağ otomatik giriş modu
- Trusted proxy/network ayarları
- Dış ağ ikinci faktör davranışı
- SMS veya alternatif ikinci faktör sağlayıcısı

Trusted header kullanılıyorsa reverse proxy güven zinciri doğru kurulmalıdır. Production ortamında untrusted forwarded header kabul edilmemelidir.

## 8. Sosyal Kanal Yönetimi

Ayarlar > Sosyal bölümünde kanal bazlı yapılandırma yapılır.

Kanallar:

- WhatsApp
- X
- Facebook
- Instagram
- e-Devlet
- Email

Her kanal için genel operasyon:

1. Gerekli provider credential'larını girin.
2. Kaydedin.
3. Test Et butonuyla bağlantıyı doğrulayın.
4. Webhook gerekiyorsa provider panelinde callback URL'yi tanımlayın.
5. İlk mesajı test edin.

## 9. WhatsApp Operasyonu

WhatsApp için gerekli bilgiler:

- Business Account ID
- Phone Number ID
- Access Token
- Meta App Secret
- Webhook Verify Token
- Meta callback URL

Callback URL ayarlar ekranında gösterilir. Aynı URL Meta Developers > WhatsApp > Configuration alanında kullanılmalıdır.

Meta tarafında webhook field aboneliği olarak en az `messages` seçilmelidir.

## 10. Yönlendirme Kuralları

Routing ekranı otomatik yönlendirme davranışını yönetir.

Yönetilebilenler:

- Otomatik yönlendirmeyi aç/kapat
- Kural oluşturma
- Kural güncelleme
- Kural silme
- Test yönlendirmesi

Kural değişikliklerinden sonra sosyal mesajdan talebe dönüşüm ve vatandaş talebi akışları test edilmelidir.

## 11. Bildirim Operasyonu

Bildirimlerle ilgili kontrol alanları:

- Kullanıcı bazlı okunmamış sayı
- Bildirim detay yönlendirmesi
- SignalR bağlantısı
- Web push abonelikleri

Sorun yaşanırsa:

- API `/api/v1/notifications/unread-count` endpoint'i kontrol edilir.
- Browser SignalR bağlantısı kontrol edilir.
- Kullanıcının tenant ve user ID claim'leri doğrulanır.

## 12. Denetim Kayıtları

Denetim kayıtları admin tarafından incelenebilir.

Kontrol edilecek bilgiler:

- İşlem zamanı
- İşlem yapan kullanıcı
- Tenant
- Entity tipi
- İşlem türü
- Önceki/sonraki değerler

Syslog ayarı aktifse audit kayıtları dış log sistemine de iletilebilir.

## 13. Günlük Operasyon Kontrol Listesi

- API health check sağlıklı mı?
- Dashboard veri getiriyor mu?
- Login akışı çalışıyor mu?
- WhatsApp webhook hata üretmiyor mu?
- Upload volume doluluk oranı normal mi?
- PostgreSQL disk kullanımı normal mi?
- API loglarında tekrarlayan 500 hatası var mı?
- Bildirim unread count davranışı doğru mu?
