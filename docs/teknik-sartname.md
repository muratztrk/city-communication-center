# T.C. Tire Belediyesi Başkanlığı

## Vatandaş Talep ve İletişim Yönetim Sistemi Teknik Şartnamesi

**Hazırlayan:** T.C. Tire Belediyesi Bilgi İşlem Müdürlüğü
**Doküman türü:** Teknik Şartname
**Hazırlanma tarihi:** 21.08.2026
**Versiyon:** 2.0

---

## 1. Amaç ve Kapsam

### 1.1 AMAÇ

Bu şartnamenin amacı, Tire Belediyesine sosyal medya, WhatsApp, SMS, e-Devlet ve web formu gibi çoklu kanallardan ulaşan vatandaş taleplerinin tek bir sistem üzerinden karşılanması, sınıflandırılması, ilgili birime yönlendirilmesi, yanıtlanması ve sonuçlandırılmasına ilişkin yazılım sisteminin (bundan sonra "Sistem" olarak anılacaktır) taşıması gereken asgari teknik ve fonksiyonel özellikleri tanımlamaktır.

### 1.2 KAPSAM

Bu şartname yalnızca **vatandaş talebi yönetimi** kapsamındaki işlevleri, ekranları ve süreçleri kapsar. Belediyenin kendi birimleri arasındaki iç iş/görev takip süreçleri (birim içi/dışı görev atama, personel görev yönetimi vb.) bu şartnamenin konusu değildir ve ayrı bir teknik şartnameye tabidir; Sistem bu iki alanı teknik olarak aynı alt yapı üzerinde barındırabilir, ancak bu doküman yalnızca vatandaşla ilgili bileşenleri değerlendirir.

Bu şartname aşağıdaki bileşenleri kapsar:

- Vatandaş talebinin toplanması, sınıflandırılması, yanıtlanması ve sonuçlandırılmasına ilişkin tüm ekran ve işlevler
- Operatör ve ilgili diğer rollerin bu süreçteki yetki ve sorumlulukları
- Talep onay süreçleri ve vatandaşa giden mesajların onay/serbest bırakma mekanizması
- Sosyal medya, WhatsApp Business, SMS, e-Devlet entegrasyonları
- Vatandaş verisinin güvenliği ve KVKK uyumu
- Kurulum, test, kabul, eğitim ve bakım-destek süreçleri

---

## 2. Tanımlar ve Kısaltmalar

| Terim | Açıklama |
| --- | --- |
| **İdare** | Tire Belediye Başkanlığı |
| **İstekli / Yüklenici** | Sistemi kuracak/işletecek taraf |
| **Vatandaş Talebi** | Vatandaşın herhangi bir kanaldan ilettiği istek, şikâyet veya bildirim |
| **Operatör** | Vatandaş kanallarını izleyen, gelen kayıtları talebe dönüştüren ve vatandaşa yanıt veren kullanıcı rolü |
| **Hedef Birim** | Vatandaş talebinin çözümü için yönlendirildiği belediye birimi/müdürlüğü |
| **SLA** | Service Level Agreement — talebin karşılanması için hedeflenen azami süre |
| **KVKK** | 6698 sayılı Kişisel Verilerin Korunması Kanunu |
| **Sosyal Kanal** | Facebook, Instagram, X, WhatsApp, e-posta, web formu, telefon gibi vatandaşın talebini ilettiği mecra |
| **Başkanlık Seviyesi Birim** | Adı "Başkanlık" olan veya birim türü "Daire Başkanlığı" olarak işaretli birim. Bu, **ayrı bir kullanıcı rolü değil**, bir **birim sınıflandırmasıdır**; söz konusu birimlere doğrudan vatandaş talebi yönlendirilmesi Sistem tarafından engellenir (bkz. Bölüm 4.1, 5.12) |
| **Standart Kullanıcı** | Operatör, Hedef Birim Yöneticisi, Vatandaş Talep Yöneticisi ve Sistem Yöneticisi rollerinin ortak adı. Bu da **ayrı bir kullanıcı rolü (RoleCode) değildir**; Sistemdeki işlem yapabilen (talep/görev üzerinde onay, atama, mesaj gönderme yetkisi olan) rolleri, yalnızca izleme amaçlı **Üst Düzey Kullanıcı**'dan (bkz. Bölüm 4.5) ayırt etmek için kullanılan bir **gruplama terimidir**; arayüzün (özellikle Anasayfa görünümü) hangi rol grubuna göre şekilleneceğini belirler (bkz. Bölüm 4, 5.1) |

---

## 3. Mevcut Durum ve İhtiyaç

İdare, vatandaşlardan gelen talep ve şikâyetleri hâlihazırda birden fazla kanaldan (sosyal medya hesapları, WhatsApp hattı, telefon, e-posta, web formu) ayrı ayrı almaktadır. Bu dağınıklığın giderilmesi; taleplerin tek bir sistemde toplanması, ilgili birime hızlı ve izlenebilir biçimde yönlendirilmesi, vatandaşa verilen yanıtların kurumsal dil ve doğruluk açısından denetimden geçmesi ve tüm sürecin ölçülebilir (SLA, denetim izi) olması bu işin temel gerekçesidir.

İstekli tarafından sağlanacak Sistem, aşağıdaki temel işleyişi desteklemelidir:

> Vatandaş talebi (hangi kanaldan gelirse gelsin) → **Operatör** tarafından incelenir → talebe dönüştürülür → ilgili **hedef birime** yönlendirilir → hedef birim yöneticisi tarafından değerlendirilir/onaylanır → sonuçlanır → vatandaşa kurumsal dille, onaylı bir kapanış mesajı iletilir.

---

## 4. Kullanıcı Rolleri ve Yetkileri

Sistem, rol tabanlı bir yetkilendirme modeli üzerine kurulmalıdır. Vatandaş talebi süreciyle doğrudan ilişkili roller aşağıda tanımlanmıştır.

**Terminoloji notu:** Bu şartnamede ve Sistem arayüzünde kullanıcılar iki genel kategoriye ayrılır: **Standart Kullanıcı** ve **Üst Düzey Kullanıcı** (bkz. Bölüm 2 — Tanımlar). Her iki terim de **ayrı bir kullanıcı rolü (RoleCode) değildir**; ikisi de birden fazla gerçek rolü kapsayan/ayırt eden **gruplama terimleridir**:
- **Standart Kullanıcı** = Operatör (4.1), Hedef Birim Yöneticisi (4.2), Vatandaş Talep Yöneticisi (4.3) ve Sistem Yöneticisi (4.4) rollerinin ortak adı — talep/görev üzerinde işlem yapabilen tüm roller.
- **Üst Düzey Kullanıcı** = yalnızca izleme/raporlama amaçlı, işlem yetkisi bulunmayan rol (4.5).

Bu ayrım ayrı bir veri alanıyla değil, doğrudan kullanıcının gerçek rolüyle (RoleCode) belirlenir; Sistem, arayüzü (Anasayfa görünümü, kart/görev listelerindeki vurgulamalar) bu iki kategoriye göre farklılaştırmalıdır.

### 4.1 OPERATÖR

Operatör, vatandaş talebi sürecinin merkezinde yer alan roldür. Sistem, Operatör rolüne asgari aşağıdaki yetkileri tanımalıdır:

- **Vatandaş Talepleri** ekranını (sosyal kanallardan gelen kayıtların listesi) görüntüleme ve yönetme
- **WhatsApp Konuşmalar** ekranını görüntüleme ve vatandaşa yazılan mesajları **fiilen gönderme** yetkisi yalnızca Operatör (ve Sistem Yöneticisi) rolüne tanınmalıdır. Diğer roller mesaj yazabilir olsa dahi, bu mesajlar vatandaşa doğrudan ulaşmamalı; Operatör onayı gerektiren bir "beklemede" kuyruğuna düşmelidir (ayrıntılı işleyiş için bkz. Bölüm 5.6)
- Mevcut bir vatandaş mesajından tek tıkla **talep oluşturma** (mesajı talebe dönüştürme)
- Manuel vatandaş talebi girişi yapma (telefonla gelen başvuru gibi kanalı otomatik izlenemeyen durumlar için)
- **Onay kuralları:**
  - Operatörün oluşturduğu bir **vatandaş talebinde**, talebin sahiplendiği birimden (halkla ilişkiler/çağrı merkezi birimi) ayrıca onay **istenmez**; talep oluşturulduğu anda doğrudan işleme alınır ve SLA süresi hemen işlemeye başlar. Bu istisnanın amacı, vatandaşa yanıt süresini mümkün olduğunca kısaltmaktır.
  - Buna karşılık, Operatör talebi bir **hedef birime yönlendirdiğinde**, o hedef birimin yöneticisinin onayı yine aranır (bkz. Bölüm 6.2).
  - Operatör, vatandaş talebini **Başkanlık** veya **Daire Başkanlığı** seviyesindeki üst birimlere doğrudan yönlendiremez; Sistem bu yönlendirmeyi teknik olarak engellemelidir. Bu tür taleplerin daha alt/uygulayıcı birimlere yönlendirilmesi zorunlu kılınmalıdır.
  - Operatör, kurum içi (birim içi/birim dışı) talep oluşturabilir; ancak bu tür taleplerde — tıpkı Personel rolünde olduğu gibi — ilgili birim yöneticisinin onayı aranır ve onay tamamlanana kadar talebe son tarih atanmaz, listede **"Onay Bekleyen"** olarak görünür. (Bu şartname yalnızca vatandaş talebi sürecini kapsadığından, kurum içi talep akışının ayrıntıları bu dokümanın konusu değildir.)

