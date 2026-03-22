# E2E Tests

Bu klasor Docker uzerinden calisan frontend ve API icin Playwright smoke/regression senaryolari icerir.

## Varsayilan adresler

- Frontend: `http://localhost:13000`
- API: `http://localhost:15000`

## Kurulum

```bash
cd tests/e2e
npm install
npx playwright install
```

## Calistirma

```bash
npm test
```

Local docker-compose ile kaldirip ayni portlardan test etmek icin once repo kokundeki `.env.example` dosyasini `.env` olarak kopyalayin ve gerekli sir degerlerini guncelleyin:

```bash
copy ..\.env.example ..\.env
cd ..
docker compose up -d --build
set CCC_INITIAL_PASSWORD=<.env icindeki ayni deger>
cd tests\e2e
npm test
```

`.env.example` varsayilan olarak `CCC_INITIAL_PASSWORD=Password123!` ile gelir.

Playwright shell'i seeded yerel kullanicilarla username-first login oldugu ve yerel kullanici olusturma senaryosunda ayni varsayilan sifreyi kullandigi icin `CCC_INITIAL_PASSWORD` degeri compose tarafinda kullanilan degerle ayni olmalidir. Varsayilan seed kullanici adlari `admin`, `zeynep.kara` ve `emre.celik` olarak kabul edilir. Bu degisken tanimli degilse testler artik bos sifreyle devam etmek yerine fail-fast olur.

Alternatif base URL icin:

```bash
set CCC_BASE_URL=http://localhost:13000
npm test
```

API istekleri icin farkli adres kullanacaksaniz:

```bash
set CCC_API_BASE_URL=http://localhost:15000
set CCC_BASE_URL=http://localhost:13000
npm test
```

## Seed veri akisi

- `backend/src/CityCommunicationCenter.Infrastructure/Persistence/Migrations/20260319180806_AddPasswordHashAndInstallSeed.cs` tenant, demo kullanicilar ve ornek verileri migration ile yukler.
- `backend/src/CityCommunicationCenter.Api/Program.cs` sadece migration uygulama ve gizli parola hash bootstrap adimini calistirir.
- `CCC_INITIAL_PASSWORD` degeri `Authentication__InitialPassword` olarak verildiginde seeded yerel kullanicilarin hash'i ilk kurulumda tamamlanir.

## Kapsam

- `/connect/token` password grant ve `tenant_id` sozlesmesi
- Tek tenant kurulumunda `tenant_id` olmadan gelen token isteginde tenant auto-resolution
- Login ekraninda tek-kurum ve custom-domain senaryolarinda kurum baglaminin otomatik acilmasi ve selector'in gizlenmesi
- Auth tenant context endpoint'i ile custom domain eslestirmesi
- Guvenilen ic ag header'i ile otomatik login akisi
- Dis agdan gelen login icin kurumsal ikinci dogrulama notu ve mock step-up akisi
- Dis agda dogrudan password grant token alma denemesinin bloklanmasi
- Login akisi
- Basarisiz login dogrulamasi
- Session restore ve logout sonrasi local storage temizligi
- Dashboard ve ana navigasyon smoke testi
- Dashboard kartlari, departman olusturma ve kullanici listeleme yuzeyleri
- Username-first yerel kullanici olusturma ve LDAP dizin kullanicisini acik baglama akisi
- Tenant bazli LDAP ayar bolumu ve sosyal ayarlar sekme gecisleri
- Tenant bazli kimlik politikasi bolumu, trusted network CIDR alanlari ve ikinci dogrulama saglayicisi ayarlari
- `SystemAdmin` ayarlar ekraninin gorunurlugu ve `Manager` icin gizlilik kontrolu
- `Manager` token'inin platform admin endpoint'lerine erisememesi
- Ayarlar icinde secilen tabin URL query state ile reload sonrasi korunmasi
- Ayarlar icinde otomatik yonlendirme kurali olusturma, test etme ve silme akisi
- Ayarlar icinde otomatik yonlendirme kurali guncelleme regresyonu
- Sosyal mesajdan gorev olusturma ve cok kullanicili tamamlama akisi
- Sosyal mesaj goreve cevrilirken varsayilan baslik fallback'i
- Manuel task approval, rejection, direct-assignment ve assignment validation branch'leri
- Atama kullanici listesinin secilen departmana gore filtrelenmesi

## Bakim Kurali

- Frontend ekranlarinda rota, baslik, buton etiketi, form label'i veya ana akis degisirse ilgili Playwright senaryolari ayni is kapsaminda gozden gecirilmeli.
- Senaryo kapsami degisirse bu dosya ve `FEATURES.md` birlikte guncellenmeli.
- Senaryo detaylari ve yeniden olusturma amaci icin `SCENARIOS.md` kaynak belge olarak tutulur.
