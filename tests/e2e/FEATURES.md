# Feature Inventory And Scenarios

## Auth

- Tenant listesi login ekraninda yuklenmeli.
- `admin@tire.bel.tr / $CCC_INITIAL_PASSWORD` ile password grant login calismali.
- `/connect/token` endpoint'i `grant_type=password` ve `tenant_id` ile access token donmeli.
- `/connect/token` endpoint'i `tenant_id` olmadan `invalid_request` donmeli.
- Basarisiz login denemesi anlamli hata gostermeli.
- Reload sonrasi session geri yuklenmeli ve logout local storage'i temizlemeli.
- Navigation smoke testi login sonrasi ana ekranlardan gecmeli.

## Dashboard

- Login sonrasi dashboard acilmali.
- Ozet kartlari API verisiyle render edilmeli.
- Dort istatistik karti sayisal degerlerle gorunmeli.

## Tasks

- Gorev listesi bos olsa bile tablo hata vermeden render edilmeli.
- Yeni gorev modal/aksiyonu acilabilmeli.
- Manuel task olusturma akisi desteklenen enum degerleriyle calismali.
- Approval isteyen task'lar submit sonrasi `PendingApproval` olmali.
- Manager'i olmayan hedef departman icin submit sonrasi task dogrudan `Assigned` olmali.
- `Assigned` task icin departman ve kullanici atama branch'i korunmali.
- Hem departman hem kullanici temizlenirse atama validasyonu calismali.
- Rejected task kapatilabilmeli.

## Social Messages

- Mesaj listesi bos durumda hata vermeden render edilmeli.
- Donusum, route, categorize akislari icin API shape uyumu korunmali.
- Yeni sosyal mesaj route edilip goreve donusturulebilmeli.

## Departments

- Departman listesi seed verisini gostermeli.
- Yeni departman aksiyonu acilabilmeli.
- Yeni departman olusturuldugunda tabloya hemen yansimali.

## Users

- Kullanici listesi departman ve rol alanlariyla yuklenmeli.
- Seed kullanicilar beklenen rol ve durum badge'leriyle gorunmeli.

## Audit

- Denetim tablosu bos durumda hata vermeden render edilmeli.

## Settings

- Yalnizca `SystemAdmin` rolu ayarlar menusu gorebilmeli.
- `Manager` ve tenant kullanicilari ayarlar menusunu gormemeli.
- `Manager` token'i platform admin endpoint'lerine erisememeli.
- Social settings ve routing bolumleri yuklenmeli.
- Test endpoint butonlari backend ile shape uyumlu cevap almali.
- Routing tabinda kural olusturma, test etme ve silme akislari calismali.

## End-To-End Workflow Summary

- `auth-navigation.spec.ts`: password grant token contract, admin login, temel navigasyon, negatif login kontrolu
- `admin-surfaces.spec.ts`: dashboard kartlari, departman olusturma, kullanici listesi ve seed veri gorunurlugu
- `settings.spec.ts`: SystemAdmin yetkisiyle ayarlar gorunurlugu ve manager icin gizlilik kontrolu
- `routing-settings.spec.ts`: ayarlar altinda otomatik yonlendirme kuralinin olusturulmasi, test edilmesi ve silinmesi
- `social-task-flow.spec.ts`: sosyal mesaj yonlendirme, goreve cevirme, mudur onayi, personel atama, tamamlama, kapatma
- `task-workflow.spec.ts`: manuel task approval flow, rejection branch, managersiz departman direct assignment, assignment validation guardrail