### 4.2 HEDEF BİRİM YÖNETİCİSİ

- Kendi birimine yönlendirilen vatandaş taleplerini onaylama veya reddetme yetkisine sahiptir.
- Onayladığı talebi kendi biriminde bir personele atayabilir veya birim havuzunda bırakabilir.
- Sonuçlanan vatandaş taleplerinde, vatandaşa gidecek kapanış mesajının notunu hazırlayıp **serbest bırakma** işlemini yapabilir (bkz. Bölüm 6.3); ancak mesajı fiilen gönderme yetkisi bu role tanınmaz.

### 4.3 VATANDAŞ TALEP YÖNETİCİSİ (ÖZEL YETKİLİ ROL)

- Belirli hedef birimlerde, birim yöneticisi yerine veya onunla birlikte vatandaş taleplerini onaylama/reddetme yetkisiyle donatılabilecek, yalnızca vatandaş talebi süreciyle sınırlı özel bir roldür.
- Bu rolün yetkileri, birim yöneticisinin genel (kurum içi dahil tüm) yetkilerinden ayrı ve dar kapsamlı tutulmalıdır.

### 4.4 SİSTEM YÖNETİCİSİ

- Tüm vatandaş talebi ekranlarına ve yönetim ayarlarına (sosyal medya entegrasyon anahtarları, yönlendirme kuralları, taslak mesajlar, rol-sayfa yetkileri, lisans) erişebilmelidir.
- Rollerin hangi sayfa ve işlemlere erişebileceğini **Rol Sayfa Yetkileri** ekranından satır bazında özelleştirebilmelidir.

### 4.5 ÜST DÜZEY KULLANICI

Üst Düzey Kullanıcı, belediye üst yönetimine (başkan yardımcıları, danışmanlar, üst düzey raportörler) yönelik, **yalnızca izleme ve raporlama** amaçlı bir roldür; talep/görev üzerinde onay, atama veya düzenleme gibi işlem yetkisi bulunmaz. Sistem bu role asgari şu davranışları sağlamalıdır:

- Anasayfa'da diğer (standart) kullanıcılardan farklı, KPI kutucukları yerine **grafik ağırlıklı** bir görünüm sunulmalıdır (bkz. Bölüm 5.1).
- Vatandaş Talep Haritası ve grafik detay/kırılım (drilldown) ekranlarına erişebilmelidir (bkz. Bölüm 5.5).
- Üst Düzey Kullanıcı tarafından oluşturulan bir talepten doğan görevler, personel/birim yöneticisi görev listelerinde **görsel olarak ayırt edici biçimde** (dikkat çekici renk) işaretlenmelidir; bu görevlerin iptal edilmesi standart kullanıcılara göre daha kısıtlı kurallara tabi tutulmalıdır.
- Üst Düzey Kullanıcının talep oluşturabilmesi ve kendi taleplerini takip edebilmesi dışında, sistem üzerinde işlem yapma (onaylama, atama, mesaj gönderme) yetkisi bulunmamalıdır.

**Başkanlık seviyesi birime bağlı Üst Düzey Kullanıcı — dar kapsamlı istisna:** Başkanlık Seviyesi Birime (bkz. Bölüm 2) bağlı bir Üst Düzey Kullanıcı, **yalnızca kendi oluşturduğu talepler** üzerinde, standart Üst Düzey Kullanıcıya göre biraz daha esnek işlem yapabilmelidir — örneğin onaylanmış bir talebe sonradan ek/dosya ekleyebilme. Bu istisna **ayrı bir rol değildir**; aynı Üst Düzey Kullanıcı rolünün, kullanıcının bağlı olduğu birime göre daralan bir uzantısıdır ve Sistem geneline ek erişim, başka birimlerin taleplerini onaylama yetkisi veya ilave denetim/rapor görünürlüğü **kazandırmamalıdır**.

### 4.6 STANDART KULLANICI (ÖZET)

**Standart Kullanıcı**, Bölüm 2'de tanımlandığı gibi ayrı bir rol değil, talep/görev üzerinde **işlem yapabilen** dört rolün ortak adıdır. Her birinin tam tanımı kendi bölümünde yer alır; kısa özetleri aşağıdadır:

| Rol | Bölüm | Bir cümlede özet |
| --- | --- | --- |
| Operatör | 4.1 | Vatandaş kanallarını izler, gelen kayıtları talebe dönüştürür, vatandaşa yanıt gönderir/onaylar |
| Hedef Birim Yöneticisi | 4.2 | Kendi birimine yönlendirilen talepleri onaylar/reddeder, personele atar, kapanış notunu serbest bırakır |
| Vatandaş Talep Yöneticisi | 4.3 | Belirli hedef birimlerde, birim yöneticisi yerine veya onunla birlikte vatandaş talebi onay/red yetkisine sahip, dar kapsamlı özel rol |
| Sistem Yöneticisi | 4.4 | Tüm ekran ve ayarlara erişir; rol-sayfa yetkilerini ve lisansı yönetir |

Standart Kullanıcı kategorisindeki tüm roller, Üst Düzey Kullanıcı'nın (4.5) aksine, Anasayfa'da **KPI kutucuklu** (grafik ağırlıklı değil) bir görünümle karşılanmalıdır (bkz. Bölüm 5.1).

---

## 5. Ekran ve Fonksiyon Gereksinimleri

Bu bölüm, Sistemin sol menüsünde vatandaş talebi süreciyle ilgili yer alması gereken tüm başlıkları ve her birinin asgari işlevlerini tanımlar.

### 5.1 ANASAYFA (DASHBOARD) — VATANDAŞ GÖRÜNÜMÜ

Kullanıcı giriş yaptığında, rolüne uygun bir özet/gösterge paneli (dashboard) ekranıyla karşılanmalıdır. Sistem, **Standart Kullanıcı** (Operatör, Hedef Birim Yöneticisi, Vatandaş Talep Yöneticisi, Sistem Yöneticisi) ile **Üst Düzey Kullanıcı** (Bölüm 4.5) için birbirinden görsel olarak farklılaşan iki ayrı dashboard görünümü sunmalıdır:

**Standart Kullanıcı görünümü** asgari şu bilgi kutucuklarını (KPI kartı) içermelidir:
- Bekleyen/açık vatandaş talebi sayısı
- Bekleyen onay sayısı
- Aktif sosyal mesaj sayısı
- Reddedilen/iptal edilen talep sayısı
- İlgili karta tıklanarak doğrudan ilgili liste ekranına geçilebilmesi

**Üst Düzey Kullanıcı görünümü**, kutucuklar yerine **grafik ağırlıklı** bir sunum kullanmalı ve asgari aşağıdaki kırılımları pasta grafik (pie chart) biçiminde göstermelidir:
- Vatandaş talebi kanal dağılımı (Facebook, Instagram, X, WhatsApp, e-posta, web formu, telefon)
- Mahalle bazlı talep/iş yükü kırılımı
- Talep etiketi/kategori dağılımı
- Birim dışı proje ve talep dağılımı

Her iki görünümde de, bir grafik dilimine veya karta tıklandığında **detay kırılım (drilldown)** penceresi açılarak ilgili alt kırılımın liste halinde görüntülenebilmesi gerekir. Grafik detay/kırılım ekranına yalnızca Üst Düzey Kullanıcı ve Operatör erişebilmelidir.

### 5.2 VATANDAŞ BİLGİ LİSTESİ

- Vatandaşların telefon numarası, ad-soyad ve diğer kimlik bilgileriyle aranabildiği, kart/CRM tarzı bir liste ekranı olmalıdır.
- Yeni vatandaş kartı oluşturma ve mevcut kart detayını görüntüleme desteklenmelidir.
- Bir vatandaşın geçmişte oluşturduğu tüm taleplerin bu kart üzerinden görüntülenebilmesi gerekir.

