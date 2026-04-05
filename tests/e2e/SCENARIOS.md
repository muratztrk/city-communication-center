# E2E Scenario Playbook

Bu belge aktif Playwright kapsamindaki temel business akislarini bir "yeniden kurulum kilavuzu" gibi tarif eder. Amaç sadece locator onarmak degil; UI, backend contract ve rol bazli davranis bozuldugunda hangi actor'un hangi adimda ne gormesi gerektigini net tutmaktir.

## Kapsam Ve Varsayimlar

- Testler aktif SPA olarak sadece `frontend/` uzerinden calisir; `frontend_old/` kapsam disidir.
- Varsayilan docker gelistirme portlari frontend icin `13000`, API icin `15000` kabul edilir.
- Seed tenant `Tire Belediyesi` aktif ve temel roller hazirdir.
- Kullanilan temel actor'lar:
	- `SystemAdmin`: `admin`
	- `Manager`: `zeynep.kara`
	- `Staff`: `emre.celik`
- Ortak parola `CCC_INITIAL_PASSWORD` ortam degiskeninden gelir.
- Task listeleri artik backend tarafindan scope bazli servis edilir: `mine`, `department-pool`, `pending-approval`, `all`.
- LDAP onboarding artik login sirasinda otomatik kullanici olusturma yapmaz; LDAP kullanicisi once admin tarafindan dizinden secilip uygulamaya baglanmalidir.

## Scenario 1: Auth Context, Navigation, And Session Durability

Amac:
- Token issuance, tenant resolution ve UI navigation ayni akista bozulmamis olmali.
- Tek-tenant auto resolution ile custom-domain resolution davranislari birlikte korunmali.
- Login, reload ve logout semantik olarak tutarli olmali.

Preconditions:
- Tek aktif tenant vardir.
- `admin / $CCC_INITIAL_PASSWORD` ile local login mumkundur.

Actors:
- `SystemAdmin`

Step Flow:
1. API uzerinden `/connect/token` endpoint'ine `grant_type=password`, `tenant_id`, username ve password ile istek at.
2. Gecerli bir `access_token` alindigini dogrula.
3. Ayni endpoint'e bu kez `tenant_id` olmadan istek at.
4. Tek-tenant kurulumda token endpoint'inin tenant'i otomatik cozup yine basarili cevap verdigini dogrula.
5. Login ekranini ac; tenant selector'in gizli oldugunu ve kurum baglaminin dogrudan yansidigini kontrol et.
6. Admin endpoint'i ile tenant'a custom domain kaydet.
7. `Host` header'i custom domain olacak sekilde tenant-context endpoint'ini yeniden cagir.
8. UI'nin tenant selector gostermeden dogrudan ilgili kurumu secmis oldugunu dogrula.
9. Browser uzerinden admin login yap.
10. Dashboard, Tasks, Social, Departments, Users ve Audit ekranlarini sirasiyla ac.
11. Sayfayi yenileyip session'in korundugunu kontrol et.
12. Logout yapip local storage auth verisinin temizlendigini dogrula.

Beklenen Sonuc:
- Token flow hem explicit tenant hem tek-tenant auto-resolution ile calisir.
- Login ekrani tenant baglamini dogru sekilde yansitir.
- Tum ana rotalar render olur.
- Reload session'i korur; logout tum kalici auth state'ini temizler.

## Scenario 2: Invalid Credentials Feedback

Amac:
- Hatali kimlik bilgileri UI'da sessizce yutulmamali.

Actors:
- `SystemAdmin` benzeri gecersiz giris denemesi

Step Flow:
1. Login ekraninda gecerli username ama hatali sifre ile giris dene.
2. Form submit sonrasi hata alani ve button state'ini izle.

Beklenen Sonuc:
- UI anlamli bir authentication hatasi gosterir.
- Kullanici yeni deneme yapabilmek icin formu yeniden kullanabilir.

