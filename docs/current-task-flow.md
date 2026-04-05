# Lokal Runtime ve Mevcut Gorev Akisi

Bu belge yerel gelistirme runtime'ini, aktif startup yolunu ve uygulamadaki mevcut gorev/sosyal mesaj akislarini implementasyona sadik sekilde ozetler. Dokploy, VPN, domain rollout veya production dagitim analizi bu dilimin kapsami disindadir.

## 1. Aktif Lokal Runtime

Bu repoda aktif frontend uygulamasi `frontend/` dizinindedir. `frontend_old/` sadece eski bir kopyadir ve yerel startup/build akisinda kullanilmamalidir.

Varsayilan lokal servis topolojisi su sekildedir:

| Servis | Kaynak | Container Port | Host Port | Amac |
| --- | --- | --- | --- | --- |
| PostgreSQL | `postgres:18-alpine` | `5432` | `5432` | Tenant verisi, gorevler, kimlik, sosyal ayarlar |
| API | `backend/Dockerfile` | `80` | `15000` | .NET 10 Web API, OpenIddict token issuance, migration bootstrap |
| Frontend | `frontend/Dockerfile` | `80` | `13000` | Vite ile build edilen aktif SPA |

Ek notlar:

- Docker Compose API servisinde `Database__ApplyMigrationsOnStartup=true` oldugu icin lokal bring-up sirasinda migration uygulamasi beklenir.
- PostgreSQL yalnizca ayri `postgres` servisi olarak calisir; API veya frontend container'lari icinde ek bir PostgreSQL kurulumu yapilmaz.
- Frontend build asamasinda `VITE_API_ORIGIN` build arg'i alir; ayni origin kullaniliyorsa bos birakilabilir.
- Docker disi split runtime icin aktif Vite dev server portu `5173` olarak kabul edilir. API'nin default CORS listesi `5173` ve `13000` icin hizalanmistir.

## 2. Lokal Bring-Up Adimlari

Docker Compose ile calisan varsayilan lokal senaryo:

1. Repo kokunde `.env.example` dosyasini `.env` olarak kopyalayin veya mevcut `.env` degerlerini kontrol edin.
2. En az su degerlerin bos olmadigini dogrulayin: `CCC_DB_PASSWORD`, `CCC_INITIAL_PASSWORD`, `CCC_SIGNING_KEY`.
3. `docker compose up -d --build` komutunu calistirin.
4. Frontend'i `http://localhost:13000`, API'yi `http://localhost:15000`, PostgreSQL'i `localhost:5432` uzerinden kullanin.
5. API saglik kontrolu ve auth smoke testi icin `GET /health` ve `POST /connect/token` ana dogrulama yuzeyleridir.

Docker disi split runtime senaryosu:

1. `dotnet run --project backend/src/CityCommunicationCenter.Api`
2. `cd frontend`
3. `npm install`
4. `npm run dev`

Bu ikinci senaryoda aktif frontend yine `frontend/` altindadir; `frontend_old/` kullanilmamasi gerekir.

## 3. Kullanici Onboarding ve Giris Kaynaklari

### 3.1 Tenant ve login baglami

- Login UI once tenant baglamini cozmeye calisir.
- Tek-tenant veya custom-domain baglami varsa tenant selector gizlenebilir.
- Kanonik token issuance yuzeyi hala `/connect/token` endpoint'idir ve `password` grant modelini kullanir.

### 3.2 Seeded yerel kullanicilar

- Kurulum verisi migration ile gelir; tenant, departman ve demo kullanicilar ilk veritabanina buradan yazilir.
- Yerel kullanici sifre hash'leri migration icine hardcode edilmez.
- Yerel seeded kullanicilarin giris yapabilmesi icin `Authentication:InitialPassword` degerinin bootstrap edilmesi gerekir.
- Docker Compose tarafinda bu deger `CCC_INITIAL_PASSWORD` ile API'ye gecilir.
- Bu degisken verilmezse kullanicilar veritabaninda bulunabilir ama yerel sifreyle login tamamlanmaz.

### 3.3 Local-first, LDAP-second auth sirasi

