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

İlk kontrolde başvuru tipi hata yanıtında zorunlu `basvuruTipiListesi` yoktu. VPN bağlantısı
sağlandıktan sonra `0b8f29fe` commit'i test sunucusuna bundle/fast-forward ile alındı ve yalnızca
API yeniden derlenip başlatıldı. GitHub'a push, frontend veya production deploy yapılmadı.
API konteyneri healthy; `/health` veritabanını Reachable bildiriyor.

### HTTPS ve PostgreSQL üzerinde kabul kontrolü (6 Kasım 2026)

Tire Belediyesi kaydında belediye kodu eşlemesi ve e-Devlet ayarları başlangıçta boştu.
Kullanıcının açık isteğiyle belediye kodu `10868`, ilçe `Tire` ve bağımsız yeni CCC SOAP test
kimlik bilgileri kaydedildi. Diğer sosyal medya ayarları korundu. Şifre loglanmadı veya repoya
yazılmadı; kullanıcıya yalnız kendisinin okuyabildiği yerel erişim dosyasıyla teslim edildi.

Çalışan servise `https://testtim.tire.bel.tr/service` üzerinden toplam **23 SOAP çağrısı** yapıldı.
Her yanıt standart WSDL'in XSD'siyle doğrulandı; tamamı geçti:

- Tire'nin gerçek tenant ayarlarıyla altı okuma çağrısı: servis kontrol, başvuru tipi, SMS/e-posta
  kategorileri, ilçe ve Talep/Öneri ayarı. Hepsi `0000` döndü.
- Yazma testleri için operatör hesabı ve alıcısı olmayan ayrı, geçici bir tenant oluşturuldu.
  Aynı çalışan API ve PostgreSQL üzerinde başvuru oluşturma/detay/durum, not ekleme, başka
  vatandaşın detayına erişimin reddi, tekrar açma, ayar listesi, hatalı ve geçerli ek denendi.
- Reddedilmiş başvuru durumu yalnızca bu geçici kayıtta veritabanından hazırlanıp SOAP ile
  yeniden açıldı. Bu, operatör arayüzünün manuel testi değildir.
- Bilgilendirme oluşturma, aynı kayıt üzerinde güncelleme, sorgulama, iptal, boş kayıt ve
  ikinci iptalde `0003` kontrol edildi. PostgreSQL'de mükerrer kayıt oluşmadığı doğrulandı.
- Telefon ve notların kalıcılığı ile ekin saklanması doğrulandı. Hatalı ekle başvuru oluşmadı.
- Geçici tenant'ta SMS veya operatör bildirimi oluşmadığı doğrulandı. Geçici tenant, başvurular,
  tercihler, ekler ve disk dosyaları test sonunda silindi; tenant sayısı sıfır olarak kontrol edildi.
  Sunucuya aktarılan geçici kontrol programı ve erişim dosyası da kaldırıldı.

Tire tenant'ında dosya/not/tekrar açma özelliklerinin varsayılanları değiştirilmedi; bu özellikler
yaşam döngüsü testi sırasında yalnız geçici tenant'ta etkinleştirildi. Test ortamında yeni bir
migration gerekmedi. Ayrı makinede SoapUI arayüzü ve CCC operatör ekranı üzerinden manuel
kabul testi yapılmadı; XML doğrulaması otomatik XSD kontrolüyle gerçekleştirildi.

## Devreye alma öncesi kalanlar

1. CCC operatör ekranında başvuruyu iş akışına alma ve sonuçlandırma davranışını operatörlerle
   teyit edin. Tekrar açmanın Job üzerindeki mevcut davranışı ayrıca kabul edilmeli.
2. Dosya/not/tekrar açma özelliklerinin Tire için etkinleştirilip etkinleştirilmeyeceğini kararlaştırın.
3. TÜRKSAT kabul sürecini yürütün. İstenirse SoapUI projesini standart WSDL'den oluşturup aynı
   endpoint ile doğrulayın. GET `/service?wsdl` sunulduğunu varsaymayın; mevcut middleware
   yalnızca SOAP POST isteklerini karşılar.
4. Bilgilendirme hizmetinin mesaj göndermediğini ve `belediyeIletisimBilgisiniGuncelle` tercihinin
   yalnızca kayıt amaçlı olduğunu hizmet sahipleriyle netleştirin.

Başkası adına işlem desteği, eski sıra kodlu adres kayıtlarının düzeltilmesi, IP kısıtı ve
bilgilendirme mesajlarının gönderilmesi bu çalışmada değiştirilmedi.
