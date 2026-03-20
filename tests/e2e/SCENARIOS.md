# E2E Scenario Playbook

Bu belge her E2E senaryosunun amacini, precondition'larini, step flow'unu ve beklenen sonucunu tanimlar. Amaç, FE degistiginde sadece selector tamiri degil, senaryo mantiginin de yeniden kurulabilmesidir.

## Scenario 1: Auth Navigation Smoke

Amaç:
- Admin login calismali.
- `/connect/token` password grant sozlesmesi bozulmamis olmali.
- `tenant_id` zorunlulugu korunmali.
- Ana navigasyon ekranlari render edilip temel route akisleri bozulmamis olmali.

Preconditions:
- Tenant listesi login ekraninda gorunur.
- Seed kullanicisi `admin@tire.bel.tr / $CCC_INITIAL_PASSWORD` aktiftir.

Step Flow:
1. `/connect/token` endpoint'ine `grant_type=password`, `tenant_id`, username ve password ile istek at.
2. Gecerli access token alindigini dogrula.
3. Ayni endpoint'e bu kez `tenant_id` olmadan istek at.
4. `invalid_request` hatasi alindigini dogrula.
5. Login ekranini ac.
6. Tire tenant'ini sec.
7. Admin ile login ol.
8. Sayfayi yenileyip session'in korundugunu dogrula.
9. Gorevler, Sosyal Medya, Departmanlar, Kullanicilar ve Denetim ekranlarina tek tek git.
10. Logout ol ve local storage auth anahtarlarinin temizlendigini dogrula.

Beklenen Sonuc:
- Token endpoint `access_token` doner.
- `tenant_id` olmayan istek `invalid_request` ile reddedilir.
- Her ekranda ilgili baslik gorunur.
- Navigasyon sirasinda hata mesaji olusmaz.
- Reload sonrasi oturum korunur, logout sonrasi kalici auth verisi kalmaz.

## Scenario 2: Invalid Login

Amaç:
- Kimlik dogrulama hatasi UI'da anlamli sekilde gosterilmeli.

Step Flow:
1. Gecersiz sifre ile login dene.

Beklenen Sonuc:
- UI kimlik dogrulama basarisiz mesajini gosterir.

## Scenario 3: Social Message To Closed Task

Amaç:
- Sosyal mesajin route edilmesi, goreve cevrilmesi ve cok kullanicili gorev yasam dongusu calismali.

Step Flow:
1. Test kendi sosyal mesajini webhook ile olusturur.
2. Admin mesaji Fen Isleri'ne yonlendirir.
3. Admin mesaji goreve cevirir.
4. Admin gorevi submit eder.
5. Mudur onay verir ve personele atar.
6. Personel gorevi tamamlar.
7. Mudur gorevi kapatir.

Beklenen Sonuc:
- Mesaj `ConvertedToTask` olur.
- Task sirasiyla `Draft -> PendingApproval -> Assigned -> Completed -> Closed` gorur.

## Scenario 4: Dashboard And Admin Surface Coverage

Amaç:
- Dashboard kartlari, departman olusturma ve kullanici listesi ayni oturumda bozulmadan calismali.

Step Flow:
1. Admin olarak giris yap.
2. Dashboard kartlarinin yuklendigini dogrula.
3. Departmanlar ekraninda seed veriyi gor.
4. Yeni bir departman olustur.
5. Kullanicilar ekraninda seed kullanicilarin departman ve rol bilgilerini dogrula.

Beklenen Sonuc:
- Dort dashboard karti gorunur.
- Yeni departman tabloya eklenir.
- Kullanici listesi seed roller ve aktiflik durumlariyla yuklenir.

## Scenario 5: Manual Task Approval Flow

Amaç:
- Manuel gorev olusturma ekranindan baslayan standart departmanli approval akisi korunmali.

Step Flow:
1. Admin UI uzerinden manuel gorev olusturur.
2. Hedef departman manager'li bir departman secilir.
3. Admin gorevi submit eder.
4. Mudur onay verir.
5. Mudur personele atar.
6. Personel tamamlar.
7. Mudur kapatir.

Beklenen Sonuc:
- UI butonlari durumlara gore dogru gorunur.
- Atanan personel gorev satirinda gorunur.

## Scenario 6: Rejection Branch

Amaç:
- Approval gereken bir gorev reddedildiginde `Rejected` durumuna gecmeli ve kapanabilmeli.

Step Flow:
1. Approval isteyen bir task olustur.
2. Submit et.
3. Mudur reddetsin.
4. Mudur kapatsin.

Beklenen Sonuc:
- `PendingApproval -> Rejected -> Closed` akisi calisir.

## Scenario 7: Direct Assign Without Manager

Amaç:
- Manager'i olmayan hedef departman icin submit sonrasi approval bypass edilmeli.

Step Flow:
1. Test manager'siz yeni bir departman olusturur.
2. Bu departmani hedefleyen task olusturur.
3. Submit eder.

Beklenen Sonuc:
- Task dogrudan `Assigned` olur.
- `PendingApproval` gorulmez.

## Scenario 8: Assignment Guardrail

Amaç:
- Atama ekraninda hem departman hem kullanici temizlenirse backend validasyonu tetiklenmeli.

Step Flow:
1. Onaylanmis ve `Assigned` durumunda bir task hazirla.
2. Departman ve kullanici secimlerini bosalt.
3. `Ata` aksiyonunu calistir.
4. Sonra gecerli departman ve kullanici secip tekrar ata.

Beklenen Sonuc:
- Ilk denemede validasyon mesaji gorunur: `En az bir atama hedefi gereklidir.`
- Ikinci denemede atama basarili olur.

## Scenario 9: Routing Settings CRUD

Amaç:
- Otomatik yonlendirme kurallari UI uzerinden yonetilebilmeli ve test endpoint'i beklenen departmani dondurmeli.

Step Flow:
1. Admin olarak ayarlar ekranini ac.
2. Otomatik yonlendirme sekmesine gec.
3. Fen Isleri'ni hedefleyen benzersiz bir kural olustur.
4. Test mesajiyla yonlendirme sonucunu dogrula.
5. Olusturulan kurali sil.

Beklenen Sonuc:
- Kural basarili sekilde kaydolur.
- Test sonucu Fen Isleri'ni dondurur.
- Kural silindikten sonra listeden kalkar.

## Scenario 10: Settings Visibility By Role

Amaç:
- Ayarlar yuzeyi yalnizca `SystemAdmin` icin gorunur olmali.

Step Flow:
1. `SystemAdmin` kullanicisi ile giris yap.
2. Ayarlar menusunun gorundugunu ve ekranin acildigini dogrula.
3. Oturumu kapat.
4. `Manager` kullanicisi ile tekrar giris yap.

Beklenen Sonuc:
- `SystemAdmin` oturumunda ayarlar menusu gorunur.
- `Manager` oturumunda ayarlar menusu hic render edilmez.
- `Manager` token'i ile `api/v1/admin/*` endpoint'leri 403 doner.

## Bakim Notlari

- UI label veya button text degisirse once bu senaryo tanimindaki adimlari kontrol et, sonra ilgili Playwright locator'larini guncelle.
- Selector duzeltirken business step sirasini bozma.
- Yeni task workflow branch'i eklenirse once bu belgeye scenario ekle, sonra spec yaz.