Mevcut backend implementasyonu kullanici dogrulamasini su sira ile yapar:

1. Eger interactive auth akisi daha once bir exchange credential uretmisse once bu tek kullanimlik credential consume edilir.
2. Hedef tenant aktif degilse auth durur.
3. Ayni tenant altinda manuel (`UserSource = Manual`) bir lokal kullanici aranir.
4. Lokal kullanici varsa ve aktifse parola hash dogrulamasi once burada yapilir.
5. Lokal auth basarisiz olursa veya uygun lokal kullanici yoksa LDAP bagli kullanici/senaryosu devreye girer.
6. LDAP tarafinda mevcut bagli kullanici bulunursa LDAP bind dogrulanir ve profil alani sync edilir.
7. Bagli LDAP kullanicisi yoksa login tamamlanmaz; kullanici once admin tarafindaki directory search plus create/link akisi ile sisteme eklenmelidir.

### 3.4 LDAP onboarding ayrintisi

- LDAP onboarding login sirasinda degil, SystemAdmin kullanicisinin directory search ve `CreateUser` akisi ile yapilir.
- Admin dizinden kullaniciyi secer; backend username, display name, email ve external identity alanlarini dizinden alarak `UserSource = Ldap` kaydini olusturur.
- Departman, rol ve aktiflik durumu admin create formunda acik secilir; login akisi bunlari defaultlayarak yeni kullanici olusturmaz.
- LDAP kullanicilari uygulama veritabaninda departman, rol, aktiflik ve external identity alanlariyla tutulur; login sirasinda sadece bagli kayitlar sync edilir.

### 3.5 Adaptive auth notu

- Trusted network ve external step-up auth yuzeyleri mevcuttur, ancak token issuance son noktada yine ayni `/connect/token` modeline doner.
- Bu belge bu dilimde login kaynagi sirasi ve onboarding davranisini hedefler; adaptive auth deployment varyasyonlari burada derinlestirilmez.

## 4. Sosyal Mesajdan Goreve Giden Akis

### 4.1 Mesajin ilk durumu

- Demo veya entegrasyon kaynagi yeni bir sosyal mesaj olusturur.
- Mesaj ilk durumda `New` olarak tutulur.

### 4.2 Route islemi

- Route komutu backend tarafinda `AssignedDepartmentId` alanini doldurur.
- Route sonrasi mesaj durumu `Routed` olur.
- Aktif UI ve backend sozlesmesi bu dilimde yalnizca departman-seviyesi yonlendirmeyi destekler; kullanici bazli sosyal inbox sahipligi heniz modele dahil degildir.

### 4.3 Sosyal mesaji goreve cevirme

`ConvertSocialMessageToTask` implementasyonu su alanlari uretir:

- `TaskType = CitizenRequest`
- `SourceType = SocialMessage`
- `SourceRefId = SocialMessageId`
- `TargetDepartmentId = message.AssignedDepartmentId`
- `AssignedDepartmentId = message.AssignedDepartmentId`
- `AssignedUserId = null`
- `CurrentStatus = Draft`

Donusum basarili olunca:

- Mesaj `ConvertedToTask` durumuna gecer.
- Mesaj ile task arasinda `TaskId` baglantisi kurulur.
- Ayni sosyal mesaj ikinci kez goreve cevrilmez; onceki task varsa mevcut task ozetine donulur.

### 4.4 Department pool kavrami

Bu repoda "department pool" su anlama gelir:

- Gorevin sorumlulugu bir departmana verilmis durumdadir.
- `AssignedDepartmentId` doludur.
- `AssignedUserId` henuz bos olabilir.
- Aktif department-pool gorunumu icin task kapanmis veya reddedilmis olmamalidir; pratikte `Completed`, `Closed` ve `Rejected` disindaki task'ler listelenir.

Bu durum tipik olarak su iki yerde gorulur:

- Sosyal mesaj goreve cevrildiginde, routed departman task uzerine kopyalandigi anda
- Gorev bir departmana atanip henuz spesifik personele dagitilmadiginda

