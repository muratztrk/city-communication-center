# Yetkilendirme Matrisi

Hazırlanma tarihi: 18 Haziran 2026

Bu doküman City Communication Center içindeki rollerin ekran ve işlem yetkilerini özetler.

## 1. Roller

| Rol | Açıklama |
| --- | --- |
| `SystemAdmin` | Sistem yöneticisi. Tenant ayarları, kullanıcılar, birimler ve tüm yönetim ekranlarından sorumludur. |
| `Manager` | Birim müdürü. Birimine gelen/giden talepleri ve personel görevlerini yönetir. |
| `Operator` | Vatandaş ve sosyal kanal mesajlarını takip eder, talep oluşturabilir. |
| `Staff` | Kendisine veya birimine atanan görevleri yürütür. |
| `Reporter` | Rapor ve izleme amaçlı kullanıcıdır. |
| `EDevletActivityPlan` | Yalnızca e-Devlet günlük faaliyet planı ekranlarına erişen kısıtlı rol. |
| `CitizenRequestManager` | Vatandaş Talep Yöneticisi. Birim müdürü olmadan, yalnızca vatandaş taleplerini Birime Gelen Talepler ekranında yönetir. Bkz. §1.1. |

### 1.1 Vatandaş Talep Yöneticisi (`CitizenRequestManager`)

Birim müdürü olmayan ama **vatandaş taleplerini** (Vatandaş Talebi / `VT-…`) yönetebilen kapsamlı (scoped) roldür. Birincil rol olarak veya ek rol olarak (`AdditionalRoleCodesJson`) atanabilir; her iki durumda da `UserRoleAccess.IsCitizenRequestManager` ile tanınır.

- **Varsayılan sayfa erişimi:** **Dashboard** + **Talep Oluştur** (`/requests/new`) + **Birime Gelen Talepler** (`/incoming-requests`). Diğer sayfalar varsayılan kapalıdır; tenant rol/sayfa matrisiyle genişletilebilir.
- **Kapsam — yalnızca vatandaş talepleri:** Tüm CRM yetkileri `JobCitizenRequestHelper.IsCitizenRequest(job)` ile sınırlıdır. Frontend'de `canCitizenRequestManagerActOnRow` yalnızca `isCitizenRequest` olan ve `VT-` ile başlayan satırlarda işleme izin verir; vatandaş-olmayan talep/satırlarda CRM hiçbir işlem yapamaz.
- **Birimdeki Görevler kapsamı:** CRM müdür sayılmaz; kendi çalışabildiği birimlerdeki vatandaş talebi görevlerini görür ve bu görevlerde yönlendirme/iptal/onay işlemleri yapabilir.
- **İşlemler:**
  - Standart kullanıcı gibi kendi birimi adına birim içi / birim dışı talep oluşturma.
  - Vatandaş talebi kapsamında birime gelen vatandaş taleplerini görüntüleme/yönetme.
  - Vatandaş talebi kapsamında hedef birim onayı/reddi — yalnızca çalışabildiği hedef birim kapsamında (`CanManageCitizenRequestInTargetDepartmentAsync`).
  - Vatandaş talebi kapsamında görev oluşturma (`CreateTaskCommand`, Staff dalından bağımsız).
  - Vatandaş talebi kapsamında iptal etme (`CancelJobCommand`).
- **Güvenlik:** Tüm kontroller backend'de `IsCitizenRequestManager` + citizen-request + birim erişimi ile doğrulanır; frontend kapsamı yalnızca UX içindir.

## 2. Sayfa Erişimleri

Varsayılan frontend matrisi settings hariç çoğu sayfayı açık kabul eder; tenant ayarlarıyla daraltılabilir. Dashboard her rol için açık kalır. Settings yalnızca `SystemAdmin` içindir.

| Sayfa | Path | SystemAdmin | Manager | Operator | Staff | Reporter |
| --- | --- | --- | --- | --- | --- | --- |
| Dashboard | `/dashboard` | Evet | Evet | Evet | Evet | Evet |
| Talep Oluştur | `/requests/new` | Evet | Evet | Evet | Evet | Evet |
| Rutin Görev Oluştur | `/routine-tasks/new` | Evet | Evet | Evet | Evet | Evet |
| Görevlerim | `/my-tasks` | Evet | Evet | Evet | Evet | Evet |
| Taleplerim | `/my-requests` | Evet | Evet | Evet | Evet | Evet |
| Vatandaş Talepleri | `/jobs` | Evet | Evet | Evet | Evet | Evet |
| Birime Gelen Talepler | `/incoming-requests` | Evet | Evet | Evet | Evet | Evet |
| Sosyal Mesajlar | `/social` | Evet | Evet | Evet | Evet | Evet |
| Wallboard | `/display` | Evet | Evet | Evet | Evet | Evet |
| Birimler | `/departments` | Evet | Evet | Evet | Evet | Evet |
| Kullanıcılar | `/users` | Evet | Evet | Evet | Evet | Evet |
| Ayarlar | `/settings` | Evet | Hayır | Hayır | Hayır | Hayır |
| Denetim Kayıtları | `/audit` | Evet | Evet | Evet | Evet | Evet |

Not: Bu tablo frontend varsayılanlarını gösterir. Gerçek tenant davranışı Ayarlar > Rol/Sayfa erişimi alanında daraltılabilir.