## Scenario 3: Adaptive Auth Variants

Amac:
- Trusted network ve external network step-up kurallari frontend tarafinda dogru temsil edilmeli.

Preconditions:
- Tenant auth policy trusted network ve ikinci faktor kurallariyla seedlenmistir.

Actors:
- `SystemAdmin`

Step Flow:
1. Trusted header veya negotiate destekli ic ag senaryosunda login akisini tetikle.
2. UI'nin otomatik kurumsal sign-in baglamini gosterdigini dogrula.
3. Dis ag senaryosunda interactive auth flow baslat.
4. Mock ikinci faktor kodunu kullanarak akisi tamamla.
5. Direct password grant ile step-up bypass denemesi yap.

Beklenen Sonuc:
- Guvenilen ag akisi otomatik sign-in semantigini korur.
- Dis ag akisi ikinci faktor olmadan tamamlanmaz.
- Mock second-factor preview sadece izin verilen policy'de gorunur.

## Scenario 4: Explicit LDAP Onboarding And User Management

Amac:
- LDAP kullanicilarinin artik login sirasinda otomatik olusmadigi hem settings hem users yuzeyinde net olmali.
- Local user creation ve LDAP linking ayni sayfada dogru ayrismali.

Preconditions:
- Tenant LDAP ayarlari directory search'e izin veriyordur.
- En az bir baglanmamis LDAP dizin kaydi vardir.

Actors:
- `SystemAdmin`

Step Flow:
1. Users ekranini ac ve yeni kullanici formunu baslat.
2. `Local User` modunda benzersiz username ve parola ile yeni bir uygulama kullanicisi olustur.
3. Formu tekrar acip `LDAP Kullanicisi` moduna gec.
4. UI'daki helper metinlerin LDAP kullanicisinin login sirasinda otomatik olusmadigini, once dizinden secilip baglanmasi gerektigini acikladigini dogrula.
5. Dizin aramasinda bagli olmayan LDAP kaydini sec.
6. Departman ve rol atayip kaydi uygulama kullanicisi olarak olustur.
7. Users tablosunda hem local hem LDAP kaynak badge'lerini dogrula.

Beklenen Sonuc:
- Yerel kullanici akisi username/password ile tamamlanir.
- LDAP akisi explicit admin onboarding semantigini korur.
- Tablo `Yerel` ve `LDAP` kaynaklarini ayirt eder.

## Scenario 5: Dashboard And Admin Surfaces

Amac:
- Dashboard kartlari ile temel admin yuzeyleri ayni oturumda saglikli yuklenmeli.

Actors:
- `SystemAdmin`

Step Flow:
1. Admin login yap.
2. Dashboard kartlarinin sayisal verilerle render oldugunu dogrula.
3. Departments ekranina gec, seed veriyi gor ve yeni departman ekle.
4. Users ekranina gec, seed kullanicilarin rol/departman/kaynak bilgilerinin yuklendigini dogrula.

Beklenen Sonuc:
- Dashboard metrikleri gorunur.
- Yeni departman tabloya duser.
- Kullanici listesi rol, departman ve kaynak alanlarini korur.

## Scenario 6: Manual Task Approval Flow With Scope Switching

Amac:
- Scope bazli task yukleme geldikten sonra klasik approval akisi bozulmamis olmali.
- Manager onaydan sonra `pending-approval` listesinden cikmis task'i `all` scope'unda bulup atayabilmeli.

Preconditions:
- Hedef departmanin manager'i vardir.

Actors:
- `SystemAdmin`, `Manager`, `Staff`

