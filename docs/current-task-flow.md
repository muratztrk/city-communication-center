# Mevcut Gorev ve Sosyal Mesaj Akisi

Bu belge mevcut kod tabaninda calisan operasyonel akis icin referans niteligindedir. Amac, sosyal medyadan gelen bir mesajin belediye icinde yonlendirilmesi, goreve donusturulmesi, mudur onayindan gecmesi ve kullanicilar arasinda atanarak kapatilmasi surecini tek yerde toplamak.

## Roller

- Admin: ayarlar, sosyal mesajlar ve gorev ekranlari uzerinden akisi baslatabilir ve izleyebilir.
- DepartmentHead: kendi mudurlugu adina onay verebilir, gorevi personele atayabilir ve kapatabilir.
- Staff: uzerine atanan gorevi tamamlayabilir.

## Sosyal Mesaj Akisi

1. Demo veya entegrasyon kaynagi yeni bir sosyal mesaj olusturur.
2. Mesaj ilk durumda `New` olarak tutulur.
3. Admin veya operator mesaji bir departmana yonlendirir.
4. Yonlendirme sonrasi mesaj durumu `Routed` olur ve `AssignedDepartmentId` set edilir.
5. Mesaj goreve cevrildiginde yeni bir `WorkTask` uretilir.
6. Gorev sosyal mesajdan uretilirse `SourceType = SocialMessage` ve `SourceRefId = SocialMessageId` olarak yazilir.
7. Donusen sosyal mesaj `ConvertedToTask` durumuna gecerek ilgili task ile baglanir.

## Gorev Yasam Dongusu

1. Yeni gorevler `Draft` durumda baslar.
2. `Submit` islemi yapildiginda sistem hedef veya atanmis departmani bulur.
3. Departmanin `ManagerUserId` bilgisi varsa ilgili mudur icin `Approval` kaydi olusturulur.
4. Mudur ile gorevi gonderen kisi ayni degilse gorev `PendingApproval` durumuna gecer.
5. Ayrica uygun bir mudur bulunamazsa gorev dogrudan `Assigned` durumuna gecer.
6. Mudur `Approve` yaptiginda gorev `Assigned` olur.
7. Mudur `Reject` yaptiginda gorev `Rejected` olur.
8. `Assign` islemi ile gorev baska departmana veya dogrudan bir kullaniciya atanabilir.
9. Personel `Complete` yaptiginda gorev `Completed` olur.
10. Mudur veya yetkili kullanici `Close` yaptiginda gorev `Closed` olur.

## Veri Alanlari

- `TargetDepartmentId`: gorevin ilk hedefi.
- `AssignedDepartmentId`: su anda gorevin sorumlu departmani.
- `AssignedUserId`: su anda gorevin sorumlu kullanicisi.
- `Approvals`: onay zinciri.
- `AssignmentHistory`: departmanlar ve kullanicilar arasi devir kayitlari.

## Demo Senaryosu

Development seed acikken asagidaki ornek akis dogrulanabilir:

1. WhatsApp veya Instagram kaynagindan gelen demo mesaj secilir.
2. Mesaj Fen Isleri gibi bir mudurluge yonlendirilir.
3. Mesaj goreve cevrilir.
4. Gorev `Submit` edilerek mudur onayina gonderilir.
5. Mudur onay verir.
6. Mudur gorevi bir personele atar.
7. Personel gorevi tamamlar.
8. Mudur gorevi kapatir.

## Teknik Notlar

- Sosyal medya kanal ayarlari artik tenant bazli veritabani kaydinda saklanir.
- Hassas sosyal medya credential alanlari ASP.NET Core Data Protection ile sifrelenir.
- Kurulum verisi migration ile yuklenir; seeded yerel kullanicilarin sifre hash'i sadece `Authentication:InitialPassword` verildiginde bootstrap edilir.
- Data Protection key dosyalari konfigurable path altinda saklanir; Docker gelistirme ortaminda `/app/.keys` volume ile kalicidir.