### 5.3 TALEP OLUŞTUR — VATANDAŞ ÇAĞRISI

Manuel vatandaş talebi girişi için kullanılan form asgari aşağıdaki alanları içermelidir:

- Kanal seçimi: Facebook, Instagram, X, E-posta, Web Formu, WhatsApp, Diğer
- Vatandaş/gönderen bilgisi (ad, telefon)
- Kategori
- Konum bilgisi (manuel giriş veya harita üzerinden seçim/mevcut konum kullanımı)
- Talep içeriği/açıklaması
- Talep oluşturulduğunda (bkz. Bölüm 4.1) doğrudan işleme alınması

### 5.4 VATANDAŞ TALEPLERİ (SOSYAL KANAL LİSTESİ)

Bu, vatandaş talebi sürecinin ana çalışma ekranıdır. Sistem bu ekranda asgari şunları sağlamalıdır:

- Sosyal medya, WhatsApp, çağrı, e-posta, web formu gibi tüm kanallardan gelen kayıtların **tek listede**, ortak alanlarla (kanal, telefon, vatandaş adı, kategori, sahip müdürlük, konum, talep tarihi, son tarih) görüntülenmesi
- Kanal bazlı filtreleme (Tümü / WhatsApp / Çağrı / e-Devlet / Mobil Uygulama vb.)
- Talep durumuna göre filtreleme
- Henüz talebe dönüşmemiş bir kaydın **son tarihinin**, kaydın alınma anı + kurumun tanımladığı SLA süresi ile otomatik hesaplanması; talebe dönüştürüldükten sonra talebin kendi son tarihinin geçerli olması
- Son tarihi henüz atanmamış kayıtlarda "Onay Bekleyen" ibaresi, son 24 saat içinde dolacak kayıtlarda sarı, süresi geçmiş kayıtlarda kırmızı renkli vurgulama
- Henüz talebe dönüşmemiş bir kayıt için tek tıkla **"Talep Oluştur"** işlemiyle kaydın resmi bir vatandaş talebine dönüştürülmesi
- Talebe dönüşen kayıtlarda etiketleme (kategori/etiket) yapılabilmesi

### 5.5 VATANDAŞ TALEP HARİTASI

Sistem, vatandaş taleplerinin coğrafi dağılımını harita üzerinde gösteren ayrı bir ekran sağlamalıdır (menüde **"Vatandaş Talep Haritası"** adıyla yer almalıdır).

**Pin gösterimi ve renklendirme:**
- Her vatandaş talebi, konum bilgisi mevcutsa harita üzerinde bir **pin** olarak gösterilmelidir; asgari dört duruma karşılık gelen ayrı renkler kullanılmalıdır: **İşleme Alındı** (yeni gelen), **Yapılmakta**, **Yapılmakta + Süresi Geçmiş**, **Tamamlanan**. Sonuçlanmamış (iptal/reddedilmiş/revizyon istenen) kayıtlar haritada gösterilmemelidir.
- Harita üzerinde bu renklerin anlamını açıklayan bir **lejant (gösterge kutusu)** bulunmalıdır.

**Kümeleme (clustering):**
- Talep sayısının yoğun olduğu bölgelerde pinler kümelenmeli; küme simgesi içindeki kayıt sayısı görünür olmalıdır.
- Kullanıcı bir kümeye tıkladığında haritanın o bölgeye yakınlaşması (zoom), yeterince yakınlaşıldığında kümenin tekil pinlere ayrılması sağlanmalıdır.

**Harita gezinme:**
- Harita, İdarenin ilçe/bölge sınırlarını kapsayacak makul bir varsayılan merkez ve yakınlaştırma seviyesiyle açılmalıdır; kullanıcının başlangıç görünümüne tek tıkla dönebileceği bir "sıfırla" kontrolü bulunmalıdır.
- Yakınlaştırma/uzaklaştırma kontrolleri harita üzerinde erişilebilir olmalıdır.

**Filtreleme:** Asgari **tarih aralığı** (günlük/haftalık/aylık/yıllık/özel aralık) filtresi desteklenmelidir.

**Pin/kayıt detayına erişim:**
- Bir pine tıklandığında, aynı adreste/konumda birden fazla talep varsa önce bir liste, tek talep varsa doğrudan talebin tam detayı (talep no, başlık, mahalle/sokak/açık adres, kanal, ilgili birim, öncelik, vatandaş adı/telefon, durum) görüntülenmelidir.
- Talep listesi ile harita arasında çift yönlü geçiş desteklenmelidir: listeden bir kayıt seçilip haritada ilgili pine odaklanılabilmeli; henüz konumu haritada gösterilemeyen (koordinatsız) kayıtlar da ayrı bir listede görüntülenebilmelidir.

**Gerçek zamanlılık:** Harita verisi, sayfa açık kaldığı sürece **düzenli aralıklarla** (asgari her 60 saniyede bir) otomatik olarak tazelenmelidir; kullanıcının manuel yenileme yapmasına gerek kalmamalıdır.

**Erişim yetkisi:** Bu ekrana yalnızca Üst Düzey Kullanıcı, Hedef Birim Yöneticisi, Operatör ve Sistem Yöneticisi rolleri erişebilmelidir.

**Birim Talep Haritası (ayrı görünüm):** Hedef birim yöneticilerinin yalnızca kendi biriminin sorumlu olduğu talepleri gördüğü, benzer özelliklere sahip ayrı bir harita ekranı (**"Birim Talep Haritası"**) sağlanmalıdır. Bu görünümde:
- Org-wide (kiracı geneli) görüntüleme yetkisi olan roller tüm birimlerin taleplerini, diğer kullanıcılar yalnızca erişebildikleri birim(ler)in taleplerini görmelidir.
- Vatandaş talebi haritasından farklı olarak, kurum içi kaynaklı (rutin görev hariç) talepler de bu ekranda değerlendirilebilir.

**Konum/adres eşleşmesi:**
- Bir talebin konum koordinatı doğrudan girilmemişse, Sistem konumu ilişkili sosyal medya/WhatsApp konuşma kaydından tamamlayabilmelidir (coğrafi veri eksik bırakılmamalıdır).
- **Adres kataloğu entegrasyonu:** Talep oluşturma formunda mahalle/cadde/kapı numarası, yerel coğrafi bilgi sistemi (CBS) adres kataloğundan seçilebilir olmalı; alternatif olarak harita servisinden (Google Maps) alınan bir konum linki yapıştırıldığında Sistem bu linkten koordinatı ve CBS adres bilgisini (mahalle/sokak/kapı no) **otomatik olarak** çözümleyip doldurabilmelidir. Yani adres kataloğu ile harita koordinatı arasında çift yönlü bir eşleme sağlanmalıdır.

**Performans ve ölçeklenebilirlik:** Seçilen tarih aralığı geniş tutulduğunda dönebilecek kayıt sayısı büyük olabileceğinden, Sistem büyük hacimli sonuçlarda (ör. binlerce kayıt) sayfa performansını koruyacak bir üst sınır, sayfalama veya kademeli yükleme mekanizması içermelidir; sınırsız/kontrolsüz veri çekimi kabul edilmemelidir.

### 5.6 WHATSAPP KONUŞMALAR

Vatandaşlarla WhatsApp Business üzerinden yürütülen tüm yazışmaların yönetildiği bu ekran, üç bölmeli bir düzende çalışmalıdır: **konuşma listesi** (sol), **mesaj zaman çizelgesi ve yazı alanı** (orta), **vatandaş profili/talep özeti** (sağ).

**Konuşma listesi:**
- Telefon numarası veya vatandaş adına göre arama yapılabilmelidir.
- Durum bazlı filtreleme desteklenmelidir: yeni gelen / işlemde / tamamlanmış / iptal, ayrıca yalnızca okunmamışları gösteren bir görünüm.
- Sayfalama ile büyük hacimli konuşma listesi performanslı biçimde görüntülenebilmelidir.

**Mesaj türleri ve içerik:**
- Metin mesajı, dosya eki (resim, PDF, ofis belgesi — tekil/toplam boyut sınırı tanımlı, asgari 5 MB) ve konum paylaşımı desteklenmelidir.
- Dosya eki gönderiminde yükleme ilerlemesi bir ilerleme çubuğuyla gösterilmelidir.

**Teslimat/okundu durumu:** Her giden mesaj için asgari dört durum görsel olarak ayırt edilebilir simgeyle gösterilmelidir: **Gönderildi** (tek onay işareti), **İletildi** (çift onay işareti, gri), **Okundu** (çift onay işareti, vurgulu renk), **Başarısız** (hata simgesi, hata nedeninin görüntülenebilmesi).

