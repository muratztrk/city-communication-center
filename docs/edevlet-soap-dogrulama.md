# CCC e-Devlet SOAP doğrulaması

Son kontrol: 6 Kasım 2026. Kapsam, Talep/Öneri Başvurusu ve Sorgulaması (#30) ile
Bilgilendirilme İsteği (#23). Mevcut `/service` katmanı kullanılır.

## Sözleşme ve otomatik doğrulama

Asıl kontrat `backend/docs/BelediyeStandartV3.wsdl` dosyasıdır. Bu dosya, kullanıcının
sağladığı `BelediyeStandartV3 (2).wsdl` ve edevlet-integration reposundaki kontratla
birebir aynıdır. Bu çalışma WSDL'i değiştirmedi ve yeni proxy eklemedi.

`BelediyeSoapContractTests`, gerçek middleware ve operasyonları izole EF InMemory veritabanıyla
çalıştırır; SOAP gövdesindeki yanıtı WSDL'den alınan değiştirilmemiş XSD ile doğrular.
Bu kontrol, SoapUI Validate'in şema kontrolünü yerelde otomatikleştirir. PostgreSQL,
reverse proxy, TÜRKSAT ekranları ve gerçek kullanıcı ayarlarının testini kapsamaz.

Doğrulanan senaryolar:

- Başvuru tipi, ayar, adres ve bilgilendirme kategorisi sorguları.
- Başvuru oluşturma, durum/detay, vatandaş notu ve reddedilmiş başvuruyu yeniden açma.
- Standart `telefonBilgisiType/telefonNo` girdisinin kaydedilmesi ve detayda geri dönmesi.
- Geçerli dosyanın içeriğiyle saklanması; boş/geçersiz Base64 dosyada kayıt oluşmadan `0002`.
- Bilgilendirme oluşturma, güncelleme, sorgulama, iptal ve iptal sonrası boş kayıt.
- Başka vatandaşın başvuru detayına/notlarına erişimin reddi.
- Hatalı kimlik bilgileri (`0001`), bulunamayan başvuru (`0003`) ve iş kuralı reddi (`0006`)
  yanıtlarının da standart şemaya uyması.

Komutlar:

```sh
dotnet test backend/tests/CityCommunicationCenter.Application.Tests/CityCommunicationCenter.Application.Tests.csproj --filter FullyQualifiedName~BelediyeSoap
dotnet test backend/tests/CityCommunicationCenter.Application.Tests/CityCommunicationCenter.Application.Tests.csproj
dotnet build backend/CityCommunicationCenter.sln
```

Bu kontrol sırasında 34 sözleşme testi eklendi; toplam 87 SOAP testi ve 412 backend testi geçti.
Backend derlemesi başarılı. Mevcut bağımlılıklarda NU1902/NU1903 uyarıları var; bu değişiklikte
paket sürümleri değiştirilmedi.

## Giderilen uyumsuzluklar

1. Başvuru telefonları eski CCC eleman adlarıyla okunuyor, standart istemcinin telefonları
   kayboluyordu. Standart girdi kabul edilir; eski CCC girdi adları da desteklenir. Yanıt yalnızca
   WSDL'deki `telefonBilgisiType/telefonTuru/ulkeKodu/telefonNo` yapısını kullanır. Mevcut başvuru
   veri modeli ülke kodunu ayrı saklamadığından bu yanıttaki `ulkeKodu` boş döner.
2. `ayarOkuListe` detayları `anahtar/deger` yerine WSDL'deki `group/key/value` alanlarıyla döner.
3. Hata yanıtlarında da ilgili yanıt tipinin zorunlu alanları bulunur. Veriler boş/default,
   nillable kayıtlar `xsi:nil` olur; istemci her zaman önce `sonucKodu` alanını değerlendirmelidir.
4. WSDL `basvuruNotListesi` içinde en az bir kayıt gerektirir. Henüz not yoksa gerçek başvuru
   tarihiyle "Başvurunuz alınmıştır" olayı gösterilir; veritabanına vatandaş notu eklenmez.
   Başarısız detay yanıtında bu zorunlu kayıt boş metin/default tarih taşır.
5. Geçersiz veya boş dosyalar sessizce atılıp başarılı başvuru oluşturulmaz.

## Test ortamında gözlenen durum

`https://testtim.tire.bel.tr/service` adresine, gerçek belediye veya kullanıcı bilgisi kullanmadan,
tanımsız belediye koduyla `sistemKontrol` ve `basvuruTipiSorgula` çağrıları yapıldı.
İkisi de HTTP 200, SOAP ve `0002 / BELEDIYE KODU BULUNAMADI` döndürdü.
Yanıt kökleri v3 namespace'inde, alt elemanlar namespace'siz: 26 Ekim namespace düzeltmesi
çalışan ortamda gözleniyor.

Ancak başvuru tipi hata yanıtında zorunlu `basvuruTipiListesi` yoktu. Buradaki yeni hata yanıtı
düzeltmesi çalışan ortamda henüz gözlenmedi. Bu çalışma push/deploy veya uzaktaki ayar/veri
değişikliği yapmadı. Gerçek kimlik bilgileriyle başarı akışı test edilmedi.

## Devreye alma öncesi kalanlar

1. Test ortamına bu sürümü alın ve CCC Ayarlar → e-Devlet alanlarını doğrulayın. CBS veya
   Innosa şifrelerini CCC şifresi varsaymayın.
2. SoapUI projesini standart WSDL'den oluşturun; endpoint'i `https://testtim.tire.bel.tr/service`
   yapın. İki hizmetin başarı ve hata yanıtlarını Validate edin. GET `/service?wsdl` sunulduğunu
   varsaymayın; mevcut middleware yalnızca SOAP POST isteklerini karşılar.
3. Başvuru oluşturma → CCC operatör ekranı → durum/detay → not → tekrar açma akışını gerçek
   test verisiyle kontrol edin. Tekrar açmanın Job üzerindeki mevcut davranışını operatörlerle teyit edin.
4. Bilgilendirme tercihlerinin oluşturma/güncelleme/iptal akışını deneyin. Bu hizmet mesaj göndermez;
   `belediyeIletisimBilgisiniGuncelle` tercihi de yalnızca kayıt amaçlıdır.
5. Test kayıtlarını belirleyip kontrollü temizleyin; sonrasında TÜRKSAT kabul sürecini yürütün.

Başkası adına işlem desteği, eski sıra kodlu adres kayıtlarının düzeltilmesi, IP kısıtı ve
bilgilendirme mesajlarının gönderilmesi bu çalışmada değiştirilmedi.