Step Flow:
1. Admin `Tasks` ekraninda manuel task olusturur.
2. Task `Draft` olarak `all` veya uygun gorunumde belirir.
3. Admin task'i submit eder; status `PendingApproval` olur.
4. Manager `Onay Bekleyen` gorunumunu acar ve task'i onaylar.
5. Task bu scope'tan duser; manager `Tum Gorevler` gorunumune gecerek ayni kaydi yeniden bulur.
6. Manager departman/personel atamasi yapar.
7. Staff `Benim Gorevlerim` gorunumunde task'i gorur ve tamamlar.
8. Manager task'i `Completed` durumundan `Closed` durumuna alir.

Status Gecisleri:
- `Draft -> PendingApproval -> Assigned -> Completed -> Closed`

Beklenen Sonuc:
- Scope degisimi task'in dogru listeden kaybolup dogru listeye dusmesini saglar.
- Explicit manager assign davranisi korunur.
- Atanan personel satirda gorunur.

## Scenario 7: Department Pool Claim Flow

Amac:
- Yeni `department-pool` scope'u ve `claim` endpoint'i UI'da gercek bir is akisina baglanmis olmali.

Preconditions:
- Task onaylandiktan sonra departmana atanmis ama kullaniciya atanmis olmamalidir.

Actors:
- `SystemAdmin`, `Manager`, `Staff`

Step Flow:
1. Admin task olusturup submit eder.
2. Manager `Onay Bekleyen` gorunumunde task'i onaylar ancak personele explicit assign yapmaz.
3. Staff `Departman Havuzu` gorunumune gecer.
4. Staff kendi departmanina ait, kullaniciya baglanmamis task'i gorur.
5. Staff `Ustlen` aksiyonunu calistirir.
6. Task `Departman Havuzu` scope'undan kaybolur.
7. Staff `Benim Gorevlerim` gorunumune gecer ve ayni task'i artik kendi adina atanmis olarak gorur.

Status Gecisleri:
- `Draft -> PendingApproval -> Assigned`
- Claim sonrasi status degismez; owner degisir.

Beklenen Sonuc:
- Claim sadece departman havuzu mantigina uygun task'larda gorunur.
- Claim sonrasi assignee alaninda staff kullanicisi yer alir.
- UI task'i dogru scope'lara tasir.

## Scenario 8: Rejection Branch

Amac:
- Red akisi scope bazli listelerde dogru hareket etmeli.

Actors:
- `SystemAdmin`, `Manager`

Step Flow:
1. Approval gerektiren task olustur ve submit et.
2. Manager `Onay Bekleyen` scope'unda task'i reddetsin.
3. Task bu listeden ciksin.
4. Manager `Tum Gorevler` scope'una gecip ayni task'i kapatsin.

Status Gecisleri:
- `PendingApproval -> Rejected -> Closed`

Beklenen Sonuc:
- Rejected kayit pending-approval listesinden kalkar.
- Close aksiyonu yeni scope modelinde de kullanilabilir kalir.

## Scenario 9: Direct Assignment Without Manager

Amac:
- Manager'i olmayan departmanlar icin approval bypass davranisi korunmali.

Actors:
- `SystemAdmin`

Step Flow:
1. Manager'i olmayan yeni departman olustur.
2. Bu departmani hedefleyen task yarat.
3. Task'i submit et.

Status Gecisleri:
- `Draft -> Assigned`

Beklenen Sonuc:
- `PendingApproval` adimi gorulmez.
- Task dogrudan atanmaya hazir hale gelir.

## Scenario 10: Assignment Guardrails And Filtering

Amac:
- Atama formu backend validation ile uyumlu olmali.
- Kullanici autocomplete secilen departmana gore filtrelenmeli.

Actors:
- `SystemAdmin`, `Manager`

Step Flow:
1. Onaylanmis ve `Assigned` durumda, kullaniciya atanmamis bir task hazirla.
2. Manager `Tum Gorevler` gorunumunde task'i acsin.
3. Departman ve kullanici secimini temizleyip `Ata` aksiyonunu denesin.
4. Validation mesajini gor.
5. Gecerli departman ve kullanici secerek atamayi tamamla.
6. Ayrica farkli departmanlar secildiginde autocomplete listesinin sadece ilgili kullanicilari gosterdigini dogrula.