**24 saatlik pencere yönetimi:**
- Vatandaştan gelen son mesajın üzerinden 24 saat geçmemişse pencere "açık" kabul edilmeli, serbest metin yazılabilmelidir.
- Pencere kapandığında serbest metin girişi devre dışı bırakılmalı; yalnızca Meta tarafından **onaylanmış şablon (template) mesajlar** seçilerek gönderilebilmelidir. Kullanıcı pencere kapalıyken serbest yazmayı denerse, sistemin şablon zorunluluğunu açıkça bildiren bir uyarı göstermesi gerekir.
- Meta onaylı şablonlar, Meta İş Hesabı ile periyodik olarak senkronize edilebilmeli (onaylı şablonların yerel listeye aktarılması) ve Sistem Yöneticisi tarafından ayrıca yönetilebilmelidir (bkz. Bölüm 5.13).

**Hızlı yanıt şablonları:** 24 saatlik pencerenin dışında kalan Meta şablonlarından ayrı olarak, her kullanıcı **kendi kişisel hızlı yanıt şablonlarını** (sık kullanılan metinler) oluşturabilmeli, adlandırabilmeli, düzenleyebilmeli ve silebilmelidir; şablon seçici ekranda Meta onaylı şablonlarla birlikte tek bir listede sunulmalıdır.

**Gerçek zamanlı güncelleme:** Yeni gelen bir WhatsApp mesajı, sayfa yenilenmeden, gerçek zamanlı bağlantı (bkz. Bölüm 7.1) üzerinden konuşma listesine ve açık konuşma detayına anında yansımalıdır. Bağlantı kesintisi sonrası yeniden bağlanıldığında, kesinti sırasında kaçırılan mesajların da geriye dönük tamamlanması sağlanmalıdır.

**Talep ile ilişkilendirme:** Konuşma detayında, bu konuşmadan doğan talep(ler) ve varsa güncel görev sahibi bilgisi özet olarak gösterilmeli; henüz bir talep oluşturulmamışsa konuşma üzerinden doğrudan **talep oluşturma** işlemi tetiklenebilmelidir.

**Yazma ve gönderme yetkisi (bkz. Bölüm 4.1 ve 4.2):** Mesaj yazma alanı tüm yetkili kullanıcılara (hedef birim yöneticisi, atanan personel dahil) açık olabilir; ancak gönderilen mesajın **vatandaşa fiilen ulaşması yalnızca Operatör veya Sistem Yöneticisi onayına bağlı** olmalıdır:
- Operatör veya Sistem Yöneticisi yazdığı mesaj, pencere açıksa veya onaylı bir şablon seçilmişse **doğrudan** gönderilmelidir.
- Diğer roller (hedef birim yöneticisi, personel) tarafından yazılan mesaj, vatandaşa hemen iletilmemeli; bir **"beklemede" (taslak) kuyruğuna** düşmeli ve yalnızca Operatör veya Sistem Yöneticisi bu taslağı inceleyip onayladığında fiilen gönderilmelidir. Bu, Bölüm 4.1'de tanımlanan "vatandaşa doğrudan yazma yetkisi yalnızca Operatörde" kuralının teknik uygulama biçimidir; arayüz düzeyinde mesaj kutusunun tamamen gizlenmesi yerine, gönderim onayının rol bazlı kısıtlanması şeklinde de gerçekleştirilebilir — asgari şart, Operatör dışı bir kullanıcının yazdığı bir metnin Operatör onayı olmadan vatandaşa ulaşmamasıdır.

**Konuşma geçmişi**, ilgili vatandaş talebi kaydına kalıcı olarak bağlı kalmalı ve talep kapandıktan sonra da erişilebilir olmalıdır.

### 5.7 SMS ONAYI

- Vatandaşa gönderilecek SMS metinlerinin onay sürecinin yönetildiği bir ekran olmalıdır.
- Onay bekleyen kayıtlar listelenmeli; yetkili kullanıcı metni onaylayabilmeli veya reddedebilmelidir.
- Reddedilen bir mesajın gerekçesi kayıt altına alınmalıdır.

### 5.8 VATANDAŞA GÖNDERİLECEK MESAJ ONAYI

- WhatsApp veya diğer kanallardan vatandaşa iletilecek mesajların **içerik onayının** yönetildiği ayrı bir ekran olmalıdır.
- Bu ekran, Bölüm 6.3'te tanımlanan iki aşamalı (serbest bırakma → fiilen gönderme) sürecin arayüzünü oluşturmalıdır.

### 5.9 E-DEVLET GÜNLÜK FAALİYET PLANI

- e-Devlet entegrasyonu kapsamında günlük faaliyet planı oluşturma ekranı ve mevcut planların listelendiği ayrı bir ekran bulunmalıdır.
- Bu ekrana yalnızca yetkili rol (belirlenmiş özel rol veya Sistem Yöneticisi) erişebilmelidir.
- Faaliyet planları, belediye standart SOAP servisi (WSDL tabanlı) üzerinden senkronize edilebilmelidir.

### 5.10 BİLDİRİMLER

- Kullanıcıyı ilgilendiren vatandaş talebi güncellemeleri (yeni atama, onay, kapanış vb.) gerçek zamanlı olarak üst menüdeki bildirim ziline düşmelidir.
- Bildirime tıklanarak ilgili talep detayına doğrudan geçilebilmelidir.
- Okunmamış bildirim sayısı görünür olmalıdır.

### 5.11 KULLANICILAR (YÖNETİM)

- Sistem Yöneticisi tarafından kullanıcı oluşturma, düzenleme, rol atama ve aktiflik durumu yönetimi yapılabilmelidir.
- Operatör, Hedef Birim Yöneticisi, Vatandaş Talep Yöneticisi gibi rollerin bu ekrandan atanabilmesi gerekir.

### 5.12 BİRİMLER (YÖNETİM)

- Belediye müdürlük/birim kayıtlarının tanımlandığı, birim yöneticisi atamasının yapıldığı bir ekran olmalıdır.
- Bir birimin **Başkanlık Seviyesi Birim** (bkz. Bölüm 2) olup olmadığı, birim kaydı üzerinde **açık ve ayrık bir alan/işaretle** (ör. bir onay kutusu) belirlenebilmelidir. Bu sınıflandırma, birimin adına veya serbest metin türü alanına dayalı isim eşleştirmesiyle **çıkarsanmamalı**; birim adı sonradan değiştirildiğinde veya farklı bir dille/yazımla girildiğinde kısıtın sessizce devre dışı kalmasına yol açmayacak, güvenilir bir veri alanı olarak saklanmalıdır. Bu işaret, Bölüm 4.1'de tanımlanan yönlendirme kısıtının teknik dayanağını oluşturmalıdır.

### 5.13 AYARLAR

Sistem Yöneticisine özel bu ekran, vatandaş talebi süreciyle ilgili asgari şu alt sekmeleri içermelidir:

- **Kurum bilgileri:** Varsayılan SLA süresi (saat), hafta sonu SLA istisnası
- **Sosyal entegrasyonlar:** WhatsApp, Facebook, Instagram, X, e-posta bağlantı bilgilerinin tanımlandığı alan
- **Yönlendirme kuralları:** Belirli kategori/kanal kombinasyonlarının otomatik olarak bir hedef birime yönlendirilmesi kuralları
- **Vatandaş talebi ayarları:** Kategori listesi, kanal listesi gibi vatandaş talebi formuna özel tanımlar
- **Taslak mesajlar:** Bkz. Bölüm 5.14 (ayrı, detaylı bir alt sekmedir)
- **Lisans:** Bkz. Bölüm 14
- **Rol sayfa yetkileri:** Her rolün hangi sayfayı görebileceğinin satır bazında düzenlendiği alt sekme

### 5.14 TASLAK MESAJLAR

"Taslak Mesajlar" alt sekmesi, yalnızca WhatsApp'ın 24 saatlik penceresi kapandığında kullanılacak sabit metinlerden ibaret değildir; Sistem Yöneticisinin **otomatik yanıt kurallarını** tanımladığı kapsamlı bir modül olarak tasarlanmalıdır. Bu ekran asgari aşağıdaki işlevleri sağlamalıdır.

**Şablon listesi ve türü:**
- Şablonlar bir liste halinde görüntülenmeli, her biri Aktif/Pasif durumuyla işaretlenmelidir.
- Her şablon bir **"Şablon Türü"** (kanal) taşımalıdır: Genel, WhatsApp, Facebook, Instagram, X, Çağrı/Telefon. Yalnızca **Genel** veya **WhatsApp** türündeki şablonlar otomatik yanıt mekanizmasında değerlendirilmelidir; diğer kanal türleri (Facebook, Instagram, X, Çağrı) manuel şablon/hızlı yanıt amaçlı tutulmalı, otomatik tetiklenmemelidir.
- Meta'dan senkronize edilen onaylı WhatsApp şablonları, kullanıcı tarafından oluşturulan taslaklardan ayrı bir tür (**"Meta"**) ile işaretlenmeli ve listede görsel olarak (rozet) ayırt edilmelidir; bu şablonların içeriği ve davranışsal ayarları (otomatik cevap, anahtar kelime, zamanlama) yalnızca Meta senkronizasyonu ile güncellenmeli, elle düzenlenememelidir — yalnızca aktif/pasif durumu değiştirilebilir.

