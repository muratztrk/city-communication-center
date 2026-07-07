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
- **Mobil sayfalarda kabuk/login dikey scroll'u kesmemeli:** `overflow-hidden` yalnız desktop
  breakpoint'lerinde kullanılmalı; iki kolonlu/split panel yerleşimleri telefonda alt alta akmalı.
- **Banner başlığının (2. satır) ağırlığı kontrollü kalır:** `.sticky-page-header .page-title`
  `font-weight: 600` kullanır; Talep Oluştur tür seçim kartları (`Birim İçi/Birim Dışı/Vatandaş Talepleri`)
  `font-semibold` seviyesinde kalır, `font-bold`/`font-extrabold`'a geri alınmaz.
- **Mobil filtre/çip satırları tek satıra zorlanmaz:** telefonlarda çipler ve banner filtreleri
  iki eşit kolonlu grid'e akar, bir satıra en az iki buton sığar; banner filtrelerinde arama
  kutusu tam satırdır, başlangıç/bitiş tarihleri aramanın altında iki eşit kolon olarak yan yana durur
  ve filtre grubu banner içinde sola hizalı kalır; aralarında tire/çizgi gösterilmez. Desktop banner
  tarih aralığında başlangıç ve bitiş tarihi arasında `-` ayırıcısı tam ortada görünür. Mobil gridview tablo yazıları/padding'i desktop ölçeğinden
  daha kompakt kalır. Detay modal formları tek kolon akar.
- **Banner arama input metni:** banner ve bildirim modalındaki search textbox boyutu büyümez; iç metin
  0.8rem+ ve yarı-kalın (`font-weight:600`) kalır, font family gridview Başlık metniyle aynı
  `var(--font-sans)` olur; `letter-spacing:0` ve kontrollü line-height korunur, placeholder/ikon
  yeşil banner üstünde okunur kalır.
- **Mobil detay popup başlıkları aksiyonlarla çakışmaz:** talep/görev detay header'ında başlık alanı
  esnek kalır; sağ üst aksiyonlar küçük, wrap edebilir butonlar olarak durur. Dashboard pie chart
  drilldown popup'ında pagination bar yatay scroll içinde gridview genişliğiyle aynı genişliktedir.
- **Mobil detay popup yazdır aksiyonu:** telefon breakpoint'inde talep/görev detay header'ındaki
  tüm `Yazdır` butonları gizlidir; desktop/tablet print aksiyonları korunur.
- **Yazdır popup'ı ağ erişimi açmaz:** `printHtmlDocument` yazdırma penceresine CSP enjekte eder
  (`default-src 'none'`) ve `opener` bağlantısını keser; print HTML'i app/API/local network
  kaynaklarına istek atamaz.
- **Global font `@fontsource/<font>` importları kullanılan TÜM font-weight'leri kapsamalı:**
  `main.tsx`'te yalnız birkaç ağırlık yüklenirse `font-normal`/`font-extrabold` gibi eksik
  ağırlıklardaki metinler tarayıcı fallback fontuna düşer (görünüşte "font değişmemiş" gibi görünür).
  Font tarihçesi: PJS → Inter (Round 177) → geri **Plus Jakarta Sans 500/600/700** (Round 182,
  "ilk haline getir"). `tokens.css` `--font-sans`/`--font-display` ve `main.tsx` import'ları birlikte
  güncellenmeli, kullanılmayan fontun `@fontsource` paketi kaldırılmalı (dead weight bırakma).
- **Koyu zeminde (Wallboard gibi) ortak açık-tema bileşeni (`ReporterDepartmentName` vb.) kullanılıyorsa
  bileşenin varsayılan `text-slate-*` utility'si, sarmalayan sayfanın kendi rengini `!important` olmadan
  ezemez** (Tailwind utility > custom class); wallboard-request-location bu yüzden `!important` gerektirdi.