Beklenen Sonuc:
- Bos hedefle atama reddedilir.
- Departman degisikligi kullanici listesini yeniden filtreler.
- Uygun secimle atama basarili olur.

## Scenario 11: Social Message To Closed Task

Amac:
- Sosyal mesajdan goreve donusum ile klasik task workflow birbirine uyumlu calismali.

Actors:
- `SystemAdmin`, `Manager`, `Staff`

Preconditions:
- Webhook endpoint'ine test mesaji gonderebilen seed ortam mevcuttur.

Step Flow:
1. Test, benzersiz bir sosyal mesaj uretir.
2. Admin mesaji sadece hedef departmana yonlendirir; bu adimda kullanici secimi yapilmaz.
3. Admin mesaji goreve donusturur; task `Draft` olusur.
4. Admin `Tasks` ekraninda yeni task'i submit eder.
5. Manager `Onay Bekleyen` scope'unda task'i onaylar.
6. Manager `Tum Gorevler` scope'una gecerek explicit personel atamasi yapar.
7. Staff `Benim Gorevlerim` scope'unda task'i tamamlar.
8. Manager task'i kapatir.

Status Gecisleri:
- Social message: `New -> Routed -> ConvertedToTask`
- Task: `Draft -> PendingApproval -> Assigned -> Completed -> Closed`

Beklenen Sonuc:
- Social-to-task handoff dogrudur.
- Sosyal mesaj routing UI'si yalnizca backend'in gercekten sakladigi departman yonlendirmesini vadeder.
- Gorev basligi bos birakildiginda fallback title mantigi da calisir.

## Scenario 12: Settings Visibility And Explicit LDAP Semantics

Amac:
- Settings sadece yetkili role acik olmali.
- LDAP alanlari login-time auto provision vaadi tasimamalidir.

Actors:
- `SystemAdmin`, `Manager`

Step Flow:
1. SystemAdmin ile login yap ve `Ayarlar` ekranini ac.
2. LDAP bolumunun render oldugunu dogrula.
3. UI'nin LDAP onboarding'in sadece admin tarafindaki directory-search/user-link akisi ile yapildigini acikca belirttigini ve auto-provision kontrolu gostermedigini kontrol et.
4. Kimlik politikasi ve sosyal medya tablarina gec.
5. Manager ile yeniden login yap.
6. Manager'in settings navigation item'ini gormedigini dogrula.
7. Manager token'i ile admin endpoint'ine API istegi at.

Beklenen Sonuc:
- Settings yalnizca SystemAdmin'e aciktir.
- LDAP bolumunde eski auto-provision semantigi gorunmez.
- Manager UI ve API seviyesinde admin yuzeyine erisemez.

## Scenario 13: Routing Settings CRUD

Amac:
- Routing kurallari settings altinda olusturulup test edilip silinebilmelidir.

Actors:
- `SystemAdmin`

Step Flow:
1. Settings ekraninda `Otomatik Yonlendirme` tabina gec.
2. Benzersiz isimli bir kural olustur.
3. Test mesajiyla ilgili departmani eslestir.
4. Gerekirse kurali guncelle.
5. Kurali sil.

Beklenen Sonuc:
- CRUD aksiyonlari ve test endpoint'i birlikte calisir.
- URL query state tab secimini korur.

## Bakim Kurallari

- UI label, tab ismi veya button text degisirse once bu belgedeki actor/flow uyumunu kontrol et, sonra locator guncelle.
- Yeni bir task branch'i eklendiginde once bu belgeye status gecisleriyle birlikte senaryo ekle, sonra Playwright spec yaz.
- `department-pool`, `pending-approval`, `mine`, `all` gorunumlerinden herhangi birinin davranisi degisirse hem task spec'leri hem bu belge birlikte guncellenmelidir.