**Otomatik cevap:**
- Bir şablon "Otomatik Cevap" olarak işaretlendiğinde, uygun koşullar sağlandığında gelen mesaja **otomatik olarak** yanıt gönderilmelidir.
- Yanıtın kaç saniye gecikmeyle gönderileceği (**Cevap Süresi**) yapılandırılabilir olmalıdır (asgari seçenekler: 10, 30, 60, 120, 300 saniye); bu, otomatik yanıtın yapay/anlık görünmemesi amacıyla kasıtlı bir gecikme uygulanmasını sağlar.
- Aynı gelen mesaja aynı içerikte birden fazla otomatik yanıt **aynı gün içinde tekrar gönderilmemelidir** (mükerrer yanıt engeli).

**Anahtar kelime eşleştirme:**
- Bir şablon "Anahtar Kelime" ile sınırlandırılabilmeli; bu durumda şablon yalnızca gelen mesaj metni tanımlı anahtar kelimelerden birini **içeriyorsa** (büyük/küçük harf duyarsız) tetiklenmelidir.
- Anahtar kelimesiz (genel) bir şablon ile anahtar kelimeli şablonlar bir arada tanımlanabilmelidir; bu durumda gelen mesaj bir anahtar kelimeyle eşleşiyorsa ilgili anahtar kelime şablonu/şablonları gönderilmeli, eşleşme yoksa en fazla bir genel şablon devreye girmelidir.

**Zamanlı yanıt (mesai dışı bildirim):**
- Bir şablon, yalnızca belirli bir **tarih aralığında** (opsiyonel, başlangıç/bitiş tarihi) etkin olacak şekilde sınırlandırılabilmelidir.
- Haftanın hangi günlerinde etkin olacağı (**Aktif Günler**, 7 günlük seçim) tanımlanabilmelidir.
- Günün hangi saat aralığında etkin olacağı (**Başlama/Bitiş Saati**) tanımlanabilmeli; bitiş saati başlangıçtan küçükse (örn. 17:30 – 08:30), Sistem bunu **gece yarısını aşan bir aralık** (mesai dışı/gece) olarak yorumlayabilmelidir — bu, "mesai dışı otomatik bildirim mesajı" senaryosunun teknik temelidir.
- Cumartesi/Pazar için ayrı bir **"Hafta Sonu — Tüm Saatler"** istisnası tanımlanabilmeli; bu işaretliyken hafta sonu günlerinde saat/gün kısıtı uygulanmaksızın şablon her saat etkin olmalıdır.
- Zamanlı yanıt kapalıysa (devre dışı), şablon zaman kısıtı olmaksızın (diğer koşullar sağlandığında) her an tetiklenebilir olmalıdır.

**İçerik ve genel ayarlar:**
- Şablon adı ve gönderilecek mesaj metni serbest metin olarak girilebilmelidir.
- "Genel Cevap" işareti, birden fazla uygun şablon arasında öncelik sıralamasında kullanılmalıdır.

### 5.15 DENETİM KAYITLARI

- Vatandaş talebiyle ilgili tüm kritik işlemlerin (oluşturma, onay, red, atama, mesaj serbest bırakma/gönderim, durum değişikliği) kim tarafından, ne zaman, hangi kayıt üzerinde yapıldığının izlenebildiği bir ekran olmalıdır.
- Bu ekrana yalnızca Sistem Yöneticisi ve yetkilendirilen roller erişebilmelidir.

---

## 6. Talep Yaşam Döngüsü ve Onay Süreçleri

### 6.1 TALEP OLUŞTURMA VE OTOMATİK AKTİVASYON

**Zorunlu asgari alanlar:** Bir vatandaş talebinin oluşturulabilmesi için asgari **başlık**, **açıklama**, **hedef/sahip birim** ve **öncelik** alanlarının doldurulmuş olması Sistem tarafından zorunlu kılınmalıdır. Vatandaş adı ve telefon numarası, talebin niteliği gereği (arşivlenebilir/aranabilir bir kayıt oluşturması için) doldurulması beklenen alanlardır; telefon numarası girildiğinde Sistem **geçerli bir Türkiye cep/sabit telefon formatında** olduğunu doğrulamalıdır — yalnızca dolu olup olmadığının kontrolü yeterli değildir.

**Onay gerekliliği ve rol ilişkisi:**
- Operatör tarafından oluşturulan vatandaş talebi, sahiplenen birimin (halkla ilişkiler/çağrı merkezi) ayrıca onayına **tabi tutulmamalıdır**; bu, İdarenin vatandaşa hızlı yanıt verme hedefinin doğrudan bir gereğidir.
- Sistem Yöneticisi veya yönetici yetkisine sahip diğer roller tarafından oluşturulan vatandaş talepleri de aynı şekilde doğrudan aktif olmalıdır.
- Personel veya Vatandaş Talep Yöneticisi rolündeki bir kullanıcı vatandaş talebi oluşturursa (istisnai bir kullanım senaryosu), talep yine sahip birim onayına düşmelidir; bu durumda talebe **talep numarası, son tarih ve görev kaydı ancak onay tamamlandıktan sonra** atanmalıdır.

**Aktivasyon anında gerçekleşmesi gereken işlemler (onay gerekmiyorsa, talep oluşturulduğu anda):**
1. Talebe kiracı/yıl bazlı **benzersiz bir talep numarası** atanmalıdır; numaralandırma eşzamanlı (concurrent) talep oluşturma senaryolarında dahi **çakışmaya izin vermemelidir** (iki farklı talebin aynı numarayı almaması garanti edilmelidir).
2. Tenant'ın tanımladığı varsayılan SLA süresine göre **son tarih** hesaplanıp talebe yazılmalıdır (bkz. Bölüm 6.4).
3. Hedef birime ait **görev (iş) kaydı** oluşturulmalı ve ilgili birim havuzuna/personele düşmelidir.
4. İşlem **denetim kaydına** (talep oluşturma ve varsa görev oluşturma olarak ayrı ayrı) yazılmalıdır.

**Otomatik yönlendirme kuralları:** Sistem, kanal/kategori/anahtar kelime bazlı tanımlanmış yönlendirme kurallarını (bkz. Bölüm 5.13) talep oluşturma anında **fiilen uygulayabilmeli** — yani uygun bir kural tanımlıysa hedef birim otomatik olarak önerilmeli veya atanmalıdır. Bu davranışın yalnızca yönetim ekranında test edilebilir bir kural motoru olarak kalmaması, gerçek talep oluşturma akışına **uçtan uca entegre** edilmiş olması asgari şarttır; kabul testlerinde (Bölüm 11.2) bu uçtan uca senaryo ayrıca doğrulanmalıdır.

**Bildirim:** Talep oluşturulduğunda, ilgili hedef birim yöneticisine **gerçek zamanlı** bir bildirim iletilmelidir (bkz. Bölüm 5.10). Yalnızca mesai saatleri dışında oluşturulan taleplerde bir ek SMS bildirimi tetiklenmesi kabul edilebilir bir tamamlayıcı önlemdir, ancak mesai içi oluşturulan taleplerde de ilgili yöneticinin **anında** haberdar olması sağlanmalıdır — bildirim yalnızca mesai dışı bir senaryoya bağlı kalmamalıdır.

**Mükerrer kayıt kontrolü:** Sistem, aynı telefon numarasından kısa bir süre içinde (ör. birkaç dakika içinde) birden fazla talep oluşturulmaya çalışılması durumunda Operatörü **uyarmalı** (mükerrer kayıt olabileceğini belirten bir bildirim/işaret göstermeli); bu, aynı şikâyetin yanlışlıkla birden fazla kez kaydedilmesini önlemeye yöneliktir. Uyarı, işlemi engellemek zorunda değildir; Operatörün bilinçli olarak devam edebilmesi sağlanmalıdır.

### 6.2 HEDEF BİRİM ONAYI