Bu nedenle sosyal donusum sonrasi olusan ilk gorev cogu zaman departman havuzundadir; bireysel sorumluluk daha sonra `AssignTask` ile netlesir.

Task listeleme API'si bu ayrimi dogrudan destekler:

- `GET /api/v1/tasks?scope=all`: tenant icindeki tum gorevler
- `GET /api/v1/tasks?scope=mine`: mevcut kullaniciya atanmis gorevler
- `GET /api/v1/tasks?scope=department-pool`: mevcut kullanicinin kendi departman havuzundaki aktif gorevler
- `GET /api/v1/tasks?scope=pending-approval`: SystemAdmin icin tenant genelindeki, manager icin kendi workflow departmanindaki bekleyen onay gorevleri

Department-pool claim islemi daha kati bir backend kuralina sahiptir: `POST /api/v1/tasks/{id}/claim` yalnizca `AssignedDepartmentId` dolu, `AssignedUserId` bos ve `CurrentStatus = Assigned` olan task'lerde kullanilir.

## 5. Manuel Gorev Yasam Dongusu

### 5.1 CreateTask giris durumlari

Manuel `CreateTask` akisi her zaman tek bir baslangic durumuna gitmez.

Varsayilan davranis:

- `CurrentStatus = Draft`
- `AssignedDepartmentId = null`
- `AssignedUserId = null`

Ek davranis:

- Eger gorevi acan kullanicinin kendi user kaydinda `ManagerUserId` doluysa task daha olusurken o yoneticiye auto-assignment alir.
- Bu durumda `AssignedDepartmentId = currentUser.DepartmentId`
- `AssignedUserId = currentUser.ManagerUserId`
- `CurrentStatus = PendingApproval`

Yani bugunku implementasyonda manuel create akisi hem `Draft`, hem de dogrudan `PendingApproval` giris durumu uretebilir.

### 5.2 SubmitTask davranisi

`SubmitTask` mevcut kodda beklenenden daha dar bir dallanma uygular:

1. Gorevin `TargetDepartmentId` degeri okunur.
2. Hedef departman varsa departman kaydi yuklenir.
3. Eger hedef departman var ve `ManagerUserId` bos ise gorev dogrudan `Assigned` olur ve `AssignedDepartmentId = TargetDepartmentId` atanir.
4. Bunun disindaki tum durumlarda gorev `PendingApproval` olur.

Bu "diger tum durumlar" su ornekleri de kapsar:

- Hedef departman var ve manager mevcut
- Hedef departman hic secilmemis
- Gorev daha once departman havuzunda olmasina ragmen submit sirasinda manager fallback gerektiriyorsa

Onemli nuans:

- `SubmitTask` su anda approval row olusturmaz.
- Approval kaydi yalnizca `ApproveTask` veya `RejectTask` aninda yazilir.

### 5.3 Approve ve Reject

- `ApproveTask` yalnizca `PendingApproval` durumundaki gorevde calisir.
- `RejectTask` yalnizca `PendingApproval` durumundaki gorevde calisir.
- Her iki islem icin de yetki `SystemAdmin` veya workflow departmaninin manager kullanicisinda olmalidir.

Sonuclar:

- Approve -> `Assigned`
- Reject -> `Rejected`
- Her iki durumda da `Approvals` tablosuna karar satiri eklenir.

### 5.4 Assign ve yeniden yonlendirme

`AssignTask` komutu su kurallari uygular:

- En az bir hedef gerekir: departman veya kullanici.
- Sadece kullanici secilirse backend kullanicinin departmanini otomatik bulur.
- Hem departman hem kullanici secilirse kullanicinin o departmana ait olmasi zorunludur.
- `Completed` veya `Closed` durumundaki gorev yeniden atanamaz.
- Atama basarili oldugunda durum her zaman `Assigned` olur.
- Her atama `AssignmentHistory` kaydi ve audit kaydi uretir.

Bu sayede departman havuzundan kisi bazli sahiplenmeye gecis veya departmanlar arasi yeniden yonlendirme ayni komutla yapilir.

### 5.5 Claim from department pool

`ClaimTaskFromPool` akisi su kurallari uygular:

