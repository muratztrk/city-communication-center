# Özellik Invariant'ları — Kart yapmadan ÖNCE oku, SONRA güncelle

> Bu dosya "ne bozulmamalı" kurallarının **yaşayan** listesidir. Trello kartlarını
> yaparken tekrar tekrar bozduğumuz şeyler burada. Amaç: yeni istek eskiyi bozmasın.

## Nasıl kullanılır (zorunlu akış)

1. **Karttan ÖNCE:** dokunacağın alanın bölümünü oku (ör. Görevler kartıysa §1).
2. **Karttan SONRA:** yeni öğrendiğin bir "bozulabilir kural"ı tek satır olarak ekle.
   Bu dosya **kısa** kalmalı — implementation anlatımı değil, sadece "bunu bozma" kuralı.
3. **Çelişki görürsen kodu kaynak al.** Bu dosya bayatlamış olabilir; önce kodu doğrula,
   sonra buradaki satırı düzelt. (Kodla doğrulanmış son tarih: 2026-06-27.)

İlgili: regresyon hikâyeleri → [`../tasks/lessons.md`](../tasks/lessons.md);
kart bazlı log → [`../tasks/todo.md`](../tasks/todo.md); doc indeksi → [`README.md`](README.md).

---

## 0. Global (tüm proje)

- **`main` push = PRODUCTION auto-deploy** (yenitim.tire.bel.tr, gerçek Tire verisi). Riskli;
  hem `main` hem `master`'a push edilir.
- **Demo seed YOK** → doğrulama = `dotnet build` + FE `npm run build` + `npm run lint`.
  Veriye bağlı akışlar runtime'da E2E edilemiyor; kod + build + (varsa) ekran görseli.
- **Türkçe casing tuzağı (tekrar eden bug):** arama/filtrede default `toLowerCase()` Türkçe
  "İ"yi bozar → **her zaman `toLocaleLowerCase('tr')`** (hem sorgu hem haystack). Bkz.
  `hooks/useColumnFilters.ts`.
- **Tüm hata/validasyon mesajları Türkçe.**
- **Modallar `zoom` stacking-context içinde** (~0.81 scale). Tam ekran / her şeyin üstünde
  durması gerekenler `createPortal(..., document.body)`. Portal sonrası modal scale 1.0'a
  döner → **`max-h-[min(85dvh,52rem)]`** kullan, sabit `h-[..dvh]` DEĞİL (bkz. lessons.md).
- **Dropdown / DateTimePicker** overflow bar tarafından kırpılır → body'ye portal + `forceDown`.
- **Mobil genişliklerde (<1024 CSS px) desktop zoom uygulanmaz:** içerik/sidebar `zoom=1`
  kalmalı; aksi halde telefonlarda native dikey scroll ve form ölçekleri kırılır.

## 1. Görevler (Görevlerim / Tasks) — `pages/TasksPage.tsx`

- **Tamamlama notu PLAIN TEXT** saklanır (`CompleteTaskCommand`: `Notes = ResultNote`,
  düz `<textarea>`). RichText/HTML değil — `<p>` etiketi beklenmez.