- Bir vatandaş talebi bir hedef birime yönlendirildiğinde, o hedef birimin yöneticisi (veya yetkilendirilmiş Vatandaş Talep Yöneticisi) talebi **onaylamalı veya reddetmelidir**.
- Onay verilene kadar talebe son tarih atanmamalı, ilgili listede **"Onay Bekleyen"** olarak görünmelidir; onay verildiği an SLA süresi işlemeye başlamalıdır.
- Talep birden fazla hedef birime **koordineli** olarak yönlendirilmişse, her hedef birimin onay/red kararı **bağımsız olarak** ayrı ayrı izlenmelidir; ilk hedef birimin onayı talebi aktive etmeli, diğer hedeflerin kararları kendi bağlamlarında ayrıca takip edilmelidir.
- Bir hedef birim talebi reddederse, yalnızca o birime ait, henüz sonuçlanmamış görev/iş kayıtları otomatik olarak iptal edilmelidir; talebin genel durumu kalan hedeflerin durumuna göre yeniden hesaplanmalı, tüm hedefler reddederse talep tümüyle iptal edilmelidir.
- Operatörün Başkanlık/Daire Başkanlığı seviyesindeki birimlere doğrudan yönlendirme yapması Sistem tarafından engellenmelidir (bkz. Bölüm 4.1).

### 6.3 VATANDAŞA GİDEN MESAJIN İKİ AŞAMALI ONAY/SERBEST BIRAKMA SÜRECİ

Talep sonuçlandıktan (tamamlandı veya iptal edildi) sonra, vatandaşa gidecek kapanış bildirimi **tek adımlı** değil, aşağıdaki gibi **iki aşamalı** bir süreçten geçmelidir:

1. **Serbest bırakma:** Hedef birim yöneticisi veya Vatandaş Talep Yöneticisi, kapanış notunu doldurur ve mesajı gönderim kuyruğuna **serbest bırakır**. Bu adım mesajı fiilen göndermez; yalnızca Operatörün görebileceği bir kuyruğa açar. İşlem denetim kaydına yazılmalı, aynı işlemin ikinci kez tetiklenmesi mükerrer kayda yol açmamalıdır.
2. **Fiilen gönderim:** Serbest bırakılan mesaj, yalnızca **Operatör** veya **Sistem Yöneticisi** tarafından SMS Onayı / Vatandaşa Gönderilecek Mesaj Onayı ekranından incelenip fiilen onaylanır ve gönderilir.

Bu ayrımın amacı, kapanış notunu yazan hedef birim yöneticisinin vatandaşa doğrudan mesaj gönderme yetkisine sahip olmamasını; vatandaşla iletişim kanalının uçtan uca yalnızca Operatör rolünde toplanmasını sağlamaktır.

### 6.4 SLA VE SON TARİH HESABI

- Sistem, her vatandaş talebi için İdarenin **Ayarlar** ekranından tanımladığı varsayılan SLA süresini (saat cinsinden) esas almalıdır.
- Formül: `Son Tarih = Başlangıç anı + SLA süresi`. Başlangıç anı, henüz talebe dönüşmemiş kayıtlarda kaydın alınma anı, talebe dönüştükten sonra ise talebin oluşma/onay anıdır.
- İdare, hafta sonu günlerinin SLA hesabına dahil edilmemesini seçebilmelidir.
- Formda son tarih elle girilirse Sistem bu değeri esas almalı, otomatik SLA hesabını devre dışı bırakmalıdır.

### 6.5 DURUM GEÇİŞLERİ

Vatandaş talebi asgari aşağıdaki durumları desteklemelidir: **Bekleyen** (hedef birim onayı bekliyor) → **Onaylanmış/Aktif** → **Yapılmakta** → **Tamamlanmış** / **İptal/Reddedilmiş**. Son tarihi geçmiş ama kapanmamış kayıtlar ayrıca **"Son Tarihi Geçmiş"** olarak işaretlenebilmelidir.

### 6.6 YÖNLENDİRİLEN TALEBİN DURUMUNUN MANUEL OLARAK DEĞİŞTİRİLMESİ (YENİDEN AÇMA)

Bir vatandaş talebi hedef birime yönlendirilip orada bir personele atandıktan ve o personelin görevi **Tamamlanmış** veya **İptal** durumuna girdikten sonra, Sistem bu görevin durumunun **manuel olarak yeniden açılabilmesini** (örn. tamamlandı işaretlenen bir işin aslında eksik kalması) desteklemelidir. Bu işlem asgari aşağıdaki kurallara tabi olmalıdır:

