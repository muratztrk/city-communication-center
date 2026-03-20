# E2E Tests

Bu klasor Docker uzerinden calisan frontend ve API icin Playwright smoke/regression senaryolari icerir.

## Varsayilan adresler

- Frontend: `http://localhost:3000`
- API: `http://localhost:5000`

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

Alternatif base URL icin:

```bash
set CCC_BASE_URL=http://localhost:3000
npm test
```

## Seed veri akisi

- `backend/src/CityCommunicationCenter.Infrastructure/Persistence/Migrations/20260319180806_AddPasswordHashAndInstallSeed.cs` tenant, demo kullanicilar ve ornek verileri migration ile yukler.
- `backend/src/CityCommunicationCenter.Api/Program.cs` sadece migration uygulama ve gizli parola hash bootstrap adimini calistirir.
- `CCC_INITIAL_PASSWORD` degeri `Authentication__InitialPassword` olarak verildiginde seeded yerel kullanicilarin hash'i ilk kurulumda tamamlanir.

## Kapsam

- `/connect/token` password grant ve `tenant_id` sozlesmesi
- `tenant_id` olmadan gelen token isteginin reddedilmesi
- Login akisi
- Basarisiz login dogrulamasi
- Session restore ve logout sonrasi local storage temizligi
- Dashboard ve ana navigasyon smoke testi
- Dashboard kartlari, departman olusturma ve kullanici listeleme yuzeyleri
- `SystemAdmin` ayarlar ekraninin gorunurlugu ve `Manager` icin gizlilik kontrolu
- `Manager` token'inin platform admin endpoint'lerine erisememesi
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