- **Completed/Cancelled görev yeniden tamamlanamaz** (`CompleteTaskCommand` guard). Durumu
  geri almak için `ChangeTaskStatusCommand` var (card #1005): Completed/Cancelled görevi
  Yapılmakta(InProgress)/Tamamlanmış/İptal'e çeker; yetki = atanan veya SystemAdmin.
  Görevlerim'de Tamamlanmış + İptal görünümlerinde "Durum Değiştir" butonu (teal) tetikler.
  Görevlerim "Tüm Görevler" detay popup'ında terminal görevde sağ üstte "Durum Değiştir"
  görünür; "Yazışmaya Git" varsa solunda kalır ve pasif "Düzenle" placeholder'ı gösterilmez.
  Görevlerim "Tamamlanmış Görevlerim" ve "İptal Görevlerim" detay popup'ında ise
  "Durum Değiştir"in yanında "Düzenle" de aynı aktif/pasif edit mantığıyla görünür.
- **Personelimin Görevleri detay popup header'ı izleme odaklıdır:** sağ üstte "Görevi Yönlendir"
  ve "Görevi İptal Et" gösterilmez.
- **Görevlerim/Birimdeki Görevler grid `İşlemler` sütununda yalnız "Detaylar" kalır;**
  aksiyonlar detay popup header'ındadır ve eşdeğer buton varsa çoğaltılmaz. Birimdeki Görevler'de
  "Görevi Yönlendir" sadece Bekleyen/Son Tarihi Geçmiş detayında görünür (yönlendirilemeyende pasif),
  Tüm Görevler detayında "Görevi İptal Et" gösterilmez. Görevlerim gridlerinde actions kolonu
  tek butona göre dar ve "Detaylar" ortalıdır.
- **Birimdeki Görevler ve Personelimin Görevleri gridleri yatay alt scroll'a düşmemelidir;**
  fixed colgroup kullanır, actions kolonu tek `Detaylar` butonuna göre dar/ortalıdır.
- **Görevlerim/Birimdeki Görevler banner araması, gridde görünen "Bağlı Olduğu Talep No" değerini
  (`formatTaskJobDisplayNumber`, ör. `T-2026-328`) de tarar.**
- **"Görev Detayları" özet kartı, TasksPage (Görevlerim) ile JobsPage (Birime Gelen) arasında
  BİREBİR AYNI tutulur** (card 649/705). Birine alan eklersen diğerine de ekle.
- **Atanmış görev detay popup'ında `Öncelik` satırı gizlidir:** `Görev Tipi = Atanmış`
  olduğunda `Görev Detayları` altındaki Öncelik etiketi ve değeri görünmez; rutin görevlerin
  öncelik satırı korunur (card #1118).
- **AMA TasksPage "İlgili Talep Detayları" (üst-talep özeti) ile JobsPage "Talep Detayları"
  arasında "aynı tutulur" kuralı YOKTUR.** İkisi ayrı düşünülür.
- **İptal/İade buton mantığı:** yalnızca `ExternalUnit` görevlerde İade; internal/routine →
  yalnızca İptal. Label + skipChoose `jobRequestType`'a göre belirlenir, role'e göre DEĞİL.
- **`createdByDisplayName` = TALEP oluşturan** (`GetTasksQuery`, `job.CreatedByUserId`'den).
  Dikkat: JobQueries'te aynı isim FARKLI şey demek (bkz. §2).
- **Görev Sahibi gösterimi:** `assignedUserDisplayName ?? ownerDisplayName` (yönlendirme
  sonrası güncel atanan). `AssignTask` `OwnerUserId`'i değiştirmez, sadece `AssignedUserId`.
- **Görev Atama Geçmişi:** ilk atanan kullanıcıdan farklı bir kullanıcıya yönlendirme yoksa
  gösterilmez; varsa Tasks detayındaki Görev Detayları kartında Açıklama'nın sağında sütun olarak görünür.
- **Görev Detayları geçmiş kolonları:** Açıklama + Görev Atama Geçmişi + Durum Değişikliği
  Geçmişi birlikte görünürken sol "Görev No/Talep No" bilgi kolonları dar tutulur; geçmiş başlıkları
  tek satır kalacak kadar sağ panel alanı bırakılır.
- **CitizenRequestManager `Birimdeki Görevler`:** müdürlük ilişkisiyle değil, çalışabildiği
  birimlerle scoped edilir; backend+frontend yalnızca `JobCitizenRequestHelper` citizen görevlerini
  gösterir ve CRM bu görevlerde yönetici aksiyonlarını kullanabilir (card #1071).
- **Durum Değişikliği Geçmişi (TasksPage detayı, card #2/#1097):** `TaskDetailResponse.StatusChangeHistory`
  görevin TÜM audit'lerindeki `StatusAtEvent`'ten türetilir — yalnızca "Durum Değiştir" değil, Atandı→Yapılmakta
  gibi normal geçişler de dahil. Mantık: audit'ler zaman sırasıyla gezilir, `StatusAtEvent` bir öncekinden
  farklıysa bir geçiş kaydı çıkar. Eski audit zinciri ilk kaydı doğrudan yeni durumla başlatırsa
  Atandı→ilk durum geçişi sentetik görünür. Sadece Görevlerim detayında, Açıklama'nın sağında ek sütun
  (rutin görevlerde gizli); UI yalnızca **durum + tarih** gösterir (card #1095). Atama Geçmişi ile
  yan yana görünürse iki geçmiş başlığı da tek satıra sığacak şekilde geniş tutulur.
- **Görev Ekleri sütunu (Tasks detay):** tamamlanmış rutin olmayan görevde yalnızca gerçek görev eki varsa
  görünür; ek yoksa boş "Görev Ekleri" alanı hiç oluşmaz.

## 2. Talepler (Jobs) — `pages/JobsPage.tsx`

- **"Talep Detayları" Taleplerim / Birimden Giden / Birime Gelen'de ORTAK** render edilir.
  Birinde yaptığın değişiklik üçünü de etkiler.
- **`createdByDisplayName` semantiği JobQueries'te ≠ GetTasksQuery.** JobQueries görev
  projeksiyonunda = GÖREVİ oluşturan (onaylayan yönetici). Görüntülemede talep oluşturan
  isteniyorsa `detail.createdByDisplayName` (talep oluşturan) tercih edilir.
- **EF projeksiyonunda Response record'a opsiyonel alan eklerken TÜM pozisyonel argümanları
  ver** (CS9307: isimli/pozisyon-dışı argüman expression-tree'de çalışmaz). Diğer call-site'lar
  default `null` ile kalır.
- **Düzenle (UpdateJob):** terminal (Completed/Cancelled/Rejected) hariç düzenlenebilir;
  hedef-departman değişikliği yalnızca onay-öncesi durumda.
- **Onayla ve Personel Ata kullanıcı listesi:** atanabilir aktif kullanıcılar `Staff` +
  `Operator` + mevcut yönetici; hepsi seçilen/aktif departmanda çalışıyor olmalı. Operator kendi
  birim içi/dışı talebini görev olarak alabilmelidir (card #1086).
- **Vatandaş talepleri `requestType=ExternalUnit` + `sourceType=SocialMessage` olarak saklanır**
  (her job gibi bir `JobNumber`/T-'leri de vardır) ama görünen numara **VT-**'dir; VT numarası
  linkli `SocialMessage.CitizenRequestNumber`'da tutulur. Gridlerde citizen ise `formatJobDisplayNumber`
  VT- döndürür (T-'ye DÖNÜŞEMEZ). Düzenleme her zaman `kind=citizen` formunda yapılır
  (`getRequestEditPath` tüm roller için), kaydedince `returnTo=social` ile Vatandaş Talepleri'ne döner —
  Taleplerim'e düşmez (card #1077). Operator/CRM `Taleplerim` ayrıca VT kayıtlarını backend
  `mine` scope + frontend guard ile tamamen dışlar; bu ekran yalnızca birim içi/dışı standart
  talepler içindir (card #1081). `isCitizenRequestJob` = requestType Citizen ya da sourceType ∈
  {SocialMessage, CitizenRequest, EDevlet}.
- **Talep oluşturma yetki hatalarında kullanıcı metni "talep" der, "iş" değil**
  (`CreateJobCommand`, card #1079).
- **Adres girişleri mahalle kapılıdır:** talep/rutin/e-Devlet/Taleplerim düzenleme formlarında
  Cadde/Sokak/Bulvar ve Açık Adres alanları Mahalle seçilmeden aktif olmaz; mahalle temizlenirse
  alt adres alanları da temizlenir. Taleplerim terminal talep notu süreç satırında tekil **Not**
  linkidir; terminal tarih etiketinde `(İptal)`/durum parantezi basılmaz; Görev Detayları terminal
  not kopyasını tekrar göstermez (cards #1196/#1197/#1198).
- **Ekler / Fotoğraflar ortak bileşendir:** Talepler detay popup'larında düzenlenebilir ek alanı
  kompakt ataç ikonlu **Dosya ekle** butonu + sağda dosya listesi (`rich-list`) düzenini
  kullanır; "Dosyayı buraya sürükleyin" dropzone metni popup/ortak bileşene tekrar eklenmez.
  Talep Oluştur (birim içi/birim dışı/vatandaş) formları istisnadır ve eski drag/drop
  yükleme alanını korur. Tüm ek listesi
  modlarında ve geçici seçili dosya listelerinde doküman/görsel dosya ikonu uzantıya göre görünür;
  ikonlar küçük, dosya adı normal ağırlıkta/küçük/siyah/altı çizgisiz kalır. Sil aksiyonu
  hover beklemeden görünür ama yalnız gerçek düzenleme modu açıksa basılır; düzenlemeye
  basmadan görüntüleme yüzeyinde görünmez. Taleplerim detayında `Dosya ekle` butonu da
  yalnız `Düzenle` modu açıkken görünür. Boyut bilgisi gizli kalır
  (cards #1199/#1200/#1201/#1204/#1208/#1211).
- **Süreç onay tarihleri:** `Talebin Birim Yöneticisinin Onay Tarihi` ve `Talebi Gerçekleştiren
  Birim Yöneticisinin Onay Tarihi` etiketleri sade kalır; onaylayan yönetici adı varsa tarih
  değerinin yanında parantez içinde, küçük ve yeşil renkte gösterilir. Manager/SystemAdmin/Reporter
  rolünde Süreç altında owner approval (`Talebin Birim Yöneticisinin Onay Tarihi`) satırı
  gösterilmez. Standart kullanıcıda owner approval bekliyorsa `Onay Bekleyen` değeri turuncu
  görünür ve yanında parantez içinde `statusActorDisplayName` yönetici adı yine turuncu gösterilir.
  Süreç timeline'ında ayrı `Durum` step'i gösterilmez (cards #1212/#1213/#1214/#1215/#1216/#1215-reopen).
- **Taleplerim detay ana kartı:** `Açıklama` kolonunun arka planı ekran görselindeki soluk
  nötr yüzeyle aynı kalır; yalnız başlık değil, açıklama panelinin tamamı bu yüzeyi taşır
  (card #1217). Detay popup üstündeki `Taleplerim` başlığı geniş harf aralıklı açık gri kalır;
  header başlığı, modal gövde içeriğiyle aynı sol hizada başlar. Kart içi `Süreç` ve `Açıklama`
  başlıkları alt kart başlıklarıyla aynı hafif ağırlıkta kalır; bold yapılmaz. Süreç yuvarlakları
  görsel referanstaki gibi açık zeminli/halkalı görünür; tamamlanan adım katı yeşil disk değildir;
  tamamlanan adımdan güncel turuncu adıma giden çizgi yumuşak yeşil→turuncu geçişli kalır.
  Ana kart `Talep Detayları` başlığı title-case, yeşil, orta boy ve bold görünür; CSS uppercase
  zorlaması uygulanmaz. Header satırında üst boşluk payı korunur; başlık modalın üst kenarına
  yapışmaz. Düzenleme modunda ana kartın ilk satırı açıklama editörü yüzünden gereksiz uzamaz;
  açıklama editörü kompakt kalır (cards #1218/#1220/#1221/#1222/#1223/#1238/#1244).
- **Taleplerim/Vatandaş Talebi detay alt kartları:** `Talebin Gittiği Birim / Görevi Yapan`
  etiketi atanmış kullanıcı yoksa değer kısmında `Birim / -` gösterir; `Adres Bilgileri`
  içinde `Açık Adres`, `Cadde / Sokak / Bulvar` ile aynı satır akışındadır; `Ekler / Fotoğraflar`
  kart zemini `Açıklama` paneliyle aynı soluk nötr yüzeyi kullanır (cards #1259/#1260/#1261).
- **Düzenle ikonları:** Metinli veya ikon-only `Düzenle` aksiyonları lucide `PenLine` ikonunu
  kullanır; eski `Pencil`/`SquarePen` ikonları edit aksiyonlarında geri getirilmez (card #1219).
- **Gridview terminal tarih renkleri:** Gridlerde `Tamamlanma Tarihi` değerleri yeşil,
  `İptal Tarihi` değerleri kırmızı gösterilir; `Son Tarih` ve süresi geçmiş son tarih
  davranışına bu renklendirme uygulanmaz (card #1243).
- **WhatsApp konuşma aksiyon ikonları:** WhatsApp konuşmaları alt aksiyonlarında `Talep oluştur`
  ve `Şablon mesajlar` ikonları yeşil kalır; buton metinleri yeşile boyanmaz (card #1245).
- **Taleplerim adres detay etiketleri:** `Adres Bilgileri` altındaki `Mahalle`,
  `Cadde / Sokak / Bulvar` ve `Açık Adres` etiketleri değerlerden bağımsız daha büyük okunur;
  adres değerlerinin font boyutu değiştirilmez (card #1246).
- **Talep oluştur adres girişleri:** Birim içi, birim dışı ve vatandaş talebi oluşturma
  formlarında `Cadde / Sokak / Bulvar` input değer fontu `Açık Adres` textarea değeriyle
  aynı okunurlukta kalır; açık adres değeri özellikle küçük düşürülmez (card #1247).
- **Birim içi talep oluşturma alan sırası:** `Talep Başlığı`ndan sonra `Görevi Yapan Kişi/Birim`
  gelir; `Öncelik / Bitiş Tarihi / Proje niteliğinde mi?` satırı bunun altında kalır (card #1250).
- **Vatandaş talebi sahip birime de yönlendirilebilir (card #1090):** `CreateJobCommand`
  hedef listesinden sahip birimi yalnızca NON-citizen (birim içi/dışı) taleplerde ayıklar;
  vatandaş kaynaklı (`RequestType==Citizen` veya `SourceType ∈ {SocialMessage,CitizenRequest,EDevlet}`)
  taleplerde owner=target korunur (FE `CitizenRequestModal`/`CreateRequestPage` de sahip birimi listede tutar).
  Owner=target citizen talebinde JobDepartment hem Owner(Approved) hem Target(Pending) satırı alır; onay
  sorgusu `Role==Target` filtrelediği için çakışmaz.
- **Görev durum değişikliği talebin İptal Notu'na yansır (card #3):** `ChangeTaskStatusCommand`
  görevi iptal edip talebi `Cancelled/Rejected`'a düşürdüğünde `job.CancelReason = reason` yazar
  (tamamlama notu zaten `JobQueries` tarafından tamamlanan görevin `Notes`'undan türetilir).
- **`RecomputeJobCompletionAsync` çoğu terminal geçişini yapar; `Completed` talebi tüm görevler
  iptal edildiğinde `Cancelled`'a düşürür (card #1044). Karışık terminal durumda (tamamlanmış +
  iptal görev bir arada) talep `Active`'e geri alınır. Bir görevi terminal'den non-terminal'e
  (InProgress) geri alırsan ve recompute hâlâ terminal bırakıyorsa komutta manuel
  `JobStatus.Active` + `CompletedAtUtc=null` yap (bkz. `ChangeTaskStatusCommand`, card #1005).

## 3. WhatsApp / Sosyal mesaj — `ConversationPanel`, `CitizenRequestModal`, `WhatsAppConversationModal`

- **WhatsApp yanıtları "Beklemede" kuyruğa girer; iletme yetkisi yalnızca operatördedir (card #1091).**
  `ReplyToSocialMessageCommand` WhatsApp kanalında mesajı GÖNDERMEZ, `DeliveryStatus=Pending` entry
  oluşturur (diğer kanallar eskisi gibi anında gider). Gerçek gönderim `SendPendingConversationEntryCommand`
  (`POST /social/messages/{id}/conversation/{entryId}/send`) ile yapılır; yetki = `Operator` veya
  `SystemAdmin` (`ForbiddenAccessException`). Mesaj `Responded`'a yalnızca gerçek gönderimde geçer.
- **`ConversationPanel.canReply` default `true`; `canSendPending` ile "Mesajı Gönder" butonu.**
  Operatör görünümleri (`CitizenRequestModal`, `WhatsAppConversationsPage`) `canSendPending`'i operatör/
  SystemAdmin rolüne göre verir → beklemedeki giden balonun altında buton. Görev/talep bağlamından açılan
  `WhatsAppConversationModal` artık yazabilir (`canReply`) ama `canSendPending=false` (yönetici/personel
  yalnızca kuyruğa yazar, iletemez). (Eskiden salt-okunurdu — card #1091 değiştirdi.)
- **24 saat pencere uyarı metni gösterilmez:** `/whatsapp` konuşma footer'ında
  pencere durumunu anlatan açıklama satırı render edilmez.
- **"Mesajı Gönder" onay pop-up'ı + "Düzenle" (card #1094/#1096):** gönder butonu önce `ConfirmDialog`
  gösterir; başlıkta metin altı çizilmez, modal konvansiyonundaki başlık-altı ayraç çizgisi kullanılır.
  Onaylanınca iletir. Yanında turuncu "Düzenle" → balon metni
  yerinde textarea ile düzenlenir (`EditPendingConversationEntryCommand`, `POST .../conversation/{entryId}/edit`,
  yetki Operator/SystemAdmin, yalnızca Pending+Outbound). Düzenlenen bekleyen mesajlarda `EditedAtUtc` doludur
  ve hem sosyal mesaj konuşmasında hem `/whatsapp` konuşma detayında "Beklemede" solunda turuncu
  "Düzenlendi" etiketi görünür. Operatör aksiyon butonları (`Düzenle`/`Mesajı Gönder`)
  daha yüksek `py-1.5` pill görünümünü ve gönderim sırasında pasif (`disabled`, opacity + not-allowed cursor)
  durumunu korur. Gönderim başarısız olsa bile API 204 döner, konuşma refresh olur ve balon
  `Failed`="İletilemedi" gösterir; 404 sadece mesaj/entry bulunamadığında döner.
- **WhatsApp konuşma balonu sender label:** personel adı soyadı kısaltılmaz; backend `FormatStaffLabel`
  tam `DisplayName` yazar. Frontend eski `Dept / Name` biçimini `Dept · Name` yapar ve eski
  `Vatandaş O.` kayıtlarını `Vatandaş Operatörü` olarak gösterir.
- **WhatsApp konuşma detay header zemini:** seçili konuşmanın üst bilgi şeridi breadcrumb `Anasayfa`
  yüzeyiyle aynı açık `slate-50` zemininde kalır; chat mesaj alanı ayrı WhatsApp dokulu zemindir
  (card #1252).
- **WhatsApp breadcrumb ve konuşma başlığı:** Breadcrumb'daki `WhatsApp` pill'inin başında
  WhatsApp ikonu görünür; konuşma detay header'ında telefon altına `WhatsApp Konuşmaları`
  fallback subtitle'ı basılmaz (cards #1253/#1254).
- **Durum Değişikliği Geçmişi yalnızca durum + tarih gösterir** (neden/aktör kaldırıldı — card #1095);
  veri yine `TaskStatusChanged` audit'inden türer.
- **`CitizenRequestModal` sağ form sırası:** Açıklama rich-text alanı Talep Başlığı satırının
  hemen altında gelir; adres ve dosya alanları açıklamadan sonra kalır (card #1082).
- **`CitizenRequestModal` adres/dosya yerleşimi:** Mahalle + Cadde satırından sonra Açık Adres
  ve Dosya/Fotoğraf alanı aynı satırda yan yana durur; dosya seçilmedi metni butonla aynı blokta
  sığar (card #1088).
- **`CitizenRequestModal` edit mode:** Vatandaş Talep No, "Vatandaş Adı / Gönderen" alanının
  üstünde turuncu ve altı çizili başlık olarak gösterilir (card #1083).
- **Vatandaş `Yazışmaya Git` butonu:** Vatandaş Talepleri gridindeki aksiyon butonu mevcut teal
  tonda kalır; Jobs/Tasks detay modallarındaki aynı buton açık mavi görünür.
- **Vatandaş Talepleri grid aksiyonları:** Gridde `Son Tarih` sütunu gösterilmez; `İşlemler`
  kolonunda yalnız `Detaylar` kalır. Yazışmaya Git / Düzenle / İptal aksiyonları detay popup
  header'ında görünür (card #1255).
- **Vatandaş Talebi detay düzenleme:** Detay popup'ta `Düzenle` aktifken `Ekler / Fotoğraflar`
  bölümünde `Dosya ekle` görünür; salt okunur modda ekleme aksiyonu gizli kalır (card #1256).
- **Job status değişince `ICitizenJobStatusNotifier` otomatik vatandaş mesajı atar**
  (İşleme Alındı / Yapılmakta / Tamamlandı). Varsayılan mesajda VT no'dan sonra talep başlığı
  yer alır ve metinler tenant `CitizenAutoReplyTemplatesJson` ayarından değiştirilebilir
  (cards #1257/#1258).
- **RichText `&nbsp;` çift-kodlama tuzağı:** `RichTextContent.normalizeNbsp` ile çözüldü;
  rich-text (`dangerouslySetInnerHTML`) ve plain-text dalları ayrı işlenir (card 551).

## 4. Modallar / UI bileşenleri

- **`.inline-actions` (globals.css) `justify-content` taşımaz → sola dayalı.** Küçük modalda
  butonları sağa istiyorsan açıkça `justify-end`.
- **Modal başlığı altı ayraç konvansiyonu:** `mb-3 border-b border-slate-200 pb-2`
  (örnek: "Görevi Birim İçi Yönlendir" başlığı, TasksPage).
- **Grid'ler boş filtrede başlığı korur:** tabloyu HER ZAMAN render et, boş mesajı `tbody`
  satırı olarak göster (Jobs/Tasks/Incoming).
- **Sarı `.row-attention` grid satırlarında `table-number-cell__priority` siyah kalır**;
  öncelik renk paleti amber zemin üzerinde kullanılmaz (card #1084).
- **Ortak bileşenleri kullan:** `DueDatePill`, `DateCell`, `FilterableTh`,
  `SingleSelectDropdown` (openUp), `StatusPill`, `ChannelIcon`. Yeni grid kolonunda yeniden icat etme.
- **Breadcrumb parent segmentlerinde her ifade kendi ikonunu taşır:** ör. `Birimdeki Görevler`,
  `Vatandaş Talepleri`, `Yönetim` gibi ara segmentler metinden önce ilgili lucide ikonunu gösterir
  (card #1251).
- **Login logosu HER ZAMAN `/tire-belediyesi-logo.png`** (LoginPage `LOGIN_LOGO_*_SRC`) —
  tenant `appearance.logoUrl` ile override edilmez.
- **Sol menüde `/whatsapp` alt linki `SidebarNavLinkItem.emphasized` ile biraz büyük ve sola
  taşınmış kalır**; metin tam sığmalı, tüm sidebar font/zoom ölçeğini değiştirerek diğer
  menüleri büyütme (card #1085).
- **WhatsApp `Şablon mesaj ekle` aksiyonunda yalnızca baştaki `+` ikonu yeşildir; buton metni
  nötr slate renginde kalır** (card #1245).
- **Talep oluşturma formlarında adres `Cadde / Sokak / Bulvar` input metni aynı formdaki `Açık Adres`
  textarea metin ölçüsüyle eşleşir**; ana oluşturma sayfası ve WhatsApp vatandaş modalı kompakt
  ölçüleri ayrı korunur (card #1247).
- **Birim içi/dışı/vatandaş talep oluşturma formlarının input/dropdown yükseklikleri kompakt
  tutulur**; genel `.field-input` / `.field-select` ölçeği bu istek için değiştirilmez (card #1249).
- **Birim içi talep oluşturma `Bitiş Tarihi` picker'ı yukarı açılır**; diğer tarih picker'larının
  yönü kart istemeden değiştirilmez (card #1248).
- **Taleplerim detayında düzenleme modundaki `Talep Başlığı` çok satırlı textarea olarak sarar ve
  aşağı doğru büyür; yatay scroll/input kayması geri getirilmez** (card #1232).

## 5. Dashboard / Wallboard

- **Banner buton sayımları client-side hesaplanır; dashboard'da bu aggregation YOK.**
  "Banner sayımına bağlı grafik" istekleri yeni backend aggregation gerektirir (#731 bu
  yüzden ertelendi).
- **Dashboard pie chart'ları sıfır veride de görünür kalmalı:** `showZeroSlices` kullanılan
  grafiklerde tüm dilimler 0 olsa bile nötr donut + sıfır lejant gösterilir; kart boş/çökmüş
  görünmez.
- **Dashboard status pie chart query'si görev→talep kaynak tipini navigation property'ye güvenmeden
  üretir:** chart endpoint'i orphan/eksik ilişki veya provider translation yüzünden tüm paneli
  hata banner'ına düşürmemeli (card #1251).
- **Wallboard layout:** fixed-height flex (`100dvh`, `overflow:hidden`), hero+stats
  `shrink-0`, table-shell `flex:1 min-h:0`, pagination pinned, scroll tablo içinde; tablo
  başlıkları scroll sırasında sticky kalır ve eski sürekli header gradient rengi korunur.
- **Wallboard görev kaynağı:** "Ekrana Yansıt" listesinde rutin görevler gösterilmez; yalnız
  açık durumdaki numaralı rutin olmayan görevler listelenir. Vatandaş talebinde Oluşturan satırının
  başında kanal ikonu görünür; vatandaş satırı için özel renk veya sıra numarası şeridi kullanılmaz.
- **"Ekrana Yansıt" görseli = `/header-ataturk.png`** (kurum arması/cresti değil).

## 5b. Bildirimler (Notifications)

- **Bildirim feed'i `GetNotificationsQuery`'de AuditLog'lardan TÜRETİLİR** (workflow olayları
  için kalıcı `Notification` satırı yok; gerçek push bildirimleri ayrı). Yeni bildirim
  davranışı eklemek = audit→`NotificationResponse` projeksiyonunu değiştirmek. Başlık
  `ActionTitle(audit.Action)`'tan; mesaj `messageParts`'tan gelir.
- **Aktörün kendi olayları feed'den çıkarılır** (`a.ActorUserId == userId` → skip, card #1063);
  görev-durum değişikliğinin talebe yansıyan yan-etki audit'i de gizlenir
  (`IsJobStatusSideEffectOfTaskChange`, #1068). Yeni audit eklerken bu filtreleri kır(ma).
- **`titleTag`** (NotificationResponse): job bildiriminde veya görev-durumu bildiriminde bağlı
  talebi Reporter oluşturmuşsa başlık yanında turuncu birim adı; Operator vatandaş talebiyse
  birim adı yerine statik turuncu `Vatandaş Talebi` yazılır ve mesajda operatör adı + VT no +
  talep başlığı kullanılır. Lookup GUID üzerinden yapılır, `Guid.ToString()` DB filtresine dayanmaz
  (cards #1072/#1078/#1087).

## 6. Tenant / Auth

- **Tenant çözümleme önceliği:** `X-Tenant-Id` header > `CustomDomain` (Host) > `SingleTenant`
  (tek aktif) > `ManualSelection`.
- **OpenIddict stateless password flow; refresh token YOK; access token 8 saat.**
- **`RoleCode` → Türkçe etiket (kartlar bu adları kullanır):** `Reporter` = "Üst Düzey Yönetici",
  `Operator` = "Vatandaş Talep Operatörü", `CitizenRequestManager` = "Vatandaş Talep Yöneticisi",
  `Manager` = "Müdür". CRM scoped rol — detay [`authorization-matrix.md`](authorization-matrix.md) §1.1.
- **CitizenRequestManager talep oluşturabilir:** birim içi/dışı taleplerde Staff gibi yalnızca kendi
  çalışabildiği sahip birimle açar ve sahip birim onayına düşer (card #1080).
- Detay: [`adaptive-auth-20260322.md`](adaptive-auth-20260322.md), [`authorization-matrix.md`](authorization-matrix.md).