- **Yetki:** Yalnızca görevin atandığı personel veya Sistem Yöneticisi bu işlemi yapabilmelidir; hedef birim yöneticisi dahil başka hiçbir rol bu değişikliği tetikleyememelidir.
- **İzin verilen geçiş:** İşlem yalnızca görev **Tamamlanmış** veya **İptal** durumundayken başlatılabilmeli; hedef durum olarak **Yapılmakta**, **Tamamlanmış** veya **İptal** seçilebilmeli, ancak görevin **mevcut durumu** hedef olarak yeniden seçilememelidir (örn. Tamamlanmış bir görev tekrar Tamamlanmış yapılamamalıdır).
- **Gerekçe zorunluluğu:** İşlem sırasında bir değişiklik **gerekçesi** girilmesi zorunlu olmalı; gerekçe girilmeden işlem tamamlanamamalıdır.
- **Tek seferlik kısıt:** Bir görevin durumu bu yolla **yalnızca bir kez** değiştirilebilmelidir; aynı görev için ikinci kez manuel durum değişikliği yapılmak istendiğinde Sistem bunu engellemeli ve kullanıcıyı bilgilendirmelidir.
- **Talebin genel durumuna etkisi:** Görev **Yapılmakta** durumuna geri alındığında, bağlı olduğu talep **Tamamlanmış**/**İptal** durumundaysa otomatik olarak **Aktif** duruma geri düşürülmeli, tamamlanma tarihi temizlenmelidir. Görev **İptal** durumuna alınırsa ve bu, talebin genel durumunu da iptale taşıyorsa, girilen gerekçe talebin iptal notuna da yazılmalıdır.
- **Koordineli (birden fazla hedef birime yönlendirilmiş) talepte etkinin sınırı:** Talep birden fazla hedef birime yönlendirilmişse, bir hedef birimdeki görevin manuel olarak yeniden açılması yalnızca **o hedef birimin** kendi tamamlanma durumunu ve dolayısıyla talebin genel/ortak durumunu etkilemelidir; diğer hedef birimlere ait görev kayıtları bu işlemden etkilenmemelidir.
- **SLA/son tarihe etkisi yok:** Bu işlem, talebin veya görevin SLA/son tarih hesabını **değiştirmemelidir**; yalnızca durum ve tamamlanma bilgilerini günceller.
- **İzlenebilirlik:** Her manuel durum değişikliği denetim kaydına (Bölüm 5.15) yazılmalı ve — talep vatandaş kaynaklıysa — ilgili bildirim mekanizması (durum değişikliği bildirimi) tetiklenmelidir.

---

## 7. Teknik Mimari ve Alt Yapı Gereksinimleri

### 7.1 SUNUCU TARAFI (BACKEND)

İstekli, sunucu tarafı teknoloji yığınını (programlama dili, çatı, veritabanı ürünü vb.) serbestçe seçebilir; bu şartname belirli bir ürün veya marka dayatmaz. Seçilen teknoloji, aşağıdaki asgari yetenekleri sağlamalıdır:

| Yetenek | Asgari gereksinim (teknolojiden bağımsız) |
| --- | --- |
| Mimari | Sorumlulukların katmanlara ayrıldığı (veri erişimi / iş kuralları / sunum) sürdürülebilir bir yazılım mimarisi; iş kurallarının doğrulanması merkezi ve tutarlı bir mekanizmayla yapılmalıdır |
| Veritabanı | Kurumsal ölçekte, ACID uyumlu, yedeklenebilir bir **ilişkisel veritabanı yönetim sistemi**; şema değişikliklerinin sürüm kontrollü (migration) biçimde uygulanabilmesi |
| Giriş doğrulama | Kullanıcıdan alınan verilerin merkezi ve tutarlı biçimde doğrulanması; hata mesajlarının Türkçe üretilmesi |
| Gerçek zamanlı iletişim | Bildirim ve WhatsApp/SMS onay kuyruğu güncellemelerinin, sayfa yenilemeden, sunucudan istemciye anlık iletilebildiği bir mekanizma |
| Loglama | Yapılandırılabilir, en az 14 gün saklama süreli, aranabilir sistem kaydı |
| API dokümantasyonu | Makine tarafından okunabilir, güncel tutulan bir API şeması (ör. OpenAPI/Swagger uyumlu) |

İstekli, teklifinde hangi teknoloji yığınını kullanacağını (dil, çatı, veritabanı ürünü ve sürümü dahil) açıkça belirtmeli; seçilen ürünlerin İdarenin mevcut/planlanan işletim ortamıyla (sunucu, yedekleme, izleme araçları) uyumlu olduğunu göstermelidir.

### 7.2 İSTEMCİ TARAFI (FRONTEND)

- Modern bir web çerçevesi üzerinde, tip güvenli (TypeScript) geliştirilmiş olmalıdır.
- Masaüstü ve tablet çözünürlüklerinde tam işlevsellik sağlanmalıdır.
- En az Türkçe dil desteği bulunmalı, çoklu dile açık bir mimari tercih edilmelidir.

### 7.3 DAĞITIM VE İŞLETİM

İstekli, dağıtım yöntemini (konteyner tabanlı, sanal sunucu tabanlı veya bulut servisi tabanlı) kendi teknoloji tercihine göre belirleyebilir. Seçilen yöntem, aşağıdaki asgari işletim yeteneklerini sağlamalıdır:

- Sistemin, birbirinden bağımsız olarak güncellenebilen/yeniden başlatılabilen bileşenler (uygulama, veritabanı vb.) halinde kurulabilmesi
- Veritabanı verisinin, yüklenen dosya eklerinin ve şifreleme/oturum anahtarlarının, uygulama güncellemesi veya yeniden başlatma sırasında **kaybolmayacak** şekilde kalıcı depolamada tutulması
- Üretim ortamı için, geliştirme ortamından ayrı; günlük (log) rotasyonu ve dışa kapalı/erişimi kısıtlı veritabanı bağlantısı içeren bir yapılandırma sağlanması
- Sistemin, İdarenin uygun gördüğü ortamda (yerinde sunucu veya bulut) çalışabilmesi; belirli bir bulut sağlayıcısına bağımlı olmaması

---

## 8. Entegrasyon Gereksinimleri

| Entegrasyon | Zorunluluk | Açıklama |
| --- | --- | --- |
| WhatsApp Business API (Meta) | Zorunlu | Webhook doğrulama, mesaj gönderme/alma, şablon mesaj yönetimi |
| Facebook / Instagram Graph API | Zorunlu | Sayfa mesajlarının içeri alınması |
| X (Twitter) API | Tercih edilir | DM/mention toplama |
| SMS ağ geçidi | Zorunlu | En az bir yerli SMS sağlayıcısı |
| e-Devlet / Belediye Standart SOAP servisi | Zorunlu | WSDL tabanlı, başvuru durumu ve faaliyet planı senkronizasyonu |
| Google Maps Geocoding / Maps API | Zorunlu | Adres-koordinat dönüşümü, harita gösterimi |
| E-posta gönderim servisi | Zorunlu | Şifre sıfırlama ve sistem bildirimleri |
| reCAPTCHA veya muadili | Zorunlu | Dış ağdan erişilen web formu için |

---

## 9. Güvenlik ve KVKK Gereksinimleri

- Vatandaşa ait kişisel veriler (ad, telefon, adres, T.C. kimlik bilgisi) yalnızca yetkili roller tarafından görüntülenebilmelidir.
- Denetim kayıtları üzerinden "kim, hangi vatandaş verisine, ne zaman eriştiğinin" izlenebilir olması sağlanmalıdır.
- Tüm dış erişim HTTPS/TLS üzerinden yapılmalı, kimlik doğrulama endüstri standardı bir protokolle (OAuth2/OpenID Connect uyumlu) sağlanmalıdır.
- Hız sınırlama (rate limiting) ve CORS politikası üretim ortamında sıkı tutulmalıdır.
- 6698 sayılı KVKK kapsamındaki veri sorumlusu yükümlülükleri (saklama süresi, silme/anonimleştirme politikası) İdare tarafından tanımlanabilir olmalıdır.

---

## 10. Performans, Kapasite ve Süreklilik

| Kriter | Asgari beklenti |
| --- | --- |
| Eşzamanlı kullanıcı | En az 20 eşzamanlı aktif Operatör/yönetici kullanıcı |
| Sayfa yanıt süresi | Standart liste/arama ekranlarında ortalama 2 saniyenin altında |
| Gerçek zamanlı bildirim gecikmesi | 5 saniyenin altında |
| Yedekleme | Veritabanının düzenli (asgari günlük) otomatik yedeklenmesi (bkz. Bölüm 10.1) |
| Sürüm güncelleme | Kesinti süresi en aza indirilmiş güncelleme yöntemi |

### 10.1 YEDEKLEME VE FELAKET KURTARMA

**Yedekleme kapsamı:** Yalnızca veritabanı değil, Sistemin çalışması için gerekli **tüm kalıcı veri** yedeklenmelidir: veritabanı, yüklenen dosya ekleri (talep/görev fotoğrafları, belgeler), veri koruma/oturum şifreleme anahtarları ve kritik yapılandırma dosyaları (ör. entegrasyon kimlik bilgileri, ortam değişkenleri).

**Sıklık ve saklama süresi:**
- Veritabanı yedeği asgari **günde bir kez**, mesai saatleri dışında otomatik olarak alınmalıdır.
- Alınan yedekler asgari **30 gün** saklanmalı; İdare talep ederse saklama süresi uzatılabilmelidir.
- Farklı zaman noktalarına dönebilmek için (yanlışlıkla silinen/bozulan veri durumunda) birden fazla yedek nokta (ör. son 7 günün her biri + haftalık/aylık uzun vadeli kopyalar) tutulmalıdır; yalnızca "en son yedek" ile yetinilmemelidir.

**Saklama konumu ve güvenlik:**
- Yedekler, **üretim veritabanının bulunduğu sunucudan fiziksel/mantıksal olarak ayrı** bir konumda (farklı disk, farklı sunucu veya farklı veri merkezi) saklanmalıdır; yedeğin üretim sunucusuyla aynı diskte tutulması tek bir donanım arızasında hem veriyi hem yedeği kaybetme riski taşıdığından kabul edilemez.
- Yedekler, gerek aktarım sırasında (transit) gerek saklama sırasında (at rest) **şifrelenmelidir**.
- Yedeklere erişim, yalnızca yetkili sistem yöneticisi/İstekli personeliyle sınırlandırılmalı ve bu erişim de denetim kaydına tabi olmalıdır.

**Geri yükleme (restore) ve doğrulama:**
- Alınan yedeklerin **gerçekten geri yüklenebilir** olduğu, düzenli aralıklarla (asgari 3 ayda bir) bir test/deneme ortamında fiilen geri yükleme denemesi yapılarak doğrulanmalıdır; yalnızca yedekleme işleminin "hatasız tamamlandı" bildirimine güvenilmemelidir.
- Geri yükleme testlerinin sonucu (başarılı/başarısız, süre) kayıt altına alınmalı ve İdareye istenildiğinde raporlanabilmelidir.

**Hedef süreler (RPO/RTO):**
- **RPO (kabul edilebilir veri kaybı süresi):** Bir felaket/veri kaybı anında, en fazla **son 24 saatlik** veri kaybedilebilir olmalıdır (günlük yedekleme sıklığıyla uyumlu); İdare daha sıkı bir RPO talep ederse yedekleme sıklığı buna göre artırılmalıdır.
- **RTO (kabul edilebilir kurtarma süresi):** Bir felaket sonrası Sistemin yedekten ayağa kaldırılıp yeniden hizmet verir hale gelmesi, asgari olarak **8 saat** içinde tamamlanabilmelidir.
- Bu hedeflerin nasıl karşılanacağını açıklayan bir **felaket kurtarma prosedürü** yazılı olarak İdareye teslim edilmelidir (bkz. Bölüm 12).

**Sorumluluk:** Yedekleme altyapısının kurulması ve ilk yapılandırılması İstekli sorumluluğundadır; garanti/bakım-destek süresi boyunca yedeklerin sağlıklı alındığının izlenmesi de (bkz. Bölüm 13) İstekli kapsamındadır. Yedeklerin fiziksel/bulut saklama maliyeti ve mülkiyeti taraflar arasındaki sözleşmede ayrıca netleştirilmelidir.

---

## 11. Kurulum, Test ve Kabul Kriterleri

### 11.1 KURULUM

Sistem, İdarenin belirlediği ortamda kurulmalı; kurulum sonrası erişim adresleri, ilk yönetici hesabı ve yapılandırma dokümantasyonu yazılı olarak teslim edilmelidir.

### 11.2 TEST SÜRECİ

Kabul öncesi asgari şu testler yapılmalı ve raporlanmalıdır: fonksiyonel test (Bölüm 5 ve 6'daki tüm işlevler), yetkilendirme testi (her rolün yalnızca yetkili olduğu ekranlara erişebildiğinin doğrulanması — özellikle Operatör dışı rollerin WhatsApp'a yazamadığının doğrulanması), güvenlik testi (OWASP Top 10), kabul testi (İdare temsilcileriyle gerçek senaryolar).

### 11.3 KABUL KRİTERLERİ

- Bölüm 5 ve 6'daki tüm fonksiyonel gereksinimlerin çalışır durumda olması
- Kritik/yüksek önem dereceli güvenlik açığı bulunmaması
- Operatör onay istisnası ve iki aşamalı mesaj onayı sürecinin (Bölüm 6.1, 6.3) doğru çalıştığının gösterilmesi
- Eğitim ve dokümantasyonun eksiksiz teslim edilmiş olması

---

## 12. Eğitim ve Dokümantasyon

- **Kullanıcı kılavuzu** — rol bazlı (özellikle Operatör), ekran görüntüleriyle desteklenmiş, Türkçe kullanım kılavuzu
- **Yönetici kılavuzu** — kurulum, yapılandırma, yedekleme, kullanıcı/rol/lisans yönetimi
- **Eğitim** — asgari; sistem yöneticileri için 1 tam gün, Operatörler ve hedef birim yöneticileri için ayrı, rol bazlı eğitim oturumları

---

## 13. Garanti, Bakım ve Destek Hizmetleri

| Hizmet | Asgari şart |
| --- | --- |
| Garanti süresi | Kabul tarihinden itibaren en az 12 ay |
| Yanıt süresi (kritik arıza) | En geç 4 saat içinde ilk yanıt |
| Çözüm süresi (kritik arıza) | En geç 24 saat içinde geçici veya kalıcı çözüm |
| Güncelleme | Güvenlik yamalarının kritikse 7 gün içinde uygulanması |

---

## 14. Lisanslama

- Sistem, vatandaş talebi işlevlerini ayrı bir lisans modülü olarak etkinleştirip devre dışı bırakabilen bir yapıda olmalıdır; bu şartname yalnızca bu modülü kapsar.
- Lisans doğrulama mekanizması yerinde (on-premise) kurulumlarda dahi çalışabilmeli, kriptografik olarak sahteciliğe karşı korunmalıdır.

---

## 15. İlişkili Uygulamalar

İdarenin kullanımındaki aşağıdaki uygulamalar, vatandaş talebi süreciyle dolaylı veya doğrudan ilişkilidir; bu şartname kapsamında bilgi amaçlı belirtilmiştir.

### 15.1 ÜST DÜZEY YÖNETİCİ RAPORLAMA UYGULAMASI (MOBİL)

Belediye başkanı ve birim müdürlerine yönelik, ayrı bir mobil uygulama üzerinden Sistemin rapor verilerine **salt izleme (read-only)** amaçlı erişim sağlanmalıdır. Uygulama üzerinden talep/görev ile ilgili hiçbir işlem (onay, atama, düzenleme, mesaj gönderme) yapılamamalı; giriş dışındaki tüm istekler yalnızca veri okuma niteliğinde olmalıdır.

**Teknolojik alt yapı (asgari beklenti):**
- Çapraz platformlu bir mobil çatı (ör. Flutter) üzerinde, hem Android hem iOS'u tek koddan destekleyecek şekilde geliştirilmelidir.
- Oturum bilgisi cihazda **güvenli depolama** (keychain/keystore düzeyinde şifreli depolama) ile saklanmalıdır; düz metin olarak saklanmamalıdır.
- API adresi ve kiracı (tenant) kimliği, uygulama derleme zamanında yapılandırılabilir (build-time konfigürasyon) olmalı; sabit kodlanmamalıdır.

**Ekranlar:** Uygulama asgari aşağıdaki ekranları içermelidir:
- **Giriş** — kullanıcı adı/şifre ile kimlik doğrulama
- **Genel Özet** — KPI kutucukları ve talep trend grafiği
- **Kanal Dağılımı** — vatandaş talebi kanal bazlı (WhatsApp, sosyal medya, telefon vb.) pasta grafik görünümü
- **Birim Performansı** — birimlerin talep/görev tamamlama performansına göre sıralanması
- **Mahalle Bazlı Görünüm** — mahalle bazlı iş yükü ve tamamlanma oranı
- **SLA Uyum Göstergesi** — hedef süre uyumu ve süresi geçmiş kayıtların özeti
- **Grafik Detay/Kırılım** — bir grafik diliminden ilgili kayıtların liste halinde görüntülendiği detay ekranı
- **Talep/Görev Detayı** — tekil bir kaydın tüm bilgilerinin görüntülendiği salt-okunur detay ekranı
- **Ayarlar** — dil seçimi, tema (açık/koyu), oturumu kapatma

**Ana Sistemle entegrasyon:**
- Uygulama, Sistemin kimlik doğrulama uç noktası üzerinden oturum açmalı ve dönen erişim jetonunu sonraki tüm isteklerde kullanmalıdır.
- Rapor verileri, Sistemin raporlama uç noktalarından (kanal dağılımı, talep haritası pin verisi, birim/mahalle kırılımları, üst düzey özet rapor, grafik detay kırılımı, tekil talep detayı) çekilmelidir.
- Her istekte ilgili kiracı (tenant) kimliği başlıkta gönderilmeli, Sistemin çoklu kiracı izolasyonuna tam uyulmalıdır.
- Erişim, Sistemdeki rol tabanlı yetkilendirmeyle sınırlı olmalıdır: rapor uç noktaları yalnızca Sistem Yöneticisi (kiracı geneli) ve yetkili yönetici rolleri (kendi birimi/kapsamı ile sınırlı) tarafından çağrılabilmelidir; Bölüm 4.5'te tanımlanan Üst Düzey Kullanıcı rolünün de bu uygulamayı kullanabilmesi beklenir.
- Gerçek zamanlı bildirim (yeni talep/kritik SLA aşımı gibi anlık push bildirimi) bu şartname kapsamında **zorunlu değildir**; talep edilmesi halinde ayrı bir iş kalemi olarak, Sistemin canlı bildirim alt yapısına ve mobil push servisine (ör. FCM) bağlanacak şekilde ayrıca kapsanmalıdır.

**Netleştirilmesi gereken hususlar:** Bu bileşen yeniden ele alınacaksa (yeni geliştirme/bakım işi kapsamında), aşağıdaki iki nokta tek bir standarda bağlanmalı ve dokümante edilmelidir:
- **Kimlik doğrulama akışı:** Kullanıcı adı/şifrenin doğrudan jeton uç noktasına gönderildiği basit akış ile, mobil istemciler için daha güvenli kabul edilen yetkilendirme kodu + PKCE akışından hangisinin hedef mimari olacağı netleştirilmelidir; iki farklı akışın belgeler ile gerçek uygulama arasında tutarsız bırakılmaması gerekir.
- **Rol kapsamı:** Uygulamaya erişebilecek rollerin (Sistem Yöneticisi, yetkili yönetici rolleri, Üst Düzey Kullanıcı) tam listesi net şekilde tanımlanmalı ve uygulamanın erişim kontrolü bu listeyle birebir tutarlı olmalıdır.

### 15.2 DIŞ MOBİL UYGULAMA ÜZERİNDEN TALEP OLUŞTURMA (PLANLANAN)

İdarenin ayrıca yürüttüğü, vatandaşa yönelik tanıtım amaçlı bir mobil uygulama üzerinden de vatandaş talebi oluşturulabilmesi hedeflenmektedir. Bu şartname hazırlandığı tarih itibarıyla söz konusu entegrasyon **fiilen devrede değildir**; ilgili mobil uygulamada bir talep formu bulunmakla birlikte form gönderildiğinde Sisteme herhangi bir veri iletilmemektedir. İstekli, talep edilmesi halinde bu dış uygulamanın Sistemin vatandaş talebi oluşturma uç noktasına bağlanmasını sağlayacak entegrasyonu ayrı bir iş kalemi olarak teklif edebilir; bu iş asgari şunları içermelidir:

1. Dış uygulamadan gelen talebin Sistemde uygun bir kanal (Web Formu veya Diğer) ile sınıflandırılması
2. İki sistem arasında güvenli bir kimlik doğrulama/yetkilendirme mekanizması (uygulamaya özel API anahtarı veya imzalı istek modeli)
3. Uçtan uca testin, gönderilen bir talebin Sistemin Vatandaş Talepleri ekranında doğru alanlarla göründüğü gösterilerek tamamlanması

---

## 16. Ekler

- **Ek-1:** Vatandaş talebi ekran listesi ve rol-erişim matrisi
- **Ek-2:** Entegrasyon uç nokta ve kimlik bilgisi şablonları
- **Ek-3:** Kabul test senaryoları listesi

---

*Bu şartname, T.C. Tire Belediyesi Bilgi İşlem Müdürlüğü tarafından hazırlanmıştır ve yalnızca vatandaş talebi ve iletişim yönetimi kapsamındaki gereksinimleri düzenler.*