## 3. Yönetim Yetkileri

| İşlem | SystemAdmin | Manager | Operator | Staff | Reporter |
| --- | --- | --- | --- | --- | --- |
| Tenant ayarlarını güncelleme | Evet | Hayır | Hayır | Hayır | Hayır |
| Rol sayfa erişimlerini güncelleme | Evet | Hayır | Hayır | Hayır | Hayır |
| LDAP/SMS/Syslog ayarları | Evet | Hayır | Hayır | Hayır | Hayır |
| Sosyal kanal ayarları | Evet | Kısıtlı/tenant ayarına bağlı | Hayır | Hayır | Hayır |
| Kullanıcı oluşturma/güncelleme | Evet | Kısıtlı/organizasyon politikasına bağlı | Hayır | Hayır | Hayır |
| Birim oluşturma/güncelleme | Evet | Kısıtlı/organizasyon politikasına bağlı | Hayır | Hayır | Hayır |
| Audit log görüntüleme | Evet | Kısıtlı | Kısıtlı | Kısıtlı | Evet |

## 4. Talep Yetkileri

| İşlem | SystemAdmin | Manager | Operator | Staff | Reporter |
| --- | --- | --- | --- | --- | --- |
| Talep oluşturma | Evet | Evet | Evet | Evet | Hayır/Kısıtlı |
| Kendi taleplerini görüntüleme | Evet | Evet | Evet | Evet | Evet |
| Birime gelen talepleri görüntüleme | Evet | Evet | Birim kapsamı | Birim kapsamı | Rapor kapsamı |
| Birimden giden talepleri görüntüleme | Evet | Evet | Hayır/Kısıtlı | Hayır/Kısıtlı | Rapor kapsamı |
| Talep onaylama | Evet | Evet | Hayır | Hayır | Hayır |
| Talep reddetme | Evet | Evet | Hayır | Hayır | Hayır |
| Talep iptal etme | Evet | Evet | Kısıtlı | Hayır/Kısıtlı | Hayır |
| Koordine birim ekleme | Evet | Evet | Hayır/Kısıtlı | Hayır | Hayır |

## 5. Görev Yetkileri

| İşlem | SystemAdmin | Manager | Operator | Staff | Reporter |
| --- | --- | --- | --- | --- | --- |
| Görev listeleme | Evet | Evet | Kendi/birim kapsamı | Kendi/birim kapsamı | Rapor kapsamı |
| Görev oluşturma | Evet | Evet | Kısıtlı | Kısıtlı | Hayır |
| Rutin görev oluşturma | Evet | Evet | Kısıtlı | Kısıtlı | Hayır |
| Görev atama | Evet | Evet | Hayır | Hayır | Hayır |
| Departman havuzu görevini sahiplenme | Evet | Evet | Evet | Evet | Hayır |
| Görevi tamamlama | Evet | Evet | Evet | Evet | Hayır |
| Kapanış onayı | Evet | Evet | Hayır | Hayır | Hayır |
| Kapanış reddi | Evet | Evet | Hayır | Hayır | Hayır |
| Revizyon isteme | Evet | Evet | Hayır | Hayır | Hayır |

## 6. Sosyal Kanal Yetkileri

| İşlem | SystemAdmin | Manager | Operator | Staff | Reporter |
| --- | --- | --- | --- | --- | --- |
| Sosyal mesajları görüntüleme | Evet | Evet | Evet | Kısıtlı | Rapor kapsamı |
| Sosyal mesaj oluşturma | Evet | Evet | Evet | Hayır/Kısıtlı | Hayır |
| Sosyal mesajı kategorize etme | Evet | Evet | Evet | Hayır/Kısıtlı | Hayır |
| Sosyal mesajı yönlendirme | Evet | Evet | Evet | Hayır/Kısıtlı | Hayır |
| Sosyal mesajı talebe dönüştürme | Evet | Evet | Evet | Hayır/Kısıtlı | Hayır |
| Sosyal mesaja cevap verme | Evet | Evet | Evet | Hayır/Kısıtlı | Hayır |
| WhatsApp şablon yönetimi | Evet | Kısıtlı | Hayır | Hayır | Hayır |

## 7. Bildirim Yetkileri

Tüm authenticated kullanıcılar kendi bildirimlerini görebilir.

| İşlem | Yetki |
| --- | --- |
| Kendi bildirimlerini listeleme | Tüm roller |
| Kendi okunmamış sayısını görme | Tüm roller |
| Bildirimi okundu işaretleme | Tüm roller |
| Tüm bildirimleri okundu işaretleme | Tüm roller |
| Push aboneliği oluşturma/silme | Tüm roller |

## 8. Teknik Notlar

- Frontend erişim matrisi kullanıcı deneyimini sınırlar; asıl güvenlik API authorization kurallarıyla sağlanmalıdır.
- `settings` sayfası frontend tarafında her zaman yalnızca `SystemAdmin` için açıktır.
- `dashboard` sayfası her rol için zorunlu açık tutulur.
- Tenant ayarları frontend erişim matrisini değiştirebilir.
- Yeni sayfa eklenirse `PAGE_ACCESS_ITEMS` ve bu doküman birlikte güncellenmelidir.