- Gorev mevcut tenant icinde bulunmalidir.
- `AssignedDepartmentId` dolu olmalidir.
- `AssignedUserId` bos olmalidir.
- Gorev durumu `Assigned` olmalidir.
- Claim yapan aktif kullanicinin `DepartmentId` degeri `AssignedDepartmentId` ile ayni olmalidir.

Claim basarili olursa:

- `AssignedUserId` claim yapan kullanici olur.
- `AssignedDepartmentId` korunur.
- Durum `Assigned` olarak kalir.
- `AssignmentHistory` icine `ActionType = Claim` kaydi yazilir.
- Audit log icine `TaskClaimedFromPool` olayi dusulur.

### 5.6 Complete ve Close

- `CompleteTask`: `SystemAdmin`, atanmis kullanici veya workflow departmani manager'i tarafindan calistirilabilir.
- `CloseTask`: `SystemAdmin` veya workflow departmani manager'i tarafindan calistirilabilir.

Durum gecisleri:

- Complete -> `Completed`
- Close -> `Closed`

`CompleteTask` kapali veya zaten tamamlanmis gorevde tekrar calismaz. `CloseTask` da zaten kapatilmis bir gorevi ikinci kez kapatmaz.

## 6. Rol ve Yetki Ozet Tablosu

| Islem | SystemAdmin | Workflow Department Manager | Assigned User |
| --- | --- | --- | --- |
| Claim from department pool | Kendi departmaninda ise evet | Kendi departman havuzunda ise evet | Kendi departman havuzunda ise evet |
| Approve / Reject | Evet | Evet | Hayir |
| Assign / Re-route | Evet | Evet | Hayir |
| Complete | Evet | Evet | Evet |
| Close | Evet | Evet | Hayir |

Buradaki workflow departmani, `AssignedDepartmentId ?? TargetDepartmentId` mantigi ile hesaplanan aktif is departmanidir.

## 7. Demo Senaryosu

Yerel Docker Compose runtime uzerinde tipik smoke senaryosu su sekildedir:

1. `.env` icinde `CCC_INITIAL_PASSWORD` tanimlidir.
2. `docker compose up -d --build` calisir.
3. Kullanici `http://localhost:13000` uzerinden UI'yi acar.
4. `admin / CCC_INITIAL_PASSWORD` ile login olur.
5. Sosyal inbox'ta bir mesaji bir departmana route eder.
6. Mesaji goreve cevirir; task `Draft` ve department-pool durumunda olusur.
7. Gerekirse task `Submit` ile approval akisine sokulur.
8. Manager task'i onaylar.
9. Manager task'i personele atar veya ayni departmandaki personel gorevi havuzdan claim eder.
10. Personel task'i tamamlar.
11. Manager veya SystemAdmin task'i kapatir.

## 8. Mevcut Bosluklar ve Sonraki Slice'lar

Bu dilimden sonra acik ve mantikli sonraki teknik parcalar sunlardir:

1. Kullanici bazli sosyal inbox sahipligi istenecekse bu davranis mevcut departman-seviyesi route modelinden ayri ve acik bir backend/frontend sozlesmesiyle eklenmeli.
2. `SubmitTask` davranisi daha niyetli hale getirilebilir; bugunku implementasyon manager olmayan hedef departman disindaki tum durumlari `PendingApproval` altina topluyor.
3. Task query scope'lari sonraki frontend slice'ta ekran bazli veri cagrilarina baglanmali; istemci tarafinda role/department guess edilmemelidir.
4. Approval kaydinin `Submit` aninda acik bir bekleyen adim olarak yazilip yazilmayacagi netlestirilmeli; su anda kayit sadece karar aninda olusuyor.
5. LDAP davranisi icin sonraki slice'ta trusted identity eslesme kurallari, search readiness ve local-vs-LDAP onboarding UX kenar durumlari sertlestirilmeli.
6. Gorev ve auth degisiklikleri sonrasinda build/E2E komutlari ile tekrar dogrulama yapilmasi gerekir; bu belgede yalnizca runtime ve implementasyon analizi tutulur.