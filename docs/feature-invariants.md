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
  Özellikle Görevlerim iptal/tamamla/durum popup'ları da Taleplerim gibi body'ye portal
  edilmeli; aksi halde `.app-content-shell .form-card` kompakt stilleri popup'ı küçültür.
- **Dropdown / DateTimePicker** overflow bar tarafından kırpılır → body'ye portal + `forceDown`.
- **Tüm ortak dropdown'lar 7+ seçenekte otomatik arama gösterir:** çağıran ayrıca `searchable`
  vermese de `SingleSelectDropdown` ilk satıra Türkçe casing uyumlu arama alanı ekler.
- **Yeni dropdown'larda native `<select>` açma:** mahalle seçimindeki ortak `SingleSelectDropdown`
  standardını (portal paneli, ortak satır/hover, gerektiğinde arama) kullan; yeni özel/native menü üretme.
- **`MultiSelectDropdown` menüsü de body portal + fixed** (`SingleSelectDropdown` ile aynı); tablo
  hücresinde absolute panel komşu sütunlara binmez (card #1706).
- **Yerel (Manual) kullanıcı düzenleme:** Ad Soyad / Ünvan / e-posta satır içi düzenlenebilir;
  LDAP'da bu üç alan salt okunur. Birim ve birincil rol `SingleSelectDropdown` kullanır (card #1705).
- **Mobil genişliklerde (<1024 CSS px) desktop zoom uygulanmaz:** içerik/sidebar `zoom=1`
  kalmalı; aksi halde telefonlarda native dikey scroll ve form ölçekleri kırılır.
- **Mobil sayfalarda kabuk/login dikey scroll'u kesmemeli:** `overflow-hidden` yalnız desktop
  breakpoint'lerinde kullanılmalı; iki kolonlu/split panel yerleşimleri telefonda alt alta akmalı.
- **Mobil login/sidebar marka alanı:** login logo kartı kullanılan koyu yeşil yüzeydir ve Atatürk
  silüeti kart border'ının içinde sol üstte kalır. Mobil drawer belediye logo çerçevesi logoya göre
  gereksiz büyük tutulmaz; logo çerçevenin içinde belirgin beyaz nefes payıyla daha küçük kalır.
  Desktop etkilenmez.
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
  esnek kalır; sağ üstte iki veya daha fazla aksiyon varsa butonlar 10px kompakt ölçüde ve bir
  satırda en fazla iki buton olacak grid düzeninde akar; tek aksiyon mevcut hizasını korur
  (card #1609 reopen: Tailwind `flex` utility'sini yenmek için grid display `!important`, çoklu
  aksiyonda header tek kolon ve aksiyon alanı tam genişliktir). Bu davranış tarayıcı `:has()`
  desteğine bağlı değildir; header ve aksiyon alanındaki açık mobil-grid sınıflarıyla uygulanır.
  Kapatma X'i grid akışına katılmaz; mobil header'ın mutlak konumlu sağ üst köşesinde kalır.
  Başlık satırı X yüksekliği kadar minimum alan ayırır; X ile alt aksiyon satırı birbirine değmez.
  Dashboard pie chart
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
- **Aynı `t()` anahtarı birden çok bağlamda (talep/görev gibi) farklı metin göstermeli olduğunda
  yeni bir locale anahtarı aç, mevcut anahtarın fallback'ini değiştirme** — anahtar zaten locale'de
  varsa tüm çağrı yerleri aynı metni gösterir (`attachments.sectionTitle` → context'e göre
  `attachments.requestSectionTitle`/`attachments.taskSectionTitle`'a ayrıştırıldı, card #1537).
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
- **Detay popup üzerinde Tamamla/İptal onay modal'ı (card #1656):** onay tamamlanınca üst
  modal kapanır; arka plandaki görev detay popup açık kalır ve durum/butonlar/Süreç/notlar
  sunucudaki son hale yenilenir (yalnızca liste `reload` yetmez).
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
  Taleplerim / Birime Gelen / Birimden Giden talep detay popup'larında bölüm başlığı
  `İlgili Görev Detayları`dır (card #1663); Görevlerim popup'ında kendi görev başlığı
  `Görev Detayları` kalır.
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
- **Görev Detayları durum değişikliği özeti:** Durum değiştiyse `Durum Değişikliği`, Görev Bilgileri
  içinden çıkar ve sağdaki `Süreç` timeline'ı bittikten sonra satır olarak görünür; okun iki yanındaki
  durum metinleri 12px kalır. `Durum Değişikliği Nedeni` ise `Görevi Yapan` satırının hemen altında,
  audit `Notes` alanındaki gerçek textbox verisini gösterir. Backend
  hem `GetTaskByIdQuery` hem `JobQueries` projeksiyonunda `Notes`/`ActorDisplayName` taşır.
  Özet ilk durum → son durumdur; metinler normal ağırlıkta, tarihler saniyesiz ve durumların altında
  ortalıdır. `İptal`/iade kırmızı, `Yapılmakta` turuncu, `Tamamlanmış` yeşildir (cards #1624/#1619 reopen).
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
  (rutin görevlerde gizli); eski yalnız-durum+tarih kuralı #1619/#1624 ile geçersizdir. Atama Geçmişi ile
  yan yana görünürse iki geçmiş başlığı da tek satıra sığacak şekilde geniş tutulur.
- **Görev Ekleri sütunu (Tasks detay):** tamamlanmış rutin olmayan görevde yalnızca gerçek görev eki varsa
  görünür; ek yoksa boş "Görev Ekleri" alanı hiç oluşmaz.
- **DateTimePicker NAİF yerel duvar-saati sözleşmesi (round 380, #1677):** `DateTimePicker` value'su
  "YYYY-MM-DDTHH:mm" yerel saattir; ISO'dan dönüşüm HER ZAMAN `utils/dateTimePicker.ts` içindeki
  `toDateTimePickerValue` ile yapılır. `toISOString().slice(0,16)` (UTC dilimi) YASAK — saati UTC
  ofseti kadar erken gösterir ve her kayıtta tarihi geriye kaydırır. Sayfa içi kopya helper yazma.
- **Talep son tarih bildirimi (round 380, #1677):** `UpdateJobCommand`'da son tarih değiştiyse
  `JobDueDateUpdated` audit'i KOŞULSUZ yazılır ("yalnızca son tarih değiştiyse" guard'ı geri getirme —
  kozmetik alan diff'leri bildirimi yutar); jenerik `JobUpdated` yalnız başka alan da değiştiyse eklenir.
- **Ek listesi sunumu (round 317, #1614/#1617):** Talep/Görev Ekleri listeleri view ve edit modunda AYNI
  görünür: iki kolon, bordersız satır, MAVİ dosya adı (`!important` şart — span'daki `text-slate-900`
  utility'si components katmanını ezer; renk kuralı yazınca computed style ile doğrula), iki satırı aşınca
  scroll. Rutin düzenleme geçmişi Önceki/Sonraki karşılaştırması İSTİSNA: tam liste, scroll kırpması yok.

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
- **Talep Oluştur ek yükleme ilerlemesi:** Birim İçi/Birim Dışı/Vatandaş Çağrı formlarının
  seçili dosyaları kayıt oluştuktan sonra XHR progress callback'iyle yüklenir; toplam yükleme
  1 saniyeyi aşarsa tüm dosyalar için birleşik yüzdeli progress bar görünür, hızlı yüklemede
  yanıp sönmez. Vatandaş create/edit akışı da seçili dosyaları oluşan job'a gerçekten yükler
  (card #1610 create-form reopen).
- **Adres girişleri mahalle kapılıdır:** talep/rutin/e-Devlet/Taleplerim düzenleme formlarında
  Cadde/Sokak/Bulvar ve Açık Adres alanları Mahalle seçilmeden aktif olmaz; mahalle temizlenirse
  alt adres alanları da temizlenir. Taleplerim terminal talep notu süreç satırında tekil **Not**
  linkidir; terminal tarih etiketinde `(İptal)`/durum parantezi basılmaz; Görev Detayları terminal
  not kopyasını tekrar göstermez (cards #1196/#1197/#1198).
- **Adres alan limitleri:** Cadde / Sokak / Bulvar tüm giriş yüzeylerinde en fazla 50 karakter,
  Açık Adres en fazla 100 karakterdir; backend komut validasyonları da aynı sınırı korur.
- **Adres metni yazımı:** Cadde / Sokak / Bulvar ve Açık Adres değerleri Türkçe locale kurallarıyla
  her kelimenin ilk harfi büyük, kalan harfleri küçük olacak biçimde normalize edilerek kaydedilir.
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
  Rutin görev detayının düzenleme modunda `Görev Ekleri`, rich-list'in iki sütunlu düzenini
  kullanır: son görsel dengede 1.75rem/11px `Dosya ekle` solda, mevcut ekler sağ kart
  sınırına yaslıdır; bu scope Taleplerim/Talep Ekleri buton ölçüsünü değiştirmez
  (card #1601 sixth reopen).
  Detay popup düzenleme yüzeylerindeki yükleme 1 saniyeden uzun sürerse yüzde metinli progress bar
  gösterilir; daha hızlı yüklemelerde gösterge yanıp sönmez. XHR progress callback'i korunur
  (card #1610).
  Düzenleme modundaki `rich-list` ekleri yatay sarılır; dosya kutusu border/zemin taşımaz, dosya
  adı mavi ve uzantısı küçük harftir. Yükleme butonu yalnız doğal genişliğini alır, liste kalan
  yatay alanın tamamını kullanır ve `display:grid !important` ile iki eşit kolondur;
  ikon kutusu 20px ve ikon/metin aralığı 2px'tir; dosya adı alanı en az 12ch olduğundan ilk
  10 karakterin kesilmeden görünmesine yer bırakır.
  JSX düzenleme öğesine border utility eklemez. İki görsel satırdan sonrası kendi alanında scroll olur
  (cards #1615/#1616/#1618). Görevi Tamamla geçici ekleri de yatay sarılır, küçük harf uzantı
  kullanır ve iki satırdan sonra scroll olur; dosya adının 20px satır yüksekliği ikonla dikey
  hizayı korurken uzun adların doğal biçimde alt satıra geçmesine izin verir (card #1617 reopen).
  Detay popup'larında `Görev Bilgileri > Görev Ekleri` veya `Talep Bilgileri > Talep Ekleri`
  satırında gerçek dosya varsa dosya adının önünde uzantıya göre küçük görsel/doküman ikonu
  bulunur; bağlantı metni altı çizgisizdir ve yalnız dosya uzantısı küçük harfle gösterilir
  (indirmedeki gerçek ad değişmez). Boş `—` değerinde ikon gösterilmez (card #1605 reopen).
- **Rutin görev düzenleme geçmişi ek karşılaştırması:** Önceki/Sonraki karşılaştırma kartları
  korunur; kartların içindeki tekil ekler ayrıca çerçevelenmez ve birden fazla ek iki sütunda
  yan yana akar (card #1626).
- **Süreç onay tarihleri:** `Talebin Birim Yöneticisinin Onay Tarihi` ve `Talebi Gerçekleştiren
  Birim Yöneticisinin Onay Tarihi` etiketleri sade kalır; onaylayan yönetici adı varsa tarih
  değerinin yanında parantez içinde, küçük ve yeşil renkte gösterilir. Manager/SystemAdmin/Reporter
  rolünde Taleplerim Süreç altında owner approval (`Talebin Birim Yöneticisinin Onay Tarihi`) satırı
  gösterilmez. **İstisna (card #1654):** Görevlerim / Birimdeki Görevler / Personelimin Görevleri
  detay popup'ındaki İlgili Talep Süreç'inde sahip onay katmanı (varsa) her zaman gösterilir.
  Standart kullanıcıda owner approval bekliyorsa `Onay Bekleyen` değeri turuncu
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
  yapışmaz.   Detaylar popup sol üst başlığının altında boydan boya şerit `2px` kalır (card #1661;
  #1657 reopen); rengi bölüm başlık çizgisiyle aynı transparan primary'dir (card #1685). Düzenleme modunda ana kartın ilk satırı açıklama editörü yüzünden gereksiz uzamaz;
  açıklama editörü kompakt kalır (cards #1218/#1220/#1221/#1222/#1223/#1238/#1244).
  Talep başlığı yanındaki meta bloğu başlık metnine değil, sol kartın sağ border çizgisine hizalanır;
  en sağda iki satırdır: üstte talep no, altında `Birim İçi/Birim Dışı` rozeti.
  Taleplerim/görev detay popup gövdesi ortak `.detail-modal-shell` / `--my-request`
  ölçülerini kullanır (card #1682 ile küçültülmüş band); sayfa bazında yeniden ayrıştırma.
  Taleplerim salt-okunur Talep Bilgileri listesinde `Proje mi` ayrı satırdır ve formdaki
  `Proje niteliğinde mi?` çevirisini kullanmaz; `Öncelik` ise Talep Bilgileri başlığının sağ
  sınırında etiketi üstte, değeri altta olacak biçimde gösterilir (cards #1586/#1599).
- **Taleplerim/Vatandaş Talebi detay alt kartları:** `Talebin Gittiği Birim / Görevi Yapan`
  etiketi tek satır kalır ve atanmış kullanıcı yoksa değer kısmında `Birim / -` gösterir; `Adres Bilgileri`
  içinde Mahalle, `Cadde / Sokak / Bulvar` ve `Açık Adres` üçlü yan yana durur; adres etiketleri
  kendi içinde satır kırmaz (`Bulvar` alt satıra düşmez); `Ekler / Fotoğraflar`
  kart zemini, Adres kartı değil, `Açıklama` paneliyle aynı soluk nötr yüzeyi kullanır (cards #1259/#1260/#1261).
  `İlgili Talep Detayları > Talep Bilgileri` başlığının sağındaki talep no ve `Birim İçi/Birim Dışı`
  meta bloğu başlık alt çizgisinin sağ sınırına hizalı kalır.
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
- **WhatsApp konuşma footer aksiyonları:** Alt aksiyon satırında `Talep oluştur` butonu görünmez;
  `Şablon mesajlar`, `Şablon mesaj ekle` ve `Dosya ekle` yan yana durur. Bu aksiyonların ikonları
  yeşil kalır; buton metinleri yeşile boyanmaz (card #1245/#1466).
  Vatandaş Çağrı Talebi oluşturma popup'ında Şablon mesajlar/Şablon mesaj ekle/Kurum İçi İlet
  kontrolleri yalnız o popup'a özel kompakt 28px; `Birim seçin` de gerçek 28px yükseklik ve orta
  genişlikte (160px) kalır. Genel dropdown ölçüleri etkilenmez.
  Yanıt textarea'sının sağındaki ileti butonu textarea boyunca uzamaz; küçük buton olarak alt
  kenara hizalanır (`self-end`).
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

- **Gelen WA balonunda üst satır gönderen etiketi:** isim varsa isim (+telefon), yoksa telefon;
  `ConversationPanel` → `inboundSenderLabel` (card #1716). Vatandaş Talebi Oluştur dahil.

- **Operatör WhatsApp yanıtları "Beklemede" kuyruğa girer; iletme yetkisi yalnızca operatördedir (card #1091).**
  `ReplyToSocialMessageCommand` WhatsApp kanalında varsayılan olarak mesajı GÖNDERMEZ, `DeliveryStatus=Pending` entry
  oluşturur (diğer kanallar eskisi gibi anında gider). `ICitizenJobStatusNotifier` tarafından
  üretilen İşleme Alındı/Yapılmakta/Tamamlandı/İptal Edildi mesajlarının dördü de operatör onayı
  beklemeden WhatsApp'a doğrudan gönderilir; bu otomatik mesajlar `Pending` ve
  `Düzenle`/`Mesaj Gönder` aksiyonu üretmez (card #1569).
  Terminal not butonları yalnız diğer ilgili bekleyen mesaj terminal durumu
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
  konuşma her zaman son mesajda/en altta açılır. Telefon parametresiyle (`/whatsapp?phone=...`) açılan
  anchorsız konuşmalar da detay popup'taki `Yazışmaya Git` davranışı gibi son mesajda/en altta açılır.
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
- **WhatsApp gelen vatandaş balonu sender label (card #1554 reopen):** kayıtlı vatandaş adı varsa
  `Ad Soyad Telefon` (bullet yok) gösterilir; telefon addan küçük ve daha açık renktir. Ad yoksa yalnız
  biçimlendirilmiş telefon addan biraz küçük ve aynı açık renk/orta ağırlıkta gösterilir; boş üst satır basılmaz.
- **Konuşma balonu zaman formatı (cards #1557/#1558/#1560):** WhatsApp ve kurum içi mesajlarda
  bugün `HH:mm`, önceki takvim günü saatten bağımsız `Dün`, daha eski mesaj `gg.aa.yyyy` gösterir.
- **WhatsApp Talep oluştur konuşma header (card #1555):** `headerMode=phone` iken ortak
  `/icons/whatsapp.webp` kullanılır (beyaz dış daire yok); `Whatsapp Telefon No` altındaki değer
  küçük punto + `+90` önekli biçimlenir; kayıtlı vatandaş adı varsa numaranın önüne yazılır.
  Formda kilitli telefon alanında `(başında 0 olmadan ekleyin)` ipucu gösterilmez. Talep Oluştur
  popup'ında dış kırmızı kapatma butonu varken iç konuşma header'ında mükerrer `X` gösterilmez.
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
  zaman alanı bugün saat:dakika, önceki takvim günü `Dün`, daha eskide `gg.aa.yyyy` değeridir.
- **WhatsApp konuşma profil paneli:** `/whatsapp` detay sağ panelinde vatandaş adı, numara, etiket,
  mahalle, cadde/sokak/bulvar ve açık adres konuşma kaydında saklanır; isim kaydedilince sol liste ve
  detay header'ı telefon yerine adı öncelikli gösterir. Sol konuşma kartında isim varsa telefon
  numarası ismin alt satırında, yanıt durumu (`Yanıt verildi` vb.) ile aynı yatay satırda görünür.
  Sağ profil paneli üstündeki `Talep Oluştur` aksiyonu satır ortasında, büyük `h-10` buton olarak kalır.
  Sol konuşma kartındaki `Talep Sayısı: N`
  satırı gösterilmez; `İşleme Alınan`, `Yapılmakta`, `Tamamlandı` durum kırılımı
  başlıksız olarak görünür kalır; `İptal` kart alt sayacında basılmaz.
- **WhatsApp konuşma toplam sayaç filtreleri:** `/whatsapp` sol panelinde `Konuşmalar` başlığı altında
  `İşleme Alınan`, turuncu `Yapılmakta`, yeşil `Tamamlandı` sayaçları görünür; `İptal` kalemi burada
  ve konuşma kartı alt sayaçlarında gösterilmez. Görünen sayaçlar tek satırda ve okunur büyüklükte kalır. `Tümü`, `Konuşmalar` başlığının altındaki kendi
  satırında tek başına durur; durum sayaçlarının toplamını gösterir ve tıklanınca Vatandaş Talepleri
  gridine WhatsApp kanalında gider; hover'da belirgin yeşil zemin/metin/ring state'i vardır.
  Diğer sayaçlar `Tümü` satırının altındaki satırda kalır ve
  tıklanınca Vatandaş Talepleri gridini ilgili talep durumuyla (`requestStatus`) filtreler. Sol
  konuşma kartlarındaki aynı görünür durum kırılımı salt metin kalır.
- **WhatsApp FAB ilgili kullanıcı görünürlüğü:** WhatsApp bildirim FAB'ı yalnız operatör/SistemAdmin için
  aktif/açık konuşmalarda, diğer kullanıcılar için ise kendisine atanmış veya aktif departmanına yönlendirilmiş
  terminal olmayan vatandaş taleplerinde görünür; tamamlandı/iptal/reddedilmiş konuşmalar ilgili kullanıcıdan gizlenir.
- **WhatsApp birim içi konuşma notu:** `/whatsapp` footer'ındaki birim seçimi + `Birim İçi İlet` aksiyonu
  aynı konuşmaya iç mesaj kaydı ekler, vatandaşa WhatsApp gönderimi yapmaz; mesaj balonda iç mesaj etiketiyle
  görünür ve konuşma son mesaj zamanını günceller. Balondaki `Birim · Ad Soyad`, footer'da seçilen hedef
  birimden değil mesajı gönderen kullanıcının kendi birim/display-name bilgisinden üretilir.
- **WhatsApp detay iç yönlendirme birimleri:** `/whatsapp` footer birim dropdown'u genel departman
  listesini değil, seçili konuşmadaki işleme alınan/yapılmakta aktif taleplerin hedef departmanlarını gösterir;
  native select değil mahalle dropdown'uyla aynı ortak portal bileşenini kullanır. Arama zorla açık
  tutulmaz; ortak 7+ seçenek eşiğine uyar. Tek birim seçeneğinde panel aşağı, 2+ seçenekte yukarı açılır.
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
- **WhatsApp sol panel arama kutusu `type="text"` kalır, `type="search"` olmaz** (tarayıcının kendi
  silme ikonu özel X butonuyla çakışır — card #1496). Arama eşleştirme mantığında (`normalizedSearchName`
  vb.) her OR dalı kendi uzunluk guard'ını taşımalı; guard'sız bir `.includes('')` her satırı
  vacuously eşleştirip filtreyi no-op'a çevirir (card #1496 reopen kökü).
- **WhatsApp konuşma listesi paging:** `/whatsapp` sol Konuşmalar panelinin altında basit toplam
  footer değil, Taleplerim gridleriyle aynı ortak `TablePagination` barı kullanılır; liste gerçek
  sayfalama yapar ve bar panelin iki alt sınır çizgisini kaplayan koyu paging yüzeyi olarak görünür.
- **Kurum İçi Mesajlar panel sınırı/paging (card #1542 reopen):** konuşma listesi büyüdüğünde panel
  banner alt sınırına kadar uzanır ve yukarı taşmaz (`max 42rem`, card #1588); paging gezinme düğmeleri ikinci satırda ortalıdır
  ve en az 24px dokunma hedefini korur.
- **Kurum İçi Mesajlar liste/sohbet düzeni (cards #1542/#1552/#1556):** panel başlığı sohbet açılınca
  kaybolmaz; liste görünümünde başlık sol kenara yapışmaz, aktif sohbette geri/avatar için dar sol
  padding korunur. Personel avatarı ad/soyad baş harflerini kullanır. Durum rozeti avatarın sağ alt
  köşesinde WhatsApp konuşma listesiyle aynıdır (yeşil = yanıt verildi, turuncu = yanıt bekliyor);
  durum metni birim satırının sağına yaslanır; birim + son mesaj zamanın altında tek satır aşağıda
  kalır (önceki “zaman altı durum” satırı kaldırıldı). Mesaj balonunda `Birim • Ad Soyad` etiketi ve
  takvim günü değiştiğinde ortalı `gün ay` ayırıcısı bulunur.
- **Kurum İçi Mesajlar sohbet header/balonları (cards #1542/#1572/#1573):** üst satırda `← Geri`,
  alt satırda aynı sol başlangıca hizalanan personel avatarı + bilgi bloğu bulunur; iki satır da
  panelin solundan kontrollü 12px iç boşlukla biraz sağda durur;
  personel adı ana satırda,
  birim altında, küçük `Kurum İçi Mesajlar` etiketi
  sağa yaslıdır. Gelen balonda birim•ad etiketi siyahtır (turuncu değil); balon padding/font WhatsApp
  balonundan bir kademe küçüktür (`text-xs` / `px-2.5 py-1.5`).
- **Kurum İçi Mesajlar kapatma hover'ı (card #1590):** panel sağ üst X butonu hover'da
  standart açık kırmızı zemin (`red-50`) ve kırmızı ikon (`red-600`) kullanır.
- **Kurum içi gönderen italik ayrımı (card #1564 reopen):** Kurum İçi Mesajlaşma FAB sohbet
  balonunda personel ve birim normal stildedir; WhatsApp kurum içi mesaj balonunda yalnız personel
  adı italiktir. Mevcut `Birim · Ad Soyad` sırası korunur.
- **Kurum İçi Mesajlar teslim/okunma durumu (card #1559):** kullanıcının kendi balonunda zamanın
  solunda çift tik + `İletildi` bulunur; `ReadAtUtc` dolunca çift tik ve `Okundu` mavi olur.
  Alıcı sohbeti açıp okundu işaretlediğinde gönderen SignalR okundu bildirimiyle beklemeden yenilenir.
  Okundu POST'u konuşma satırına tıklama anında, detay GET'ini beklemeden başlar; gönderen istemci
  okundu makbuzunu açık konuşmanın yerel state'ine anında uygular, yeniden GET'i beklemez (card #1579 reopen).
  SignalR cookie ve varsa Bearer token ile yetkilendirilir; açık konuşma görünür sekmede 1 saniyelik
  yedek senkronizasyonla `ReadAtUtc` değişimini sayfa yenilemeden yakalar (card #1579 second reopen).
  İlk SignalR bağlantı hatası 2/5/10/30 saniye geri çekilmeyle tekrar denenir; reconnect ve sekmenin
  yeniden görünür olması konuşma listesini hemen yeniler. FAB polling bağlıyken 15 saniye, bağlantı
  yokken 3 saniyedir. Kalıcı mesaj/read kaydından sonraki push HTTP iptalinden bağımsız 5 saniyelik
  timeout kullanır ve başarısızlık warning olarak loglanır (live delivery hardening, 2026-07-13).
- **Kurum İçi Mesajlar küçük ayraç/paging hizası (card #1542 reopen):** gönderen ve teslim durumu
  bullet'ları metnin optik ortasında küçük kalır; personel/birim ve Okundu/İletildi-zaman bullet'ları
  aynı 2px ölçüdedir.
  Paging yazıları üst/alt border'a yapışmaz.
- **WhatsApp talep etiketi (cards #1561/#1563):** profil Talep Etiketi input'u salt okunurdur;
  seçim yalnız ortak Etiketler dropdown'undan yapılır ve anında kaydedilir. WhatsApp'tan açılan
  Vatandaş Çağrı Talebi oluşturma POPUP'ında Kanal/Talep Etiketi bloğu gösterilmez (card #1563);
  Talep Oluştur SAYFASINDAKİ Vatandaş Çağrı Talebi formunda ise Talep Kanalı'nın sağında aynı
  salt-okunur değer + Etiketler + Etiket Ekle bloğu bulunur (card #1561 reopen, 2026-07-13);
  kaynak mesaj bir konuşmaya bağlıysa seçim conversation profile'a kaydedilir.
  Kayıtlı etiket sayısı 7 veya daha fazlaysa Etiketler menüsünün ilk satırında küçük puntolu arama gösterilir.
  Yalnız Talep Oluştur sayfasındaki Vatandaş Çağrı Talebi bloğunda Etiketler ve Etiket ekle
  buton metinleri diğer WhatsApp profil yüzeyinden bir kademe büyük (`text-sm`) görünür.
- **Sağ alt FAB sırası (cards #1543/#1553):** yatay sıra WhatsApp → Kurum İçi Mesajlar →
  aşağı/yukarı scroll butonudur; scroll butonu Kurum İçi Mesajlar'ın üstüne/altına dönmez.
- **Kurum İçi Mesajlar FAB ikonu:** yeşil yuvarlak butonda tek, 24px ve belirgin dolu konuşma
  balonu görünür; ikinci/öndeki balon ve üç nokta gösterilmez (card #1583 reopen).
  Scroll FAB render edilmediğinde panel offset'leri koşullu kalır ve dar ekranda taşma oluşturmaz.
- **FAB panel katmanı:** WhatsApp ve Kurum İçi Mesajlar birlikte açıkken WhatsApp bildirim paneli
  `z-20` ile kurum içi panelin önünde görünür (card #1578).
- **WhatsApp konuşma satırı durum sayaçları salt metindir:** konuşma kartındaki `İşleme Alınan /
  Yapılmakta / Tamamlandı` değerleri tıklanabilir buton gibi davranmaz; `İptal` bu satırda basılmaz ve yalnız sol panel
  üstündeki özet sayaçları Vatandaş Talepleri filtrelerine götürür.
- **WhatsApp FAB bildirimi aynı son mesaj için geri dirilmez:** kendi gönderdiğin kurum içi ileti
  veya FAB satırına tıklama, kullanıcı bazlı `conversationId + lastMessageAt` bastırması yapar;
  polling aynı son mesajı yeniden rozet/panel satırı olarak göstermez, yeni mesaj zamanı değişirse bildirim geri gelir.
- **WhatsApp teslim durumu status-only webhook ile de canlı yenilenir:** `sent/delivered/read`
  güncellemesi açık konuşmaya `isStatusUpdate` payload'ı yollar; istemci konuşmayı yeniler ama
  bunu yeni mesaj gibi `mark-read` yapmaz.
- **Otomatik vatandaş durum mesajı konuşma kuyruğunu da günceller:** `ICitizenJobStatusNotifier`
  WhatsApp `Sent`/`Failed` entry eklediğinde ilgili `CitizenConversation.LastMessageAt/UnreadCount`
  değerlerini ve SignalR WhatsApp payload'ını da günceller; aksi halde mesaj operatör listesinde
  son konuşma/sıra olarak görünmeyebilir.
- **Durum Değişikliği Geçmişi audit reason taşır:** #1095'te kaldırılan neden, #1619 reopen ile
  geri gelmiştir; veri `TaskStatusChanged` audit `Notes` alanından okunur ve Süreç altında gösterilir.
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
  sağ üst aksiyon butonları (Düzenle/Tamamla/Yazdır vb.) ve kapatma (X) kompakt ölçülüdür
  (~1.875rem yükseklik, ~0.7rem yazı; card #1632). Sol üst popup başlığı
  (`.my-request-detail-header__title`) de kompaktır (~0.7rem / 0.14em tracking; card #1632 reopen).
  768px üstü fakat viewport yüksekliği 900px ve altındaki dizüstü ekranlarda gövde/kart padding ve
  kontroller ayrıca kompaktlaşır; üçlü adres alanı iki kolona düşerek iç içe geçmez (card #1614).
- **Süreç "Durum Değişikliği" özeti (cards #1621/#1633):** `Tamamlanmış` gibi uzun durum etiketleri
  tek satırda kalır; değer satırın sağ border'ına yaslanır ve ~0.75rem fontla okunaklıdır
  (`StatusChangeTransition`).
- **Birimden Giden Tamamlanmış / ortak görev detayı (cards #1634/#1635):** düz `Açıklama` kartı
  Birimden Giden Tamamlanmış'ta gösterilmez. Taleplerim / Birime Gelen / Birimden Giden'de
  `Görev Bilgileri` ve `Süreç` kartları eşit yükseklikte gerilir (`items-stretch` + `h-full`);
  başlık metinleri kart üstünde `items-start` ile aynı düşey hizada kalır.
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
  kullanıcı tarafından düzenlenemez. Durum adından sonra sabit `{GönderilenBirim}` gelir ve aktif
  hedef birim adlarıyla değiştirilir; bu alanın ardından ikinci serbest metin düzenlenebilir. Eski
  kayıtlı şablonlara eksik birim token'ı okunurken/yazılırken otomatik eklenir (card #1594).
  Her iki textarea yazım sırasında baştaki/sondaki boşluğu korur; trim ve boş gövde varsayılanına
  dönüş yalnız `Kaydet` normalizasyonunda yapılır, böylece kelimeler arasına boşluk girilebilir
  (card #1594 reopen).
  `{GönderilenBirim}` token'ından sonra şablonda her zaman tam bir otomatik ayraç boşluğu bulunur;
  eski bitişik veya çok boşluklu kayıtlar okunurken/yazılırken tek boşluğa normalleştirilir
  ve mesaj üretilirken de gerçek hedef birim ile devam metni arasındaki tek boşluk son kez garanti
  edilir (card #1598 reopen). Kullanıcının ikinci textarea'da ayrıca başına boşluk yazması gerekmez.
  İptal alanının görsel
  chip'i ve giden/kaydedilen otomatik mesaj durumu `İptal Edildi` olarak üretilir.
  `İşleme Alındı` ve `Yapılmakta` chip'leri turuncu kalır (cards #1258/#1263/#1270/#1268-reopen).
  Aynı SocialMessage/talep için aynı üretilmiş durum mesajı Pending/Sent/Delivered/Read olarak
  zaten varsa ikinci kez oluşturulmaz; yalnız Failed kayıt yeniden denemeye izin verir.
  (cards #1257/#1258).
- **Detay popup'tan açılan WhatsApp konuşması son mesajda açılır:** Jobs/Tasks
  `Yazışmaya Git` aksiyonlarının kullandığı `WhatsAppConversationModal`/`ConversationPanel`
  ilk yüklemede ve yeni entry geldiğinde konuşmayı en alta hizalar; eski üstten açılma geri gelmez.
- **Görevlerim ilgili talep özetinde Talep Bilgileri başlığı meta taşır:** `İlgili Talep Detayları`
  sol kart başlığında sağda talep numarası ve `Birim İçi/Birim Dışı` rozeti kalır; başlığı alt
  alanlara taşırken bu meta tekrar silinmez.
- **Ayarlar > Taslak Mesajlar:** klasik şablon mesaj formudur; sol üst aksiyon butonu
  `+ Yeni Şablon Oluştur` metnini gösterir; form içinde
  `Şablon Türü`, `Otomatik Cevap`, `Anahtar Kelime`, `Zamanlı Yanıt` ve zaman planı kontrolleri
  görünür kalır. Meta onaylı şablonlar için birincil yol **Meta'dan Senkronize Et** butonudur
  (`POST /whatsapp-templates/sync-from-meta`); yalnızca Graph'ta `APPROVED` olanlar upsert edilir,
  artık onaylı olmayan yerel `WhatsApp Meta` kayıtları `IsActive=false` yapılır. Elle Meta oluşturma
  butonu gizlidir — Meta onaylı şablonlar Meta Manager üzerinden oluşturulur, uygulamada birincil
  yol senkrondur. Şablon editöründeki `Sil` aksiyonu kırmızı arka planlı buton
  olarak görünür; boş edit panelinde büyük `WA` placeholder'ı basılmaz.
- **WhatsApp Meta şablon gönderimi `type: template`:** Operatör Meta kanalı şablon seçtiğinde reply /
  send-pending yolu serbest metin değil Cloud API `SendTemplateMessageAsync` kullanır; body
  değişkeni (`{{1}}` vb.) içeren şablonlar v1'de Türkçe validasyon ile reddedilir. 24s penceresi
  dışında yalnızca Meta şablon seçiliyken gönderim açılır.
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
- **Mobil login Atatürk görseli:** `/header-ataturk.png` (beyaz silüet) sayfa sol üst köşesinde
  `lg:hidden` ile gösterilir; açık login zemininde görünürlük için `brightness-0` (koyu silüet)
  uygulanır. Desktop hero koyu zeminde beyaz silüet kalır.
- **Mobil sol menü belediye logosu:** drawer marka alanında varsayılan 96px kare değil, daha geniş
  `MunicipalitySeal` (yaklaşık 88×176px) kullanılır; Atatürk sol üstte kalır.
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
- **Talep Oluştur > Vatandaş Çağrı Talebi Talep Etiketi değeri:** yalnız salt-okunur input metni
  `text-xs` kalır; Etiketler/Etiket ekle butonlarının büyütülmüş metni etkilenmez (card #1561).
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
  desenlidir, değer metinleri `font-weight: 500` civarında kalır; salt-okunur görünümde `Proje mi`
  satırı `Öncelik` satırının hemen üstündedir; kolon3 = `Süreç`
  timeline. Ayrı `Açıklama` paneli YOKTUR.
  `Talep Yeri / Oluşturan` tek satır başlığıdır; değer alanında talep yeri üstte, oluşturan kişi
  altta `StackedFieldValue` ile gösterilir. Aynı sıra Görevlerim, Birimdeki Görevler,
  Personelimin Görevleri, Birimden Giden ve Birime Gelen görev detaylarında da korunur.
  `Talep Yapılan Birim` ve `Görevi Yapan` ayrı kalır (cards #1592/#1593).
  Vatandaş talebinin ilgili detayları Görevlerim, Birimdeki Görevler ve Personelimin Görevleri
  popup'larında `Vatandaş Adı / Telefon No` değerini de ad üstte, telefon altta
  `StackedFieldValue` ile gösterir (card #1596).
- **Süreç "Talebi Gerçekleştiren Birim Yöneticisinin Onay Tarihi" adımı (cards #1333/#1337/#1345/#1357):**
  birim içi taleplerde hiç görünmez. Vatandaş ve birim dışı taleplerde hedef birim GERÇEKTEN
  onaylandığında (Approved + gerçek decidedAtUtc + görev atanmış) görünür ve onaylayan HEDEF
  birim yöneticisinin adını gösterir. Yönetici tarafından oluşturulan birim dışı aktif taleplerde
  hedef onay öncesinde gri `Onay Bekleyen` adımı durur; hedef yönetici onaylayınca yeşile döner.
  Yönetici birim dışı talebinde hedef onay gerçekleştiyse sıra `Hedef Onay Tarihi` → `Durum / Yapılmakta`
  olmalıdır; bekleyen durumda `Durum / Yapılmakta` daha erken kalabilir.
  `CreateJobCommand` otomatik hedef onayında ApprovedBy/DecidedAt YAZMAZ; gerçek damga
  `CitizenJobTargetApproval.TryRecordTargetApprovalAsync` ile ilk görev atamasında hedef yöneticisi
  adına kesin olarak vurulur (eski yaratıcı veya sahibi-birim-yöneticisi damgalı satırları da düzeltir).
  Eski kayıtların Timeline/yazdırma görünümünde hedef ve sahip onaycı aynıysa gerçek hedef onaycı,
  hedef birimin ilk görevindeki `assigningManagerDisplayName` üzerinden çözülür (card #1595).
- **Timeline `Durum / Yapılmakta` step'i:** yönetici-birim-içi istisnasına ek olarak standart
  kullanıcının Active (onaylanmış) non-citizen taleplerinde de gösterilir (card #1334); standart
  kullanıcı Taleplerim chip metni `Onaylanmış/Yapılmakta Taleplerim`dir.
- **Timeline son aktif pulse:** süreçte turuncu güncel adım varsa o yanıp söner; yoksa son aktif
  yeşil/kırmızı nokta turuncu pulse'ın yeşil/kırmızı eşdeğeriyle yanıp söner (card #1339/#1343).
- **Birime Gelen / Birimden Giden detay Süreç kolonu (card #1527):** flat alan listesi değil;
  Taleplerim ile aynı `JobProcessTimeline` + `buildJobProcessSteps` kullanılır;
  Son Tarih Değiştir / Ek süre talebini gör aksiyonları timeline `dueDate` adımında kalır.
  Standart kullanıcının birim dışı talebi sahibi-birim yöneticisince onaylandıysa hem Birimden
  Giden hem Birime Gelen timeline'ında `Talebin Birim Yöneticisinin Onay Tarihi`, `Durum`
  katmanından önce gösterilir (cards #1603/#1604). Active birim içi/dışı taleplerde turuncu
  `Durum` adımı gösterilir (card #1535). Onay bekleyen (`PendingOwnerApproval` /
  `PendingExternalApproval`) taleplerde Talep Tarihi ile Son Tarih arasına mavi
  `Durum / Onay Bekleyen` katmanı eklenir (`pending` state, card #1535 reopen) — **istisna:**
  `ownerApprovalBeforeStatus` açıkken ve sahip-onay adımı görünürken `PendingOwnerApproval`
  için Durum katmanı eklenmez (sahip-onay satırıyla mükerrer; card #1629). **İstisna (cards
  #1652/#1653/#1655):** birim dışı talepte (yönetici veya standart kullanıcı) sahip onayı
  tamamlanmış ve hedef birim yöneticisi onayı beklenirken tüm detay popup Süreç'lerinde Durum
  katmanı hiç eklenmez — hedef `Onay Bekleyen` adımı yeterlidir. Birime Gelen'de
  `Active` + henüz görev yok kayıtları da aynı mavi Durum katmanını alır
  (`unassignedActiveAsPending`, card #1535).
  `MyRequestDetailMainCard` (Taleplerim / İlgili Talep) sahip onayı gösterirken
  `ownerApprovalBeforeStatus: true` kullanır — yönetici-oluşturmuş taleplerde sahip onay
  adımı `Durum`dan önce gelir (card #1636).
  Sahip-birim onayı tamamlanmış fakat hedef-birim onayı bekleyen birim dışı talepte, standart
  kullanıcı Taleplerim ve Birimden Giden timeline'ı turuncu `Durum`dan hemen sonra mavi
  `Talebi Gerçekleştiren Birim Yöneticisinin Onay Tarihi / Onay Bekleyen` adımını gösterir;
  hedef onaylanınca bu sentetik bekleyen adım gösterilmez (cards #1603 reopen/#1606).
  **Güncelleme (cards #1641/#1642/#1645):** Birime Gelen / Birimden Giden'de otomatik hedef damgası
  + sentetik `Onay Bekleyen` birlikte gösterilmez (mükerrer yok). Sentetik / gerçek
  `Talebin|Talebi Gerçekleştiren Birim Yöneticisinin Onay Tarihi` değeri `Onay Bekleyen` ise
  başlık+değer+gösterge mavi (`pending`) — süresi geçmiş taleplerde mavi uygulanmaz (card #1645).
- **Süreç Durum katmanı rengi (cards #1643/#1644/#1645/#1651/#1659):** `Durum / Onay Bekleyen` ve
  `Durum / Yapılmakta` mavi (`pending` / `text-sky-500`) — card #1651/#1659, #1645'in Yapılmakta-
  turuncu kuralını geri alır. Görevlerim / Birimdeki / Personelimin Görevleri görev Süreç
  timeline'ı da aynı kuralı kullanır (card #1659). `Durum / Son Tarihi Geçmiş` (birleşik etiket dahil) turuncu
  (`current`) — card #1644.
  **Güncelleme (card #1646/#1647/#1650 reopen):** süresi geçmiş aktif Durum metni yalnız
  `Yapılmakta` veya yalnız `Son Tarihi Geçmiş` olmaz; `Yapılmakta (Son Tarihi Geçmiş)`
  birleşik etiketi kullanılır. Vatandaş talebinde `İşleme Alındı` metni korunur (Onay Bekleyen'e
  çevrilmez); grid Durum hücresinde kanal ikonu önde gelir (card #1650).
  (Talepler/Taleplerim/Görevler/Görevlerim Süreç kolonu + Birimdeki Görevler İlgili Talep
  Süreç kolonu + ilgili grid durum etiketleri).
- **Üst düzey (Reporter) görev vurgusu (card #1648):** Birimdeki Görevler (ve Görevlerim ailesi)
  gridinde Reporter-kaynaklı talepten gelen görevlerde `Başlık` + `Görevi Yapan` turuncu
  (`#f97316`); detay popup'ta aynı alanlar da turuncudur.
- **Görev Bilgileri İptal/Tamamlama Notu renkleri (card #1638):** `İptal Notu` etiket+değer
  kırmızı (`text-red-600`), `Tamamlama Notu` etiket+değer yeşil (`text-emerald-600`).
- **Görsel ek ikonu (cards #1637/#1637 reopen):** JPG/PNG eklerde `SimpleImageAttachmentIcon`
  (sade çerçeve + dağ çizgisi; Lucide `Image`/`FileImage` değil); ikon boyut sınıfları
  (`size-3` / `size-3.5`) değişmez.
- **Düzenleme placeholder fontları (cards #1615/#1639):** Son Tarih DateTimePicker placeholder
  + seçili değer `0.6875rem`; adres Mahalle/Cadde/Açık Adres placeholder'ları aynı ölçüde.
- **Görev Detayları altındaki Süreç kolonu (card #1527 reopen):** `MyRequestTaskDetailsSection`
  içinde de flat liste değil; görev düzeyinde `JobProcessTimeline` (Görev Tarihi → Durum/Son Tarih
  veya terminal tarih) kullanılır — Taleplerim / Birime Gelen / Birimden Giden ortak. Görev
  Tamamlama/İptal Notu (ya da aktif görev Açıklaması) Süreç kartının önünde yer alır.
- **Görevlerim ailesi ilgili talep öncelik/proje satırları (card #1658):** Görevlerim, Birimdeki
  Görevler ve Personelimin Görevleri popup'larında `Öncelik` ile `Proje mi` ayrı satırlardır;
  `Proje mi`, `Öncelik`in hemen altındadır (birleşik `Öncelik / Proje mi` kullanılmaz).
- **Dashboard pie lejant scroll (card #1704):** tüm `PieChart` lejantlarında satır sayısı
  `> 6` ise `overflow-y-auto`; 6 ve altı (ör. 5) scroll yok.
- **Dashboard status pie chart dönem filtresi (card #1662):** pie chart sorguları üst kartlarla
  aynı şekilde yalnız `CreatedAtUtc` dönem aralığını uygular; dönem dışı açık/gecikmiş kayıtları
  OR ile eklemez.
- **Görev Bilgileri üst metası ve alan sırası:** Görevlerim/Birimdeki Görevler/Personelimin Görevleri
  detayında bağlı talebin `Öncelik` etiketi/değeri `job-detail-card-title--spread` ile Görev Bilgileri
  başlığının sağ border'ına yaslanır; `Normal` bu yüzeyde emerald yeşilidir.
  Talep Bilgileri / Görev Bilgileri başlık altı border çizgisi, yanındaki başlık+meta / Süreç
  başlık border'ıyla aynı yatay hizada kalır (`min-height` on section headings; card #1660).
  İlgili Görev Detayları'nda Görev Bilgileri ↔ Süreç border'ı tek satır başlık
  yüksekliğinde hizalıdır; görev no + tip rozeti absolute sağ üstte border'ı
  aşağı itmez (card #1664 reopen). Kart başlık metni (Süreç vb.) ikon kutusuyla
  aynı düşey hizadadır (`job-detail-card-title__label`; card #1665 reopen).
  Detay kolon başlık altı border'ları metne biraz daha yakındır (`padding-bottom: 0.3rem`,
  grid `min-height: 3rem`; card #1665) — kolonlar arası hiza korunur.
  Süreç timeline listesi başlığın altında `0.9rem` üst boşlukla başlar (card #1672 reopen).
  Detay popup bold kart/bölüm başlıkları `0.875rem` (card #1686 reopen — biraz büyüt,
  çok değil). Talep/Görev Bilgileri etiket `0.75rem`, değer `0.8125rem` (card #1688);
  yönetici notu / ek boş durum metinleri `0.75rem` (#1687).
  Boş ek metni `Talep için ek bulunmamaktadır.`; yükleme etiketi `Dosya / Görsel Ekle (opsiyonel)`
  (card #1690). Birimden Giden detayda ek yükleme yok — salt okunur + boş metin (card #1689).
  Yapılmakta scope chip mavi (`scope-chip--in-progress`); Son Tarihi Geçmiş turuncu
  (`scope-chip--overdue`) — cards #1693/#1695. Birime Gelen'de Onaylanmış → Yapılmakta →
  Son Tarihi Geçmiş sırası; Onaylanmış grid `approvedAtUtc` desc (cards #1694/#1695).
  Birime Gelen breadcrumb `?status=` ile sekme adını takip eder (card #1696).
  Standart kullanıcı Taleplerim `Onaylanmış/Yapılmakta Taleplerim` chip'i mavidir
  (`scope-chip--in-progress`, card #1698) — sarı `approved` chip'i yönetici Onaylanmış'ta kalır.
  Birime Gelen Onaylanmış: `approvedAtUtc != null` — durum sonra değişse bile kalır
  (card #1697). Birimden Giden Onaylanmış: Owner `decidedAtUtc` dolu olan tüm talepler
  (card #1697). Yapılmakta / Tamamlanmış vb. sekmelerde de görünebilirler.
  Birime Gelen Onaylanmış grid İşlemler'de yalnız `Detaylar` — `İptal Et` ve `Onayla`
  yok (cards #1702/#1703).
  Görevlerim/Birimdeki Görevler `Son Tarihi Geçmiş` chip turuncu `scope-chip--overdue`
  (card #1701; mavi `in-progress` değil).
  Desktop sidebar marka metni (`shell.subtitle`) logo altında `gap-3.5` + hafif `pt`
  ile bir kademe aşağı hizalanır (card #1699); boyut `text-sm` kalır (#1692).
  Birime Gelen / Birimden Giden banner `page-kicker` seçili scope chip metnidir;
  `page-title` bölüm adı kalır (card #1700; Taleplerim ile aynı).
- **Ayarlar banner `page-kicker` seçili tab metnidir** (`Kurum`, `Görünüm`, …);
  `page-title` `Ayarlar` kalır (card #1708). Ayarlar’da `Vatandaş Akışı` tab’ı yok (card #1707).
- **Log sayfası üç sekme:** Sistem Log (`Department`/`ApplicationUser`/`TenantSetting`/diğer),
  Talep Log (`Job`), Görev Log (`WorkTask`/`Task`); banner `page-kicker` seçili sekme (card #1710).
  Sekmeler `tab-bar`/`tab-button` kullanır; `scope-chip` ile aktif görünüm bozulmaz (card #1712).
- **Log grid standart:** `FilterableTh` + kolon filtre/sort + `TablePagination`; **Varlık sütunu yok**
  (card #1713 reopen). Talep/Görev Log İşlem etiketleri bildirim `ActionTitle` ifadeleriyle aynı
  (`Görev atandı`, `Görev İptal Edildi`, `Rutin görev oluşturuldu` — ham action kodu yok).
  Detay sütunu bildirim `FormatNote` ile aynı sadeleştirme: teknik `Status=/Targets=/CreatedTasks=`
  ham dump yok; varsa yalnızca lokalize durum (card #1713 Detay).
- **Nav/UI “Birimler”:** `nav.departments` ve departments.* metinleri “Birimler/Birim”dir;
  “Departmanlar” geri gelmez (card #1723).
- **Yeni birim formu LDAP birim çekebilir:** LDAP açıksa Manual|LDAP segmented; LDAP listesinde
  yalnız birim adları. Oluşturma formunda Tür/Müdür/Sorumlular yok — varsayılan tür `Birim`
  (card #1714/#1720). LDAP oluşturmada `SourceType=Ldap`. “Anlık LDAP Birim Senkronize Et”
  yalnız listeyi yeniler / doldurur (`GET /users/directory-departments` — OU + department
  attribute; kullanıcı displayName limitine takılmaz) — kayıt **Oluştur** ile eklenir;
  senkron otomatik `createDepartment` çağırmaz (cards #1717/#1730). Dizin kullanıcı
  araması `department` / `physicalDeliveryOfficeName` alanlarını da tarar. LDAP birim
  düzenleme formu
  müdahale edilemez; Tür yalnız `Birim`/`Administration` (card #1719). Düzenle Tür
  default `Birim`, mevcut `Administration` korunur (card #1720). Yönetim seçilince müdür
  etiketi `Yönetici`.
- **Kurum sekmesi sağ kolon:** üstte Kurum Konumu, altta Hafta Sonu SLA; sol Kurum Bilgisi ile
  alt border hizalı (`items-stretch` + sağ kolon `flex-1`) (card #1715).
- **Birimler/Kullanıcılar grid:** FilterableTh + sort + TablePagination; kolon genişlikleri
  `users-table`/`departments-table` ile orantılı (card #1724). Kullanıcılar Rol StatusPill ortalı;
  İşlemler’de kalem+Düzenle / çöp+Sil ve satır ortalı (cards #1722/#1725/#1732). Banner `+Yeni…`
  açıkken İptal destructive kırmızı; form altındaki ekstra İptal yok (card #1721). Yeni kullanıcı
  **Aktif** Rol kolonunun altında (Ek roller satırını itmez) (card #1718). LDAP kullanıcı
  seçimi birimi otomatik oluşturmaz; kullanıcı/birim **Oluştur** ile eklenir; senkron yalnız
  dizin listesini yeniler (card #1729). `+Yeni Kullanıcı` açıkken grid görünür kalır
  (`desktop-page-fill` form açıkken kapanır — card #1731). Kullanıcılar LDAP formunda
  “LDAP Kullanıcı Çek” solda, “Anlık LDAP Kullanıcı Senkronize Et” sağda (card #1735);
  Birimler’de “LDAP Birim Çek” solda, senkron sağda (card #1737). LDAP dizin e-postası
  yalnız `mail` attribute’tur — boşsa form E-posta alanı boş kalır, UPN ile doldurulmaz
  (card #1734). Yeni kullanıcı E-posta placeholder’ı `ornek@belediye.bel.tr` (card #1740).
  Ek görev birimleri placeholder “Ek birim seçiniz...”; multi-select’te
  arama satırı var; Birim+Ek birimler+Rol+Ek roller+Aktif+Oluştur tek satırda;
  Rol kolonu dar; Rol+Ek roller menü satır metni kompakt; Oluştur geniş ama alçak
  (card #1739).
  Birimi Düzenle dropdown’ları `<label>` ile sarılmaz — dış tıklayınca kapanır (card #1729).
  Birimler grid’inde Tür sütunu yok; Tür yalnız düzenleme formunda ve özet “Tür Dağılımı”nda (card #1741).
- **Rol Sayfa Yetkileri:** standart header + TablePagination default 25; **Sayfa** th ortalı,
  satır adları solda (card #1726).
- **Ayarlar/Birimler/Kullanıcılar (`admin-surface-page`):** helper-copy, label, textbox,
  textarea, settings tab butonları, Oluşturma Modu segmented + LDAP başlıkları kompakt
  shell’den belirgin büyük (cards #1733/#1736/#1738).
- **Otomatik Yönlendirme:** Yönlendirme Kuralları ve Yönlendirme Testi UI yok (card #1727).
- **Mobil detay popup başlığı:** title case (ALL CAPS değil); çok kelimede 2. satır; X sağ üst
  (card #1728). **Masaüstü** detay popup başlığı biraz büyük + `text-transform: uppercase`
  (card #1742) — mobil ölçüler bozulmaz.
- **Mobil Talep Bilgileri satırları:** `Talep Yeri / Oluşturan` ve `Talebi Onaylayan` dahil
  etiket üstte, değer alt satırda (yan yana değil); `StackedFieldValue` mobilde sola yaslı
  (card #1743). Masaüstü sağa yaslı yan yana düzen korunur.
- **Birimler / Kullanıcılar / Ayarlar dropdown’ları** native `<select>` değil ortak
  `SingleSelectDropdown` (card #1709). Kullanıcı düzenleme dept/rol menüsünde arama + kompakt satır (card #1706).
- **Vatandaş Talebi Oluştur modalı WA balonları** `compactBubbles` ile ana `/whatsapp` sayfasından küçük kalır (card #1711).
- **Onayla ve Personel Ata self-istek metni (card #1671):**
  `(Görevi kendisi yapmak istiyor)` — sonda nokta yok.
- **Talep Son Tarih Değiştir (cards #1673/#1666):** Birime Gelen hedef birim yöneticisi
  `UpdateJob` ile Son Tarih kaydedebilir (Owner-only yetki 403 vermez). Birimden Giden sahip
  yöneticisi detay Süreç'te `Onay Bekleyen` yanında `Değiştir` görür.
- **Mobil detay header eşit butonlar (card #1676):** `DisabledActionButton` span sarmalayıcı
  da 2-kolon gridde `width: 100%` — pasif Yönlendir = İptal boyutu.
- **Mobil login logo paneli (card #1675):** yeşil logo alanı Personel Girişi kartıyla aynı
  genişlikte (negatif margin yok).
- **Mobil kurum içi mesajlar FAB (card #1674):** FAB `size-12`; panel yüksekliği `~78dvh`.
- **Bildirim ISO tarih formatı (card #1667):** `FormatNote` hem `Z` hem `+00:00` (round-trip
  `"O"`) ISO zamanlarını `dd.MM.yyyy HH:mm` (yerel) gösterir — özellikle `TaskDueDateUpdated`
  / `JobDueDateUpdated`.
- **Talep son tarihi bildirimi (card #1677):** `UpdateJob` Son Tarih değişince `JobDueDateUpdated`
  yazar; başlık `Talep son tarihi güncellendi`, gövde `T-… — başlık — dd.MM.yyyy HH:mm`
  (`TaskDueDateUpdated` ile aynı kalıp; genel `JobUpdated` / "Title updated" değil).
- **Bildirim "Görev son tarihi güncellendi" başlığı (card #1669):** okunmuş olsa da tüm
  başlık metni `font-bold` kalır (yalnızca eylem kelimesi değil). `/son tarihi güncellendi/`
  eşleşmesi talep başlığını da kapsar.
- **Detay bölüm başlık çizgisi (cards #1679/#1681):** popup içi `job-detail-section-heading`
  alt çizgisi `--color-primary` tonunda ve transparan
  (`color-mix(... 40%, transparent)`, scrollbar ile aynı); gri slate değil.
- **Detay popup boyutu (card #1682):** `.detail-modal-shell` / `--my-request` bir kademe
  daha küçük (`~63–67vw` / `~73–77dvh` bandı).
- **Detay popup header logo (card #1683 reopen):** başlık satırı ortasında login page
  logosu (`/tire-belediyesi-logo.png`); absolute ortalanır, aksiyonlar sıkışmaz.
- **Detay popup header şeridi (card #1685):** `my-request-detail-header::after` rengi
  bölüm başlık çizgisiyle aynı (`color-mix(primary 40%, transparent)`).
- **Süreç Onay Bekleyen metni (card #1684 reopen):** onay adımı ve Son Tarih
  `Onay Bekleyen` değerleri aynı boyutta (`0.75rem`,
  `job-process-timeline__pending-approval-text`) — step-value ile hizalı.
- **Detay popup header aksiyonları (card #1680 reopen):** masaüstünde aksiyonlar
  `flex-nowrap`; `DisabledActionButton` span'ında kalıcı `w-full` yok (mobilde CSS
  grid hücresi verir) — İptal/X bozulmaz.
- **Grid "Yeni" rozeti (cards #589/#607/#1668):** yanıp sönen yeşil `Yeni` tarih kolonunun
  altındadır — Taleplerim/Birime Giden → `Talep Tarihi` (`createdAtUtc` bugün);
  Görevlerim/Birimdeki/Personelim → `Görev Tarihi` (`assignedAtUtc` bugün);
  Birime Gelen Onay Bekleyen → `Talep Tarihi`. Terminal (Completed/Cancelled/Rejected)
  satırlarda gösterilmez (#606).
  Alanlarda `Görevi Atayan Yönetici` üstte, `Görevi Yapan` hemen alttadır (cards #1611/#1613).
  Durum Değiştir geçmişi Süreç timeline'ı altında, son işlemin gerçek nedeni hemen altındadır
  (cards #1619 reopen/#1624).
- **Birime Gelen Görev Detayları açıklaması (card #1584):** yalnız Birime Gelen detay popup'ında
  aktif görevin düz `Açıklama` kartı gizlenir; terminal Görev Tamamlama/İptal Notu korunur.
- **Yönetici Taleplerim görev özeti (card #1550):** yalnız Manager/SystemAdmin görünümünde düz
  `Açıklama` kartı gizlenir; terminal tamamlama/iptal notu korunur.
- **Standart kullanıcı Taleplerim popup düzeni (cards #1549/#1602):** Manager/Reporter olmayan
  kullanıcıda `Adres Bilgileri` ve `Talep Ekleri` ana talep kartının altında ayrı kutular olarak
  gösterilir; Talep Ekleri Talep Bilgileri listesinde tekrarlanmaz. Dolu Yönetici Notu,
  Talep Bilgileri listesinde `Proje mi` satırından sonra kalır. Görev Detayları düz `Açıklama`
  kartı gizlenir (terminal tamamlama/iptal notu korunur). Düzenleme modunda ek yükleme/adres alanları için eski
  kutucuklar düzenlenebilir kalır; Yönetici Notu düzenleme kutusu standart kullanıcıya açılmaz ve
  dolu not düzenleme sırasında da Talep Bilgileri'nin son satırında kalır. (Round 251'deki geri alma, müşterinin 12 Tem 21:48 reopen'ıyla
  geçersizdir.)
- **Talep detay düzenleme kontrolleri kompakttır (card #1601/#1691):** detay içi `Düzenle` modunda
  Öncelik ve Mahalle dropdown seçenekleri 12px; başlık textarea'sı masaüstünde
  `min(14.5rem, 100%)` — talep numarası/rozet kolonuna binmez (card #1691 8. tur),
  mobilde 7.5rem; font 0.8125rem; Son Tarih kontrolü tam placeholder için
  en fazla 12rem/12px; `Dosya ekle` son görsel dengelemesinde 1.625rem/10.5px'tir
  (card #1601 fourth reopen). Bu ölçüler genel form/dropdown bileşenlerine yayılmaz.
- **Birime Gelen / Giden Talep Detayları kolon düzeni (card #1534):** Taleplerim ile aynı —
  kolon1 = başlık + talep no/tip + açıklama metni; kolon2 = Talep Bilgileri; kolon3 = Süreç
  timeline. Ayrı `Açıklama` paneli ve Talep Bilgileri içindeki tekrarlayan başlık/no satırları yok.
  Talep no + Birim İçi/Dışı meta bloğu başlık satırında sağ border'a hizalıdır (card #1534 reopen).
  İlk satır 3 kolon yekpare tek dış çerçeve + iç `border-r` ayırıcıdır; ayrı kutucuk değil (card #1536).
- **Birime Gelen / Birimden Giden detay alt kart başlıkları:** `Adres Bilgileri`, `Yönetici Notu`,
  `Ekler / Fotoğraflar` Taleplerim ile aynı `MyRequestSectionHeading` + teal ikon
  (`MapPin` / `NotebookPen` / `Paperclip`) ve `job-detail-card-title` tipografisini kullanır;
  düz `h3` border-b başlık kullanılmaz. Adres alanları `AddressDetailFields variant="my-request"`.
  Shell `detail-modal-shell--my-request` taşır.
- **Yönetici Notu limiti (card #1585):** yönetici detay popup'larındaki textarea ve
  `SetJobManagerNoteCommand` en fazla 100 karakter kabul eder; başlık yanında
  `(max 100 karakter) *` gösterilir.
- **Terminal işlem notları 100 karakterdir:** Görevi Tamamla `Tamamlama Notu`, Görevi İptal Et
  `İptal Nedeni`, Talebi İptal Et `İptal Nedeni` ve Görev Durum Değişikliği nedeni frontend
  `maxLength` + açıklama metninde ve backend FluentValidation'da aynı 100 sınırını uygular
  (cards #1620/#1621/#1622/#1623).
- **Görev detayında terminal not konumu:** Görevlerim/Birimdeki Görevler/Personelimin Görevleri ile
  Taleplerim/Birime Gelen/Birimden Giden popup'larında terminal görev notu `Görev Bilgileri` içinde
  `Görevi Yapan` sonrasında gösterilir; tamamlanmışta `Tamamlama Notu`, iptal/reddedilmişte `İptal Notu`
  etiketi kullanılır. Talep detayındaki ayrı terminal not kartı tekrar edilmez; normal Açıklama kartı
  yalnız ilgili yüzey açıklamayı zaten gösteriyorsa kalır (card #1628 reopen).
- **Görev durum dropdown'u ortak tasarımdır:** Görev Durum Değişikliği popup'ı native `select`
  kullanmaz; portal tabanlı `SingleSelectDropdown` ile diğer form dropdown'larıyla aynı görünür
  ve bu popup'ta seçili değer/placeholder ile menü seçenekleri 12px kalır (card #1612 reopen).
- **Vatandaş kanalı Birime Gelen detayda (card #1532):** `Talep Bilgileri` başlık satırının sağında
  kanal ikonu + kanal adı; metin rengi ikon rengiyle aynı (`getChannelLabelColor`).
- **Talep detay öncelik başlığı (card #1599):** Taleplerim, Birime Gelen ve Birimden Giden
  detaylarında `Öncelik` Talep Bilgileri satır listesinden çıkar; başlığın sağ sınırında etiketi
  üstte, değeri altta görünür. Etiket title-case (`Öncelik`) ve 12px kalır; yalnız değer önceki
  görünümden biraz küçülerek 11px olur ve `Normal` değeri yeşildir. Vatandaş kanal ikonu/adı
  varsa bu bloğun solunda kalır
  (card #1599 reopen). Detay içi `Düzenle` modunda değer aynı başlık konumunda kompakt dropdown'a
  dönüşür; `Talep Yapılan Birim` satırının altında ikinci bir Öncelik alanı oluşmaz
  (cards #1587 reopen/#1600).
- **Vatandaş Talepleri detay alt kartları (card #1587):** salt-okunur vatandaş detayında
  `Proje mi` ve `Talep Ekleri` Talep Bilgileri satırlarında görünmez; `Adres Bilgileri` ile
  `Talep Ekleri` kendi başlıklı kutuları olarak ana kartın altında gösterilir.
- **Görev İptal Notu (card #1530):** job detay `TaskSummaryResponse.RevisionReason` iptal/red
  görevlerde dolu gelir; UI önce `task.revisionReason`, yoksa `detail.cancelReason` gösterir —
  "İptal notu girilmemiş" yalnızca ikisi de boşsa yazılır.
- **Görevi Birim İçi Yönlendir personel seçimi (card #1607):** native `<select>` değildir;
  ortak portal tabanlı `SingleSelectDropdown` kullanır. Trigger `Personel seçiniz` metni 12px,
  açılan seçenekler 12px/2rem satır yüksekliğindedir ve uzun listede standart arama/scroll davranışı korunur.
- **Açıklama alanı başlıkları:** talep/rutin/vatandaş/e-Devlet açıklama giriş başlıklarında
  `(max 400 karakter) *` ibaresi görünür; RichTextEditor zaten 400 düz-metin karakter sınırını uygular.
- **Talep oluşturma Açıklama editörü yüksekliği (card #1533):** içerik aşağı uzayınca kutu
  büyümez; `min-height` = `max-height` + `overflow-y: auto` ile dikey scroll açılır
  (`RichTextEditor` ve e-Devlet dönüşüm textarea'sı).
- **Grid başlık casing/padding:** TÜM gridview header'ları (`data-table`, `table-container`,
  `wallboard-table`) `text-transform: uppercase` kullanır (card #1342 — #1318'i tersine çevirdi);
  `FilterableTh` label/ikon aralığı iki ayırıcı arasında dengeli olmalıdır.

## 5. Dashboard / Wallboard

- **Banner buton sayımları client-side hesaplanır; dashboard'da bu aggregation YOK.**
- **Yönetici `Personelimin Görevi Çözme Süresi` grafiği:** yalnız Manager rolünde ve yöneticinin
  kapsamındaki personele atanmış rutin olmayan terminal görevleri kullanır. Süre Görev Tarihi
  (`CreatedAtUtc`) ile tamamlananda `CompletedAtUtc`, iptalde son `TaskCancelled` audit zamanı
  arasındadır; personel başına ortalama saat (1 ondalık) gösterilir.
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
- **Dashboard pie lejant yüksekliği (card #1597):** ortak `PieChart` lejantı en fazla 5 satır
  yüksekliğinde kalır; daha çok dilimde yalnız sağ lejant dikey scroll olur. Donut ve dashboard grid
  kartı uzun etiket listesi yüzünden aşağı doğru büyümemelidir.
- **Talep Etiketi pie chart'ı (card #1591):** yalnız Üst Düzey Yönetici (`Reporter`) ve Vatandaş
  Operatörü (`Operator`) dashboard'larında görünür. Tenant ve seçili tarih aralığındaki talebi
  `SocialMessage.JobId` üzerinden tek kez sayar; etiket kaynağı önce `SocialMessage.Category`, boşsa
  bağlı `CitizenConversation.Label` değeridir. Tanımlı `RequestTag` adları sıfır sayıda da lejantta
  kalır; geçmişte kullanılmış fakat sonradan tanımdan kaldırılmış etiketler kaybolmaz. `Yapılmakta Olan` yalnız `JobStatus.Active`,
  `Tamamlanan` yalnız `JobStatus.Completed`, `Tümü` ise tüm durumları kapsar; durum butonları
  Görevlerim filtreleriyle aynı başlık hizası/tasarımında, etiket adı ve sayısı sağ lejantta kalır.
- **Vatandaş Talep Kanalları pie chart'ı**, `SystemAdmin`, `Manager`, `Operator` ve Üst Düzey Yönetici
  (`Reporter`) dashboard'larında görünür; `Reporter`/`SystemAdmin` tenant genelini, `Manager` ise
  aktif/kapsamındaki birime gelen VT taleplerini (`OwnerDepartmentId` veya `JobDepartment.Target`) sayar.
  Kanal kırılımında kanonik bağ `SocialMessage.JobId + CitizenRequestNumber`'dır; `Job.SourceRefId`
  boş/uyumsuz olsa bile VT kanalı kaybolmamalıdır. VT job adaylığı yalnız `RequestType=Citizen`
  ile sınırlanmaz; `SourceType ∈ {SocialMessage,CitizenRequest,EDevlet}` veya linkli VT numaralı
  `SocialMessage.JobId` de grafiğe dahil olur.
  Aynı kanal etiketi (`channel.Phone` vb.) hem linkli SocialMessage hem unlinked legacy
  `SourceType=SocialMessage→Phone` yolundan gelirse tek dilimde birleştirilir — çift "Telefon"
  dilimi olmaz. Unlinked `SocialMessage` + `RequestType≠Citizen` (orphan/test) grafiğe girmez.
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
- **Grid durum/son tarih uyarı renkleri (cards #1387/#1649/#1650):** `Yapılmakta` status chip'i
  mavi (`bg-sky-100 text-sky-700`); `Yapılmakta (Son Tarihi Geçmiş)` iki satır (alt satır
  ortalı `(Son Tarihi Geçmiş)`) ve **solid** turuncu chip (`bg-orange-500 text-white`, açık
  `orange-100` değil — card #1649 reopen); `İşleme Alındı` koyu turkuaz + beyaz yazı
  (`bg-teal-600 text-white`, card #1650) + vatandaş kanal ikonu (VT no ile aynı
  `ChannelIcon`). Bugün dolan `Son Tarih` pill'i sarı arka plan, sarı takvim ikonu ve sarı
  çerçeve/yazı dilinde kalır.
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
- **Ek süre talebi bildirim Detay popup'ı (card #1394):** yöneticiye giden `TaskExtraTimeRequested`
  (başlık `Ek süre talebi`) Detay ile **Birimdeki Görevler** popup'ını açar (`/department-tasks?taskId=…`,
  `TasksPage mode=departmentTasks`). Audit-feed actionUrl da `/my-tasks` değil `/department-tasks`
  üretir; FE başlık eşleşmesi eski yanlış URL'leri de department scope'a zorlar. Görevlerim popup'ı
  kullanılmaz — onay/red "Ek süre talebini gör" bu yüzeyde görünür.
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