- **İki kardeş `inline-flex` div üst üste değil yan yana dizilir:** dikey stack beklenen (örn. birim adı +
  oluşturan adı) iki blok, ikisi de `inline-flex` ise satır içi gibi davranıp yan yana yapışır — `flex`
  (block-level) kullan (card #1313 reopen, `ReporterDepartmentName` + `.wallboard-creator-line`).
- **Metin değişikliği kartlarında önce LOCALE dosyasını düzelt, t() fallback'ini değil:** kod içi
  `t('key', 'fallback')` ikinci argümanı yalnız anahtar locale'de yokken görünür; anahtar
  `locales/tr/common.json`'da varsa oradaki metin kazanır (card #1308 reopen, `searchPlaceholderExtended`).
- **Bildirim başlıkları generic `İşlem gerçekleşti` göstermez:** audit action mapping eksikse
  `GetNotificationsQuery.ActionTitle` entity/action tipine göre en az `Talep güncellendi` /
  `Görev güncellendi` gibi anlamlı bir başlığa düşer.
- **Departman adı form/grid etiketi public UI'da `Birim Adı`dır:** `departments.name` ve placeholder
  `Birim adı` dilini kullanır; eski `Departman Adı` metni geri gelmez.
- **Grid header hücrelerine `pl-3` gibi küçük padding utility'si EKLEME:** `.data-table thead th`
  varsayılanı `--table-chrome-row-px: 1rem`'dir; 1rem altı bir utility (utilities katmanı kazandığından)
  padding'i düşürür. "Boşluk ekle" isteğinde 1rem'den büyük değer kullan (`pl-6` vb.) (card #1329 reopen).

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
- **Yönlendirilmiş dış birim talebinden oluşturulan görevlerde**, görev gridindeki `Bağlı Olduğu Talep No`
  değerinin alt satırında koyu turkuaz `(Yönlendirilen Talep)` etiketi görünür ve bu hücre ortalı kalır; görev
  detayındaki `İlgili Talep Detayları > Talep No` satırında `Birim Dışı` etiketinden sonra aynı
  rozet görünür. Aynı kartta hedef departman `Notes` değeri `Talebin Yönlenme Sebebi` olarak koyu
  turkuaz `Talebi Yönlendiren Birim • sebep` formatında gösterilir.
- **"Görev Detayları" özet kartı, TasksPage (Görevlerim) ile JobsPage (Birime Gelen) arasında
  BİREBİR AYNI tutulur** (card 649/705). Birine alan eklersen diğerine de ekle.
- **Atanmış görev detay popup'ında `Öncelik` satırı gizlidir:** `Görev Tipi = Atanmış`
  olduğunda `Görev Detayları` altındaki Öncelik etiketi ve değeri görünmez; rutin görevlerin
  öncelik satırı korunur (card #1118).
- **AMA TasksPage "İlgili Talep Detayları" (üst-talep özeti) ile JobsPage "Talep Detayları"
  arasında "aynı tutulur" kuralı YOKTUR.** İkisi ayrı düşünülür.
- **TasksPage "İlgili Talep Detayları" alanı Taleplerim detay kart düzenini kullanır:**
  ana kart 3 kolon (`Talep Başlığı` + `Talep Bilgileri` + `Adres Bilgileri`) olarak görünür;
  talep açıklaması bu görev popup'ındaki ilgili talep özetinde basılmaz, süreç/manager note/ekler alt kartlarda kalır
  ve yönlendirilmiş talep rozeti + sebep satırı korunur.
- **İptal/İade buton mantığı:** yalnızca `ExternalUnit` görevlerde İade; internal/routine →
  yalnızca İptal. Label + skipChoose `jobRequestType`'a göre belirlenir, role'e göre DEĞİL.
- **`createdByDisplayName` = TALEP oluşturan** (`GetTasksQuery`, `job.CreatedByUserId`'den).
  Dikkat: JobQueries'te aynı isim FARKLI şey demek (bkz. §2).
- **Görev Sahibi gösterimi:** `assignedUserDisplayName ?? ownerDisplayName` (yönlendirme
  sonrası güncel atanan). `AssignTask` `OwnerUserId`'i değiştirmez, sadece `AssignedUserId`.
- **Görev Atama Geçmişi:** ilk atanan kullanıcıdan farklı bir kullanıcıya yönlendirme yoksa
  gösterilmez; varsa Tasks detayındaki Görev Detayları kartında Açıklama'nın sağında sütun olarak görünür.
- **Görev Detayları durum değişikliği özeti:** Durum değiştiyse `Görev Bilgileri` altında
  `Durum Değişikliği` satırı ilk durum → son durum şeklinde görünür; durum metinleri normal ağırlıkta,
  tarihleri saniyesiz ve durumların altında ortalıdır. `İptal`/iade kırmızı, `Yapılmakta` turuncu,
  `Tamamlanmış` yeşil metindir.
- **Görev Detayları geçmiş kolonları:** Açıklama + Görev Atama Geçmişi birlikte görünürken sol
  "Görev No/Talep No" bilgi kolonları dar tutulur; geçmiş başlıkları tek satır kalacak kadar sağ panel alanı bırakılır.
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
- **Adres alan limitleri:** Cadde / Sokak / Bulvar tüm giriş yüzeylerinde en fazla 50 karakter,
  Açık Adres en fazla 100 karakterdir; backend komut validasyonları da aynı sınırı korur.
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
  Süreç timeline'ında ayrı `Durum` step'i normalde gösterilmez; istisna olarak birim yöneticisinin
  oluşturduğu birim içi aktif taleplerde Talep Tarihi ile Son Tarih arasında turuncu `Durum / Yapılmakta`
  step'i gösterilir (cards #1212/#1213/#1214/#1215/#1216/#1215-reopen/#1275).
- **Taleplerim detay ana kartı:** `Açıklama` kolonunun arka planı ekran görselindeki soluk
  nötr yüzeyle aynı kalır; yalnız başlık değil, açıklama panelinin tamamı bu yüzeyi taşır
  (card #1217). Detay popup üstündeki `Taleplerim` başlığı Görevlerim detay popup sol üst
  başlığından biraz büyük kalır (`0.8125rem`, `font-weight:800`,
  `letter-spacing:0.18em`, slate-600);
  header başlığı, modal gövde içeriğiyle aynı sol hizada başlar. Kart içi `Süreç` ve `Açıklama`
  başlıkları alt kart başlıklarıyla aynı hafif ağırlıkta kalır; bold yapılmaz. Süreç yuvarlakları
  görsel referanstaki gibi açık zeminli/halkalı görünür; tamamlanan adım ve tamamlanmış çizgi
  `Düzenle` butonundaki emerald-700 yeşiliyle eşleşir; tamamlanan adımdan güncel turuncu adıma
  giden çizgi hedefin %50 hizasına kadar yeşil kalır, sonra ara renk bandı eklemeden yeşil ile
  turuncu karışarak geçiş yapar; güncel turuncu adımdan gri gelecek adıma giden çizgi de %50
  hizasından sonra koyu turuncudan griye belirgin açılır. Yeşilden kırmızıya terminal çizgi
  geçişinde ara turuncu bant kullanılmaz; doğrudan yeşil→kırmızı akar.
  Ana kart `Talep Detayları` başlığı title-case, yeşil, orta boy ve bold görünür; CSS uppercase
  zorlaması uygulanmaz. Header satırında üst boşluk payı korunur; başlık modalın üst kenarına
  yapışmaz. Düzenleme modunda ana kartın ilk satırı açıklama editörü yüzünden gereksiz uzamaz;
  açıklama editörü kompakt kalır (cards #1218/#1220/#1221/#1222/#1223/#1238/#1244).
  Talep başlığı yanındaki meta bloğu başlık metnine değil, sol kartın sağ border çizgisine hizalanır;
  en sağda iki satırdır: üstte talep no, altında `Birim İçi/Birim Dışı` rozeti.
  Taleplerim detay popup gövdesi desktopta referans görseldeki gibi geniş ama kontrollü kalır:
  yaklaşık `70.25vw` / `84.3rem` genişlik ve `80.7dvh` / `46.85rem` yükseklik.
  JobsPage/TasksPage detay popupları da aynı ortak `.detail-modal-shell` ölçüsünü kullanır;
  detay modal boyutlarını sayfa bazında yeniden ayrıştırma.
  `Öncelik / Proje Niteliğinde mi?` değerindeki ayraç, süreç timeline tarih-saat ayracıyla
  aynı küçük nokta bileşenini kullanır; düz `·` karakterine dönmez.
- **Taleplerim/Vatandaş Talebi detay alt kartları:** `Talebin Gittiği Birim / Görevi Yapan`
  etiketi tek satır kalır ve atanmış kullanıcı yoksa değer kısmında `Birim / -` gösterir; `Adres Bilgileri`
  içinde Mahalle, `Cadde / Sokak / Bulvar` ve `Açık Adres` üçlü yan yana durur; adres etiketleri
  kendi içinde satır kırmaz (`Bulvar` alt satıra düşmez); `Ekler / Fotoğraflar`
  kart zemini, Adres kartı değil, `Açıklama` paneliyle aynı soluk nötr yüzeyi kullanır (cards #1259/#1260/#1261).
- **Talep terminal not popup başlıkları:** Talep iptalse `Not` linki popup başlığı `İptal Notu`,
  tamamlanmışsa `Tamamlanma Notu` açar; generic `Not` başlığına geri dönmez (card #1264).
- **Düzenle ikonları:** Metinli veya ikon-only `Düzenle` aksiyonları lucide `PenLine` ikonunu
  kullanır; eski `Pencil`/`SquarePen` ikonları edit aksiyonlarında geri getirilmez (card #1219).
- **Gridview terminal tarih renkleri:** Gridlerde `Tamamlanma Tarihi` değerleri yeşil,
  `İptal Tarihi` değerleri kırmızı gösterilir; `Son Tarih` ve süresi geçmiş son tarih
  davranışına bu renklendirme uygulanmaz (card #1243).
- **Birime Gelen > Tamamlanmış grid başlığı:** yalnız bu görünümdeki `Tamamlanma Tarihi`
  `FilterableTh` başlığında küçük sol boşluk bulunur; genel grid header padding'i değiştirilmez.
- **Ek süre talebi grid işaretleri:** aktif talep/görevde işaret `Son Tarih` altında, tamamlanmışta
  `Tamamlanma Tarihi` altında, iptal/reddedilmişte `İptal Tarihi` altında görünür; `Tümü` görünümünde
  terminal satırlarda durum hücresinin altında aynı marker kullanılır. Ek süre isteği/onay/red sonrası
  görev grid satırı liste yenilemeyi beklemeden marker alanlarını optimistik günceller.
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
- **Yönlendirilmiş dış birim talebi tekrar yönlendirilemez:** hedef `JobDepartment.Notes`
  doluysa Birime Gelen detayında `Talebi Yönlendir` butonu çıkmaz; grid Talep No yanında koyu
  turkuaz `(Yönlendirilen Talep)` rozeti görünür. Detay `Talebin Yönlenme Sebebi` değerinde
  yönlendiren birim + yönlenme sebebi koyu turkuaz ama bold olmayan metinle gösterilir.
- **`RecomputeJobCompletionAsync` çoğu terminal geçişini yapar; `Completed` talebi tüm görevler
  iptal edildiğinde `Cancelled`'a düşürür (card #1044). Karışık terminal durumda (tamamlanmış +
  iptal görev bir arada) talep `Active`'e geri alınır. Bir görevi terminal'den non-terminal'e
  (InProgress) geri alırsan ve recompute hâlâ terminal bırakıyorsa komutta manuel
  `JobStatus.Active` + `CompletedAtUtc=null` yap (bkz. `ChangeTaskStatusCommand`, card #1005).

## 3. WhatsApp / Sosyal mesaj — `ConversationPanel`, `CitizenRequestModal`, `WhatsAppConversationModal`

- **WhatsApp yanıtları "Beklemede" kuyruğa girer; iletme yetkisi yalnızca operatördedir (card #1091).**
  `ReplyToSocialMessageCommand` WhatsApp kanalında varsayılan olarak mesajı GÖNDERMEZ, `DeliveryStatus=Pending` entry
  oluşturur (diğer kanallar eskisi gibi anında gider). `ICitizenJobStatusNotifier` tarafından üretilen
  WhatsApp durum cevapları da aynı kuyruğa girer; tamamlandı/iptal cevapları vatandaş operatörü
  onaylamadan iletilmez. Terminal not butonları yalnız ilgili bekleyen mesaj terminal durumu
  (`Tamamlandı/Tamamlanmış` veya `İptal/İptal Edildi`) içeriyorsa görünür; ara durum
  (`İşleme Alındı`, `Yapılmakta`) mesajlarında görünmez. Gerçek gönderim `SendPendingConversationEntryCommand`
  (`POST /social/messages/{id}/conversation/{entryId}/send`) ile yapılır; yetki = `Operator` veya
  `SystemAdmin` (`ForbiddenAccessException`). Mesaj `Responded`'a yalnızca gerçek gönderimde geçer.
  İstisna: `/whatsapp` konuşma footer'ından vatandaş operatörünün yazdığı direkt mesaj
  `sendImmediately=true` ile gider ve balonda `Düzenle`/`Mesajı Gönder` bekleyen aksiyonları üretmez.
- **WhatsApp `/whatsapp` dosya eki gerçek medya gönderimidir:** `Dosya ekle` seçimi yalnız dosya adını
  metne eklemez; önizleme balonu yerel görsel/dosya kartı gösterir, gönderimde multipart
  `POST /social/messages/{id}/reply/attachment` çağrılır, backend WhatsApp Cloud API'ye medya yükleyip
  dönen `MediaId`/`MediaMimeType` değerlerini konuşma entry'sine yazar. Eski `/reply` endpoint'ine
  `[Dosya eki: ...]` metniyle gelen WhatsApp direkt gönderimleri reddedilir; aksi halde açılabilir medya
  olmadan sahte "Gönderildi" balonu oluşur.
- **`ConversationPanel.canReply` default `true`; `canSendPending` ile "Mesajı Gönder" butonu.**
  Operatör görünümleri (`CitizenRequestModal`, `WhatsAppConversationsPage`) `canSendPending`'i operatör/
  SystemAdmin rolüne göre verir → beklemedeki giden balonun altında buton. Görev/talep bağlamından açılan
  `WhatsAppConversationModal` artık yazabilir (`canReply`) ama `canSendPending=false` (yönetici/personel
  yalnızca kuyruğa yazar, iletemez). (Eskiden salt-okunurdu — card #1091 değiştirdi.)
- **24 saat pencere uyarı metni gösterilmez:** `/whatsapp` konuşma footer'ında
  pencere durumunu anlatan açıklama satırı render edilmez.
- **WhatsApp konuşma scroll'u kullanıcı niyetini korur:** `/whatsapp` detayında kullanıcı mesaj alanında
  yukarı scroll yaptıysa 8 saniyelik refresh, sağ/sol tıklama veya pasif güncelleme otomatik dibe indirmez;
  yalnız kullanıcı tekrar dibe yakınsa veya kendi mesaj gönderiyorsa dibe kayılır. Detay yükleme sırasında
  mevcut konuşma boşaltılıp çerçeve yeniden çizdirilmez; konuşma değişimi görsel zıplama üretmemelidir.
  Sol listeden manuel konuşma seçimi eski `phone/at/messageId` deep-link anchor'ını temizler ve yeni
  konuşma her zaman son mesajda/en altta açılır.
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
- **WhatsApp ikon ve liste zamanı:** WhatsApp'a özel nav/breadcrumb/channel/konuşma fallback ikonları
  ortak `/icons/whatsapp.webp` asset'ini kullanır. Sağ alt WhatsApp bildirim FAB'ı eski yalın yeşil
  baloncuk görünümünde kalır; merkezinde küçük beyaz disk içinde ortak `/icons/whatsapp.webp`
  görünür. `/whatsapp` konuşma listesinin sağ üst
  zaman alanı göreli gün metni (`Dün`, `Bugün`) değil, son mesajın saat:dakika değeridir.
- **WhatsApp konuşma profil paneli:** `/whatsapp` detay sağ panelinde vatandaş adı, numara, etiket,
  mahalle, cadde/sokak/bulvar ve açık adres konuşma kaydında saklanır; isim kaydedilince sol liste ve
  detay header'ı telefon yerine adı öncelikli gösterir. Sol konuşma kartında isim varsa telefon
  numarası ismin alt satırında, yanıt durumu (`Yanıt verildi` vb.) ile aynı yatay satırda görünür.
  Sol konuşma kartındaki `Talep Sayısı: N`
  satırı gösterilmez; `İşleme Alınan`, `Yapılmakta`, `Tamamlandı`, `İptal` durum kırılımı
  başlıksız olarak görünür kalır.
- **WhatsApp konuşma toplam sayaç filtreleri:** `/whatsapp` sol panelinde `Konuşmalar` başlığı altında
  `İşleme Alınan`, turuncu `Yapılmakta`, yeşil `Tamamlandı`, kırmızı `İptal` sayaçları görünür;
  hepsi tek satırda ve okunur büyüklükte kalır. `Tümü`, `Konuşmalar` başlığının altındaki kendi
  satırında tek başına durur; durum sayaçlarının toplamını gösterir ve tıklanınca Vatandaş Talepleri
  gridine WhatsApp kanalında gider. Diğer sayaçlar `Tümü` satırının altındaki satırda kalır ve
  tıklanınca Vatandaş Talepleri gridini ilgili talep durumuyla (`requestStatus`) filtreler. Sol
  konuşma kartlarındaki aynı durum kırılımı da hover'lı/tıklanabilir buton kalır ve aynı filtre rotasını kullanır.
- **WhatsApp FAB ilgili kullanıcı görünürlüğü:** WhatsApp bildirim FAB'ı yalnız operatör/SistemAdmin için
  aktif/açık konuşmalarda, diğer kullanıcılar için ise kendisine atanmış veya aktif departmanına yönlendirilmiş
  terminal olmayan vatandaş taleplerinde görünür; tamamlandı/iptal/reddedilmiş konuşmalar ilgili kullanıcıdan gizlenir.
- **WhatsApp birim içi konuşma notu:** `/whatsapp` footer'ındaki birim seçimi + `Birim İçi İlet` aksiyonu
  aynı konuşmaya iç mesaj kaydı ekler, vatandaşa WhatsApp gönderimi yapmaz; mesaj balonda iç mesaj etiketiyle
  görünür ve konuşma son mesaj zamanını günceller.
- **WhatsApp detay iç yönlendirme birimleri:** `/whatsapp` footer birim dropdown'u genel departman
  listesini değil, seçili konuşmadaki işleme alınan/yapılmakta aktif taleplerin hedef departmanlarını gösterir.
- **`Birim İçi İlet` mesajı SEÇİLEN birimin ticket'ına yazılır, `primaryTicket`'a değil:** aynı konuşmada
  birden fazla aktif talep farklı birimlere gidiyorsa, iç mesaj `internalDepartmentId`'ye eşleşen ticket'ın
  `socialMessageId`'sine kaydedilmeli — yoksa o birimin yöneticisi/personeli kendi görevinden "Yazışmaya Git"
  ile açtığında mesajı göremez (card #1322 reopen, `handleSendInternal`).
- **Detay popup "Yazışmaya Git" konuşması tek ticket'la sınırlanmaz:** `GetSocialConversationQuery`
  sosyal mesaj aynı `CitizenConversationId`'ye bağlıysa tüm ticket entry'lerini döndürür ve her entry kendi
  `socialMessageId`'sini taşır; medya indirme/gönder/düzenle aksiyonları entry'nin gerçek id'siyle çalışır.
- **WhatsApp profil telefonu salt okunur:** sağ panelde `Numara` başındaki ülke kodu olmadan gösterilir,
  kayıtta değiştirilemez; kaydedilen ad/etiket/adres metinleri Türkçe başlık biçimine normalize edilir.
- **WhatsApp detay header sayaçları:** seçili konuşma header'ında durum kırılımları gösterilmez; yalnız
  seçili numaraya ait toplam `Talep Sayısı` hesaplanır ve tıklanınca Vatandaş Talepleri gridine telefon
  filtresiyle gider.
- **WhatsApp detay header görev sahibi:** konuşmadaki vatandaş talebinin görevi oluşmuş ve atanan
  personeli varsa `Talep Sayısı` yanında `| Görev Sahibi: Ad Soyad, Diğer Ad` olarak tüm benzersiz görev
  sahipleri virgülle gösterilir; yalnız `Active`/Yapılmakta talep görev sahipleri sayılır, tamamlanan/iptal
  taleplerin personel adları düşer; görev/atanan yoksa alan basılmaz.
- **WhatsApp konuşma listesi görev sahibi:** görev sahibi bilgisi artık detay header'ına taşındı;
  sol konuşma kartında `GG Ad Soyad` avatar/metni tekrar gösterilmez.
- **WhatsApp konuşma listesi paging:** `/whatsapp` sol Konuşmalar panelinin altında basit toplam
  footer değil, Taleplerim gridleriyle aynı ortak `TablePagination` barı kullanılır; liste gerçek
  sayfalama yapar ve bar panelin iki alt sınır çizgisini kaplayan koyu paging yüzeyi olarak görünür.
- **WhatsApp konuşma satırı durum sayaçları salt metindir:** konuşma kartındaki `İşleme Alınan /
  Yapılmakta / Tamamlandı / İptal` değerleri tıklanabilir buton gibi davranmaz; yalnız sol panel
  üstündeki özet sayaçları Vatandaş Talepleri filtrelerine götürür.
- **WhatsApp teslim durumu status-only webhook ile de canlı yenilenir:** `sent/delivered/read`
  güncellemesi açık konuşmaya `isStatusUpdate` payload'ı yollar; istemci konuşmayı yeniler ama
  bunu yeni mesaj gibi `mark-read` yapmaz.
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
- **Vatandaş Talepleri grid kolonları:** Gridde `Kanal` ve `Durum` sütunları gösterilmez; kanal
  talep numarasının başındaki kanal ikonu ile anlaşılır. `Vatandaş Talep No` ve
  `Vatandaş Talep Tarihi` başlıkları tek satır kalır; `Etiket` kolonu operatörün talep
  etiketi/kategorisini gösterir.
- **Detay popup header aksiyonları:** Detaylar butonundan açılan iş/talep/görev detay popup'larında
  sağ üst aksiyon butonları `Button size="lg"` ölçeğinde, kapatma butonu `size-9` yuvarlak kırmızı
  buton olarak kalır.
- **Talep Oluştur manuel vatandaş akışı:** `Vatandaş Çağrı Talebi` olarak adlandırılır; kanal seçimi
  yalnız `Çağrı`dır, form ve onay aksiyon metni `Talep Oluştur` kalır ve oluşturulan kayıt Vatandaş
  Talepleri `Çağrı` filtresinde VT numarasıyla görünür. Tek `Çağrı` kanal butonu satırı dolduran
  yatay buton görünümünde kalır; form başlığındaki ikon, seçim kartındaki mavi zeminli telefon ikonuyla aynıdır.
- **Vatandaş Talebi detay düzenleme:** Detay popup'ta `Düzenle` aktifken `Ekler / Fotoğraflar`
  bölümünde `Dosya ekle` görünür; salt okunur modda ekleme aksiyonu gizli kalır (card #1256).
- **Job status değişince `ICitizenJobStatusNotifier` otomatik vatandaş mesajı atar**
  (İşleme Alındı / Yapılmakta / Tamamlandı / İptal). Varsayılan mesajda VT no'dan sonra talep başlığı
  yer alır ve metinler tenant `CitizenAutoReplyTemplatesJson` ayarından değiştirilebilir.
  İlk görev eklenince `Yapılmakta`, görev kapatma/tamamlama akışı talebi terminale taşıyınca
  `Tamamlanmış`, talep/görev iptali talebi terminale taşıyınca `İptal` şablonu gönderilir;
  red/son tarihi geçmiş etiketleri bu otomatik şablonlara düşürülmez (cards #1266/#1268).
  Ayarlar > Otomatik Yönlendirme > Vatandaşa Giden Cevaplar bölümü, Otomatik Yönlendirme
  kartının hemen altında durur; `{VatandaşTalepNo}`, `{VatandaşTalepBaşlığı}` ve durum adı
  kullanıcı tarafından düzenlenemez, yalnız aradaki serbest metin düzenlenir. İptal alanının görsel
  chip'i ve giden/kaydedilen otomatik mesaj durumu `İptal Edildi` olarak üretilir.
  `İşleme Alındı` ve `Yapılmakta` chip'leri turuncu kalır (cards #1258/#1263/#1270/#1268-reopen).
  (cards #1257/#1258).
- **Ayarlar > Taslak Mesajlar:** klasik şablon mesaj formudur; sol üst aksiyon butonu beyaz `+`
  ile `Yeni Meta Onaylı Şablon Oluştur` metnini gösterir; form içinde
  `Şablon Türü`, `Otomatik Cevap`, `Anahtar Kelime`, `Zamanlı Yanıt` ve zaman planı kontrolleri
  görünür kalır; WhatsApp Meta onaylı 3-şablon sınırı burada uygulanmaz.
- **Taleplerim detay `Adres Bilgileri` etiketleri** (`Mahalle`, `Cadde / Sokak / Bulvar`,
  `Açık Adres`) üçlü yan yana düzende tek satır kalır; alt çizgi metin dekorasyonu değil,
  görseldeki gibi hafif açık gri label alt sınır çizgisidir. Boş değer çizgisi bu görünümde
  `-` karakteridir ve değer font ağırlığı düşük kalır (card #1260 reopen).
- **RichText `&nbsp;` çift-kodlama tuzağı:** `RichTextContent.normalizeNbsp` ile çözüldü;
  rich-text (`dangerouslySetInnerHTML`) ve plain-text dalları ayrı işlenir (card 551).

## 4. Modallar / UI bileşenleri

- **`.inline-actions` (globals.css) `justify-content` taşımaz → sola dayalı.** Küçük modalda
  butonları sağa istiyorsan açıkça `justify-end`.
- **Modal başlığı altı ayraç konvansiyonu:** `mb-3 border-b border-slate-200 pb-2`
  (örnek: "Görevi Birim İçi Yönlendir" başlığı, TasksPage).
- **Terminal not popup başlıkları:** `İptal Notu` başlığı kırmızı, `Tamamlanma/Tamamlama Notu`
  başlığı yeşil görünür; bu renk `ConfirmDialog.titleTone` ile yalnız ilgili bilgi popup'larına
  verilir (card #1264).
- **Grid'ler boş filtrede başlığı korur:** tabloyu HER ZAMAN render et, boş mesajı `tbody`
  satırı olarak göster (Jobs/Tasks/Incoming).
- **Sarı `.row-attention` grid satırlarında `table-number-cell__priority` siyah kalır**;
  öncelik renk paleti amber zemin üzerinde kullanılmaz (card #1084).
- **Ortak bileşenleri kullan:** `DueDatePill`, `DateCell`, `FilterableTh`,
  `SingleSelectDropdown` (openUp), `StatusPill`, `ChannelIcon`. Yeni grid kolonunda yeniden icat etme.
- **Breadcrumb parent segmentlerinde her ifade kendi ikonunu taşır:** ör. `Birimdeki Görevler`,
  `Vatandaş Talepleri`, `Yönetim` gibi ara segmentler metinden önce ilgili lucide ikonunu gösterir
  (card #1251).
- **Vatandaş Talepleri breadcrumb:** `/social` sayfasında `Vatandaş İlişkileri` ara katmanı
  gösterilmez; breadcrumb doğrudan `Anasayfa > Vatandaş Talepleri` olur (card #1262).
- **Login logosu HER ZAMAN `/tire-belediyesi-logo.png`** (LoginPage `LOGIN_LOGO_*_SRC`) —
  tenant `appearance.logoUrl` ile override edilmez.
- **Mobil login logo çerçevesi yatayda geniş kalır:** kompakt login logo kartının yatay
  padding'i ve kart genişliği daraltılıp kare karta geri döndürülmez; panel viewport içinde biraz
  dışa taşarak genişler, logo etrafındaki beyaz alanda yatay nefes payı olur ve logo boyutu sabit kalır.
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
  aşağı doğru büyür; Talep Bilgileri listesine taşınmaz, sol kartta başlığın görüntülendiği yerde
  açılır. Yatay scroll/input kayması geri getirilmez** (card #1232/#1355).
- **Taleplerim detayında `Talep No` / `Vatandaş Talep No` düzenlenebilir alan değildir:** edit
  modunda da `Talep Bilgileri` listesine ayrı satır olarak geri dönmez; başlık yanında meta olarak kalır.
- **Taleplerim detay ana kartı 3 kolonludur (card #1336/#1335 — Round 182):** kolon1 = `Talep Başlığı`
  bölümü (FileText ikonlu başlık; başlığın YANINDA talep no + turuncu zeminli `Birim İçi/Birim Dışı`
  rozeti sağa yaslıdır ve sığmazsa yine sağa yaslı alt satıra sarar — parantezli tip metni KULLANILMAZ;
  altında Title Case talep başlığı `font-bold` ve SİYAH açıklama metni); kolon2 = `Talep Bilgileri`
  (Info ikonlu) alan satırları — satırlar gridview zebra
  desenlidir, değer metinleri `font-weight: 500` civarında kalır ve `Öncelik / Proje Niteliğinde mi?`
  değeri `Normal · Hayır` biçimindedir ("Proje niteliğinde mi?:" öneki yazılmaz); kolon3 = `Süreç`
  timeline. Ayrı `Açıklama` paneli YOKTUR.
- **Süreç "Talebi Gerçekleştiren Birim Yöneticisinin Onay Tarihi" adımı (cards #1333/#1337/#1345/#1357):**
  birim içi taleplerde hiç görünmez. Vatandaş ve birim dışı taleplerde hedef birim GERÇEKTEN
  onaylandığında (Approved + gerçek decidedAtUtc + görev atanmış) görünür ve onaylayan HEDEF
  birim yöneticisinin adını gösterir. Yönetici tarafından oluşturulan birim dışı aktif taleplerde
  hedef onay öncesinde gri `Onay Bekleyen` adımı durur; hedef yönetici onaylayınca yeşile döner.
  Yönetici birim dışı talebinde hedef onay gerçekleştiyse sıra `Hedef Onay Tarihi` → `Durum / Yapılmakta`
  olmalıdır; bekleyen durumda `Durum / Yapılmakta` daha erken kalabilir.
  `CreateJobCommand` otomatik hedef onayında ApprovedBy/DecidedAt YAZMAZ; gerçek damga
  `CitizenJobTargetApproval.TryRecordTargetApprovalAsync` ile ilk personel atamasında vurulur
  (eski yaratıcı-damgalı satırları da düzeltir).
- **Timeline `Durum / Yapılmakta` step'i:** yönetici-birim-içi istisnasına ek olarak standart
  kullanıcının Active (onaylanmış) non-citizen taleplerinde de gösterilir (card #1334); standart
  kullanıcı Taleplerim chip metni `Onaylanmış/Yapılmakta Taleplerim`dir.
- **Timeline son aktif pulse:** süreçte turuncu güncel adım varsa o yanıp söner; yoksa son aktif
  yeşil/kırmızı nokta turuncu pulse'ın yeşil/kırmızı eşdeğeriyle yanıp söner (card #1339/#1343).
- **Açıklama alanı başlıkları:** talep/rutin/vatandaş/e-Devlet açıklama giriş başlıklarında
  `(max 400 karakter) *` ibaresi görünür; RichTextEditor zaten 400 düz-metin karakter sınırını uygular.
- **Grid başlık casing/padding:** TÜM gridview header'ları (`data-table`, `table-container`,
  `wallboard-table`) `text-transform: uppercase` kullanır (card #1342 — #1318'i tersine çevirdi);
  `FilterableTh` label/ikon aralığı iki ayırıcı arasında dengeli olmalıdır.

## 5. Dashboard / Wallboard

- **Banner buton sayımları client-side hesaplanır; dashboard'da bu aggregation YOK.**
- **Reporter dashboard pie drilldown popup:** başlık yeşil ve `Info` ikonludur; tablo başlıkları
  portal/zoom farkını dengeleyecek şekilde `.data-table` genel header fontundan sonra override edilir
  ve Taleplerim gridview'ın görsel başlık font/ölçeğiyle, pagination satırı yüksekliğiyle uyumlu kalır.
  Terminal tarih kolonu yalnız `Tamamlanma Tarihi` veya `İptal Tarihi` başlığı
  kullanır; `Tamamlanma / İptal Tarihi` fallback ibaresi geri gelmez.
  "Banner sayımına bağlı grafik" istekleri yeni backend aggregation gerektirir (#731 bu
  yüzden ertelendi).
- **Dashboard pie chart'ları sıfır veride de görünür kalmalı:** `showZeroSlices` kullanılan
  grafiklerde tüm dilimler 0 olsa bile nötr donut + sıfır lejant gösterilir; kart boş/çökmüş
  görünmez.
- **Vatandaş Talep Kanalları pie chart'ı**, `SystemAdmin`, `Manager`, `Operator` ve Üst Düzey Yönetici
  (`Reporter`) dashboard'larında görünür; `Reporter`/`SystemAdmin` tenant genelini, `Manager` ise
  aktif/kapsamındaki birime gelen VT taleplerini (`OwnerDepartmentId` veya `JobDepartment.Target`) sayar.
  Kanal kırılımında kanonik bağ `SocialMessage.JobId + CitizenRequestNumber`'dır; `Job.SourceRefId`
  boş/uyumsuz olsa bile VT kanalı kaybolmamalıdır. VT job adaylığı yalnız `RequestType=Citizen`
  ile sınırlanmaz; `SourceType ∈ {SocialMessage,CitizenRequest,EDevlet}` veya linkli VT numaralı
  `SocialMessage.JobId` de grafiğe dahil olur.
- **Dashboard status pie chart query'si görev→talep kaynak tipini navigation property'ye güvenmeden
  üretir:** chart endpoint'i orphan/eksik ilişki veya provider translation yüzünden tüm paneli
  hata banner'ına düşürmemeli (card #1251).
- **`PieChart.resolveSliceLabel`** üç formatı ayırt eder: `GUID|isim` (departman/personel — id kırpılıp
  isim gösterilir), `prefix – dashboard.xxx` (çevrilebilir bileşik), ve düz literal metin (aynen basılır).
  Yeni bir grafik id'siz bir gruplama anahtarına (ör. mahalle adı) göre dilim üretecekse, `Label` alanına
  DOĞRUDAN literal ismi ver — pipe/GUID eklemeye gerek yok.
- **Reporter grafik dilimleri detay popup'ı açar (card #1343/#1338):** Üst Düzey Yönetici panosunda
  Taleplerim HARİÇ 6 grafik (`citizenRequests`, `externalRequestCreators/Pending/Fulfillers`,
  `neighborhoodCompletedRequests`, `neighborhoodInProgressRequests`) diliminde tıklama `DashboardChartDrilldownModal`'ı açar
  (`GET /reports/dashboard-chart-drilldown`, Reporter/SystemAdmin gate); popup Taleplerim detay modalıyla
  aynı `.detail-modal-shell` ölçüsünü kullanır, küçük grid text'i + ortak `TablePagination` kullanır. Son Tarih'ten
  önce terminal tarih kolonu gelir: tamamlandı diliminde `Tamamlanma Tarihi`, iptal/iade diliminde
  `İptal Tarihi`; terminal olmayan satırlara terminal tarih değeri basılmaz. Son Tarih boşsa bu popup'ta
  `Belirsiz` değil `Onay Bekleyen` yazılır; Durum sütunu rozet/pill değil düz metindir, ama
  `Completed` yeşil, iptal/iade kırmızı, `Active`/`InProgress` turuncu text rengiyle gösterilir. Dilim anahtarı backend'e HAM label (GUID|isim veya i18n key) olarak gider;
  sınıflandırma `BuildCitizenRequestsChart` ile birebir aynı tutulmalıdır. Mahalle completed/in-progress
  grafikleri ve drilldown satırları rutin görevleri dışlar; vatandaş talepleri için VT numarası taşır.
  Gridin son sütununda `İşlemler > Detaylar` butonu bulunur; aksiyon hücresi Taleplerim gridindeki
  `actions-cell/request-actions` + `Button size="sm" variant="secondary"` tasarımıyla kalır ve ilgili talebi
  salt-okunur `MyRequestDetailModal` ile popup olarak açar. Yönlendirme yapan eski davranış yalnız Taleplerim grafiğinde kalır.
- **Reporter `Birimlerde Bekleyen Talepler` pie chart'ı**, dış birim hedef linklerini
  `PendingOwnerApproval` ve `PendingExternalApproval` statülerinde hedef birim adına göre sayar; drilldown
  aynı statü kapsamını kullanır.
- **Dashboard legend tıklanabilirliği:** rotası olmayan pie legend/dilimleri tıklanabilir görünmez;
  standart kullanıcı `Birimdeki Görevler` grafiğinde `Birimdeki Görevler` legend'i read-only kalır.
- **Dashboard Vatandaş Talep Kanalları:** VT numaralı ama SocialMessage satırına bağlanmamış
  `SourceType=SocialMessage` kayıtları `Sosyal Medya Mesajı` değil `Telefon/Çağrı` diliminde görünür.
- **Standart kullanıcı dashboard görev dilimi:** `Birimdeki Görevler` grafiği başlığı erişim yoksa
  tıklanmaz kalabilir ama `Benim Görevlerim` dilimi yine `/my-tasks?view=all` rotasına gitmelidir.
- **Wallboard layout:** fixed-height flex (`100dvh`, `overflow:hidden`), hero+stats
  `shrink-0`, table-shell `flex:1 min-h:0`, pagination pinned, scroll tablo içinde; tablo
  başlıkları scroll sırasında sticky kalır ve eski sürekli header gradient rengi korunur. Footer
  viewport'un en alt kenarına tam satır/full-bleed oturur; sayfa padding'i footer'ı yukarıda veya dar bırakmaz.
- **Wallboard görev kaynağı:** "Ekrana Yansıt" listesinde rutin görevler gösterilmez; yalnız
  açık durumdaki numaralı rutin olmayan görevler listelenir. Vatandaş talebinde Oluşturan satırının
  başında kanal ikonu görünür; vatandaş satırı için özel renk veya sıra numarası şeridi kullanılmaz.
- **Wallboard Reporter vurgusu:** Üst Düzey Yönetici talebi satırında talep yeri altında oluşturan adı
  ayrı satırda kalır; "Üst Düzey Yönetici" oluşturan metni ve Görev Sahibi metni turuncu kalır.
  Başlık fontu normal ağırlıkta kalır, Görev Sahibi normal satırda Görevin Talep Yeri verisiyle aynı
  tondadır; reporter turuncusu `wallboard-task-owner` genel rengini ezmelidir. Başlık font size'ı
  tablo yoğunluğuna göre düşük kalır.
- **Wallboard Son Tarihi Geçmiş stat accent'i:** Yalnız `Son Tarihi Geçmiş` kutusunun alt border/accent
  çizgisi `Kapat` butonunun `var(--color-destructive)` kırmızısıyla aynı kalır.
- **Wallboard Birim Dışı stat accent'i:** `Birim Dışı` kutusunun alt border/accent çizgisi turuncu
  kalır ama çok koyu kahverengiye dönmez; `Son Tarihi Geçmiş` kırmızı kuralından bağımsızdır.
- **Grid durum/son tarih uyarı renkleri:** `Yapılmakta` status chip'i turuncu zemin + beyaz metin kullanır;
  bugün dolan `Son Tarih` pill'i sarı arka plan, sarı takvim ikonu ve sarı çerçeve/yazı dilinde kalır.
- **Banner arama input ağırlığı:** Banner/search input metni kompakt alanda iri okunur ama 700-bold
  görünmez; `scope-chip-search-input` yazı ağırlığı yarı-kalın seviyede kalır.
- **"Ekrana Yansıt" görseli = `/header-ataturk.png`** (kurum arması/cresti değil).

## 5b. Bildirimler (Notifications)

- **Bildirim feed'i `GetNotificationsQuery`'de AuditLog'lardan TÜRETİLİR** (workflow olayları
  için kalıcı `Notification` satırı yok; gerçek push bildirimleri ayrı). Yeni bildirim
  davranışı eklemek = audit→`NotificationResponse` projeksiyonunu değiştirmek. Başlık
  `ActionTitle(audit.Action)`'tan; mesaj `messageParts`'tan gelir.
- **Ek süre/revizyon onaycısı bildirim kapsamı:** `TaskRevision` approval onaycısı, görevin atanmış/owner
  kullanıcısı olmasa bile audit-feed ve okunmamış rozet kapsamına dahildir; kalıcı `Notification` yazılmaz.
- **Bildirim dropdown okundu aksiyonu:** "Tümünü Okundu yap" butonu küçük bildirim dropdown'unda
  kapatma X'inin solundadır, yeşil metinlidir, çerçeveli buton gibi görünür ve iki satır metin
  (`Tümünü` / `Okundu yap`) arasında okunabilir boşluk kullanır;
  "Tüm bildirimleri gör" modal toolbar'ında da tek satır `Tümünü okundu yap` aksiyonu görünür.
- **Bildirim başlığı vurguları:** başlıkta `güncellendi`, `oluşturuldu`, `atandı`, `yönlendirildi`, `Yönetici notu atandı`
  ve `Ek süre talebi` gibi renksiz aksiyon kelimeleri de bold kalır; onay/red/tamamlandı/iptal renkli
  bold davranışı korunur.
- **Bildirim alt mesaj metni:** başlığın altındaki mesaj alanında onay/red/tamamlandı kelimeleri
  kırmızı/yeşil renge boyanmaz ve bold yapılmaz; normal ağırlıkta nötr slate metin olarak kalır.
- **Bildirim detay popup ek süre marker'ı:** bildirimden açılan görev/talep detay popup'ı, grid detaylarıyla
  aynı ek süre marker'ını gösterir; görev detayı `TaskDetailResponse` ek süre alanlarını taşır, talep detayı
  içindeki görevlerden marker türetir.
- **Detay Son Tarih ek süre marker'ı:** yönetici/görev/talep detaylarında görev `Son Tarih` değeri,
  bekleyen/onaylanan/reddedilen ek süre marker'ını tarihin yanında aynı ortak bileşenle gösterir.
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
