# Feature Inventory And Scenarios

## Auth

- Login ekranı tenant bağlamını önce custom domain veya tek-tenant kurulum üzerinden çözmeye çalışmalı.
- Tek tenant kurulumlarında login ekranında tenant selector gösterilmemeli ve kurum adı doğrudan gösterilmelidir.
- Custom domain eşleşirse login ekranı doğrudan ilgili tenant bağlamında açılmalı ve diğer tenantlar listelenmemeli.
- Çok tenantlı ortak host senaryosunda kullanıcı tenant seçebilmelidir.
- `admin / $CCC_INITIAL_PASSWORD` ile password grant login calismali.
- `/connect/token` endpoint'i `grant_type=password` ve `tenant_id` ile access token donmeli.
- Tek tenant kurulumunda `/connect/token` endpoint'i `tenant_id` olmadan tenant'i otomatik cozebilmeli.
- Guvenilen ic agda `X-Authenticated-User` header'i ile otomatik kurumsal login tamamlanabilmeli.
- Dis ag isteginde password grant ikinci dogrulama tamamlanmadan token donmemeli.
- Dis ag login akisinda kurumsal dogrulama notu gosterilmeli ve mock ikinci dogrulama kodu ile login tamamlanabilmeli.
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
- Yerel kullanici olusturma akisi kullanici adi ve yerel sifre ile tamamlanabilmeli.
- LDAP arama modunda bagli olmayan dizin kullanicisi secilip uygulama kullanicisi olarak eklenebilmeli.
- Kullanici tablosu kullanici adi kolonu ve kaynak badge'i ile `Yerel` ve `LDAP` ayrimini gostermeli.

## Audit

- Denetim tablosu bos durumda hata vermeden render edilmeli.

## Settings

- Yalnizca `SystemAdmin` rolu ayarlar menusu gorebilmeli.
- `Manager` ve tenant kullanicilari ayarlar menusunu gormemeli.
- `Manager` token'i platform admin endpoint'lerine erisememeli.
- Tenant bazli LDAP ayar bolumu render olmali ve admin tarafinda gorulebilmeli.
- Tenant kimlik politikasi bolumu render olmali ve ic ag / dis ag davranis ayarlari gorulebilmeli.
- Social settings ve routing bolumleri yuklenmeli.
- Ayarlar tab secimi URL query string uzerinden korunmali.
- Test endpoint butonlari backend ile shape uyumlu cevap almali.
- Routing tabinda kural olusturma, test etme ve silme akislari calismali.

## End-To-End Workflow Summary

- Varsayilan local docker-compose portlari frontend `13000`, API `15000` olarak kabul edilir.
- `auth-navigation.spec.ts`: password grant token contract, single-tenant auto resolution, custom-domain tenant context, admin login, temel navigasyon, negatif login kontrolu
- `adaptive-auth.spec.ts`: trusted-header otomatik login, dis ag mock 2FA ve direct password grant blokaj testi
- `admin-surfaces.spec.ts`: dashboard kartlari, departman olusturma, kullanici listesi ve seed veri gorunurlugu
- `user-management.spec.ts`: yerel kullanici olusturma, LDAP dizin arama ve kaynak badge dogrulamasi
- `settings.spec.ts`: SystemAdmin yetkisiyle ayarlar gorunurlugu ve manager icin gizlilik kontrolu
- `routing-settings.spec.ts`: ayarlar altinda otomatik yonlendirme kuralinin olusturulmasi, test edilmesi ve silinmesi
- `social-task-flow.spec.ts`: sosyal mesaj yonlendirme, goreve cevirme, mudur onayi, personel atama, tamamlama, kapatma
- `task-workflow.spec.ts`: manuel task approval flow, rejection branch, managersiz departman direct assignment, assignment validation guardrail