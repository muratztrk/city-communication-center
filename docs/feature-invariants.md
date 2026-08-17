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
- **Harita / Konum UI (#2572 / #6a6cf0d1 / #2610):** Uygulama içi Google Maps
  `Vatandaş Talep Haritası` (`/citizen-request-map`, vatandaş lisansı) ve
  `Birim Talep Haritası` (`/department-request-map`, yalnız Kurum İçi İş Takip lisansı, #2610)
  sayfalarında. Anasayfa'da harita yok.
  Vatandaş Talepleri grid’inde Konum satırı yok. Talep detayında lat/lng metni olabilir;
  WhatsApp balonunda dış `maps.google.com` linki kalabilir.
- **Demo seed YOK** → doğrulama = `dotnet build` + FE `npm run build` + `npm run lint`.
  Veriye bağlı akışlar runtime'da E2E edilemiyor; kod + build + (varsa) ekran görseli.
- **Türkçe casing tuzağı (tekrar eden bug):** arama/filtrede default `toLowerCase()` Türkçe
  "İ"yi bozar → **her zaman `toLocaleLowerCase('tr')`** (hem sorgu hem haystack). Bkz.
  `hooks/useColumnFilters.ts`.
- **Tüm hata/validasyon mesajları Türkçe.**
- **Tarayıcıdan yerel ağa istek atma (#6a6e1900):** herkese açık bir host'ta açılan sayfa
  private-range bir adrese istek atarsa Chrome "Yerel ağınızdaki diğer cihazlara erişin" izni
  sorar. `api/config.ts` bunu **şemadan bağımsız** engeller (http'de de) ve aynı origin'e düşer;
  bu geri düşüş sayfanın origin'inin `/api`, `/connect`, `/hubs` proxy'lemesine dayanır (nginx
  yapıyor). Frontend'de LAN'a giden tek yol `VITE_API_ORIGIN`'dir — yeni mutlak URL ekleme.
- **Modallar `zoom` stacking-context içinde** (~0.81 scale). Tam ekran / her şeyin üstünde
  durması gerekenler `createPortal(..., document.body)`. Portal sonrası modal scale 1.0'a
  döner → **`max-h-[min(85dvh,52rem)]`** kullan, sabit `h-[..dvh]` DEĞİL (bkz. lessons.md).
  Özellikle Görevlerim iptal/tamamla/durum popup'ları da Taleplerim gibi body'ye portal
  edilmeli; aksi halde `.app-content-shell .form-card` kompakt stilleri popup'ı küçültür.
- **Detay popup ESC (#2816):** `MyRequestDetailModal`, Görevlerim/Birime Gelen detay portal'ları ve
  `ModalBackdrop onEscapeClose` — ESC = kırmızı X ile aynı kapatma; üstte yüksek öncelik overlay
  (`data-escape-overlay="high"`) açıkken alt detay ESC almaz.
- **Popup içi grid ölçüsünü sayfa grid'iyle eşitlerken aynı rem değerini KOPYALAMA (#6a6cffd1):**
  portal edilen popup shell zoom'unu (0.76–0.90) almaz, aynı rem orada daha büyük görünür.
  `AppShell` zoom'u `--app-content-zoom` olarak `documentElement`'e yazar; popup kuralları
  `calc(... * var(--app-content-zoom, 1))` ile çarpmalı. Ayrıca **`min-height` table-cell'de
  yok sayılır** — başlık yüksekliğini sabitlemek için `height` kullan (`--table-header-row-height`).
- **Grid thead + paging sabit yükseklik (#2824):** sayfa boyutu değişince başlık şeridi büyümemeli —
  `thead th` `height`/`max-height: var(--table-header-row-height)`; paging bar `max-height:
  var(--table-chrome-row-min-height)`; `background-attachment: fixed` thead'de kullanılmaz.
- **Popup gridview başlık şeridi standart gridview gibi üstten kavislidir** (0.9rem): scroll kabı
  olan tablolarda kavis `thead th:first-child/:last-child`'a verilir (araya `overflow:hidden` bir
  sarmalayıcı koymak sticky thead'i bozar); ayrı wrap'i olanlarda (`.dashboard-drilldown-table-wrap`)
  wrap'e verilir.
- **Footer yüksekliği değişirse `--fab-footer-clearance` de güncellenmeli**, yoksa WhatsApp/scroll
  FAB'ları footer'ın üstüne biner.
- **Tailwind utility'sini CSS'ten ezerken `!important` ŞART (#6a664c6f):** globals.css `@layer
  components` içinde; Tailwind v4'te utilities katmanı bunu yener, importance'sız kural sessizce
  hiç uygulanmaz. `w-*`, `shrink-0`, `gap-*` gibi bir utility'yi override eden her kuralda kullan
  ve tarayıcıda computed value ile doğrula — "yazdım ama olmadı" kartlarının tipik nedeni budur.
- **Dropdown / DateTimePicker** overflow bar tarafından kırpılır → body'ye portal + `forceDown`.
  `SingleSelectDropdown` hover tooltip yok (#2754).
- **Tüm ortak dropdown'lar 7+ seçenekte otomatik arama gösterir:** çağıran ayrıca `searchable`
  vermese de `SingleSelectDropdown` ilk satıra Türkçe casing uyumlu arama alanı ekler.
- **Yeni dropdown'larda native `<select>` açma:** mahalle seçimindeki ortak `SingleSelectDropdown`
  standardını (portal paneli, ortak satır/hover, gerektiğinde arama) kullan; yeni özel/native menü üretme.
- **`MultiSelectDropdown` menüsü de body portal + fixed** (`SingleSelectDropdown` ile aynı); tablo
  hücresinde absolute panel komşu sütunlara binmez (card #1706).
- **Yerel (Manual) kullanıcı düzenleme:** Kullanıcı Adı / Ad Soyad / Ünvan / e-posta satır içi
  düzenlenebilir; LDAP'da bu dört alan salt okunur. Login `Username OR Email` kullandığı için
  kullanıcı adı ve e-posta tenant içindeki iki alanın tamamında ortak benzersiz kalır.
  Manual kullanıcının ana birimi `SingleSelectDropdown` kullanır; LDAP kullanıcısının ana birimi
  dizinden geldiği için salt metindir ve backend değişikliği reddeder. LDAP kullanıcısına yalnız
  `MultiSelectDropdown` üzerinden ek birim verilebilir. Birincil rol düzenlenebilir
  (`SingleSelectDropdown`) kalır (cards #1705/#2270/#2274).
- **Müdür ek rol kısıtı:** Birincil rolü `Manager` (UI'da Müdür/Sorumlu) olan kullanıcıya
  `Staff` veya `CitizenRequestManager` ek rolü verilemez; frontend seçenekleri gizler ve backend
  `UserRoleAccess.ApplyAdditionalRoleCodes` kuralı zorunlu uygular (card #2273).
- **Mobil genişliklerde (<1024 CSS px) desktop zoom uygulanmaz:** içerik/sidebar `zoom=1`
  kalmalı; aksi halde telefonlarda native dikey scroll ve form ölçekleri kırılır.
  Mobil sol menü sola kaydırılınca parmağı takip ederek kapanır; aniden kaybolmaz (#2739).
- **Mobil sayfalarda kabuk/login dikey scroll'u kesmemeli:** `overflow-hidden` yalnız desktop
  breakpoint'lerinde kullanılmalı; iki kolonlu/split panel yerleşimleri telefonda alt alta akmalı.
- **Mobil login/sidebar marka alanı:** login logo kartı kullanılan koyu yeşil yüzeydir ve Atatürk
  silüeti kart border'ının içinde sol üstte kalır. Mobil drawer belediye logo çerçevesi logoya göre
  gereksiz büyük tutulmaz; logo çerçevenin içinde belirgin beyaz nefes payıyla daha küçük kalır.
  Desktop sidebar `MunicipalitySeal` çerçevesi `h-[5.25rem] w-[85%] max-w-[11.5rem]` sabit kalır;
  logo görseli `imageClassName ~86%` ile çerçeve içinde büyütülür (çerçeve boyutu değişmez);
  yüklenen görselin intrinsic boyutu login/sidebar çerçevesini büyütemez (card #2252).
- **Banner başlığının (2. satır) ağırlığı kontrollü kalır:** `.sticky-page-header .page-title`
  `font-weight: 500` kullanır; Anasayfa / Vatandaş Bilgi Listesi gradient banner
  `.section-card > .grid.border-b .page-title` da `font-weight: 500` (#2511 reopen); Vatandaş Talep Haritası
  banner başlığı aynı `page-title` sınıfını kullanır (#2579). En büyük banner metni
  `page-title` clamp tavanı ~1.85rem (masaüstü) / ~1.45rem (mobil) — 2rem/1.55rem değil (#2637).
  Talep Oluştur tür seçim kartları (`Birim İçi/Birim Dışı/Vatandaş Talepleri`)
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
  "Görevi Yönlendir" sadece Bekleyen/Geciken detayında görünür (yönlendirilemeyende pasif),
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
  Görevlerim detay → Düzenle’de **Başlangıç Tarihi** satırı hiç gösterilmez; kayıtta mevcut `startDateUtc` gönderilir (#2736 reopen).
- **Atanmış görev detay popup'ında `Öncelik` satırı gizlidir:** `Görev Tipi = Atanmış`
  olduğunda Görevlerim `Görev Detayları` altındaki Öncelik etiketi ve değeri görünmez; rutin
  görevlerin öncelik satırı korunur (card #1118).
  **İstisna (#r537):** Taleplerim / Birime Gelen / Birimden Giden `İlgili Görev Detayları`
  (`MyRequestTaskDetailsSection`) içinde Öncelik, `Görevi Yapan` satırından hemen sonra her
  görev tipinde görünür; renk `getPriorityColorClass`.
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
  gösterilmez; varsa Görevlerim detayında `Görev Bilgileri` içinde `Görevi Yapan` satırının
  hemen altında, `Durum Değişikliği` ile aynı geçiş özeti tasarımında (ilk atanan → son atanan +
  tarihler) görünür — ayrı alt kart/kutucuk yok (card #1746).
- **Görev Detayları durum değişikliği özeti:** Durum değiştiyse `Durum Değişikliği`, Görev Bilgileri
  içinden çıkar ve sağdaki `Süreç` timeline'ı bittikten sonra satır olarak görünür; okun iki yanındaki
  durum metinleri 12px kalır. `Durum Değişikliği Nedeni` ise `Görevi Yapan` satırının hemen altında,
  audit `Notes` alanındaki gerçek textbox verisini gösterir. Backend
  hem `GetTaskByIdQuery` hem `JobQueries` projeksiyonunda `Notes`/`ActorDisplayName` taşır.
  Özet ilk durum → son durumdur; metinler normal ağırlıkta, tarihler saniyesiz ve durumların altında
  ortalıdır. `İptal`/iade kırmızı, `Yapılmakta` mavi (`text-sky-500`), `Tamamlanmış` yeşildir
  (card #2105; eski turuncu #1624/#1619 geri alındı).
- **Görev Detayları geçmiş kolonları (eski):** Açıklama yanında Atama Geçmişi sütunu kaldırıldı
  (#1746); atama özeti artık Görev Bilgileri satırıdır.
- **CitizenRequestManager `Birimdeki Görevler`:** müdürlük ilişkisiyle değil, çalışabildiği
  birimlerle scoped edilir; backend+frontend yalnızca `JobCitizenRequestHelper` citizen görevlerini
  gösterir ve CRM bu görevlerde yönetici aksiyonlarını kullanabilir (card #1071).
- **Durum Değişikliği Geçmişi (TasksPage detayı, card #2/#1097):** `TaskDetailResponse.StatusChangeHistory`
  yalnız `ChangeTaskStatusCommand` (`TaskStatusChanged` audit) geçişleridir — normal Cancel/Complete
  akışı burada yoktur. İptal Süreç tarihi için `TaskDetailResponse.UpdatedAtUtc` kullanılır; iptalde
  bu alan son `TaskCancelled` audit `EventTimeUtc` (yoksa entity `UpdatedAtUtc`) değeridir (card #1795).
  Sadece Görevlerim detayında, Açıklama'nın sağında ek sütun (rutin görevlerde gizli).
- **Log Detay `RoutineTaskEditSnapshot`:** ham JSON/`\\u` kaçışları gösterilmez; başlık/öncelik/adres/
  açıklama/ekler özetlenir (card #1806). Detayda `Log ID` (`auditLogId`) satırı vardır (card #1807).
  Banner'da Jobs/Tasks ile aynı search + tarih aralığı vardır (card #1811); ayraç `—` yeşildir (#1809).
- **Anlık LDAP sync popup:** `updatedUsers` eski→yeni alan farklarını listeler; özet mesaj tek satırdır
  (cards #1813/#1815).
- **Görev Ekleri sütunu (Tasks / Taleplerim / harita Detaylar):** tamamlanmış görevde yalnızca gerçek görev eki varsa
  görünür; ek yoksa boş "Görev Ekleri" satırı hiç oluşmaz (#2705).
- **DateTimePicker NAİF yerel duvar-saati sözleşmesi (round 380, #1677):** `DateTimePicker` value'su
  "YYYY-MM-DDTHH:mm" yerel saattir; ISO'dan dönüşüm HER ZAMAN `utils/dateTimePicker.ts` içindeki
  `toDateTimePickerValue` ile yapılır. `toISOString().slice(0,16)` (UTC dilimi) YASAK — saati UTC
  ofseti kadar erken gösterir ve her kayıtta tarihi geriye kaydırır. Sayfa içi kopya helper yazma.
- **Banner Başlangıç/Bitiş tarih chip'i (round 532–#r539):** `.scope-chip-date` genişliği `≥11.5rem`
  (saat dahil `dd.mm.yyyy HH:mm` sığsın, #r539). Takvim ikonu `size-3.5` / chip ~0.8125rem.
  `ScopeChipDateRange` saati gösterir (dateOnly YOK — #r539; #r533 dateOnly geri alındı).
  Takvim portalında sağ üst X: default çerçeve yok; hover'da kırmızı + yuvarlak (#r538 / #2008).
  Range: Başlangıç seçiliyse Bitiş'te önceki günler disable; Bitiş seçiliyse Başlangıç'ta sonraki
  günler disable (`minDateTime`/`maxDateTime`, #r538).
- **Talep son tarih bildirimi (round 380, #1677):** `UpdateJobCommand`'da son tarih değiştiyse
  `JobDueDateUpdated` audit'i KOŞULSUZ yazılır ("yalnızca son tarih değiştiyse" guard'ı geri getirme —
  kozmetik alan diff'leri bildirimi yutar); jenerik `JobUpdated` yalnız başka alan da değiştiyse eklenir.
- **Ek listesi sunumu (round 317, #1614/#1617 / #r488/#r490):** Talep/Görev Ekleri listeleri view ve edit
  modunda AYNI görünür: iki kolon, bordersız satır, dosya adı **koyu mavi** `blue-700`
  (`#1d4ed8` / `rgb(29 78 216) !important`, ikon dahil); `!important` CSS kuralı utility layer'ı ezer.
  Görev Bilgileri satırında ikon/metin biraz küçük. İki satırı aşınca scroll. Rutin düzenleme geçmişi Önceki/Sonraki İSTİSNA: tam liste.
  Görsel ek adının hemen sağında küçük yeşil **Ön İzle** (Eye) vardır (`flex-1` yok — buton ada
  yapışık); lightbox `document.body` portal + `z-[400]` ile detay modalının üstünde açılır (#2709/#2732).
  Detay popup'ta **Talep Bilgileri** altında Talep Ekleri satırı yalnız ek varsa görünür (#2734 reopen).
  **Talep Bilgileri** ve **Görev Bilgileri** altındaki ek satırında dosya adı + Ön İzle, üst değer satırının sağ kenarıyla aynı düşey hizadadır (değer kolonu `align-items: flex-end`; scrollbar-gutter ek kümesini içeri kaydırmaz) (#2733 reopen); diğer rich-list yüzeyleri sola hizalı kalır. Ad ile Ön İzle arası
  biraz açıktır (#2735). **Dosya ekle** tıklanınca progress bar %0 görünür; dosya seçilince bar
  `holdAtZero()` ile %0'da **görünür kalır** (sahte `start()` animasyonu yok, kaybolmaz) ve yüzde
  yalnız gerçek yükleme sırasında XHR `report` ile ilerler (#2728 reopen).
- **Adres etiketi (#r488):** UI/validasyon metinlerinde `Cadde / Sokak` (eski `… / Bulvar` yok).
- **Talep Bilgileri WhatsApp etiketi (#r486/#r487):** kanal metni `#169A45`; ikon
  `.channel-icon--whatsapp` (`brightness(0.78)`).

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
  seçili dosyaları kayıt oluştuktan sonra XHR progress callback'iyle yüklenir; progress bar
  Dosya ekle tıklanınca %0’da görünür ve dosya seçilince `holdAtZero()` ile %0'da bekler (kaybolmaz);
  yüzde yalnız kayıt sonrası XHR `report` akışında ilerler (#2728 reopen). Son bekleyen dosya
  silinince bar `stop()` ile kapanır — aksi halde %0'da asılı kalır.
  tüm dosyalar için birleşik yüzde gösterilir. Vatandaş create/edit akışı da seçili dosyaları
  oluşan job'a gerçekten yükler (card #1610 create-form reopen).
- **Adres girişleri mahalle kapılıdır:** talep/rutin/e-Devlet/Taleplerim düzenleme formlarında
  Cadde/Sokak, No ve Adres Tarifi alanları Mahalle seçilmeden aktif olmaz; mahalle temizlenirse
  alt adres alanları da temizlenir. Mahalle seçildikten sonra Cadde/Sokak **ve No** zorunludur
  (etikette `*`, `required`); **Adres Tarifi zorunlu değildir** (`*` yok) — #2582.
  Mahalle seçilince başlıkta `*` ve dropdown chevron sağında kırmızı X (clearable) — #2715. Taleplerim terminal talep notu süreç satırında tekil **Not**
  linkidir; terminal tarih etiketinde `(İptal)`/durum parantezi basılmaz; Görev Detayları terminal
  not kopyasını tekrar göstermez (cards #1196/#1197/#1198).
- **Adres alan limitleri:** Cadde / Sokak tüm giriş yüzeylerinde en fazla 50 karakter,
  No (kapı/sokak numarası) en fazla **6** karakter ve yazılan her karakter büyük harf
  (`toLocaleUpperCase('tr')`, #2585), **Adres Tarifi** (eski Açık Adres) en fazla 100 karakterdir;
  backend komut validasyonları da aynı sınırı korur (#2567/#2578).
  WhatsApp Vatandaş Bilgileri ve yazdırma çıktısında etiket `Adres Tarifi`; yazdırmada Cadde/Sokak
  altında ayrı `No` satırı vardır (#2586/#2588). Adres Tarifi placeholder:
  `Mevki, daire, kat bilgisi giriniz...` (#2660/#2669). Cadde placeholder her yerde
  `Cadde seçiniz` (#2721). No `No seçiniz` (#2669). Konum Koordinatı placeholder
  `Link giriniz...` (#2722); taşan metin ellipsis + hover tooltip, punto biraz küçük (#2725).
- **Adres metni yazımı:** Cadde / Sokak ve Açık Adres değerleri Türkçe locale kurallarıyla
  her kelimenin ilk harfi büyük, kalan harfleri küçük olacak biçimde normalize edilir
  (`normalizeTitleCaseField` — onBlur + kayıt). Rutin görev detay Düzenle dahil tüm adres
  giriş yüzeylerinde uygulanır (#r499).
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
  Detay popup düzenleme yüzeylerindeki yükleme progress bar'ı Dosya ekle seçilir seçilmez
  görünür (#2510). XHR progress callback'i korunur. Görevi Tamamla / Görevi İptal Et popup'larındaki `Dosya ekle` anlık yüklemesi de aynı
  ortak progress bileşenini kullanır (card #1610).
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
  step'i gösterilir (cards #1212/#1213/#1214/#1215/#1216/#1215-reopen/#1275). Vatandaş talebi popup
  Süreç'inde terminal olmayan işlerde Talep Tarihi ile Son Tarih arasında `Durum` vardır:
  `İşleme Alındı` / `Yapılmakta` (mavi) / `Geciken` (turuncu, birleşik `Yapılmakta (…)` değil)
  — `getCitizenRequestStatusLabel` backend `CitizenJobStatusLabelHelper` ile aynı — #2574 reopen.
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
  en sağda iki satırdır: üstte talep no, altında `Birim İçi` / `Birim Dışı` veya vatandaş talebinde
  `Vatandaş Talebi` rozeti (#2575). Görev popup `İlgili Talep Detayları` Talep Bilgileri sağındaki
  VT numarasının alt satırı da vatandaş talebinde `Vatandaş Talebi` yazar, `Birim Dışı` değil (#2583).
  Taleplerim/görev detay popup gövdesi ortak `.detail-modal-shell` / `--my-request`
  ölçülerini kullanır (card #1682 ile küçültülmüş band); sayfa bazında yeniden ayrıştırma.
  Taleplerim salt-okunur Talep Bilgileri listesinde `Proje mi` ayrı satırdır ve formdaki
  `Proje niteliğinde mi?` çevirisini kullanmaz; `Öncelik` ise Talep Bilgileri başlığının sağ
  sınırında etiketi üstte, değeri altta olacak biçimde gösterilir (cards #1586/#1599).
- **Taleplerim/Vatandaş Talebi detay alt kartları:** `Talebin Gittiği Birim / Görevi Yapan`
  etiketi tek satır kalır; atanmış kullanıcı yoksa yalnız birim adı (` / -` yok, #r481);   `Adres Bilgileri`
  içinde Mahalle, `Cadde / Sokak`, `No` ve `Adres Tarifi` durur; adres etiketleri
  kendi içinde satır kırmaz (etiket tek satır). Yanında yalnız Talep Ekleri varken (`--attachments-only`)
  Mahalle / Cadde / Sokak / No / Adres Tarifi **aynı satırda kolon içi ortalı**, başlıklar
  çok az sola kayar (`translateX(-0.45rem)`, #2576 reopen). Yanında 1'den fazla kutu
  (`--three-cards`) iken dört adres başlığı **ve** `-` `translateX(0.45rem)` sağa (aynı
  düşey eksen); **No** başlık+değer `2.4rem` (`.address-detail-my-request__item--street-no`); boş Adres Tarifi
  Mahalle ile aynı `0.7rem` sol kenar (#2576).
  `Ekler / Fotoğraflar`
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
  **Rutin Görev Oluştur (card #1821/#1869):** `Açıklama` başlığının sağında WhatsApp ile aynı
  `Şablon mesajlar` + `Şablon mesaj ekle` bileşenleri; seçim açıklama RichText'e yazılır.
  Kayıt sonrası yönlendirme `/my-tasks?view=pending` (Bekleyen Görevlerim — card #2548).
  Şablon menü `menuAlign="start"` ile buton soluna hizalanıp **sağa doğru** açılır (card #1869).
  **Kişisel şablon popup (card #1822):** `Kayıtlı şablonlar` native `<select>` değil;
  `SingleSelectDropdown` (portal + standart stil).
  Yanıt textarea'sının sağındaki ileti butonu textarea boyunca uzamaz; küçük buton olarak alt
  kenara hizalanır (`self-end`).
- **Taleplerim adres detay etiketleri:** `Adres Bilgileri` altındaki `Mahalle`,
  `Cadde / Sokak` ve `Açık Adres` etiketleri değerlerden bağımsız daha büyük okunur;
  adres değerlerinin font boyutu değiştirilmez (card #1246).
- **Talep oluştur adres girişleri:** Birim içi, birim dışı ve vatandaş talebi oluşturma
  formlarında `Cadde / Sokak` input değer fontu `Açık Adres` textarea değeriyle
  aynı okunurlukta kalır; açık adres değeri özellikle küçük düşürülmez (card #1247).
- **Birim içi talep oluşturma alan sırası:** `Talep Başlığı`ndan sonra `Görevi Yapan Kişi/Birim`
  gelir; `Öncelik / Bitiş Tarihi / Proje niteliğinde mi?` satırı bunun altında kalır (card #1250).
  `Proje niteliğinde mi?` yalnız **birim yöneticisi** (`Manager`) görür; Evet seçilince Görevi
  Yapan kilitlenir ve oluşturan yöneticinin adı gelir (#2619). Personel/SystemAdmin bu alanı görmez.
- **Birim Dışı Talep Oluştur (#2617/#2672/#2675):** `Proje niteliğinde mi?` yok (Reporter’da
  hedef birimin sağında, Öncelik ile aynı `1fr` — hedef dropdown’un yarısı, #2675). Öncelik,
  `Talebin Gideceği Birim` ile aynı satırda sağda ve o dropdown’un yarısı genişlikte
  (`2fr`/`1fr`). Reporter’da proje etiketi `Proje Mi` ve Öncelik ile üst hizalı (#2675).
  Birim İçi Manager’da da `Proje Mi` (#2670). Birim İçi/Vatandaş formlarına başka dokunulmaz.
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

- **Operatör WhatsApp yanıtları "Beklemede" kuyruğa girer; iletme yetkisi yalnızca operatördedir (card #1091 / #2600).**
  `ReplyToSocialMessageCommand` WhatsApp kanalında mesajı GÖNDERMEZ (`SendImmediately` yok sayılır), `DeliveryStatus=Pending` entry
  oluşturur (diğer kanallar eskisi gibi anında gider). Yazışmaya Git / `/whatsapp` yazımı da doğrudan vatandaşa gitmez. `ICitizenJobStatusNotifier` tarafından
  üretilen İşleme Alındı/Yapılmakta mesajları operatör onayı beklemeden WhatsApp'a doğrudan
  gönderilir. Tamamlandı/İptal otomatik mesajları artık job tamamlanır/iptal olur olmaz
  **otomatik olarak** `Pending` kuyruğa girmez (R421 değişti — card #2039): `CitizenJobStatusNotifier`
  terminal durumda erken `return` ile deferral loglar ve `Job.CitizenTerminalMessageReleasedAtUtc`
  `null` kalır. Mesaj+not, Manager/CitizenRequestManager `Vatandaşa Gönderilecek Mesaj Onayı`
  (`/citizen-message-approval`, yalnız WhatsApp/Çağrı kanallı VT — `CitizenRequestNumber` dolu;
  `SocialMessage.JobId` veya `Job.SourceRefId` bağları, card #2036) ekranından
  chip'ler **Mesaj Onayı Bekleyen** / **Mesaj Gönderimi Onaylanan** / **Tümü**;
  `Mesajı Gönder` ile `ReleaseCitizenMessageApprovalCommand` → `ICitizenJobStatusNotifier
  .ReleaseTerminalMessagesAsync` çağırana kadar bekler; bu an itibariyle eskisi gibi `Pending`
  kuyruğa girer ve `CitizenTerminalMessageReleasedAtUtc` doldurulur (idempotent). FE release
  sonrası `view=sent` chip'ine geçer (card #2058). Release şablon yoksa da varsayılan metinle
  Pending kuyruğa yazar; iptal notu follow-up da kuyruğa eklenir. Sol menüde "Onayı" yanına
  bekleyen sayı rozeti (`nav-pending-badge`, beyaz çerçeve yok — card #2056). Aynı rozet
  WhatsApp nav satırında `Yanıt bekliyor` rozeti yok (#6a6ba9ac); sayım yalnız sayfa içi
  `Yanıt bekliyor` filtresinde. `Yanıt Verildi Yap` yalnız **seçili konuşma yanıt bekliyorsa**
  chip satırının en sağında (yanıp sönen yeşil, yavaş blink) —
  filtre tek başına yetmez (#6a6bab12/#6a6c3dca);
  `POST …/mark-waiting-replied` (`WaitingReplyClearedAtUtc`); yeni inbound webhook sıfırlar.
  **Sms Onayı** nav satırında phone `to-send` bekleyen sayısı (card #6a6b6824).
  **Görevlerim / Birime Gelen / Birimden Giden** nav satırlarında da aynı `nav-pending-badge`
  rozeti: Görevlerim = `myPendingTaskCount`, Birime Gelen = Onay Bekleyen grid toplamı
  (`useIncomingPendingApprovalCount` / `matchesIncomingStatusFilter` pending-approval — dashboard
  `pendingApprovalCount` ile aynı değil; VT yöneticisi CRM için yalnız vatandaş satırları), Birimden Giden =
  `outgoingPendingCount` (dashboard snapshot; Sms Onayı stili — card #2516 / #2820 / #2823).
  Sol menü etiketleri kısardır: `WhatsApp` / `Sms Onayı`; Sms ikonu Lucide `MessageSquareText`
  (renkli `/icons/sms.svg` değil); Manager Sms Onayı varsayılan/zorla kapalı (card #6a6b6c8e).
  WhatsApp konum mesajı balonda MapPin + (yer açıklaması varsa açıklama, yoksa **Konum**)
  + alt satırda Haritada Göster; enlem/boylam metni gösterilmez; kayıtlı yer (`Name - Address`)
  SocialMessage lat/lng ile tanınır. Vatandaş Talebi popup konuşmasında konum metni compact `12px` / normal `13px` (#2748).
  Medya placeholder (`[image]` vb.) ve medya balonunda konum UI yok (#6a74de2a reopen / #6a6b9fac).
  Inbound MapPin çerçevesi Taleplerim ek ikonuyla aynı emerald rozet
  (`border-emerald-100 bg-emerald-50 text-emerald-700`, `size-5` kutu + `size-3` ikon; #6a74de2a / #6a75958d).
  Detayda turuncu
  **Talep Durumunu Değiştir** → `ReopenCitizenMessageJobCommand` (`POST …/reopen-to-in-progress`)
  Job'u Active + terminal görevleri InProgress yapar, release bayrağını temizler (card #2057/#2062).
  Edit/Release/Reopen uygunluğu liste ile aynıdır (`FindEligibleTerminalJobAsync`): Completed/Cancelled
  + WA/Çağrı VT bağı — `RequestType` Citizen şartı yok (VT modal `ExternalUnit` yazar; #2063/#2066).
  Grid: kanal ikonu (#2052), **Notu Düzenle** turuncu (#2051/#2053), mobilde işlem butonları
  `nowrap` (#2050). Not kaydı Completed görevlerde `CompletedAtUtc` olmasa da çalışır (#2063).
  Tamamlanmada
  görev ekleri + tamamlanma notu, iptalde iptal notu da aynı kuyruğa eklenir. Bu otomatik
  mesajlar release edildikten sonra operatör tarafında yine `Düzenle`/`Mesaj Gönder` üretir; not
  boşsa release reddedilir (Manager/CRM önce "Notu Düzenle" ile not girmelidir — `Job.CancelReason`
  veya son tamamlanan `WorkTask.Notes`). Terminal not butonları yalnız diğer ilgili bekleyen mesaj
  terminal durumu (`Tamamlandı/Tamamlanmış` veya `İptal/İptal Edildi`) içeriyorsa görünür; ara durum
  (`İşleme Alındı`, `Yapılmakta`) mesajlarında görünmez. Gerçek gönderim `SendPendingConversationEntryCommand`
  (`POST /social/messages/{id}/conversation/{entryId}/send`) ile yapılır; yetki = `Operator` veya
  `SystemAdmin` (`ForbiddenAccessException`) — Manager/CRM yalnızca release eder, `SendPending` yapamaz.
  Mesaj `Responded`'a yalnızca gerçek gönderimde geçer.
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
- **`ConversationPanel` vatandaş talebi modal gönderim (Round 718b):** metin yanıtı
  `/whatsapp` ile aynı — `sendImmediately=true`; ilet butonu onay sormaz. Bekleyen kuyruk
  mesajlarında `Mesajı Gönder` onay pop-up'ı korunur.
- **Vatandaş Talebi modal pending aksiyon boyutu (Round 718b):** `compact` balonda
  Düzenle / Onaylayan Yönetici / Mesajı Gönder `text-[10px] px-2 py-1`.
- **"Mesajı Gönder" onay pop-up'ı + "Düzenle" (card #1094/#1096):** gönder butonu önce `ConfirmDialog`
  gösterir; başlıkta metin altı çizilmez, modal konvansiyonundaki başlık-altı ayraç çizgisi kullanılır.
  Onaylanınca iletir. Yanında turuncu "Düzenle" → balon metni
  yerinde textarea ile düzenlenir (`EditPendingConversationEntryCommand`, `POST .../conversation/{entryId}/edit`,
  yetki Operator/SystemAdmin, yalnızca Pending+Outbound). Düzenleme modu balonun genişlik/yüksekliğini
  korur; metin şeffaf textarea ile balon içinde düzenlenir (iç içe beyaz kutu yok). Düzenlenen bekleyen mesajlarda `EditedAtUtc` doludur
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
- **WhatsApp Talep oluştur konuşma header (card #1555 / #2390):** `headerMode=phone` iken ortak
  `/icons/whatsapp.webp` kullanılır (beyaz dış daire yok); `Whatsapp Telefon No` altındaki değer
  küçük punto + `+90` önekli biçimlenir; kayıtlı vatandaş adı varsa numaranın önüne yazılır.
  Vatandaş Talebi Oluştur modalında vatandaş adı/telefon modal gradient başlığında (küçük WA ikonu
  ile) gösterilir; `ConversationPanel` iç header `hideHeader` ile gizlenir.
  Formda kilitli telefon alanında `(başında 0 olmadan ekleyin)` ipucu gösterilmez. Talep Oluştur
  popup kapatma X'i Talebi İptal Et ile aynı ghost stil + kırmızı hover (`ModalCloseButton`);
  dolu kırmızı yuvarlak X kullanılmaz (#6a75d47c). İç konuşma header'ında mükerrer `X` yok.
- **WhatsApp konuşma detay header zemini:** seçili konuşmanın üst bilgi şeridi breadcrumb `Anasayfa`
  yüzeyiyle aynı açık `slate-50` zemininde kalır; chat mesaj alanı standart `color-background`
  zemini kullanır (Kurum İçi FAB paneli ile aynı renk).
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
  detay header'ı telefon yerine adı öncelikli gösterir. Profil alanları `DeferredComposer` + blur'da
  senkron flush (Kaydet stale draft #6a75c91c); yazarken 8 sn detail poll atlanır.
  Sol konuşma kartında isim varsa telefon
  numarası ismin alt satırında, yanıt durumu (`Yanıt verildi` vb.) ile aynı yatay satırda görünür.
  Sağ profil paneli üstündeki `Talep Oluştur` aksiyonu satır ortasında, büyük `h-10` buton olarak kalır;
  yeşil gradient üst alan sağ panelin üst köşelerinde `rounded-t-xl` ile ana kartın köşe motifine uyumlu kalır (#2391).
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
- **WhatsApp FAB ilgili kullanıcı görünürlüğü (#2286):** WhatsApp bildirim FAB'ı yalnız
  `Operator` (Vatandaş Talep Operatörü) rolünde görünür; SystemAdmin dahil diğer rollerde çıkmaz.
  Konuşma listesi filtresi: aktif/açık konuşmalarda operatörler için; diğer kullanıcılar için
  kendisine atanmış/aktif departmanına yönlendirilmiş terminal olmayan talepler (eski kural).
- **WhatsApp footer birim/iç mesaj hizası (#2381/#2392/#2391 reopen):** `/whatsapp` ve Vatandaş Talebi modal
  footer'ında şablon/dosya/birim/Sadece Kurum İçi İlet **tek üst satırda** kalır; birim dropdown'u butonun
  hemen solunda; iç mesaj butonunun sağ kenarı textarea ile hizalıdır (grid spacer).
- **WhatsApp operatör dosya eki (#2394 reopen):** Dosya ekle seçimi pending önizleme gösterir; iletim
  `Mesajı Gönder` ile onaylanır (doğrudan gönderim yok).
- **WhatsApp giden ek balonu (#2399 reopen):** iletilmiş ekler chip olarak gösterilir; görsel eklerde
  görsel ikonu, dokümanda FileText; orijinal dosya adı `[Dosya eki: …]` içeriğinden okunur (#2385 reopen);
  caption varken de marker her zaman yazılır (#6a75878c — yoksa UI `whatsapp-{tel}` fallback).
  uzantı küçük harf; modal/kompakt konuşmada ad metni `text-xs` (#2209). Bekleyen ek önizlemesi iletilmiş
  ek ile aynı chip bileşenini kullanır (#2267); üstte birim · ad soyad başlığı, normal outbound balon
  genişliği (`max-w-[min(70%,26rem)]` / kompakt `68%/22rem`), dar `16rem` sınırı yok.
- **Gelen WA ek dosya adı (#2406 / #6a75c6fa):** webhook `document.filename` alanı `[Dosya eki: …]` olarak
  içerikte saklanır (path/encoding normalize, ad değiştirilmez); gelen ek adı orijinal büyük/küçük harf
  korunur. Medya indirirken `X-Original-File-Name` + Content-Disposition orijinal adı taşır; UI
  `whatsapp-{tel}` fallback'ini orijinal ad varken kullanmaz — **balonda/önizlemede görünen ad**
  vatandaşın orijinal adıdır. **İndirilen dosyanın adı** ise `kanal-numara-tarih.uzanti`
  (`inboundMediaDownloadFilename`, ör. `whatsapp-5547616022-18.08.2026.jpg`); uzantı orijinal
  addan, yoksa MIME'den gelir; numara/tarih yoksa o parça düşer, ikisi de yoksa entry kimliği
  eklenir. Bu, indirme adının orijinal ad olduğu eski davranışın (#2710 reopen) yerini alır.
  Giden ek indirme adı değişmez.
- **Inbound video ortala (#6a75c6e8):** video balonu görsel gibi `w-full max-w-full object-contain`
  (dik format sağ boşluk kapanır / ortalanır).
- **WA textarea gecikmesi (#2397):** yanıt textarea metni chat scroll alanında ayrıca render edilmez; yalnız
  footer input'ta tutulur.
- **Vatandaş Talebi modal başlık (#2398):** gradient header'da `Vatandaş Talep Akışı` kicker'ı basılmaz.
- **Medya balon Talep Eki hizası (#2401/#2410/#2744):** modalda görsel+doküman gelen eklerde Ön İzle · İndir aynı satırda, **Talep Eki Olarak Ekle** alt satırda; üçü görsel genişliğine göre ortalanır (`items-center` + `w-fit`); sağ kenar İndir ile aynı (`w-full`); butonlar biraz daha dar (`h-6` / `10px`). Modal gelen görsel `max-w-[14rem]` (#2413 reopen); modal
  gelen doküman adı çerçevesi `text-[11px] px-2.5 py-1.5` (#2411 reopen). Bekleyen giden görsel önizleme
  yüksekliği kompakt `max-h-32`, normal `max-h-36`; görsel `w-full object-cover` (çerçeveyi
  yatay doldurur); giden görsel balonu `max-w-[min(58%,15.5rem)]` / kompakt `54%` (#2711 reopen).
  Görsel ek adı **alt** satırda;
  X fotoğrafın **içinde sağ üst** (#2711 reopen); görsel X çerçevesi kırmızı (#2731). Giden mesajda birim · ad soyad **aynı satırda**, ad birimin yanında (#2405);
  görsel dosya adı punto biraz büyük (#2711).
  Görsel dosya adı yanındaki küçük ikonda emerald çerçeve **yok** (#6a7592b2); doküman satırında
  Taleplerim rozeti kalır: `rounded-md border-emerald-100 bg-emerald-50 text-emerald-700`
  (#6a758a88 / #6a75958d). Modal gelen görsel `max-w-[15.5rem]`; sayfa inbound
  `max-w-[18rem] object-contain` (bubble genişliği aynı kalır). WA gelen doküman adı çerçevesi
  `text-[11px] px-2.5 py-1.5`. Modal Dosya ekle pending: balon altında **Düzenle** + **Mesajı Gönder**
  (`ConversationPanel`, WA sayfasıyla aynı — #6a7586e9); balon içinde **Beklemede** (#6a75994d).
  WA konuşma medyası (sayfa + Vatandaş Talebi popup) `socialMediaBlobCache` ile bellek içi LRU
  önbelleğe alınır (max 40 / ~48MB); tekrar görüntülemede ağ isteği yok (#6a758a88). Logout cache temizler.
- **Kurum İçi pending ek (#2395 reopen):** mime/boyut alt satırı basılmaz. Ek yüklendikten sonra alıcıya
  SignalR yenilemesi gider; indirme yalnızca konuşmanın gönderen/alıcı tarafına açıktır. Açık sohbet poll
  eşitliği `attachment.attachmentId` alanını da karşılaştırır — ek yüklendikten sonra UI güncellenmez
  regresyonu olmamalı (#2395 reopen).
- **Kurum içi ek dosya adı (#2407):** pending, balon ve indirme adında uzantı küçük harf; upload sırasında
  normalize edilir.
- **Kurum içi görsel ek önizlemesi (#2415):** iletilmiş görsel ekler gönderen ve alıcı balonunda thumbnail
  (`max-h-32`) + dosya adı chip'i gösterir; indirme chip veya thumbnail tıklamasıyla.
- **Kurum içi pending ek (#2409):** dosya seçimi otomatik iletmez; önizlemede birim · ad soyad + dosya adı,
  altında **Eki Gönder** butonu (`h-6` / `text-[10px]` — #6a75721d); footer Gönder yalnızca metin içindir.
- **Gelen WA doküman ek adı (#2404 reopen):** vatandaştan gelen doküman balonunda dosya adı metni
  `text-[10px]` / ikon `size-3` / çerçeve `px-2 py-1`.
- **WhatsApp bekleyen dosya önizlemesi (#2385/#2389):** sohbet alanındaki pending-file balonu kompakt
  kalır; yalnız dosya adı + (görsel ise küçük thumbnail) gösterilir, mime/boyut alt satırı basılmaz.
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
  kayıtta değiştirilemez; `Vatandaş Adı` düzenlenebilir ve yalnız `CitizenConversation` profiline
  yazılır (`Job.CitizenName` talep bazlı ayrı kalır — card #2288). **Phone (çağrı) VT'leri aynı
  numarada mevcut WhatsApp konuşmasına bağlanmaz / WA profil adını ezmez** — `CitizenConversationLinkGuard`
  (#2288 reopen / #2330). Kaydedilen ad/etiket/adres metinleri Türkçe başlık biçimine normalize edilir.
- **WhatsApp detay header sayaçları:** seçili konuşma header'ında durum kırılımları gösterilmez; yalnız
  seçili numaraya ait toplam `Talep Sayısı` hesaplanır ve tıklanınca Vatandaş Talepleri gridine telefon
  filtresiyle gider. `Talep Sayısı` numara satırının **alt satırında** gösterilir (#2400).
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
  sohbet header’da üst satır `← Geri` + `Kurum İçi Mesajlar` + X; alt satırda avatar + ad +
  `Birim - Ünvan` panel genişliğinde (truncate yok, satır sonuna kadar — #r508/#r509/#r510);
  ünvan `font-mono`. Liste satırında ünvan birimin altında ayrı satırda kalır (#r506).
  Gelen balonda birim•ad etiketi siyahtır (turuncu değil); balon padding/font WhatsApp
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
- **WhatsApp talep etiketi (cards #1561/#1563/#1865/#6a75d1bf):** `CitizenRequestModal` içinde salt-okunur
  etiket textbox'ı yoktur; seçim yalnız Etiketler dropdown (+ Etiket ekle) ile yapılır. `Talep Etiketi`
  başlığı dropdown ile aynı satırda (üst hiza). Textbox'ın boşalttığı dikey alan `Talep Başlığı`
  textarea yüksekliğine eklenir (genişlik değişmez). WhatsApp profil paneli Talep Etiketi bloğunu
  göstermez — blok `Talep Oluştur` popup'ında Açıklama'nın hemen üstündedir (#1865). WhatsApp'tan
  açılan Vatandaş Çağrı Talebi oluşturma POPUP'ında Kanal/Talep Etiketi bloğu gösterilmez (#1563);
  CreateRequestPage (çağrı formu) Talep Kanalı yanındaki klonu korur.
  Talep Oluştur SAYFASINDAKİ Vatandaş Çağrı Talebi formunda ise Talep Kanalı'nın sağında aynı
  salt-okunur değer + Etiketler + Etiket Ekle bloğu bulunur (#1561 reopen);
  kaynak mesaj bir konuşmaya bağlıysa seçim conversation profile'a kaydedilir.
  Kayıtlı etiket sayısı 7 veya daha fazlaysa Etiketler menüsünün ilk satırında küçük puntolu arama gösterilir.
  `CitizenRequestModal` Etiketler/Etiket ekle kompakt (`h-7`/`h-8`, ~11px, #2703); menü her zaman
  aşağı açılır, genişlik ~220–280px, satır `text-xs` + belirgin hover (`emerald-50`) (#1865).
  Öncelik dropdown tetikleyici/liste `13px` (#2703). Konuşma balonu compact `11px` (#1711/#2634; #2702 küçültme geri alındı).
  CreateRequestPage Vatandaş Çağrı Talebi bloğunda Etiketler/Etiket ekle bir kademe büyük
  (`largeText` → `text-sm`) kalır.
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
- **WA FAB otomatik giden mesaj (#2562):** sistem otomatik iletilen durum şablonu / zamanlı WA yanıtı
  (belediye adı gönderen, personel `Birim · Ad` değil; veya önizlemede `talebinizin durumu`) WhatsApp
  baloncuk rozet/panel/pulse tetiklemez. `lastMessageIsAutomaticOutbound` son giden entry'nin enum
  yön/teslimat + gönderen etiketiyle hesaplanır (reopen #2562).
  **Onay kuyruğundaki (`Pending`) otomatik durum mesajı `HasPendingOutboundMessage` yapmaz**
  (`GetCitizenConversationsQuery` pending adayları `IsAutomaticOutbound` ile eler): bu bayrak yalnız
  personelin yazdığı bekleyen yanıtlar içindir, aksi halde otomatik mesaj `#1472` yolundan FAB'a
  geri sızıyordu. Otomatik durum mesajı FAB panelinde **önizleme metni olarak da basılmaz**;
  konuşma yalnız gerçek okunmamış mesajı varsa listelenir.
- **WA konuşma mesaj kutusu odak (#2528):** `/whatsapp` açık konuşmada yanıt kutusuna odaklanıldığında
  `mark-read` + `ccc:whatsapp-composer-engaged` ile sağ alt WhatsApp baloncuk rozeti temizlenir.
- **WhatsApp teslim durumu status-only webhook ile de canlı yenilenir:** `sent/delivered/read`
  güncellemesi açık konuşmaya `isStatusUpdate` payload'ı yollar; istemci konuşmayı yeniler ama
  bunu yeni mesaj gibi `mark-read` yapmaz.
- **Otomatik vatandaş durum mesajı konuşma kuyruğunu da günceller:** `ICitizenJobStatusNotifier`
  WhatsApp `Sent`/`Failed` entry eklediğinde ilgili `CitizenConversation.LastMessageAt` güncellenir
  ve SignalR WhatsApp payload'ı yollar; otomatik **iletilmiş** (`Sent`) durum şablonları `UnreadCount`
  artırmaz (FAB #2562). Onay bekleyen terminal (`Pending`) ve başarısız gönderimler bildirim sayacını
  artırabilir; aksi halde mesaj operatör listesinde son konuşma/sıra olarak görünmeyebilir.
- **Durum Değişikliği Geçmişi audit reason taşır:** #1095'te kaldırılan neden, #1619 reopen ile
  geri gelmiştir; veri `TaskStatusChanged` audit `Notes` alanından okunur ve Süreç altında gösterilir.
- **`CitizenRequestModal` `Talep Başlığı`:** saran textarea + dikey scroll; etiket textbox kaldırılınca
  yükseklik artar (`min-height` ~4.25rem). Başlık kolonu Öncelik’ten biraz daha geniş, Öncelik dar
  (`7.25rem`, #2743). Öncelik menü sırası Normal → Yüksek → Çok Yüksek (`prioritySelectOptions`, #2749). Gideceği Birim ve Öncelik menü punto `0.75rem`; Adres Tarifi input Açıklama ile aynı `0.8rem`; Açıklama
  editör yüksekliği `6.85rem` (#2743/#2746). Mahalle/Cadde/No boş placeholder punto biraz küçük (#2747). Gideceği Birim / Öncelik kapalı placeholder punto biraz küçük (`citizen-request-placeholder-trigger`, #2747 reopen). Öncelik kapalı seçili metin `12px` (#2747). Açık Mahalle/Cadde/No menü punto Gideceği Birim ile aynı `0.75rem` (`citizen-request-department-menu`, #2730).
- **`CitizenRequestModal` sağ form sırası:** Açıklama rich-text alanı Talep Başlığı satırının
  hemen altında gelir; adres ve dosya alanları açıklamadan sonra kalır (card #1082).
- **`CitizenRequestModal` adres/dosya yerleşimi:** Mahalle + Cadde satırından sonra Konum Koordinatı
  Mahalle’nin alt satırındadır (#2741); ardından Açık Adres ve Dosya/Fotoğraf aynı satırda yan yana durur; dosya seçilmedi metni butonla aynı blokta
  sığar (card #1088). Açıklama RichTextEditor ve Açık Adres textarea üst padding kompakt
  (`0.45rem 0.55rem`, #2403/#2416). Dosya ekle butonu `w-[6.35rem] h-[1.875rem] text-[11px] whitespace-nowrap`
  (Round 719). Açıklama `spellCheck={false}` + Windows autocorrect kapalı; Enter → `insertLineBreak`
  (liste hariç); satır aralığı yalnız `line-height` (#6a74e697). Açık Adres `h-[5rem]` — dosya
  kutusu alt kenarıyla hizalı (#2440 reopen). Açıklama editör
  `font-size: 0.8rem`, yükseklik `6.85rem` (#2743/#2746). Modal gelen görsel balon içinde `w-full` (Round 719).
- **Görsel lightbox yüksekliği (Round 720):** `SocialConversationMediaPreview` kabuk
  `max-h-[70vh]`, görsel/video `max-h-[56vh]` (WA + kurum içi — #6a75848c / #6a75722a).
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
  (~2.05rem yükseklik, ~0.72rem yazı; card #1632 + #1747). Küçük mobil
  (`max-width:767`) kompakt ölçüler korunur. Sol üst popup başlığı
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
  Talepleri `Çağrı` filtresinde VT numarasıyla görünür. Sol kolonda talep **Adres Bilgisi** (job
  alanları); sağ kolonda konuşma profili **Vatandaş Adres Bilgisi (İsteğe Bağlı)** — Mahalle /
  Cadde / Açık Adres ayrı kaynaklardan (#2554). Dosya Ekle yalnız sol adres bölümünde bir kez
  (`renderAddressFields`); mükerrer blok yok (#2559). Açıklama editörü `min-h-40`; toolbar
  `#citizen-request-form` `min-height: 1.6rem`, buton `1.4rem` (#2568). Kanal (Çağrı) butonu
  `py-1.5` (#2560). Adres Tarifi textarea `#citizen-request-form` `4.5rem` (#2584; Tailwind
  `min-h-[5.5rem]` `!important` ile ezilir). Cadde/Sokak biraz dar, No biraz geniş
  (`1fr` / `6.75rem`, #2584 reopen). `request-form--readable` 3.2rem ezilir.
  Sol kolon **Talebin Adres Bilgisi** placeholder `0.66rem`; sağ kolon vatandaş alanları `0.76rem`.
  **Talep adresi ≠ vatandaş profil adresi (#2563):** `ConvertSocialMessageToJob` / `UpdateJob`
  `CitizenConversation` mahalle/cadde/no/açık adresini job alanlarıyla güncellemez; profil yalnız
  `updateCitizenConversationProfile` ve WA **Vatandaş Bilgileri** panelinden yazılır.
  yatay buton görünümünde kalır; form başlığındaki ikon, seçim kartındaki mavi zeminli telefon ikonuyla aynıdır.
- **Talep Oluştur Vatandaş kartı lisans (#2357):** tür seçim ekranındaki `Vatandaş Çağrı Talebi`
  kartı yalnız `Operator` rolü **ve** `citizen` modülü kullanılabilirken görünür (`canShowCitizenRequest`).
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
- **İptal/Tamamlanma terminal notu durum mesajına gömülür (card #2103, #1829 supersede):**
  `SendWhatsAppAsync` terminal notu durum şablonunun altına `\n\n` ile ekler; `EnqueueTerminalFollowUpsAsync`
  yalnız tamamlanma eklerini (medya) kuyruğa alır — not için standalone `ConversationEntry` üretmez
  (eski: tamamlanmada ek yoksa not ayrı balondu). Popup/terminal not metadata (Not chip) korunur.
  Otomatik İptal şablon mesajı ve Süreç kartı/detay popup notları değişmez.
  İptal alanının görsel
  chip'i ve giden/kaydedilen otomatik mesaj durumu `İptal Edildi` olarak üretilir.
  `İşleme Alındı` ve `Yapılmakta` chip'leri turuncu kalır (cards #1258/#1263/#1270/#1268-reopen).
  Aynı SocialMessage/talep için aynı üretilmiş durum mesajı Pending/Sent/Delivered/Read olarak
  zaten varsa ikinci kez oluşturulmaz; yalnız Failed kayıt yeniden denemeye izin verir.
  (cards #1257/#1258).
- **İletilmiş İptal/Tamamlanma WA mesajında Not chip yok (card #2109, #1861/#2103 supersede):**
  Terminal not durum mesajına gömülü olduğu için ayrı `Not` butonu gösterilmez.
  `Onaylayan Yönetici` chip turkuaz (`teal-600`) + `User` ikonu (card #2109/#2110).
  BE `GetCitizenConversationDetailQuery` / `GetSocialConversationQuery` terminal metadata'yı yalnız
  Pending değil, iletilmiş outbound entry'lere de ekler. Pending sıradaki Düzenle/Gönder aksiyonları
  değişmez.
- **WA otomatik durum tırnakları (card #2104):** `BuildStatusMessage` / `ParseOrDefault` durum
  etiketlerini `"İşleme Alındı"` / `"Yapılmakta"` / `"Tamamlandı"` / `"İptal Edildi"` olarak üretir
  (eski tırnaksız şablonlar okunurken normalize edilir).
- **Mesaj Onayı reopen → İşleme Alındı (card #6a6ae7e2):** `Talep Durumunu Değiştir` confirm
  metninde mavi `İşleme Alındı` (turuncu Yapılmakta değil). Reopen terminal görevleri InProgress'e
  almaz; job Active + açık görev yok → UI `İşleme Alındı`. Liste `taskCount` yalnız açık
  (non-terminal) görevleri sayar.
- **Grid Durum İşleme Alındı ikon yok (card #6a6b3e39):** `GridStatusLabel` Durum hücresinde
  `İşleme Alındı` önünde kanal ikonu göstermez.
- **Mesaj Onayı reopen scope (card #2108 / #6a6aecbc):** `wasReopenedViaCitizenMessageApproval`
  yalnız vatandaş + Active + (completedAtUtc|cancelReason). Birime Gelen'de **İptal Et** gizlenir;
  **Onayla** (hedef onay / personel atama) reopen sonrası aktif kalır — pasif/disabled Onayla
  gösterilmez. Timeline: İptal/Tamamlanma → Durum Yapılmakta; İptal Tarihi kırmızı
  (`terminal-danger`). Hedef onay adımı tarih varsa (decidedAtUtc veya hedef görev atama)
  gösterilir, yoksa Onay Bekleyen.
- **Mesaj Onayı reopen hedef onay adımı (card #6a6aecbc):** reopen sonrası Süreç'te
  `Talebi Gerçekleştiren Birim Yöneticisinin Onay Tarihi` korunur (onaylıysa tarih; değilse
  `Onay Bekleyen`). `shouldShowCitizenTargetApprovalDate` reopen'da `taskCount === 0` iken de
  Approved+decidedAtUtc ile açılır; Talep Bilgileri `Talebi Onaylayan` Süreç öncesi silinmez.
- **Süreç timeline çizgi geçişi (card #6a6b3b5b):** yeşil(completed)→gri(upcoming) ve
  kırmızı(terminal-danger)→gri(upcoming) çizgilerde `linear-gradient` renk geçişi zorunlu;
  düz gri/düz kırmızı tek renk kabul edilmez.
- **Yazışmaya Git Phone flash (card #2107):** SocialMessage kaynağında kanal yüklenmeden buton
  gösterilmez; Phone/çağrı kanalında hiç görünmez.
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
- **Taleplerim detay `Adres Bilgileri` etiketleri** (`Mahalle`, `Cadde / Sokak`,
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
- **Grid Son Tarih Onay Bekleyen (#2590):** `DueDatePill` / `DateCell` boş son tarihte
  `Onay Bekleyen` metni ve takvim ikonu `sky-500` (`#0ea5e9`); tarihli satırların
  warning/danger/reporter tonları değişmez.
- **Ortak bileşenleri kullan:** `DueDatePill`, `DateCell`, `FilterableTh`,
  `SingleSelectDropdown` (openUp), `StatusPill`, `ChannelIcon`. Yeni grid kolonunda yeniden icat etme.
- **Breadcrumb parent segmentlerinde her ifade kendi ikonunu taşır:** ör. `Birimdeki Görevler`,
  `Vatandaş Talepleri`, `Yönetim` gibi ara segmentler metinden önce ilgili lucide ikonunu gösterir
  (card #1251).
- **Vatandaş Talepleri breadcrumb:** `/social` sayfasında `Vatandaş İlişkileri` ara katmanı
  gösterilmez; breadcrumb doğrudan `Anasayfa > Vatandaş Talepleri` olur (card #1262).
- **Login logosu (#2315 / #2318 / #2326):** Login ekranı `appearance.loginLogoUrl` kullanır; boşsa
  `/tire-belediyesi-logo.png`, kayıtlı `/default-institution-logo.png` lumespec wordmark. Login/popup upload
  **Kaydet** sonrası uygulanır.
- **Login logo oval çerçeve (#2316):** desktop `h-15 w-36` (`2xl:h-[4.25rem]`); mobil
  `h-[4.5rem]` (`sm:h-[6.25rem]`).
- **Mobil login Atatürk görseli:** `/header-ataturk.png` (beyaz silüet) sayfa sol üst köşesinde
  `lg:hidden` ile gösterilir; açık login zemininde görünürlük için `brightness-0` (koyu silüet)
  uygulanır. Desktop hero koyu zeminde beyaz silüet kalır.
- **Mobil sol menü belediye logosu:** drawer marka alanında varsayılan 96px kare değil, daha geniş
  `MunicipalitySeal` (yaklaşık 88×176px) kullanılır; Atatürk sol üstte kalır.
- **Mobil login logo çerçevesi yatayda geniş kalır:** kompakt login logo kartının yatay
  padding'i ve kart genişliği daraltılıp kare karta geri döndürülmez; panel viewport içinde biraz
  dışa taşarak genişler, logo etrafındaki beyaz alanda yatay nefes payı olur ve logo boyutu sabit kalır.
- **Sol menüde `/whatsapp` ve `/sms-delivery-approval` alt linkleri `SidebarNavLinkItem.emphasized`
  ile aynı hiza/punto ve renkli ikonla kalır** (`whatsapp.webp` / `sms.svg`); Sms Onayı WhatsApp
  alt başlığı gibi küçük/gri görünmez (card #1085 / #6a6b6c8e reopen).
- **WhatsApp sayfa geçiş performansı (#2417):** `AppShell` içinde nested `Suspense` + in-content
  `PageLoadingFallback` shell'i bloke etmez; sidebar hover'da route chunk prefetch; `CitizenRequestModal`
  lazy; konuşma listesi ilk API turunda açılır, şablon/birim/hazır yanıt `requestIdleCallback` ile ertelenir.
- **WhatsApp `Şablon mesaj ekle` aksiyonunda yalnızca baştaki `+` ikonu yeşildir; buton metni
  nötr slate renginde kalır** (card #1245).
- **Talep oluşturma formlarında adres `Cadde / Sokak` input metni aynı formdaki `Açık Adres`
  textarea metin ölçüsüyle eşleşir**; ana oluşturma sayfası ve WhatsApp vatandaş modalı kompakt
  ölçüleri ayrı korunur (card #1247).
- **Talep Oluştur > Vatandaş Çağrı Talebi Talep Etiketi değeri:** yalnız salt-okunur input metni
  `text-xs` kalır; Etiketler/Etiket ekle butonlarının büyütülmüş metni etkilenmez (card #1561).
- **Birim içi/dışı/vatandaş talep oluşturma formlarının input/dropdown yükseklikleri kompakt
  tutulur**; genel `.field-input` / `.field-select` ölçeği bu istek için değiştirilmez (card #1249).
- **Birim içi talep oluşturma `Bitiş Tarihi` picker'ı yukarı açılır**; diğer tarih picker'larının
  yönü kart istemeden değiştirilmez (card #1248).
- **Talep oluşturma/düzenleme Bitiş Tarihi minimumu:** seçilen gün **bugünle aynı takvim günü**
  ise `now+2s`; farklı gün seçildiğinde saat **mevcut duvar saati** — +2s kuralı günler arası
  taşınmaz (card #2515 reopen).
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
  Durum değeri `Yapılmakta` veya `Yapılmakta (Geciken)` ise yanına ` / Görevi Yapan` personel
  adı eklenir (card #2772; Görevlerim ve talep detay Süreç).
- **Terminal Süreç `Yapılmakta` katmanı (#2771/#2773/#2774):** Tamamlanmış/İptal/Reddedilmiş (ve
  iptalden geri alınmamış) talep ve görev Süreç’lerinde Tamamlanma veya İptal Tarihinden hemen
  önce `Yapılmakta` durur; yanında ` / Görevi Yapan` (parantez değil, #2780). Altında önceki zaman
  ile terminal zaman `date • time - date • time` (bullet + ` - `). Kapanışta son tarih geçmişse
  etiket `Yapılmakta (Geciken)` olur (#2776). Ayrı `inProgressPeriod` adımıdır;
  `statusContent` bu değeri ezmez. Görev tarafı: Görevlerim + İlgili Görev Detayları.
  Terminal Süreç’te `Son Tarih` Tamamlanma/İptal’den **sonra** gelir (#2785/#2786); aktifte Durum’dan sonra.
- **Süreç tarih/saat punto (#2775/#2779):** tarih-saat ve Son Tarih `0.75rem` (`datetime-value`);
  Durum etiketi aynı. Son Tarih `date • time` (`TimelineDateTimeValue` / ProcessStepDateValue, #2777);
  `dueDateContent` varken tarih bir kez yazılır (#2781).
- **Görevlerim İlgili Talep Adres Tarifi (#2778):** Görevlerim/Birimdeki/Personelimin popup’ta
  `Adres Tarifi` ve `Mahalle` başlıkları (ve `-` değerleri) aynı sol düşey hizada; kolon içi
  ortalama kısa/uzun etikette sol kenarı kaydırır, bu iki alan `flex-start` + aynı `padding-inline-start`.
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
  timeline'ı da aynı kuralı kullanır (card #1659). `Durum / Geciken` (birleşik etiket dahil) turuncu
  (`current`) — card #1644.
  **Güncelleme (card #1646/#1647/#1650 reopen):** birim içi/dışı süresi geçmiş aktif Durum metni
  yalnız `Yapılmakta` veya yalnız `Geciken` olmaz; `Yapılmakta (Geciken)`
  birleşik etiketi kullanılır. Vatandaş talebi grid + popup Durum overdue da diğer
  grid'lerle aynı: `Yapılmakta` + alt satır `(Geciken)` (`GridStatusLabel`, #2574).
  Süreç Durum aynı iki satır (sol hizalı). Backend/WhatsApp metni yalnız `Geciken`
  kalır.
  Vatandaş talebinde `İşleme Alındı` metni korunur (Onay Bekleyen'e
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
- **Dashboard üst kart ↔ pie bekleyen dilimi (#2350):** `GetDashboardQuery` sayıları pie chart
  `pending` dilimiyle aynı kuralları kullanır — son tarihi geçmiş kayıtlar bekleyen sayısına
  dahil edilmez; talep bekleyen dilimi Draft/PendingOnay/Revision (yönetici dış onay dilimi
  yalnız PendingOwner/PendingExternal). **EF çeviri:** bu kurallar LINQ içinde satır içi
  ifade olarak yazılmalı; `CountAsync` içinde statik yardımcı metot çağrısı kullanılmaz (#2350 reopen 500).
- **Yönetici pie chart sırası (#r507):** `Personelimin Görevleri` → `Personelimin Görevi Çözme Süresi (Saat)`
  (sonra Görevlerim / giden-gelen). `Birimdeki Görevler` ve `Talep Önceliği` pie'ları kaldırıldı (#2521).
- **Görev Bilgileri üst metası ve alan sırası:** Görevlerim/Birimdeki Görevler/Personelimin Görevleri
  detayında bağlı talebin `Öncelik` etiketi/değeri `job-detail-card-title--spread` ile Görev Bilgileri
  başlığının sağ border'ına yaslanır; renk `getPriorityColorClass` ile grid Talep No altı Öncelik
  ile aynıdır (#2002): Normal sarı, Yüksek turuncu, Çok Yüksek/Kritik kırmızı.
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
  Yapılmakta scope chip mavi (`scope-chip--in-progress`); Geciken turuncu
  (`scope-chip--overdue`) — cards #1693/#1695. Birime Gelen'de Onaylanmış → Yapılmakta →
  Geciken sırası; Onaylanmış grid `approvedAtUtc` desc (cards #1694/#1695).
  Birime Gelen breadcrumb `?status=` ile sekme adını takip eder (card #1696).
  Standart kullanıcı Taleplerim `Onaylanmış/Yapılmakta Taleplerim` chip'i mavidir
  (`scope-chip--in-progress`, card #1698) — sarı `approved` chip'i yönetici Onaylanmış'ta kalır.
  Birime Gelen Onaylanmış: `approvedAtUtc != null` ve tamamlanmış/iptal/yapılmakta değil
  (#2826); hedef onay bekleyen (Talebi Gerçekleştiren Onay Bekleyen) + sahip onaylı
  İşleme Alındı VT Onay Bekleyen'de (#2823). Onay Bekleyen: sahip onay
  bekler + personel ataması bekler + sahip onaysız VT İşleme Alındı; `PendingExternalApproval`
  yalnız Onaylanmış'ta. Onaylanmış grid **Son Tarih** sütunu yok, **Durum** + **Onay Tarihi**
  Birime Gelen Onaylanmış grid **Son Tarih** sütunu yok, **Durum** + **Onay Tarihi**
  (#2825). Birime Gelen **Geciken** grid: **Durum** Son Tarih'ten önce (#2829). Birime Gelen
  sayfa içi Onay Bekleyen scope chip'inde rozet yok — sayı yalnız sol menüde (#2830). Birimden
  Giden **Geciken** grid: **Oluşturan** yok; Gittiği Yer sonrası **Durum** (#2828). Birimden Giden
  Onaylanmış da tamamlanmış/iptal/yapılmakta hariç (#2826).
  Birime Gelen Onaylanmış grid İşlemler'de yalnız `Detaylar` — `İptal Et` ve `Onayla`
  yok (cards #1702/#1703). Onaylanmış grid'de `Görevi Yapan` / `Görev Sahibi` sütunu yok
  (#6a6ca0bc). Onay Bekleyen varsayılan sıra: dış birim `ownerApprovedAtUtc` desc,
  birim içi `createdAtUtc` desc (#6a6c9edc).
  Görevlerim/Birimdeki Görevler `Geciken` chip turuncu `scope-chip--overdue`
  (card #1701; mavi `in-progress` değil). Overdue rozeti bildirim zili rozeti gibi köşede
  (`right/top: -0.35rem` / `top: -0.45rem` hafif yukarı — #2551 reopen), `z-index: 30`;
  `.scope-chips` z-index 3 — banner üstüne taşan rozet banner'ı ezer (#2555).
  `incoming-requests-page` daha sıkı `page-stack` gap + çip `margin-top: 0.2rem` (#2555 reopen).
  Desktop sidebar marka metni (`shell.subtitle`) logo altında `gap-3.5` + hafif `pt`
  ile bir kademe aşağı hizalanır (card #1699); boyut `text-sm` kalır (#1692).
  **Birim yöneticisi menüsü (#2553):** `SidebarNav` `compactLabels` — uzun çok satırlı başlıklar
  küçük punto + satır kırılımı; `/citizen-message-approval` diğer çok satırlı öğelerle aynı
  `text-sm` (#2553 reopen); emphasized nested linkler negatif margin genişletmesi yapmaz;
  scroll alanı `overflow-x-hidden`.
  Header: **Personel Dahili No ara…** solda (tüm kullanıcılara görünür — card #1779),
  **Sistemde ara…** sağda; her ikisi de en az 3 karakterde arar. Personel araması yalnız
  `DisplayName` eşleşir (card #1780); Türkçe karakter / i-ı katlamalı arama (card #1791);
  textbox’a yalnız harf+boşluk (card #1776 reopen);
  X ile temizleyince “Personel” paneli kapanır (card #1781); sonuç `Ad - Dahili` /
  `Birim - Ünvan` (dahili boşsa `Ad - Dahili No Yok` — #r503/#r504); “Personel” başlığı büyük ve yeşil,
  birim/ünvan metni bir kademe büyük (card #1778). Sistemde ara yalnız sol menüde yetkili sayfa
  scope’larını çeker
  ve sonuç grup başlığı menü adıyla aynıdır (`Taleplerim` / `Görevlerim` /
  `Birime Gelen Talepler` … — `nav.jobs` kullanılmaz; cards #1782/#1783);
  talep/görev sonucuna tıklanınca `jobId`/`taskId` ile ilgili sayfada
  detay popup açılır (card #1766).
  Kurum İçi Mesajlar personel aramasında (≥3 karakter) satır başlığı da `Ad - Dahili` /
  `Ad - Dahili No Yok` (#r504).
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
  yalnız listeyi yeniler / doldurur (`GET /users/directory-departments` — **yalnız
  `physicalDeliveryOfficeName` attribute**; OU ve `department` attribute'u artık dahil
  değil — card #1838; kullanıcı displayName limitine takılmaz) — kayıt **Oluştur** ile eklenir;
  senkron otomatik `createDepartment` çağırmaz (cards #1717/#1730). “Tüm LDAP Birimlerini Ekle”
  ConfirmDialog (`Ekle`) ile eksik birimleri toplu oluşturur (card #1336). Dizin kullanıcı
  araması `department` / `physicalDeliveryOfficeName` alanlarını da tarar. LDAP birim
  düzenleme formu
  müdahale edilemez; Tür yalnız `Birim`/`Administration` (card #1719). Düzenle Tür
  default `Birim`, mevcut `Administration` korunur (card #1720). Yönetim seçilince müdür
  etiketi `Yönetici`.
- **SMS sağlayıcı dropdown (#6a6ef1a7/#6a6efa2c):** listede `Custom` yok; varsayılan seçim
  boş → placeholder `SMS sağlayıcısı seçiniz` (`SmsProvider.Unspecified`, NetGSM'e düşmez).
  Entegrasyonu olmayan sağlayıcı uyarısı: "…Destek talebinde bulununuz."
  Kayıtlı `Custom`/`JettMesaj` hâlâ seçenek olarak görünür.
- **SMS şifre alanı (#6a6efd02/#6a6f06f8):** kayıtlı parola varken input değeri `********`
  (maske API'ye gitmez; null = mevcut şifre korunur). `Kayıtlı şifreyi sil` checkbox yok.
- **Asistel gonderimTarihi (#6a6efc64):** boş string 108 hatası verir; anlık gönderimde
  Europe/Istanbul `ddMMyyyyHHmmss` gönderilir.
- **Asistel başarı yanıtı (#6a60a552/#6a6f16da):** `100` ve `100:transactionId` başarıdır;
  kullanıcı metni `SMS başarıyla gönderildi.` (eski: sunucuya yüklendi).
- **Çağrı terminal SMS notu (#6a6f0814/#6a6f0928/#6a6f234d):** Operatör Sms Onayı gönderiminde
  `{GönderilenBirim}` değerinden önce `\n\n`; ardından `\n\n{not}` ("Not" etiketi yok).
- **Terminal not ilk harf (#6a6f233d):** talep iptal / görev tamamlama / görev iptal notu
  `TurkishText.EnsureLeadingCapital` (TR kültürü); SMS/WA gönderiminde de uygulanır.
- **WA non-terminal birim boş satırı (#6a6f2518):** İşleme Alındı/Yapılmakta WA mesajında
  birim adından önce `\n\n` (çağrı SMS ile aynı helper).
- **WA terminal not (#6a6f24e7):** tamamlandı/iptal mesajından sonra `\n\n` + not metni;
  ayrıca `{GönderilenBirim}` öncesi `\n\n` (release yolu).
- **Talep Oluştur ilk harf (#6a6f496e):** Birim İçi/Dışı/Çağrı formlarında başlık, vatandaş
- **Birim Dışı dosya dropzone (#6a6f2982):** `min-h` 4rem→3.25rem, dikey padding azaltıldı.
  adı ve açıklama blur/submit'te yalnız ilk harf TR büyük (`ensureLeadingCapitalTr` /
  `ensureLeadingCapitalRichText`) — title-case değil.
- **Pie yazdır VT No (#6a6f46e6):** Vatandaş Talep No kullanan pie yazdırlarında
  `stackRequestNoHeader` → "Vatandaş" / "Talep No" iki satır.
- **Reporter birim VT pie (#6a6cdec6):** Anasayfa-Vatandaş'ta "Birimlerde İşleme Alınan /
  Yapılmakta / Tamamlanan Talepler"; yalnız VT; dilim popup mahalle pie standardında.
- **Talep Oluştur doğrulama (#6a6ef103):** kırmızı `.error` kutusu `error--create-request`
  ile `1rem` punto (global `.error` 0.88rem kalır).
- **Kurum sekmesi 2×2 (#6a6cdcad / #2366):** Kurum Bilgisi | Kurum Konumu / (citizen lisans açıkken) SMS API |
  Hafta Sonu SLA — SMS kutucuğu `isCitizenModuleUsable` ile gizlenir.
  (`xl:grid-cols-2`, `items-stretch` + `h-full`; dış/`grid` `gap-6` eşit düşey boşluk;
  Kaydet `mt-auto`). Readonly KURUM ADI/SLA özet satırı yok (#6a6cdd37).
- **Kurum Konumu ilçe (#r512/#r514/#r521/#6a75b1ae):** Ayarlar’da İlçe (İzmir) seçilir; mahalle listesi
  önizlemesi Ayarlar’da gösterilmez (#r521). Kaydet sonrası `ccc_municipality_district` localStorage
  + `TenantSettings.Theme = ccc-district:<id>` ile talep formu mahalle dropdown’ları aynı ilçeyi
  kullanır; sonraki girişlerde Settings dropdown seçili gelir. Eski ad/büyük-küçük harf/boşluklu
  localStorage değerleri canonical ilçe ID’sine normalize edilir; boş/geçersiz seçim mevcut
  değerin üzerine yazılamaz (card #2271 follow-up). Kurum Bilgisi Kaydet Theme’deki ilçe kodunu silmez.
  **CBS Adres Ara kademesi (#2652/#2654/#2655/#2658/#2659/#2681):** Mahalle / Cadde-Sokak / No İzmir CBS
  `BinaBilgiControl.aspx` proxy’sinden gelir (`GET /api/v1/izmir-cbs/*`); ilk çekimde
  `izmircbscatalogcache` tablosuna yazılır, sonraki seçimler DB’den gelir (#2681). Mahalle seçilmeden
  cadde, cadde seçilmeden kapı no enable olmaz. Ayarlar’da 2×2: İlçe|Mahalle / Cadde|No
  (#2654 geri al + alt satır). Seçimler `ccc_municipality_cbs_address` localStorage’da kalır.
  Talep oluştur (iç/dış/vatandaş), vatandaş modal, rutin ve WA taslak adresinde Cadde/No
  textbox yok; CBS dropdown (`CbsStreetNoDropdowns`, #2655). Talep formunda mahalle satırı
  Öncelik/Son Tarih satırı kadar genişler; Cadde dar, No `8.25rem` sabit (cadde seçilince
  değişmez, #2659/#2669). Cadde placeholder her yerde `Cadde seçiniz` (#2721).
  Cadde/No menü punto WA’da mahalle menüsü ile aynı (`whatsapp-neighborhood-menu-scroll`, #2716).
  WA Mahalle/Cadde/No arama ve liste punto aynı (0.875rem); liste küçültülmez (#2729).
  WA **Vatandaş Talebi Oluştur** popup açık Mahalle/Cadde/No menü punto Gideceği Birim ile aynı `0.75rem` (#2730). Kapalı kutu form `.field-select` (0.82rem) kalır. WA profil **Vatandaş Bilgileri** açık menü punto `0.75rem` (#2640).
  Popup Konum Koordinatı Mahalle’nin **alt satırında** (Cadde/No ile aynı satırda değil) (#2741).
  Popup yüksekliği taban detay shell’den çok az daha fazladır (`detail-modal-shell--citizen-create`, #2742).
  WA Vatandaş Bilgileri ve Vatandaş Talebi Oluştur popup Cadde seçili metni oka kadar
  daha fazla yer kaplar; erken ellipsis yok (#2724).
  WA Vatandaş Bilgileri Cadde/No placeholder **Seçiniz** (#2724). Seçili Cadde/No metni kutuyu
  genişletmez; taşınca ellipsis + hover tooltip (#2724 reopen).
  No `No seçiniz`; listede **Yok** (#2714); CBS’den gelen **Kapı Numarası Yok** satırı yok (#2723).
  Talep oluşturda No’nun sağında isteğe bağlı Konum Koordinatı (#2713), placeholder `Link giriniz...` (#2722); taşan metin ellipsis + **500ms** hover tooltip (#2725/#2763). Değer punto `13px`, placeholder `14px` (#2765/#2766). Native `title` yok.
  Konum Koordinatı anlamsız/hatalıysa talep yine oluşur; marker yok; `coordinatesInvalid` ile bloke edilmez (#2753). Pin için Google Maps linki (`@lat,lng` / `q=` / `!3d!4d`, `google.com.tr`, kısa `maps.app.goo.gl` sunucuda açılır) parse edilip lat/lng kaydedilir (#2764/#2767); düz `lat, lng` marker yazmaz. Oluşturunca harita pin sorgusu invalidate + mount’ta taze çekilir (#2752).
  Vatandaş Çağrı **Talebin Adres Bilgisi**, Rutin Görev Oluştur ve WA **Vatandaş Talebi Oluştur** popup’ta Konum Koordinatı başlığı Mahalle dropdown’unun **alt satırında** hizalanır; Adres Tarifi / Dosya ekle bir alt satırdadır (#2726/#2727/#2741).
  Birim/Vatandaş talep haritasında Mahalle+Cadde+No (No ≠ Yok) doluysa pin CBS’den gelir; Konum Koordinatı kullanılmaz (#2720). Orijinal Maps linki (`LocationMapsUrl`) varsa marker **önce** Google Maps linkinden (`!3d!4d` kamera `@` değil, kısa link sunucuda açılır) konur; CBS veya kayıtlı Job lat/lng ezmez (#2770/#2782/#2783).
  No=Yok ve koordinat yoksa (veya link Google Maps değilse) marker yok, **Haritada Olmayanları Listele**’de durur (#2718/#2764). `LocationMapsUrl` varken No=Yok tek başına pin’i düşürmez (#2782).
  No=Yok + Google Maps koordinat, veya mahalle/cadde boş + koordinat: pin koordinata konur (#2719/#2764). CBS cadde noktası No=Yok iken kullanılmaz.
  Mahalle+cadde boş + Google Maps linki: **oluştururken** girilen link olduğu gibi saklanır (`LocationMapsUrl`); detay Konum `maps?q=` ile yeniden yazılmaz (#2770). `/maps/place/` metni Google `address=` ile aranır; pin linkteki `!3d!4d`/`@` konumudur, CBS cadde noktası kullanılmaz (#2719). Ayarlar CBS etiketlerinde Mahalle / Cadde / No yanında `(Veri Kontrolü)`
  (#2654/#2681). Mahalle kataloğu hâlâ
  statik `izmir-locations` + ilçe Theme’dir. Mahalle ve Cadde/Sokak dropdown etiketleri
  `toTitleCaseTr` (#2658).
- **Tek seferlik adres doldurma (#2662/#2663):** API açılışında (migration sonrası) CBS Tire
  havuzundan rastgele mahalle/cadde/no; Vatandaş Bilgi Listesi’ndeki tüm profiller + son
  30 gün talepler üzerine yazılır. `AuditLogs.Action = OneOffRandomAddresses-2662-2663`
  varsa tekrar çalışmaz.
- **Birimler/Kullanıcılar grid:** FilterableTh + sort + TablePagination; kolon genişlikleri
  `users-table`/`departments-table` ile orantılı (card #1724). Kullanıcılar Rol StatusPill ortalı;
  İşlemler’de kalem+Düzenle / çöp+Sil ve satır ortalı (cards #1722/#1725/#1732). Banner `+Yeni…`
  açıkken İptal destructive kırmızı; form altındaki ekstra İptal yok (card #1721). Yeni kullanıcı
  **Aktif** Rol kolonunun altında (Ek roller satırını itmez) (card #1718). LDAP kullanıcı
  seçimi birimi otomatik oluşturmaz; kullanıcı/birim **Oluştur** ile eklenir; senkron yalnız
  dizin listesini yeniler (card #1729). “Tüm LDAP Kullanıcılarını Ekle” önce yalnız aktif
  LDAP kullanıcılarını çeker (disable olanlar gelmez — cards #1754/#1757); ConfirmDialog’da
  birimi sistemde olmayanlar atlanır, kalanlar **Ekle** ile Staff olarak eklenir; sAMAccountName
  ile zaten bağlı olanlar yeniden eklenmez; başarıda **Yeni çekilen kullanıcılar (N)** listelenir
  (`GET /users/directory-users`, cards #1748/#1750/#1758/#1759). Aynı LDAP e-postası birden fazla
  hesapta olabilir — `alreadyLinked` e-postaya bakmaz; LDAP create e-posta uniqueness uygulamaz
  (card #1785). PDO (`physicalDeliveryOfficeName`) dolu
  kullanıcılar eklenebilir (sistemde yoksa `ldapDepartmentName`); PDO boş olanlar “birimi eksik”
  ve listede **OU:**; eksikler OU’ya, eklenecekler birime göre alfabetik (cards #1763/#1764/#1765/#1761).
  Toplu Ekle: LDAP DN base-lookup + username fallback; geçersiz mail/uzun phone engellemez;
  tek kullanıcı hatası tüm batch’i düşürmez; string ValidationException mesajı FE’ye `detail`
  olarak iner (card #1784). Toplu Ekle her zaman `roleCode: Staff` gönderir; LDAP create’te
  ünvan Müdür iken birim kontenjanı doluysa BE Personel’e düşer — batch generic validation
  hatasıyla kesilmez (card #1824).
  `ResolveDepartment` yalnız `physicalDeliveryOfficeName` döner — `department` attribute
  fallback'i kaldırıldı (card #1838); PDO boş kullanıcı "birimi eksik" sayılır, `department`
  attribute'u dolu olması yeterli değildir.
  "Tüm LDAP Birimlerini Sil" kırmızı link (Ekle butonundan sonra) + ConfirmDialog
  (`POST /departments/ldap/delete-unused`, cards #1853/#1855); `DeleteUnusedLdapDepartmentsCommand`
  yalnız `SourceType=Ldap`, hiç kullanıcısı ve hiç işi/görevi olmayan birimleri siler —
  `DeleteDepartmentCommand` güvenlik kontrolleriyle aynı taşınabilirlik kurallarını uygular
  (routing rule / job department referansları önce temizlenir). Kırmızı `deleteAllLdapHint`
  LDAP oluşturma modunda "LDAP Birim Çek" yardım metninin altında görünür.
  Popup kapanış **Çıkış**
  (kırmızı); eksik birim uyarısı: LDAP birim verisi gerekir / tümü eklendiyse başarı metni
  (cards #1759/#1760). Çekim sonrası buton sağında **Birimi LDAP’ta olmayan kullanıcılar**
  dropdown’u (card #1752). LDAP formunda Dizin Hesabı alanı yok; **İptal Et** yalnız LDAP
  kullanıcısı seçiliyken Oluştur altında görünür (cards #1755/#1756). Anlık senkron `listDirectoryUsers`
  ile çalışır (arama zorunlu değil); ConfirmDialog `"LDAP Kullanıcı Senkronize Edildi"` + bağlı
  kullanıcıların username/ad/ünvan/dahili/e-posta güncellemesi (`POST /users/sync/ad` — card #1787);
  ayrıca LDAP birim adı sistemde eşleşiyorsa `DepartmentId` güncellenir; description/`Title`
  içinde "Müdür" geçiyorsa (birim müdür kontenjanı uygunsa) rol `Manager` yapılır
  (cards #1787 reopen/#1789). "Tüm LDAP Kullanıcılarını Sil" kırmızı link + ConfirmDialog;
  yalnız talep/görev oluşturmamış LDAP kullanıcılarını siler (`POST /users/ldap/delete-unused`,
  card #1790). Kırmızı `deleteAllLdapHint` `sourceLdapHint`'ten hemen sonra gelir (çek
  butonlarının altında değil). sistemde olmayanlar ayrıca listelenir; yoksa `"Yeni kullanıcı bulunamadı"`; senkron sonrası birimi
  LDAP’ta olmayanlar dropdown’u güncellenir (cards #1754/#1768). LDAP arama placeholder’ı
  **en az 3 karakter** (card #1754). Eklenecek kullanıcılar satırında `birim:` etiketi yok —
  `Ad — BirimAdı` (card #1767).   Yerel kullanıcıda **Parola Onayla** alanı; uyuşmazsa kırmızı
  uyarı ve Oluştur engeli (card #1762). Parola / Parola Onayla textbox’larında login ile aynı
  göz ikonu (göster/gizle) vardır (card #1772). Oturum: 1 saat hareketsizlik → uyarı popup (60 sn geri
  sayım, Tekrar sorma yok); uzatılmazsa logout (card #1769 / #r490). Uyku/sekme sonrası duvar
  saati ile kontrol edilir — `setTimeout` donmuş olsa bile uyanınca logout (#2003 / #r528). Sistemde
  talep/görev oluşturmuş kullanıcı
  silinemez — `"Sistemi kullanmış olan personel silinemez"` (card #1753). `+Yeni Kullanıcı` açıkken grid görünür kalır
  (`desktop-page-fill` form açıkken kapanır — card #1731). Kullanıcılar LDAP formunda
  “LDAP Kullanıcı Çek” solda, “Anlık LDAP Kullanıcı Senkronize Et” sağda (card #1735);
  Birimler’de “LDAP Birim Çek” solda, senkron sağda (card #1737). LDAP dizin e-postası
  yalnız `mail` attribute’tur — boşsa form E-posta alanı boş kalır, UPN ile doldurulmaz
  (card #1734). Yeni kullanıcı E-posta placeholder’ı `ornek@belediye.bel.tr` (card #1740).
  Ek görev birimleri placeholder “Ek birim seçiniz...”; multi-select’te
  arama satırı var; Birim+Ek birimler+Rol+Ek roller+Aktif+Oluştur tek satırda;
  Rol kolonu dar; Rol+Ek roller menü satır metni kompakt; Oluştur geniş ama alçak
  (card #1739). Yeni kullanıcı üst satırı: Kullanıcı Adı / Ad Soyad / Dahili No /
  Ünvan / E-posta tek satır (`lg:grid-cols-5`); create API `title`+`phone` alır;
  LDAP seçiminde dizin title/phone prefills (card #1771). LDAP Title=`description`,
  Phone=`telephoneNumber` attribute’larından gelir (card #1773).
  Personel Dahili No sonuç paneli `left-0` ile sağa açılır (card #1786).
  Talep oluştur ek listesinde dosya adı `text-sm`, uzantı küçük gri (card #1788).
  Birimi Düzenle dropdown’ları `<label>` ile sarılmaz — dış tıklayınca kapanır (card #1729).
  Birimler grid’inde Tür sütunu yok; Tür yalnız düzenleme formunda ve özet “Tür Dağılımı”nda (card #1741).
- **Birim/Kullanıcı özet ve arama (#2277-#2281):** Birimler liste ve LDAP araması en az 3
  karakterden sonra çalışır; Türkçe arama `toLocaleLowerCase('tr')` kullanır. Tür Dağılımı’nda
  NFC-normalize adında `Müdür` geçenler Müdürlük, kalanların tamamı Birim sayılır ve sıfır
  bucket da görünür. Kullanıcı özetinde Aktif yanında Yerel ve LDAP sayıları ayrı gösterilir;
  liste placeholder’ı `İsim, kullanıcı adı ara...` kalır.
- **Rol Sayfa Yetkileri:** standart header + TablePagination default 25; **Sayfa** th ortalı,
  satır adları solda (card #1726). Matris satır sırasında `Birimden Giden` hemen
  `Birime Gelen` sonrası (#6a6ca355). Rol kolon sırasında `Vatandaş Talep Yöneticisi`
  hemen `Birim Yöneticisi/Sorumluları` sonrası (#6a6cb6ea). Tenant JSON yok/geçersizse Ayarlar
  grid’i stale/global localStorage’a değil fresh `DEFAULT_ROLE_PAGE_ACCESS` matrisine düşer;
  geçerli tenant özelleştirmesi korunur (card #2243). Default matris referans grid ile eşleşir:
  SystemAdmin yalnız Ayarlar; E-Devlet rolünde Anasayfa varsayılan Pasif (normalize Anasayfa’yı
  diğer rollere zorla açmaz); CitizenRequestManager Anasayfa + talep/rutin + görev/talep + gelen +
  vatandaş mesaj onayı; Operator/Staff’ta `departmentTasks` açık, `myTasks` varsayılan kapalı;
  Reporter’da `createRequest`/`myRequests` kapalı, `departmentTasks` açık (#2243 reopen).
  `DEFAULT_ALLOWED_PAGES_BY_ROLE` açık allow-list’tir.
  Matris `social` ve `citizenMessageApproval` satır etiketleri menü metninden ayrıdır; başlık +
  küçük parantez ipucu iki satırda gösterilir (#2282/#2284); sol menü `nav.*` etiketleri değişmez.
- **Dosya sunucusu test alanları (#6a6cb6ec):** NAS ve FTP kolonlarında ayrı bağlantı +
  kullanıcı giriş testi (ortak alt blok yok).
- **NAS kullanıcı testi gerçek bir SMB bağlantısıdır (Round 657 / card #2226):** eskiden yalnız
  kayıtlı `nasUsername` ile girilen adı string karşılaştırıyordu (sahte). Artık `SMBLibrary`
  (Infrastructure/FileStorage/SmbNasConnectivityTester.cs, `INasConnectivityTester` abstraction)
  ile kayıtlı host+paylaşıma test kullanıcı adı/şifresiyle bağlanıp gerçek bir test klasörü
  oluşturup siliyor. Yalnız `SMB/CIFS` desteklenir, `NFS` seçiliyken "henüz desteklenmiyor" döner.
  FTP kullanıcı testi (`testFileStorageFtpUserCredentials`) hâlâ eski sahte string-karşılaştırma —
  kart yalnız NAS'ı istedi, FTP'ye dokunulmadı. **Doğrulanmadı:** gerçek bir NAS'a karşı test
  edilmedi (kullanıcı "doğrulamadan push'la" dedi) — ilk canlı denemede sürpriz çıkabilir.
  Ayrıca `SMB2Client.Connect` bağlantı için CancellationToken/timeout desteklemiyor; NAS
  ulaşılamazsa istek TCP seviyesinde uzun sürebilir (mevcut 4sn'lik `TryConnectAsync` deseninden
  farklı) — gerekirse ayrı bir `CancellationTokenSource.CancelAfter` + soket-seviyesi sarmalayıcı
  eklenmeli.
- **NAS SMB login domain (#2347):** IP host (`192.168.x.x`) FQDN gibi parse edilmez — ilk oktet
  (`192`) domain adayı olmamalı. Domain sırası: açık `DOMAIN\user` / `user@domain` → NetBIOS adı
  → connect adı short-host → `WORKGROUP` → `.` → `""` → (yalnız hostname ise) host short-host.
  IP ile `Connect` NTLM SPN bozabilir; önce NetBIOS (`NameServiceClient`) ve reverse-DNS short
  adıyla `Connect`, sonra IP fallback. Paylaşım alanına tam UNC (`\\host\share`) girilse
  `NasPathNormalizer` kayıt ve testte yalnız share adını çıkarır; paylaşım adı Türkçe karakterler
  ASCII'ye katlanır (`Tire İletisim Merkezi` → `Tire Iletisim Merkezi`). NAS kullanıcı testi formdaki
  host/paylaşım değerlerini de kabul eder (kaydetmeden test). Başarısız `Login` sonrası aynı
  client'ta `Logoff`+yeniden `Login` yapılmaz (STATUS_USER_SESSION_DELETED); her domain denemesi
  fresh `Connect`.
- **Ayarlar/Birimler/Kullanıcılar (`admin-surface-page`):** helper-copy, label, textbox,
  textarea, Oluşturma Modu segmented + LDAP başlıkları kompakt shell’den belirgin büyük
  (cards #1733/#1736/#1738). Ayarlar banner altı tab butonları #1733’ten sonra biraz
  küçültüldü (card #1744: ~2.35rem / 0.84rem). LDAP “Kayıtlı bind şifresini temizle”
  checkbox’ı Bind Şifresi textbox ile aynı satırda/hizada; helper-copy altında değil
  (card #1745).
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
  Başlık `WhatsApp Konuşması - Vatandaş Talebi Oluştur` `font-medium` (#2634);
  compact konuşma mesaj metni 11px, gönderen satırı 12px (#2634).
  Modal açıkken gelen WA mesajı aynı konuşma penceresinde anlık görünür (`ccc:whatsapp-message` + 3sn poll, #2707).
- **Yazışmaya Git popup (#2080 / #2289):** `WhatsAppConversationModal` → `compactBubbles` + `compactActions`
  (metin `text-xs`, balon padding küçültülür). Banner: kayıtlı vatandaş adı varsa numaranın **solunda** aynı satırda.
- **Mesaj Onayı Detaylar → Talep Durumunu Değiştir (#2083):** buton rengi `Görevi Yönlendir` ile aynı
  (`bg-[#007985]` / `hover:bg-[#006570]`), turuncu değil.
- **Onayla ve Personel Ata self-istek metni (card #1671):**
  `(Görevi kendisi yapmak istiyor)` — sonda nokta yok.
- **Talep Son Tarih Değiştir (cards #1673/#1666):** Birime Gelen hedef birim yöneticisi
  `UpdateJob` ile Son Tarih kaydedebilir (Owner-only yetki 403 vermez). Birimden Giden sahip
  yöneticisi detay Süreç'te `Onay Bekleyen` yanında `Değiştir` görür.
- **Talep son tarihi min + onay bekleyen overdue (card #1819):** Manuel Son Tarih seçimi
  (oluşturma + Değiştir) en erken `şimdi + 2 saat`. Hafta sonu SLA durduruluyorsa Cmt/Paz
  oluştururken/seçerken en erken sonraki Pazartesi mesai + varsayılan SLA saat
  (varsayılan 08:30 + 48s, #2706).
  Onay bekleyen (`PendingOwnerApproval` /
  `PendingExternalApproval` / `PendingApproval`) talepler aynı gün içinde saat aşımında
  "Geciken" sayılmaz; takvim günü değişince overdue olur.
- **Talep Oluştur Başlangıç / Son Tarih (card #6a6f6301, #6a6f5011 supersede):** Birim Dışı
  formda Başlangıç en erken `şimdi` (geçmiş gün/saat disable). Başlangıç seçiliyse Son Tarih
  en erken `başlangıç + 2 saat`; değilse Son Tarih min `şimdi + 2 saat` (#1819).
- **Talep Oluştur placeholder’ları (card #6a6f49fd):** Başlık `Talep başlığı giriniz...`;
  Açıklama `Talebinizi detaylı olarak açıklayınız...`; Vatandaş Çağrı Açıklama
  `Vatandaş talebini detaylı olarak açıklayınız...`.
- **Header Personel Dahili No (card #6a6f51eb):** placeholder/aria `Personel Dahili No bul...`.
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
- **Bildirim okundu → bold kalkar (#6a6ca25f):** okunmuş satırda başlık/aksiyon kelimeleri
  / `Görev`·`Talep` / titleTag hepsi normal/medium ağırlığa döner (önceki #1669 “okunmuş
  bold kalsın” kuralı geçersiz). Renkli durum tonları (yeşil/kırmızı) okunmuşta kalabilir.
- **Detay bölüm başlık çizgisi (cards #1679/#1681):** popup içi `job-detail-section-heading`
  alt çizgisi `--color-primary` tonunda ve transparan
  (`color-mix(... 40%, transparent)`, scrollbar ile aynı); gri slate değil.
- **Detay popup boyutu (card #1682):** `.detail-modal-shell` / `--my-request` bir kademe
  daha küçük (`~63–67vw` / `~73–77dvh` bandı).
- **Detay popup header logo (card #1683 reopen / #1751 / #1885 / #r484 / #2314):** başlık satırı
  ortasında `appearance.popupLogoUrl` (yoksa logo gösterilmez); absolute. Logo, başlık ile sağ
  aksiyonlar arasındaki boşluğun ortasına hizalanır. **Yalnız Birime Gelen + onaysız vatandaş talebi**
  (`preferLeftForBusyActions`, ~128px ekstra sola) — Yazışmaya Git ile çakışmaz; diğer
  sayfa/durumlarda ekstra kaydırma yok. Kaydırma **animasyonsuz** (`transition: none`).
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
- **Yönetici Notu limiti (card #1585 / #2809 reopen):** textarea ve komut en fazla 100 karakter;
  başlıkta zorunluluk yıldızı ve `(max 100 karakter)` gösterilmez (#2809). `JobManagerNoteAdded`
  `Talep No: T-…` (yoksa `T-{yıl}-Onay Bekleyen`) içerir; audit `ActorDisplayName` yazılır.
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
- **Talep detay öncelik başlığı (card #1599/#2109):** Taleplerim, Birime Gelen ve Birimden Giden
  detaylarında `Öncelik` Talep Bilgileri satır listesinden çıkar; başlığın sağ sınırında etiketi
  üstte, değeri altta görünür. Etiket title-case (`Öncelik`) ve 12px (`text-xs font-bold`) kalır; değer
  11px (`text-[11px] font-semibold`) olur ve `Normal` değeri yeşildir. Görevlerim / Birimdeki Görevler /
  Personelimin Görevleri detayında Görev Bilgileri başlığı aynı puntoyu kullanır (#2109). Vatandaş kanal
  ikonu/adı varsa bu bloğun solunda kalır
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
- **Açıklama RichText toolbar (#r511):** italik (İ/T) yok — yalnız kalın, altı çizili, madde/numaralı
  liste. Yapıştırılan `<em>`/`<i>` ve `font-style:italic` sanitize sırasında düşürülür; Ctrl/Cmd+I engellenir.
- **Talep oluşturma Açıklama editörü yüksekliği (card #1533):** içerik aşağı uzayınca kutu
  büyümez; `min-height` = `max-height` + `overflow-y: auto` ile dikey scroll açılır
  (`RichTextEditor` ve e-Devlet dönüşüm textarea'sı).
- **Grid başlık casing/padding:** TÜM gridview header'ları (`data-table`, `table-container`,
  `wallboard-table`) `text-transform: uppercase` kullanır (card #1342 — #1318'i tersine çevirdi);
  `FilterableTh` iç sıra: başlık → sıralama ikonu → filtre (`MoreVertical`); sıralama label içinde
  **Talep No / Vatandaş Talep No / Bağlı Olduğu Talep No** (`jobNumber`): yıl sonrası `-` sayısı
  niceliğine göre (591 > 12); ilk tıklama büyükten küçüğe (#2646). `VT-2026-Onay Bekleyen` string
  karşılaştırmasına düşer.
  değil (#6a759062). Label/ikon aralığı dengeli kalır.
- **Grid Öncelik alt satır metni:** `(Öncelik:…)` değil `Öncelik:…` — parantez yok (#6a75913e).
- **Grid Öncelik alt satır görünürlüğü (#2509):** Talep/Görev No altındaki öncelik satırı yalnız
  `High` / `VeryHigh` / `Critical` için gösterilir; `Normal`/`Low` gizlenir — `shouldShowGridPrioritySubline`.
- **Birime Gelen / Birimden Giden / Mesaj Onayı aksiyon ikonları:** Detaylar=`FileText`
  (popup `Talep Detayları` title heading ile aynı — #6a758f80 reopen), Onayla=`Check`, İptal Et=`XCircle`;
  butonlar `inline-flex items-center gap-1.5` (#6a758f80 / #6a758fb1).
- **Grid Öncelik alt satır punto (#2684):** `.table-number-cell__priority` `0.78rem`
  (Talep No `0.9rem` altında; #2684 küçültme sonrası hafif artış).
- **Grid Öncelik alt satır boşluğu:** `.table-number-cell__priority` `margin-top: 0.35rem` (#2684);
  wallboard `0.2rem` (#6a75913e reopen).
- **WA / kurum içi pending ek balonu:** Dosya ekle önizlemesinde balon içinde `Beklemede · HH:mm`
  (#6a75994d / #6a759a3e reopen — bullet + saat, giden mesaj satırıyla aynı). **WA Konuşmaları
  sayfası (`WhatsAppConversationsPage`) kendi pending UI’sini kullanır** — ConversationPanel
  düzeltmesi yetmez (#6a75994d reopen). Kurum içi iletilmiş satırda Okundu/İletildi satırı
  `mt-1.5` (#6a759a81). Görsel dışı ek/konum ikon rengi çerçevede `text-emerald-700` (#6a75958d).
- **Header Personel Dahili No bul:** input ikonu `User` (büyüteç değil — #6a759807).
- **Görevlerim grid:** `Görev Tipi / Görevi Yapan` sütunu yok (#6a75a628); tip rozeti
  `Görev Tarihi` altında (#6a75969e). Personelimin’de tip sütunu yok (#6a75af48).
- **Birimdeki Görevler grid:** `Görev Tipi / Görevi Yapan` sütunu var (#6a75a6ae geri getir).
  `Son Tarih` yalnız `Geciken` görünümünde (#6a75ad62); diğer birim görünümlerinde yok
  (#6a75a7b9 / #6a75a725 / #6a75a790). Bağlı Olduğu Talep No dar (~10rem), başlık geniş (#6a75a6ae width).
- **Taleplerim / Birime Gelen / Birimden Giden `Tümü`:** Durum sütunu Son Tarih’ten önce
  (#6a75a5fd / #6a75a5a3).
- **Birimden Giden:** Onaylanmış + Yapılmakta’ta Son Tarih yok (#6a75a457); Tamamlanmış + İptal’de
  Görevi Yapan / Görev Sahibi yok (#6a75a4ff).
- **Kurum içi FAB sohbet zemin:** liste paneli ile aynı `bg-[color:var(--color-background)]`
  (bej `#ece5dd` geri alındı — #6a75a09a).
- **Yönetici anasayfa kutucuk sırası (#6a75b318 / #2808 / #2811):** üst satır Birimdeki
  Görevler → Bekleyen Görevlerim → Geciken Görevlerim; alt satır Vatandaş Talepleri → Bekleyen
  Taleplerim → Geciken Taleplerim (Kurum İçi modülü açıkken). Birime Gelen / Birimden Giden
  kutuları kaldırıldı (#2808).
- **VT operatör/CRM anasayfa kutucuk grid (#2807 reopen):** Operator veya CitizenRequestManager
  (veya Staff+Operator ek rol) dört kutucukta yönetici alt satırıyla aynı flex düzeni — tek satır
  yan yana (`lg:max-w-[calc((100%-9rem)/4)]`), 2×2 değil. Sıra: Bekleyen Görevlerim → Geciken
  Görevlerim → Bekleyen Taleplerim → Geciken Taleplerim.
- **Personel/Operatör anasayfa kutucuk sırası (#6a75bf14):** Bekleyen Görevlerim → Bekleyen Taleplerim.
- **Bekleyen Görevlerim kart sayısı (#6a75c274 / #2804 reopen):** pie `dashboard.chart.pending`
  dilimi (geciken hariç); tıklanınca `/my-tasks?view=pending`. `myPendingTaskCount` yalnızca
  nav rozeti / eski uyumluluk için geciken dahil kalır; kart sayısı `myPendingTaskNavBadgeCount`
  veya pie ile aynı.
- **Operatör birim anasayfa banner (#6a75bed6):** `pageTitle` / breadcrumb `birimler` = `Anasayfa`
  (Anasayfa - Birimler değil).
- **Görev Tarihi filtre harf (#6a75c435 / #6a75c4e8):** Görevlerim + Personelimin `createdAtUtc`
  FilterableTh `allowLetters`; filtre değeri tarih + tip rozeti metnini kapsar.
- **Personelimin Görev Tarihi altı tip (#6a75c4e8):** `showTaskTypeUnderDate` staff’ta da.
- **Birimdeki kolon genişlik (#6a75c5d5):** Sıra + Talep No dar; Görev Tipi geniş (~10.5rem).
- **WA Açık Adres hint (#6a75b7a4 reopen):** `(max 100 karakter)` `text-[10px]` normal-case.
- **Kurum Konumu ilçe kalıcılığı (#6a75b1ae):** Kaydet → `TenantSettings.Theme = ccc-district:<id>`
  + localStorage; sonraki girişlerde Settings dropdown seçili gelir. Kurum Bilgisi Kaydet Theme’i silmez.
- **WA Mahalle:** başlık tıklanabilir değil (div, label değil — #6a75b6c1); dropdown seçenekleri
  küçültülmüş (#6a75b6ed). Açık Adres `(max 100 karakter)` küçük + normal-case (#6a75b7a4).
- **WA pending ek dosya adı:** `text-[11px]` / `text-xs` (#6a75b73a).
- **Vatandaş Talebi Açıklama hint:** `field-hint` (#6a75b7b0). Rutin Dosya/Görsel başlık
  biraz küçük (#6a75be0b).
- **Anasayfa kutucuk sayıları (#2520):** ikon solda; sayı başlık metninin hemen sağında (hafif
  sağa, `font-bold`/`text-xl`); başlık+sublabel bir satır yukarı hizalı.
- **Reporter vatandaş anasayfa (#2519):** pie grid son kutusu `Bildirimler` — son 3 bildirim (sıra no),
  mesaj `line-clamp-1` + `title` tooltip; başlık satırında `Tüm bildirimleri gör`. Tüm anasayfalarda
  pie bölümü sonunda (#2519 reopen).
- **Sol menü rozetleri (#2523):** `myPendingTaskNavBadgeCount` son tarihi geçmiş görevleri saymaz;
  job rozetleri `DueDateUtc >= now` ile zaten filtreli.
- **Kurum içi mesaj ünvan (#2518):** `TenantSetting.InternalMessagesSettingsJson`;
  `showUserTitleInMessages` varsayılan `false`; Ayarlar > reCAPTCHA altında checkbox; FAB liste ve
  sohbet başlığında ünvan yalnız açıkken.
- **Görevlerim düzenle Öncelik dropdown (#2503 reopen):** `max-width: 12rem`.
- **Görevlerim düzenle başlık textarea (#2522 reopen):** dikey ortalı görünüm (`padding` + `min-height: 2rem`).

## 5. Dashboard / Wallboard

- **Dashboard modül redirect'leri hook sonrası (CI):** `DashboardPage` içinde citizen/departments
  `Navigate` early-return'leri tüm `useState`/`useQuery`/`useEffect` sonrasında olmalı;
  hook öncesi return `react-hooks/rules-of-hooks` ile lint fail eder.
- **Banner buton sayımları client-side hesaplanır; dashboard'da bu aggregation YOK.**
- **Yönetici `Vatandaş Talepleri` kartı:** `activeSocialMessageCount` — İşleme Alındı VT
  sayısı (`CitizenVtDashboardClassification`, geciken dahil — #2812); alt etiket **Onay Bekleyen**
  (#2791 reopen). Tıklama → `/incoming-requests?citizen=1&status=processing-received`.
  Grid `processing-received` iptal/terminal VT satırlarını içermez — `toExternalRow` terminal
  job durumunu `PendingExternalApproval` ile ezmez (#2812 reopen).
- **Yönetici `Bekleyen Taleplerim` kartı:** sayı = `myRequests` pie `externalPendingApproval`
  dilimi (`PendingExternalApproval` veya `Active` + `taskCount===0`, geciken hariç — Taleplerim
  `external-pending` grid ile aynı); tıklama → `/my-requests?view=external-pending` (#2800).
- **Personel `Bekleyen Taleplerim` kartı:** sayı = `myRequests` pie `pending` dilimi (geciken
  dahil değil); tıklama → `/my-requests?view=pending` (#2801).
- **Anasayfa geciken kutucukları (#2802/#2803):** Bekleyen Taleplerim/Görevlerim sonrası
  `Geciken Taleplerim` / `Geciken Görevlerim`; sayı = ilgili pie `overdue` dilimi; tıklama
  → `/my-requests?view=overdue` / `/my-tasks?view=overdue` + aktif dönem `from`/`to` + `fromPie=1`
  (#2817/#2818); pie ile aynı dönem için Geciken grid `createdAtUtc` ile süzülür (`fromPie` + overdue).
  Yönetici kutucuk/pie `myTasks` = `GET /tasks?scope=mine` (yalnızca `AssignedUserId`; birimdeki
  görev kümesiyle sınırlama yok, #2817 reopen); `myRequests` = `GET /jobs?scope=mine` (Routine hariç,
  aktif birim `OwnerDepartmentId`; yalnız ExternalUnit değil, #2818 reopen).
- **Personel/CRM anasayfa 4 kutucuk (#2807 reopen):** Staff + Operator + CRM dörtlü flex sıra
  (Bekleyen Görevlerim → Geciken Görevlerim → Bekleyen Taleplerim → Geciken Taleplerim);
  `useStaffMetricFourCol` Staff rolünü de kapsar.
- **VT İşleme Alındı geciken (#2800/#2819):** grid `GridStatusLabel` + `overdueSubline` →
  `İşleme Alındı` alt satır `(Geciken)`; pill turkuaz kalır; detay popup
  `getCitizenRequestDetailStatusLabel` → tek satır `İşleme Alındı (Geciken)`.
- **Yönetici `Personelimin Görevi Çözme Süresi` grafiği:** yalnız Manager rolünde ve yöneticinin
  kapsamındaki personele atanmış rutin olmayan terminal görevleri kullanır. Süre Görev Tarihi
  (`CreatedAtUtc`) ile tamamlananda `CompletedAtUtc`, iptalde son `TaskCancelled` audit zamanı
  arasındadır; personel başına ortalama saat (1 ondalık) gösterilir.
- **Reporter dashboard pie drilldown popup:** başlık yeşil ve `Info` ikonludur; tablo başlıkları
  portal/zoom farkını dengeleyecek şekilde `.data-table` genel header fontundan sonra override edilir
  ve Taleplerim gridview'ın görsel başlık font/ölçeğiyle, pagination satırı yüksekliğiyle uyumlu kalır.
  Terminal tarih kolonu yalnız `Tamamlanma Tarihi` veya `İptal Tarihi` başlığı
  kullanır; `Tamamlanma / İptal Tarihi` fallback ibaresi geri gelmez.
  Anasayfa-Vatandaş mahalle/birim/VT pie popup’larında **Birim sütunu yok** (#2689).
  Pie drilldown shell `67vw` / `80rem` (#2690). Sütun filtresi varken yanıp sönen **Filtreyi sil**
  Yazdır’ın solundadır (#2683); chip punto/padding biraz küçüktür (#2683 reopen).
  "Banner sayımına bağlı grafik" istekleri yeni backend aggregation gerektirir (#731 bu
  yüzden ertelendi).
- **Dashboard pie chart'ları sıfır veride de görünür kalmalı:** `showZeroSlices` kullanılan
  grafiklerde tüm dilimler 0 olsa bile nötr donut + sıfır lejant gösterilir; kart boş/çökmüş
  görünmez.
- **Personelimin Görevleri pie (R548 / #2034):** birimdeki tüm aktif `Staff` kullanıcıları
  (görev sayısı 0 olsa bile) dilim/lejantta kalır; yalnız görev atanmış personel listelenmez.
- **Mahalle pie'ları (R548 / #2035):** `neighborhoodCompleted/InProgress/Processing` Tire
  mahalle kataloğundaki tüm isimleri 0 sayıyla doldurur (`TireNeighborhoodCatalog`, FE
  `izmir-locations.ts` ile senkron); katalogda olmayan geçmiş mahalle adları kaybolmaz.
- **Dashboard pie lejant yüksekliği (card #1597):** ortak `PieChart` lejantı en fazla 5 satır
  yüksekliğinde kalır; daha çok dilimde yalnız sağ lejant dikey scroll olur. Donut ve dashboard grid
  kartı uzun etiket listesi yüzünden aşağı doğru büyümemelidir.
- **Dashboard dönem altı metrik kutucukları (card #2532 reopen):** `DashboardPage` üst grid
  + alt satır `justify-center` (Bekleyen Taleplerim / Bekleyen Görevlerim / Vatandaş Talepleri);
  `max-w-7xl gap-x-12`; kutucuk `min-w-[15.5rem]`.
- **Talep Etiketi pie chart'ı (card #1591):** yalnız Üst Düzey Yönetici (`Reporter`) ve Vatandaş
  Operatörü (`Operator`) dashboard'larında görünür. Tenant ve seçili tarih aralığındaki talebi
  `SocialMessage.JobId` üzerinden tek kez sayar; etiket kaynağı önce `SocialMessage.Category`, boşsa
  bağlı `CitizenConversation.Label` değeridir. Tanımlı `RequestTag` adları sıfır sayıda da lejantta
  kalır; geçmişte kullanılmış fakat sonradan tanımdan kaldırılmış etiketler kaybolmaz.
  Durum filtre butonları (Yapılmakta Olan / Tamamlanan / Tümü) yok; pie her zaman tüm
  durumları gösterir (#2606). Lejant ve dilimler en çok verisi olan etiket üstte
  (sayı azalan, eşitlikte ada göre; sıfırlar altta). Etiket adı ve sayısı sağ lejantta kalır.
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
- **Sol menü dizin sırası (#6a6cfc0c / #2571):** Reporter’de: Anasayfa - Vatandaş → Vatandaş Talep Haritası →
  Vatandaş Bilgi Listesi → Anasayfa - Birimler. Operator’de: Anasayfa → (citizen) Anasayfa - Vatandaş →
  Harita → Bilgi Listesi. Sistem Admin’de harita/dizin Vatandaş Talepleri grubundan sonra kalır.
- **Vatandaş Bilgi Listesi (card #1836, kolon/buton düzeni #1843/#1858):** `/citizen-directory` yalnız
  `Reporter` / `Operator` / `SystemAdmin`; grid `GET /citizen-conversations`. Ana gridde `Talep Kanalı`
  sütunu yok (#2543); kanal yalnız detay popup talep listesinde `Talep Tarihi` sonrası (#2540).
  Telefon hücresi diğer kolonlarla aynı font (`font-semibold text-slate-800`,
  `font-mono`/`text-base` yok — card #1863) + `formatDirectoryPhone` (baştaki `90`/`0`
  gösterilmez — card #1843 reopen). Operatör/çağrı ile oluşturulan VT'ler `ConvertSocialMessageToJob`
  sırasında `CitizenConversation` upsert eder; liste sorgusu eksik konuşmaları da backfill eder
  (card #1858). WhatsApp Konuşmaları listesi `whatsAppOnly=true` ile yalnız en az bir WhatsApp
  kanal mesajı olan konuşmaları gösterir; çağrı VT numaraları bu listede yoktur (card #1864).
  Detaylar → konuşma ticket listesi (aynı telefon tüm kanallar — BE konuşma birleşimi +
  orphan Phone VT telefon eşlemesi, card #2543/#2546) → salt-okunur
  `MyRequestDetailModal`; listede `jobId` olmayan ama `citizenRequestNumber` taşıyan ticket'lar da
  gösterilir. İşlemler’de **Düzenle**: Mahalle/Cadde/No/Adres Tarifi grid üzerinde değişir;
  CBS kademeli seçim + mevcut `PUT .../profile` (#2784). Ad/telefon ezilmesin diye kayıtta
  mevcut isim/telefon/etiket gönderilir. Düzenle koyu turkuaz (`teal-700`); sırası Detaylar → Yazışmaya Git → Düzenle (#2787).
  Detaylar `FileText`, Düzenle `PenLine` (Sms Onayı ile aynı, #2795).
  Üst Düzey (`Reporter`) Düzenle görmez (#2789). Düzenlerken İptal kırmızı (`destructive`, #2794). Açık menü punto `0.6875rem`, satır `1.5rem` (#2788); kapalı tetikleyici
  `13px` (#2790). Yazışmaya Git: Üst Düzey’de koyu turkuaz (#2792), diğerlerinde açık sky.
  Yazışmaya Git → birim yöneticisi/personel detayındaki aynı
  `WhatsAppConversationModal` (`latestSocialMessageId` veya konuşma detayından) (card #1884);
  `Phone`/Çağrı satırında `DisabledActionButton` ile pasif (card #1868), açık mavi stil
  (`MessageSquareText` + `!bg-sky-400`). Mobil grid `table-wrap` ile yatay kayar (#r482).
  İç içe detay popup'ta (`MyRequestDetailModal`) İlgili Görev Detayları → Tamamlama Notu
  `citizenApprovalReleasedNote` = yöneticinin **ilk** `CitizenMessageApprovalReleased` notu
  (reopen sonrası yeni döngü). Operatör Sms Onayı gönderimi ikinci Released audit yazmaz;
  geçmişte yazılmış ikinci kayıtlar yok sayılır. Operatör Sms Onayı'nda notu değiştirirse
  `citizenOutboundMessage` → `Vatandaşa Giden Mesaj` Tamamlama Notu'nun **alt satırında**
  (WA ile aynı; #2528 SMS'te de). Tamamlama ile outbound farklıysa outbound kırmızı (#2557).
- **FAB boyutları (#r482/#2638):** WhatsApp + Kurum İçi 2.75rem / sm 3rem; scroll 2.5rem / sm 2.75rem.
  Üçü de biraz küçük; sıra WhatsApp → Kurum İçi → scroll.
- **Reporter/Operator anasayfa ayrımı (cards #1833/#1810/#1859/#2341/#2348):** Üst Düzey Yönetici
  (`Reporter`) sol menüde `Anasayfa - Vatandaş` (`/dashboard`, citizen lisans açıkken) + `Anasayfa - Birimler`
  (`/dashboard/birimler`); genel `Anasayfa` etiketi gösterilmez — birim sayfası varsayılan (#2348). **Vatandaş Talep Operatörü**
  (`Operator`) menüde 1. sırada yalnız `Anasayfa` (`/dashboard/birimler`); altında Vatandaş
  Bilgi Listesi ve (citizen lisans açıkken) `Anasayfa - Vatandaş`. **Operator varsayılan açılış** (`getDefaultLandingPath`) =
  `/dashboard/birimler`. Citizen lisans kapalıyken Anasayfa menüsü `/dashboard/birimler`'e yönlenir (#2362).
  Operator birim anasayfasında standart kullanıcı
  kutucukları (Bekleyen Taleplerim / Bekleyen Görevlerim) gösterilir. **Bekleyen Taleplerim**
  kutucuk değeri = `myRequests` pie `Bekleyen` + `Geciken` dilim toplamı (#2561).
  `/dashboard/birimler` sayfasında banner üstü Geri butonu gösterilmez (card #1889).
  Genel `nav.dashboard` metni `Anasayfa`. Vatandaş sayfasında Bekleyen Taleplerim/Görevlerim kartları yoktur — yalnız dönem filtresi +
  vatandaş pie'ları (Vatandaş Talepleri, Talep Etiketi, mahalle Tamamlanan/Yapılmakta/İşleme Alınan,
  Vatandaş Talep Kanalları). Vatandaş pie 1. satır mahalle üçlüsü, 2. satır birim üçlüsü (#2606).
  İşleme Alınan pie yalnız ProcessingReceived (açık görev yok; overdue/Active+görev yok);
  Yapılmakta pie Yapılmakta + overdue (#2605). Drilldown Durum etiketi sahte taskCount=1 kullanmaz —
  `OpenTaskCount` ile İşleme Alındı / Yapılmakta ayrılır. Harita alanı yok (#6a6cdf95).   Birimler sayfasında Reporter pie sırası: Bekleyen / Yapılmakta / Tamamlanan Talepler →
  Yapılmakta / Tamamlanan Projeler → Talep Oluşturan Birimler → Taleplerim → Bildirimler (#2629).
  Birimler sayfasında Reporter: Taleplerim +
  dış birim pie'ları. Operator: Görevlerim/Taleplerim. `Birimdeki Görevler` ve `Talep Önceliği`
  pie'ları tüm anasayfalardan kaldırıldı (#2521). Birimler pie + drilldown vatandaş kaynaklı
  job içermez (#2570): `RequestType=Citizen`, `SourceType∈{SocialMessage,CitizenRequest,EDevlet}`
  ve VT numaralı kayıtlar `WhereIsNotCitizenSourced` ile dışlanır — yalnız `RequestType != Citizen`
  yetmez.   Birimler pie başlıkları: Onay Bekleyen Talepler / Tamamlanan Talepler (#2608/#2623).
  Pie drilldown Durum `Onay Bekleyen` sky mavi (`pendingApproval` / `bg-sky-100`, #2625);
  Bekleyen görev nötr kalır.
  Kullanıcıya görünen `Son Tarihi Geçmiş` ifadesi her yerde `Geciken` (#2632/#2633);
  birleşik etiket `Yapılmakta (Geciken)`.
  Talep Oluşturan Birimler drilldown: Birim sonrası Gittiği Yer; Bekleyen/Yapılmakta/Tamamlanan
  drilldown: Talep Yeri (sahip birim) Birim’den önce (#2616). Durum overdue = `Yapılmakta (Geciken)` (#2609).
  Yapılmakta/Tamamlanan Projeler pie yalnız Birim İçi (`InternalUnit`, Owner birim) + Üst Düzey
  Yönetici’nin oluşturduğu `IsProject` talepler (#2618); Birim İçi Target JobDepartment aranmaz
  (T-2026-589). Diğer birim-dışı projeler dahil değil.
- **Pie drilldown Birim (#6a62fe79):** dış birim / mahalle / talep etiketi / Vatandaş Talepleri
  popup’ta Birim tek satır `truncate` + overflow tooltip (`max-w-[12rem]`).
- **Vatandaş Talep Haritası (#2572/#2569):** `/citizen-request-map`; `GET /reports/dashboard-citizen-map-pins`;
  Banner: mahalle, cadde/sokak, no içeren açık adres (#2656). Birim haritası aynı kalıp (#2657).
  Reporter **ve Operator** (403 değil). Pin kümesi `WhereHasCitizenRequestNumber` — `RequestType=Citizen`
  şartı yok (VT numaralı kaynaklar). Dönem filtresi Anasayfa ile aynı; pin clustering
  `@googlemaps/markerclusterer`;   marker tıklanınca doğrudan `MyRequestDetailModal` (`Vatandaş Talebi`),
  InfoWindow yok. Aynı adres/konumda birden fazla talep varsa dizin nested
  `Vatandaş Bilgi Listesi` popup'ı açılır; tek talepte Vatandaş Talebi kalır (#2592).
  Cluster rengi banner `--color-header-from`; ilk tıklama yalnız zoom in (pan + 1 kademe),
  `fitBounds` / zoom out yok (#2598). İlk cluster tıklaması +1 kademe; ikinci tıklama zoom 16
  (pin görünür, sokak seviyesine inmez — 3. tıklama/`fitBounds` yok; #2612). SuperCluster
  `maxZoom` 13, böylece 2. tıklamada küme çözülür.
  başlangıç zoom'da tek pin bile sayılı cluster, cluster'dan çıkınca durum rengi (#2569).
  Pinler yüklenince / geocode oldukça kamera **hareket etmez** — ilçe merkezi + zoom 12 (#2591).
  Marker **pin ikonu** (daire değil); cluster küçük, pin 18×27 (#2593/#2597). Pin **rengi** durum
  rengi (sky-500 / orange-500 / red-500 / green-500; iç daire beyaz); doygunluk artırımı
  geri alındı (#2613). Dış çerçeve / beyaz stroke **yok** (#2597).
  Pinler geocode bitene kadar haritaya konmaz (#2607). `cameraControl` kapalı;
  Google haritada yalnız cadde/sokak/bulvar etiketleri; POI ve transit kapalı; CBS overlay
  veya özel referans marker yok (#2799).
  özel +/- 2rem (tüm çerçeve tıklanır, Google native zoom yok) sağ altta; Street View sarı pegman
  beyaz çerçeve 1.7rem / iç logo 26px, +/- yığınının solunda **+/− arasındaki çizgi hizasında** (#2614/#2615/#2621/#2631/#2769).
  Hover’da pegman bir kez geri kayar ve durur; mouse çıkınca eski konumuna döner (#2767).
  `StreetViewCoverageLayer` + yola tıklayınca panorama (#2614/#2615/#2621/#2631).
  Özel `svv` `ImageMapType` overlay tıklamayı yutar — kullanma (#2631).
  Düşük zoom native koyu mavi kapsama çerçevesi durur; erode/CSS ile inceltme geri alındı (#2622).
  pan/fullscreen yok. Geocode fail pin yok; harita altında “konumlanamadı” yazısı yok (#2604).
  Pin konumu **İzmir CBS** (`cbs.izmir.bel.tr` kapı katmanı / cadde orta hattı); Google
  adres araması yok (#2696). Cadde/sokak
  boşsa veya CBS kaydı yoksa marker yok — mahalle yedeği vatandaş haritasında yok (#2635;
  #2600 geri alındı). Job.Street boşsa bağlı konuşmanın cadde/no’su pin API’de yedeklenir (#2692).
  Mevcut mahalle-seviye pinler de kalkar.
  No yoksa CBS cadde orta hattı + ~30 m boş alana kaydırılır. Yalnız Adres Tarifi / GPS /
  konuşma adresi yetmez (#2594/#2595). Marker **yalnız mahalle + cadde/sokak + no** — açık adres
  (adres tarifi) CBS sorgusuna girmez (#2695). Geocode fail
  ilçe merkezine düşmez. Mahalle adı CBS kataloğuyla eşleşir: tam ad
  önce eşleşir (`İbni Melek OSB` ayrı kalır, İbni Melek mahallesine indirgenmez — #2661).
  Yalnız mahalle/mah soneki atılır. Kayıtlı lat/lng
  (WhatsApp GPS) harita pinini ezmez. Anasayfa haritası yok (#6a6cdf95).
  **İptal** talepler haritada gösterilmez (#2579). Pin/lejant: İşleme Alındı turkuaz `#0d9488`,
  Yapılmakta mavi `#0ea5e9`, Geciken turuncu `#f97316` (#2671). Vatandaş lejant metni
  `Yapılmakta` (Olan yok); Geciken lejantı `whitespace-nowrap` ile yan yana `Yapılmakta Geciken`
  (#2671/#2680). Banner: `Bölgenizdeki vatandaş talepleri…` (ilçe adı yok, #2685).
  Sağ alt zoom’da `+` üstünde hedef ikonu sayfa açılış merkez/zoom’a döner; ikon `20px`, çerçeve `2rem` (#2688).
  Varsayılan zoom bir kademe geniş (#2579).   Hover'da el (grab)
  imleci ve `gestureHandling: greedy` ile tekerlek zoom (#2589). Küçük ekranda (`max-width: 1023px`)
  hover yok: harita baştan `greedy` + `touch-action: none` (pinch/zoom çalışır); WhatsApp ve
  kurum içi FAB gizlenir, zoom kontrolleri kapanmaz (#2694). Sayfa banner/layout
  Anasayfa-Vatandaş `section-card` ile aynı (#2580).
  **Talepleri Listele (#2664/#2665/#2668):** `N konum` metninin yanında; popup yalnızca haritada
  konumlanan pinleri listeler (`detail-modal-shell--all-requests` + drilldown grid).
  Yanında **Haritada Olmayanları Listele** aynı popup; başlık **Harita Konumu Olmayan Talepler** (#2737/#2745).
  Birim haritası konumlanan liste başlığı **Konum Bilgisi Olan Birim Talepleri** (#2745).
  Mobilde bu buton Talepleri Listele’nin sağında aynı satırdadır; etiketler nowrap, mobil butonlar biraz daha yüksek; genişlik içerik kadar (`w-fit`); Talepleri Listele biraz daha dar padding (`px-1.5` vs `px-2`, #2738).
  Liste popup başlığı title case’dir (ALL CAPS yok, `map-list-modal-title`) (#2740).
  Sütun filtresi varken yanıp sönen **Filtreyi sil** kapatma (X) solundadır (#2717).
  Dönemdeki pinlenemeyen talepler (cadde yok / geocode fail). Konum ikonu yok, Detaylar durur (#2693). Pin API cadde
  şartı yok — cadde/konuşma yedegi geocode için FE’de; harita yine cadde zorunlu (#2635).
  Vatandaş kolonları Anasayfa Tüm Talepler VT grid’i; **Gittiği Yer yok** (#2682).
  (Talebi Yönlendiren/owner değil). Durum `processingReceived` = İşleme Alındı
  (#2668, Onay Bekleyen değil).   Vatandaş listesinde Durum pill: İşleme Alındı turkuaz
  (`bg-teal-600`), gecikmiş İşleme Alındı da turuncu değil — alt satır `(Geciken)` (#2819);
  İşleme Alındı / Yapılmakta pill boyutu grid'de hafif büyük (`grid-status-label--flow-status`, #2822).
  Yapılmakta Görevlerim ile aynı açık mavi (`bg-sky-100` / `getStatusPillClass`,
  #2699), Geciken turuncu (`bg-orange-500`). Pin rengi Yapılmakta `#0ea5e9` kalır (#2671).
  yeşil Konum ikonu (yuvarlak çerçeve + hover, #2673/#2674); damla pin küçük yeşil (#2700).
  Konum ile Detaylar
  arası boşluk artırılır (#2677). Liste grid’leri FilterableTh sıralama/filtre kullanır
  (Sıra/İşlemler hariç, #2678).   Konum tıklanınca
  marker bounce harita/marker tıklanıncaya kadar sürer (#2676).   Liste Detaylar Yazdır
  `printJobDetail` / `printHtmlDocument` popup (Talep Detayları tablosu, Açıklama, Adres,
  Yönetici Notu, Ekler, Görev) — mevcut sayfanın Chrome yazdır önizlemesi değil (#2692).
  Harita listesi Detaylar’da lat/lng **Konum** bloğu yok (#2762).
  Liste/harita Detaylar popup başlığı **Talep Detayları** (#2768).
  pill Taleplerim ile aynı (`getStatusPillClass`, geciken turuncu+beyaz #2665). Birim kolonları
  #2665). Birim kolonları Birim Talep Bilgi Listesi.
- **Birim Talep Haritası (#2610/#2611/#2667):** `/department-request-map`;
  `GET /reports/dashboard-department-map-pins`. Yalnız `internal` lisans.
  Sol menü Anasayfa - Birimler’in altında; Sayfa Yetkileri’nde Vatandaş Talep Haritası’nın
  bir alt satırında. Pinler vatandaş-olmayan (`RequestType != Citizen`, sosyal/e-Devlet/rutin yok)
  ve Birimdeki Görevler kapsamındaki atanmış görevlerin talepleri — kullanıcının birimi.
  Üst Düzey Yönetici (`Reporter`) ve SystemAdmin tüm birimlerin atanmış taleplerini görür (#2641).
  Lejant: Yapılmakta (mavi) / Geciken `Yapılmakta Geciken` tek satır nowrap (turuncu) / Tamamlanan;
  Onay Bekleyen yok (#2665/#2679/#2680). Reset ikonu + zoom vatandaş haritası ile ortak (#2688).
  Harita başlığı Reporter/SystemAdmin’de
  `Kurum İçi Birim Talepleri` + banner “Tüm birimlere atanmış…” (#2680); diğer roller
  `Birimdeki Görevler` + “Biriminize atanmış…” (#2679).
  Marker cluster popup başlığı `Birim Talep Bilgi Listesi`; kolonlar Talep No / Talep Tarihi /
  Talep Yeri / Gittiği Yer (hedef birim) / Başlık; Talep Kanalı yok (#2667).
  Geocode kuyruğunda 4 sn timeout pin düşürmez (#2640). Yönetici kendisine atanmış talep
  (AssignedUserId) adresi varsa haritada görünür; cadde CBS’de yoksa mahalle yedeği
  birim haritasında kullanılır. Mahalle+Cadde+No (No ≠ Yok) doluysa Konum Koordinatı / lat-lng pin’e girmez (#2720).
  No=Yok + koordinat yok → marker yok (#2718). No=Yok veya adres boş + koordinat → pin koordinatta;
  adres boşsa CBS mahalle/cadde doldurulur, No=Yok (#2719). Reporter tüm atanmış
  görevleri (birim veya kişi) görür. Açık adres marker için kullanılmaz (#2695). Vatandaş haritası
  cadde zorunlu kalır (#2635). Pin noktası CBS (`GET /izmir-cbs/point`).
  Pin API + geocode paralel (en fazla 4 eşzamanlı, aynı adres tek istek); dönem değişince
  önceki pinler yerinde kalır, cache 60 sn (#2643).
- **Anasayfa-Vatandaş Tüm Talepler (#2644/#2647):** dönem satırında Özel’den sonra `Tüm Talepler`;
  popup operatör VT grid (`SocialMessagesPage` embedded). Boyut Taleplerim Detaylar
  (`detail-modal-shell--my-request`). Anasayfa Tüm Talepler popup’ı Taleplerim detaydan çok az
  daha geniş (`detail-modal-shell--all-requests`, #2644/#2648). Kanal chip’leri ve Tüm Talep Durumları
  dropdown yok; Talep Etiketi sütunu yok; thead drilldown standardı (`0.78rem`).
  Ara / başlangıç / bitiş tarihi yok. Tüm VT kayıtları listelenir.
  **Gittiği Yer sütunu yok** (Operator #2686, Reporter #2687). Reporter `GetSocialMessages`
  tam kutu (Operator ile aynı). Embedded yükleme etiket/birim listesini atlar; işler
  `requestType=Citizen` ile çekilir (#2686/#2687). Yükleme sürerken grid içinde
  `Sayfa yükleniyor...` (`common.pageLoading`, #2686/#2687). Popup kolon başlıkları **Talep Tarihi** / **Telefon No**; paging sticky altta (#2649).
  Popup genişliği Taleplerim detaydan daha geniş (`70vw` / `84rem`, #2644). Küçük ekranda
  başlıklar sığmazsa yatay kaydırma (`overflow-x`, #2648). Boş grid metni
  `Henüz vatandaş talebi bulunmuyor` (`social.emptyCitizenRequests`, #2644).
- **Anasayfa-Birimler Tüm Talepler (#2645/#2648):** Özel’den sonra aynı buton; popup başlığı
  `Birimlerin Tüm Talepleri`. Boyut Taleplerim Detaylar (`detail-modal-shell--my-request`).
  Vatandaş-olmayan atanmış kurum içi talepler (Sıra, Talep No,
  Talep Tarihi, Talep Yeri, Gittiği Yer, Başlık, Durum, İşlemler). Gittiği Yer = hedef birim;
  birim içi talepte sahip birim adı. Durum = Taleplerim `StatusPill` + `GridStatusLabel`.
- **Vatandaş Talepleri kanal chip'leri:** Tümü / WhatsApp / Çağrı / e-Devlet / Mobil Uygulama
  (`SocialChannel.MobileApp`). e-Devlet ve Mobil Uygulama'da Yeni/işsiz talep sayısı kırmızı badge;
  chip tıklanınca badge localStorage ile temizlenir (card #1871/#1872). Mobil Uygulama satırında
  birim yoksa Gittiği Yer birim dropdown (`routeSocialMessage`); Talep Etiketi sütunu `RequestTagPicker`
  (card #1877/#1878).
- **Ayarlar Sosyal Medya Entegrasyonu:** tab adı bu; Web Formu + Mobil Uygulama statik kartlar
  (card #1873/#1874).
- **Vatandaş Bilgi Listesi:** Talep listesi popup Taleplerim header'ı (logo ortada + Yazdır +
  kırmızı yuvarlak X), sticky thead (sürekli gradient — `th` transparan), paging; nested detay
  başlığı `Vatandaş Talep Bilgisi`. Popup grid tipografisi Taleplerim ile aynı (`thead` 0.78rem /
  `td` 0.9rem, thead biraz yüksek); alt başlık (ad·telefon) `text-xs` + biraz aşağı (card #1889).
  Ana grid: `Vatandaş Adı`; Talep Kanalı Numara'dan sonra ve ortalanmış (card #1880–#1883 reopen).
  Cadde / Sokak sonrası **No** sütunu (`streetNo`); açık adres başlığı **Adres Tarifi** (#2587).
  Nested İşlemler→Detaylar popup Taleplerim shell’den biraz küçük
  (`detail-modal-shell--citizen-directory-nested`, card #r454).   Nested talep listesi Durum
  `getCitizenRequestStatusLabel` + `ticket.dueDateUtc` + `openTaskCount` (sahte `taskCount: 1` yok —
  açık görev yoksa `İşleme Alındı`, detay popup ile aynı, #2628; overdue = `Yapılmakta` /
  `(Geciken)`, #2574).
  Harita aynı-adres popup'ında Birim yerine stacked Vatandaş Adı / Telefon No
  (`replaceUnitWithCitizenContact`). Dizin Detaylar popup’ında Birim yok; stacked Ad/Telefon
  kolonu da yok (#2750) — yalnız harita `replaceUnitWithCitizenContact`. Başlıklarda sıralama+filtre;
  dizin yazdırmada kanal sütunu, stacked Ad/Telefon yok. Dizin **Filtreyi sil** Yazdır’ın solunda
  (aynı grup, #2708). Filtre sonucu boşsa grid kalır, tbody `Henüz gösterilecek veri yok.` (#2653);
  paging pie drilldown gibi tablo hemen altında (sticky footer değil); boş-durum çerçevesi pie ile aynı alçak padding.
  Kapalı ve açık `SingleSelectDropdown` hover tooltip yok (Talep Oluştur Görevi Yapan/Öncelik/Mahalle/Cadde dahil, #2754).
  **Adresi Gör** popup: başlık altı çizgi; Mahalle/Cadde/No aynı satır, altında yalnız Adres Tarifi (Konum Koordinatı yok); Cadde/No başlık+değer kolon içi ortalı; popup `max-w-[26rem]` (#2755). X Talebi Yönlendir ile aynı.
  Detay **Adres Bilgileri**: satır1 Mahalle+Cadde+No; satır2 Adres Tarifi Mahalle altında, Konum Koordinatı Cadde altında; koordinat varsa **Konumu Gör** (#2756; #2758 No hizası geri alındı). Adres Tarifi / Konum başlıklarının üstünde ekstra boşluk (#2666). Taleplerim / Birimden Giden detayında **No** başlık+değer sağa daha yakın (`2.4rem` üç kutu, `1.6rem` iki kutu, #2759).
  Görevlerim İlgili Talep Adres Bilgileri 3+2; Mahalle/Cadde/No üstünde boşluk (#2568); Adres Tarifi başlığı Mahalle ile aynı sol düşey hizada (#2778); satır 2 üstte boşluk (#2651). WA Vatandaş Bilgileri Cadde menüsü tetikleyiciden sağa (No tarafına) daha geniş (`+96px`), No tetikleyici genişliğinde, aşağı açılır (#2640). WA Talebi Oluştur Açıklama toolbar ikonları yalnız o popup’ta küçük (`!important`, Tailwind size-4 ezmesin, #2757). Giden WA birim·ad yeşil balonda `text-white/90`. WA Talebi Oluştur Mahalle/Cadde/No/Birim arama kutusu 0.7rem (#2760).
  Vatandaş talep detayında adres doluysa Talep Bilgileri’nde Vatandaş Adı / Telefon No altında
  **Vatandaş Adres Bilgisi** + sağda **Adresi Gör** (küçük portal popup, #2751).
  Harita popup kolon sırası: Sıra → VT No (kanal ikonu `size-3.5` yanında, Talep Kanalı sütunu yok)
  → stacked Vatandaş Adı / Telefon No → Talep Tarihi → Başlık → Durum (#2635/#2636).
  Harita Yazdır h1 ve VT No stacked `Vatandaş` / `Talep No`; Vatandaş Adı / Telefon No
  başlığı ve hücresi de stacked, slash yok (#2636).
  Nested detay **Süreç** overdue tek satır `Yapılmakta (Geciken)` — stacked GridStatusLabel değil (#2574).
  İptal / Tamamlanmış pill içinde alt satırda tarih (`completedAtUtc` / `updatedAtUtc`, #2574 reopen). Anasayfa pie → Detaylar
  aynı nested boyut (#6a6da278). Başlık: Vatandaş sayfası `Vatandaş Talebi`, Birimler
  `Talep` (#6a6da49d/#6a6da519).
- **Grid thead rengi + sticky örtü (card #1888 / #r447):** sticky `th` opak
  (`background-color` + aynı linear-gradient, `background-attachment: fixed`) — scroll’da
  tbody satırları başlığın üstüne binmez; hücreler arası sürekli gradient korunur. `z-index` ≥ 5.
- **Vatandaş Talepleri kolon sırası:** Sıra → Talep No → Vatandaş Adı → Telefon → Talep Tarihi →
  Gittiği Yer → Talep Etiketi → **Durum** → İşlemler (#2646; eski Süreç başlığı). Varsayılan sıra
  Vatandaş Talep No **yıl+sıra desc** (en yüksek numara üstte, #2691). Durum hücresi
  Taleplerim `StatusPill` + `GridStatusLabel`. **Tüm Talep Durumları** scope chip
  seçildikten sonra genişlik sabit kalır (`scope-chip-status-select`, #2573). Etiket dropdown hücresinde buton ortalı; açık menü
  satırları sola yaslı (card #1878 reopen — ortalanmamalı).
- **Vatandaş Talepleri Talep Etiketi (card #1878/#r461/#r462/#r463/#6a6d8fe8):** grid hücresinde
  `RequestTagPicker` + `emptyLabel=Etiketler` (diğer formlarda `Etiket seçiniz` kalabilir);
  seçilince buton metni seçilen etikettir, kapalı halde `text-xs`/`h-8`. Açık menü
  satırları `text-left`. Seçiliyken buton içinde chevron sonrası kırmızı `X` → temizlenir.
  Sayfa/link/geri veya popup X → Etiketler default (create `location.key` reset; WA forceNew
  önceki label yüklenmez). Grid sayfa/page-size değişince kolon filtreleri sıfırlanır.
- **WA chat footer (#r463/#r465):** Şablon + Şablon ekle + Birim + Kurum İçi İlet tek satır;
  Birim ~8.75rem; açık panel ~240px; seçiliyken chevron sonrası kırmızı X (`clearable`) temizler.
- **Açık Adres zorunluluk etiketi (#r463):** mahalle sonrası `(max 100 karakter)` sonra kırmızı `*`.
- **WA Talep Oluştur popup (#r464):** konuşma + form `lg:grid-cols-2` (yarım / yarım).
- **Dizin yazdır (#r462–#r465):** h1 `Vatandaş Bilgi Listesi`; Başlık ~30% + ortalı;
  Durum ~15%; nested Detaylar Yazdır = `printJobDetail`.
- **Vatandaş Detaylar Yazdır (#r465):** `printJobDetail` Talep No = `formatJobDisplayNumber` (VT-…);
  vatandaşta `Proje mi` satırı yok.
- **Vatandaş Talep Bilgisi popup (#r466):** `MyRequestDetailMainCard` vatandaşta `Proje mi` satırını
  gizler (`hideProjectRow`); dizin nested Detaylar dahil.
- **Detay popup Proje mi (#2620):** Hayır ise (ve onay bekleyen proje isteği yoksa) `Proje mi`
  başlığı tüm Detaylar popup’larında gizlenir (`MyRequestInfoFieldsList` dahil); Evet / onay
  bekleyen istek görünür. İlgili Talep Detayları `separatePriorityProjectRows` bu kuralı ezer.
- **Detay popup Proje Sahibi (#2624):** yalnız Birim İçi + proje ise
  `Talep Yapılan Birim / Görevi Yapan` başlığı `Proje Sahibi` olur.
  Aksi halde birleşik başlıkta slash yok: **Talep Yapılan Birim** üstte, **Görevi Yapan** alt satır;
  değerler de birim üstte kişi altta hizalı; Görevi Yapan etiketine az üst boşluk (#2650).
  **Talep Yeri** / **Oluşturan** aynı stacked düzen.
- **Detay popup Talebi Yönlendiren (#2627):** yalnız vatandaş talebinde
  `Talep Yeri / Oluşturan` başlığı `Talebi Yönlendiren` olur.
- **Vatandaş Talepleri paging (#r467):** sayfa numarası tıklanınca kolon filtreleri temizlenir ama
  sayfa 1'e sıfırlanmaz (filtre-clear → page-reset yarışı yok).
- **JobDetail VT (#r467):** `GetJobById` / `JobDetailResponse` `CitizenRequestNumber` taşır; yazdır VT-…
- **Yazdır not satırları (#r467):** iptal/tamamlamada `İptal Notu` / `Tamamlama Notu` Durum'dan
  sonra ayrı satır; boş Son Tarih = `Onay Bekleyen` (Belirsiz değil).
- **Yazdır boş bölümler (#2701):** `printJobDetail` Yönetici Notu / Talep Ekleri / İlgili Görev
  Detayları yalnız doluysa; görev eki yalnız görevde dosya varsa. `İlgili Görev Detayları` sayaç yok;
  `Görev 1` alt başlığı yok (#2701).
- **Yazdır Talep Etiketi (#2189):** detayda etiket varsa `printJobDetail` `Talep Detayları`'nda
  Durum sonrası `Talep Etiketi` satırı (`options.requestLabel` = sosyal `category`).
- **Yazdır Talep Kanalı (#2524/#2558):** vatandaş talebi yazdırmada `Vatandaş Adı / Telefon No`
  satırının hemen altında `Talep Kanalı` (`options.sourceChannel` → `getSocialChannelLabel`).
- **Dizin ticket sıra (#r467):** VT yılı+numara azalan (en yüksek üstte).
- **WA Birim panel (#r467–#r478/#2704):** Konuşmalar trigger ~10rem / menü ~184px; create-modal
  menü ~148px; clearable X; placeholder `Birim seçiniz...`.
- **WA Tümü / Talep Sayısı (#r473):** yalnız İşleme Alınan + Yapılmakta + Tamamlandı toplamı
  (iptal dahil değil).
- **Grid truncate tooltip (#r474–#r479/#r517/#r522/#r524/#r529/#r530/#r531/#r533/#r534/#r535):** AppShell `useDataTableOverflowTooltips` —
  `.data-table` taşan hücrelerde + `.dropdown-menu-item` ellipsis satırlarında kompakt emerald
  portal tooltip; dropdown’da flex ölçüm fallback + native `title` yedek. Tooltip `z-index` 10050;
  yatayda ortalı + ~16px sağa (#2001); metin antrasit `#36454f`, tek satır `nowrap` (#2004);
  arka plan açık yeşil (`#f0fdf4`→`#dcfce7`), border `#6ee7b7`, font ~0.68rem, `border-radius: 999px` (#r534/#2004);
  **500 ms hover gecikmesi** sonrası açılır (#r536 / #1992) — 1 sn veya anında açmaya geri alma.
- **Grid personel adı boyutu (#2005/#r531):** Gittiği Yer / çerçeve altı personel `text-sm`
  (iç birim `text-sm` ile aynı; `text-xs` farkı kaldırıldı — `FramedDepartmentStack` secondary dahil).
- **Görev Tipi Görevi Yapan (#2006/#r531):** personel adı `text-sm font-semibold` (önce ~0.8125rem).
- **WA Konuşmaları footer (#r468):** Şablon/Dosya + Birim + Kurum İçi tek satır; Birim/Kurum
  İçi `ml-auto` sağa (create-modal ConversationPanel ile aynı).
- **Talep Etiketi edit senkron (card #1896/#r449):** detay kaydı sonrası sosyal grid
  `onMessageUpdated` ile category seçili kalır.
- **WA 24s hata metni (#r470):** re-engagement → `Vatandaş son 24 saat içinde mesaj göndermediği
  için yalnızca Meta onaylı şablon mesaj gönderilebilir.` Vatandaş yeniden yazdığında pencere
  açıksa bekleyen/hatalı re-engagement mesaj Düzenle + Mesajı Gönder serbest; BE `Failed`
  re-engagement girişlerini pencere açıkken düzenle/gönder kabul eder (#2552 reopen).
- **WA Şablon menü (#r471):** Konuşmalar sayfasında `menuAlign="start"` (sağa doğru açılır).
- **Vatandaş yazdır (#r471):** Talep No sonrası `Vatandaş Adı / Telefon No` satırı.
- **Görev grid Görevi Yapan (#r471/#r472/#r531):** personel adı `text-sm font-semibold` (#2006).
  oluşturan `text-sm` ile hizalı.
- **Bildirim "(Vatandaş Talebi)" etiketi (#r491/#r492/#6a6bad16):** `titleTag` metin `text-[0.7rem]`
  yeşil (`text-emerald-600`); kanal ikonu `size-2.5`; ikon+metin `inline-flex items-center`.
- **Ek toplam boyutu (#r491):** Entity / form başına tüm eklerin toplamı ≤ 5 MB (tek dosya da dahil); aşımda uyarı, yükleme yok. BE `UploadAttachmentCommand` mevcut ekleri toplar.
- **Adres Bilgileri 3 kolon (card #1876 / #r483 / #r449 / #r495–#r501 / #6a6ba6ad / #2756):** Masaüstü: satır 1 Mahalle + Cadde + No; satır 2 Adres Tarifi Mahalle kolonunun altında, Konum Koordinatı Cadde kolonunun altında. Koordinat varsa **Konumu Gör** (link popup). Dolu adreste Cadde etiket+değer sola yaslı;
  kırılınca da sol — #r500); değer fontu ~0.8rem (#r501); Cadde kolon biraz sola
  (`translateX(-0.7rem)` — #r498); boşsa üç kolon bölüm alt çizgisi altında ortalı (`--empty`,
  #6a6ba6ad). Mobil (≤767): alt alta. Rutin = `my-request`; Görevlerim İlgili Talep =
  `stacked` alt alta (#6a6baec9 reopen — 3 kolon yapılmaz).
- **Rutin Görev Oluştur Açık Adres (#r501/#r502):** textarea `address-open-textarea`; font
  Cadde / Sokak `field-input` ile aynı (~0.98rem, değer + placeholder).
- **Rutin Görev Oluştur Mahalle dropdown (#2602):** `openUp` yok; liste aşağı açılır.
- **Ek dosya adı (#r489/#r490):** Talep/Görev ek adları ~11–12px; renk koyu mavi `blue-700` (ikon+ad).
- **Mobil paging (#r490/#r493):** Sayfa-boyutu seçici ≤767px DOM'dan çıkarılır; sabit `pageSize=10`.
- **Mobil Talep No (#r490):** `.table-number-cell__value` / `__priority` mobilde küçültülür.
- **VT edit mobil hiza (#r490/#r498):** Talep Etiketi kontrolü etiket altında sola; Öncelik sağ üst
  meta, varsayılan `w-28` (Öncelik sola/küçült istekleri #r498'de geri alındı).
- **Atanmış görev adres stacked (#r496/#r497/#6a6baec9 / #2651):** Görevlerim İlgili Talep Adres
  `variant="my-request"` (Mahalle+Cadde+No / Adres Tarifi+Konum); başlıklar kart içinde ortalı.
- **Mobil dizin talep popup (#r483 / #r485):** başlık altında isim · telefon yan yana (küçük
  bullet); ortada kurum logosu.
- **Mobil Vatandaş Talep Bilgisi genişlik (#r483):** `.detail-modal-shell--my-request`
  ≈ `100vw - 0.5rem`.
- **Birimler grid varsayılan sıralama (card #1856):** birim adı Türkçe alfabetik; kullanıcı sütun
  sort'u seçene kadar.
- **LDAP birim senkron/ekle (card #1857/#1862/#1890):** `Anlık LDAP…` ConfirmDialog ile sonuç
  gösterir (working → success/none); buton metni listeleme sırasında değişmez (flicker yok).
  `Tüm LDAP… Ekle` onay ister; listeleme sırasında buton metni değişmez (#1890); ekleme sırasında
  `addAllLdapWorking`. Sonuç/önizleme `details` içinde kaydırılabilir birim listesi. None:
  `Eklenecek yeni LDAP birimi yok; hepsi sistemde ekli durumdadır.` Sil aynı kalıp.
- **Grid boş em-dash (#1894/#r480):** data-table `—` → `EmptyCell` / `.empty-cell-dash`
  slate-400 gri (transparan değil).
- **Rutin Görev ek dosya boş metni (#r480):** `Henüz dosya seçilmedi.` → CreateRequest ile
  aynı `text-sm text-slate-500`.
- **Sayfa Yetkileri (card #1892/#1893 reopen):** `Vatandaş Bilgi Listesi` Vatandaş Talepleri’nden
  sonra; sıra `Kaydet` → `Varsayılanlara Dön` (sağda, `justify-end`); kayıt/sıfırlama sonucu
  ConfirmDialog (banner değil). `e-Devlet Günlük Faaliyet Planı Oluştur` ve `… Listesi`
  grid sıralamasında `Log` (`audit`) satırından sonra gelir (card #2269).
- **Ayarlar sonuç mesajları (#2275):** Kaydetme/uyarı sonuçları banner altındaki inline şeritte
  tekrarlanmaz; ortak `Toast` popup’ında gösterilir (`document.body` portal — zoom shell dışında).
  Sayfa Yetkileri kayıt/sıfırlama sonucu `ConfirmDialog` popup’ıdır. Bağlantı testi gibi alan-içi
  durum metinleri kendi kartında kalır.
- **Kullanıcılar düzenle Birim/Rol dropdown (card #r448/#r456/#r459):** sütun ~7.5rem / ~9rem;
  Birim paneli Ek roller sağına (~16.5rem); Rol paneli LDAP sonuna (~14rem); satır fontu ~0.6rem.
- **Kullanıcılar yarım aksiyon (#r457):** Yeni Kullanıcı Ekle / Düzenle / Sil birbirinin açık
  yarım durumunu temizler (düzenleme satırı + create form aynı anda kalmaz).
- **Birimler/Kullanıcılar banner İptal (#r458/#r459):** İptal genişliği = Yeni … Ekle
  (görünmez ölçüm grid’i; sabit min-w yok).
- **Birime Gelen Talep Yeri çerçeve (#r520/#r521):** grid `Talep Yeri / Oluşturan` — aktif (kendi)
  birim dışı talep yeri `FramedDepartmentStack` yeşil çerçeve, sütunda ortalı (#r521);
  kendi birim `ReporterDepartmentCell`. Kolon filtresi `createdBy` hem `departmentName` hem
  oluşturan adını arar (#6a6c52d8). Gelen grid `grid-col-location-creator` ~14.5rem (#6a6c72f4).
- **Dropdown truncate tooltip (#r517/#r522):** `useDataTableOverflowTooltips` dropdown
  `.truncate` satırlarında portal tooltip; flex ölçüm fallback + `title` attribute yedek (#1997).
- **Kullanıcılar grid Rol menü font (#r523/#1994):** `.users-edit-dropdown-menu*` ~0.82rem
  (`!important` ile admin-surface ezilir). Create form Rol + Ek Roller (`users-roles-compact-menu`)
  aynı `menuWidth={220}` + satır/buton ~0.82rem (#r527/#1988).
  Grid Ek Roller/Ek birimler footer Çıkış/Seç ~0.85rem (#r526/#1994).
- **Rol etiketi e-Devlet (#2000):** `enum.role.EDevletActivityPlan` → `e-Devlet Günlük Faaliyet`
  (eski “… Planı” kaldırıldı; RoleCode değişmez).
- **Detay Öncelik rengi (#2002/#r528):** İlgili Talep Detayları / Talep Bilgileri Öncelik değeri
  `getPriorityColorClass` — grid ile aynı (Normal sarı, Yüksek turuncu, Çok Yüksek kırmızı).
  Personelimin Görevleri `separatePriorityProjectRows` satırında da aynı sınıf (önce renk yoktu).
- **Ayarlar Kurum Bilgisi (#r522 / #6a6cbd61 / #6a6cd81e / #6a6cdd37):** başlık `text-xl`;
  Aktif/Alan Adı/Dağıtım/Tema yok; readonly KURUM ADI/SLA özet satırı yok (yalnız form).
- **Ayarlar Lisans sekmesi:** lumespec-license'tan (Ed25519 imzalı) gerçek modül durumu gösterilir.
  SystemAdmin kapalı ağda Lumespec'ten aldığı JWT'yi modül başına kaydedebilir (`PUT /me/license-modules/{module}`).
  Çözümleme sırası: uzaktan servis (online) → kayıtlı token yalnızca servise **ulaşılamazsa**
  (kapalı ağ) → **fail-closed**. Uzaktan HTTP reddi (askıya alma) varken eski kayıtlı JWT
  kullanılmaz (#citizen-license-suspend).
  `TenantSetting.LicenseModulesJson` kalıcı depo; online başarılı fetch otomatik persist eder.
  Uzaktan sorgu sıklığı: `Licensing:CacheMinutes` (prod **60**) + bellek önbelleği (okuma+TTL);
  FE `LicenseModuleSync` refetch ~saat başı. Manuel token kaydı cache'i temizler.
  `frontend/src/lib/licenseModules.ts` + backend `LicenseModuleStatusService`; sayfa/menü gizleme
  `PAGE_LICENSE_MODULE` haritası üzerinden `canAnyRoleAccessPage`'e entegre (bkz. rolePageAccess.ts).
  **Kurum İçi kapalıyken (#2369/#2376/#2377/#2378):** `outgoingRequests` menü/arama/dashboard'dan gizlenir
  (`PAGE_LICENSE_MODULE` → `internal`); `createRequest` yalnız Operator + citizen lisans açıkken;
  Anasayfa `Bekleyen Taleplerim` kutucuğu ve `myRequests` pie gizlenir.
  Operator Talep Oluştur seçim ekranında yalnız Vatandaş Çağrı Talebi (`?kind=citizen` otomatik); Birim İçi/Dışı
  kartları gizlenir. Reporter menüden `Anasayfa - Birimler` kaldırılır; `/dashboard/birimler` doğrudan erişim
  citizen anasayfaya veya Vatandaş Bilgi Listesi'ne yönlendirilir; Reporter varsayılan açılış citizen açıksa
  `/dashboard`, değilse `/citizen-directory`.
  Backend `testDisabled` API'si kalır; Ayarlar > Lisans UI'da geçici pasife al butonu yok (#2365).
- **Sayfa Yetkileri modül filtresi (#2360):** `visiblePageAccessItems` `PAGE_LICENSE_MODULE` +
  `isModuleUsable` ile filtrelenir; citizen kapalıyken e-Devlet, Vatandaş Bilgi Listesi, Vatandaş
  Talepleri, Sms Onayı, Mesaj Onayı satırları görünmez. `useMemo` lisans durumuna bağlı olmalı —
  boş `[]` ile cache'lenmez.
- **WA / kurum içi mesaj zamanı (#2340/#2339):** balon altı yalnız HH:mm; gün ayraçlarında yıl
  her zaman (`formatConversationMessageTime`, `formatConversationDayDivider`).
- **WhatsApp konuşma zemin (#2300 reopen):** mesaj scroll alanı bej `#ece5dd` (`--wa-chat-bg`) +
  hafif nokta deseni (`whatsapp-chat-bg`); uygulama gri zeminine (`color-background`) çekilmez.
- **Kurum içi FAB sohbet zemin:** aktif sohbet scroll alanı liste paneli ile aynı
  `bg-[color:var(--color-background)]` (#6a75a09a — bej `#ece5dd` geri alındı).
- **Kurum içi mesaj dosya eki (#2370/#2395 reopen):** FAB sohbetinde `Dosya ekle` (Paperclip + filtreli accept);
  gönderen ve alıcı indirebilir; upload sonrası alıcı SignalR ile sohbeti yeniler.
  `POST /attachments/internal-messages/{messageId}`; mesaj yanıtında `attachment` alanı.
- **Kurum içi mesaj listesi önizleme boşluğu (#2374):** konuşma satırında ünvan (`title`) altındaki
  son mesaj önizlemesi `mt-2` ile ayrılır (sıkışık `mt-0.5` kullanılmaz).
- **WA Vatandaş Talebi modal Dosya ekle (#2375 reopen):** `ConversationPanel` `enableWhatsAppFileAttachment`
  ile dosya WhatsApp konuşmasına gider (`replySocialMessageAttachment`); talep eklerine değil. Gelen medya
  balon aksiyonu `onAddMediaAsAttachment` talep eklerine kalır.
- **Kurum İçi İlet buton metni (#2380):** `Sadece Kurum İçi İlet` (`whatsapp.sendInternalMessage`).
- **WA footer düzeni (#2381 / reopen):** `/whatsapp` sayfasında Birim + Sadece Kurum İçi İlet alt satır sol;
  Vatandaş Talebi modal (`compactActions`) tek satır, Birim/Kurum İçi sağda (`ml-auto`).
- **WA modal ek önizleme (#2385):** kompakt dosya balonu; PDF/mime alt satırı yok (yalnız dosya adı + görsel önizleme).
- **Kurum içi dosya uzantısı (#2386):** `internalMessageFileExtension` yalnız `.ext` döner (`lowercaseFileExtension` değil).
- **Kurum içi mesaj textarea (#2382):** çok satırlı `textarea`, `max-h-28` + dikey scroll.
- **Kurum içi Dosya ekle (#2383):** kompakt buton; 5 MB; seçilen dosya sohbet alanında önizleme (WA gibi).
- **Görünüm Kaydet/Varsayılana Dön (#2367 reopen):** üst boşluk `mt-12`.
- **Dosya ekle accept filtresi (#2373 reopen / Round 717):** Talep/görev/WA/kurum içi dosya seçimlerinde ortak
  `ATTACHMENT_FILE_ACCEPT` **yalnız uzantı** listesi kullanır (MIME eklenmez — Windows diyalogunda
  jpg/jpeg mükerrer ve pjp/jfif/dot eşlemeleri oluşmasın). JPG/PNG/PDF/Office + video (mp4/mov/webm/3gp).
  Seçim sonrası uzantı doğrulaması da yapılır. Logo yükleme (Ayarlar Görünüm) ayrı kalır.
- **Login görünüm açıklaması (#2345 / #2361 / #2363 / #2364 / #2344):** `TenantAppearance.loginPageDescription` (appearance JSON);
  boşsa i18n `login.subtitle` kullanılır. Ayarlar > Görünüm: Login Page Logosu Tema Ön ayarı altında (sol
  sütun); Login Page Açıklama Ana Renk altında tam sütun genişliği. Başlıklar ayrı satır, logo Ekle butonu ile
  açıklama textbox'ı aynı yatay hizada (#2344). Tema/Ana Renk/logo başlıkları `<label>` değil düz metin —
  tıklanınca input tetiklenmez (#2364).
- **Sayfa Yetkileri artık `departmentTasks`/`citizenDirectory`'i zorla açıp kapatmıyor (card #2242):**
  önceki kod bu iki sayfayı role göre unconditional force ediyordu (admin checkbox'ı hiç işe yaramıyordu);
  `normalizeRolePageAccessMatrix`'e yeni bir zorlama eklerken kayıtlı admin tercihini ezmediğinden emin ol.
- **Sadece SystemAdmin rolüne sahip personelde Anasayfa gizli, varsayılan açılış sayfası Ayarlar'dır
  (card #2249):** `rolePageAccess.ts`'te `matrix.SystemAdmin.dashboard` zorunlu `false`; E-Devlet
  rolünde Anasayfa varsayılan allow-list’ten Pasif kalır (#2243 reopen — diğer rollere Anasayfa
  zorla açılmaz). `App.tsx`'teki tüm fallback `Navigate` hedefleri `getDefaultLandingPath(user)`
  kullanır, sabit `"/dashboard"` YAZMA — yoksa SystemAdmin `PageAccessGate`'te kendine yönlendirilip
  sonsuz döngüye girer. Yalnız E-Devlet rolü `/edevlet/activity-plan` açılışına gider.
- **Dosya sunucusu (NAS/FTP) parola alanları artık SMS API ile aynı maske deseni kullanır (card #2229):**
  kayıtlıysa `********` gösterir, "Kayıtlı şifreyi sil" checkbox'ı yok — `frontend/src/lib/` yerine
  doğrudan SettingsPage.tsx içinde SMS_PASSWORD_MASK reuse edilir (bkz. `fileStorageSettings` state).
- **Ayarlar Görünüm sekmesi tek "Ana Renk" seçtirir (Round 654 / card #2233):** diğer 9 renk alanı
  formdan kaldırıldı, `deriveAppearanceFromPrimary` (lib/theme.ts, HSL kaydırma) ile otomatik türetilir.
  Önizlemedeki hex-kodlu küçük kutucuk ızgarası da kaldırıldı. Yeni bir renk alanı eklersen bu türetme
  fonksiyonunu güncellemeyi unutma — elle giriş formuna geri dönme.
- **Varsayılan tema adı `"varsayılan-tema"` (card #2250):** `DEFAULT_TENANT_APPEARANCE.themePreset`
  (frontend `lib/theme.ts`) ve backend `TenantAppearanceService.DefaultAppearance` birlikte değişmeli —
  ikisi ayrı sabitte tutuluyor, biri unutulursa yeni tenant'ın backend default'u eskisiyle uyuşmaz. Ana
  renk zaten `#0A8F3E` (R10 G143 B62) — bu değeri değiştirme.
- **Kurum logosu artık dosya yükleme (Round 655 / card #2234):** Logo URL/Giriş Arka Plan textbox'ları
  kaldırıldı; `POST /api/v1/admin/tenants/{id}/appearance/logo?kind=institution|login|popup` göreli
  `/uploads/{tenant}/branding/{logo|login-logo|popup-logo}.*` döner. `MunicipalitySeal` kurum logosunu
  (`logoUrl`) tek noktadan `resolveAttachmentUrl` ile mutlak URL'e çevirir — yeni bir logo/kurum görseli
  tüketen bileşen eklersen `resolveAttachmentUrl` KULLAN, ham `src` verme. nginx'e `/uploads/` proxy
  location'ı bu round'da eklendi (`frontend/nginx.conf`) — önceden yalnız `/api/`, `/hubs/`, `/connect/`,
  `/health` proxy'liydi, aynı-origin dağıtımda `/uploads/...` SPA fallback'ine düşüp index.html dönerdi
  (var olan ek-önizleme özellikleri için de gizli bir bug'dı).
- **Üç logo türü (#2318 / #2322 / #2325 / #2326):** `logoUrl` (sidebar/menü), `loginLogoUrl` (login),
  `popupLogoUrl` (detay popup header). Ayarlar > Görünüm'de **Menü Logosu** | Pop up yan yana; Login Page
  alt satırda. Popup: **Pop up Logosu Ekle** + kırmızı **Pop up Logosu Sil** (onaylı). **Varsayılana Dön**
  menü+login'i lumespec default'a ve popup'ı temizler; önceki logo geri yükleme butonları yok. Alt satır:
  sağa yaslı `[Varsayılana Dön][Kaydet]` (ikisi de onaylı).
- **Menü logosu etiketi (#2321 / #2327):** Görünüm'de **Menü Logosu** / **Menü Logosu Ekle**; dosya seçiminde
  **Menü logosu seçildi**; teknik alan `logoUrl`.
- **Kurum/Menü/Login/Pop up logosu staging (#2312 / #2318 / #2359):** üç logo türünde dosya
  seçimi yalnızca form önizlemesini günceller (blob URL); upload + DB **Kaydet** sonrası.
  Görünüm sekmesinden ayrılınca veya başka Ayarlar sekmesine geçilince pending seçimler atılır;
  `ThemeContext` / sidebar **Kaydet** sonrası güncellenir.
- **Login logosu fallback (#2315 / #2326):** `loginLogoUrl` boşsa `/tire-belediyesi-logo.png`; kayıtlı
  `/default-institution-logo.png` lumespec wordmark (tire'e map edilmez).
- **Anasayfa breadcrumb'ı kök rotalarda ikinci "Anasayfa" segmentini göstermez (card #2248):**
  `AppShell.tsx`'teki `isDashboardRoot` (`/dashboard` veya `/dashboard/birimler`) `currentBreadcrumbSegment`'i
  `undefined` yapar — "Ana Sayfa" (home butonu) zaten aynı yeri temsil ediyor, ikinci pill gereksiz tekrardı.
- **Vatandaş Bilgi Listesi (#6a6cbef5/#6a6cbf0e/#6a6ce8f0/#6a6cf14b):** popup Birim truncate;
  Talep Tarihi `DateCell` = Son Tarih `DueDatePill` (0.84rem/600, svg 0.875rem); ana grid
  Adı/Numara = Gelen Talep Yeri tipografisi; popup kolon başlığı `Vatandaş Talep No`;
  Talep No `0.95rem` (#6a6cfd34), Öncelik alt satır `0.64rem`.
- **Durum overdue 2 satır (#6a6cf4d4):** `GridStatusLabel` — `Yapılmakta` / `(Geciken)`
  `whitespace-nowrap`; tüm grid StatusPill’lerde kullanılır (dizin popup dahil).
- **Vatandaş Talepleri pie (#6a6cf439/#6a6cf4d4):** drilldown Priority alt satır; kolon başlığı
  `Vatandaş Talep No`; Öncelik `0.7rem`; Durum sütunu `min-width: 11rem`.
- **Anasayfa - Vatandaş pie popup (#6a6cff28/#6a6d9411/#6a6d8a66/#6a6d8c50):** kolon
  `Vatandaş Talep No` → hemen sonra Vatandaş Adı/`TELEFON NO` → Talep Tarihi; Birim = hedef birim;
  boş satır kompakt `TableEmptyStateRows`.
- **Vatandaş Talep Kanalları (#6a6d0132/#6a6d0181/#6a6d8db3/#6a6eeb56):** lejant `Çağrı`;
  Reporter/SystemAdmin dilim → popup drilldown; **Operator dilim → popup yok**,
  `/social?channel=` grid (WhatsApp/Phone). Telefon No, Vatandaş Adı alt satırında; başlıklar
  `Talep Tarihi` + `Birim` (VT sayfasındaki Gittiği Yer / Vatandaş Talep Tarihi değil).
- **Pie yazdır (#6a6d8e2f/#6a6d92e8/#6a6da028/#6a6f46e6):** terminal kolon `Sonuç Tarihi` (Tamamlanma değil);
  VT No başlığı `stackRequestNoHeader` ile Vatandaş/Talep No iki satır (birim VT pie dahil);
  mahallede talep no başlığı `Vatandaş` / `Talep No` iki satır; vatandaş kolonunda Ad üstte /
  `Telefon No` (title-case) alt satır.
- **Çağrı detay Düzenle telefon (#6a6d903e):** 10 hane değilse Kaydet → uyarı modal içinde
  (`editError`); kayıt sonrası VT grid `citizenPhone`/`citizenName` `onMessageUpdated` ile
  anında senkron.
- **Boş Adres Bilgileri (#6a6dab1b/#2185):** yan yana üç kolon boşken sola yaslı (ortalı değil);
  Mahalle + Açık Adres `padding-inline-start: 0.7rem` ile biraz sağa; Cadde `translateX(-0.45rem)`
  ile çok az sola. Yan kutuda yalnız Talep Ekleri iken (`--attachments-only`) dört başlık
  kolon içinde ortalıdır; boş-adres padding/translate hilesi yok (#2576 reopen, #2185 geri).
  Yanında 2 kutucuk daha (`--three-cards`) iken dört adres başlığı **ve** `-` değeri
  `translateX(0.45rem)` sağa (aynı düşey eksen); **No** başlık+değer `2.4rem` (#2576).
  boş Adres Tarifi Mahalle ile aynı `0.7rem` sol kenar (#2576).
  boş Açık Adres `0.6rem` (#2187).
- **Dropdown ellipsis tooltip (#2188):** `useDataTableOverflowTooltips` dropdown satırında
  birden fazla `.truncate` varsa hover edilen / kesilmiş satırı gösterir (Şablon mesajlar adı+içerik).
- **Pie drilldown Başlık/Durum (#6a6d9daf/#2180):** Başlık `cell-title` 2 satır + overflow tooltip;
  Durum sütunu ~12rem (2 satır StatusPill sığsın) — Vatandaş + Birimler pie popup’ları.
- **Pie yazdır Durum (#6a6db2e2):** Durum hücresi ortalı (`status-cell` + eşit padding); Sonuç Tarihi
  kolonunda ekstra sağ padding/min-width yok (Durum sağa kaymasın).
- **Pie yazdır tarih (#6a6da028):** Talep Tarihi / Sonuç Tarihi yalnızca gün (saat yok).
- **Talep Etiketi pie (#6a6c9fed/#6a6cfd82/#6a6cffd1):** Birim yok; Vatandaş Adı/Telefon VT No sonrası;
  Öncelik alt satır.
- **Adres boş (#1876/#r449):** boşken etiket `fit-content` ortalı; alt çizgi kısa.
- **Dizin yazdır (#r449/#r450/#r460):** Başlık kolonu `width:auto` + rem sabit diğer kolonlar
  (`table-layout:fixed` içinde % karışımı yok); wrap açık; eski popup (`document.write`);
  `window.open(origin)` — about:blank / sol üst info ikonu yok (#r460).
- **Yazdır popup origin (#r460):** `printHtmlDocument` boş URL yerine site origin ile açılır.
- **Kullanıcılar Birim/Rol menü font (#r456/#r460/#r516/#r518/#r519/#r521/#r522/#r523):** geçmiş
  ölçüler ~0.52–0.92rem; create Rol/Ek Roller güncel #r527 (220px / ~0.82rem).
- **Talep açıklaması detay (#r460):** Taleplerim/detay `RichTextContent` ~13px.
- **Oturum idle (#2003/#r528/#2603):** 1 saat hareketsizlik → “Oturumu Uzat” yok, direkt logout
  (uyku/arka plan duvar saati dahil). Kullanıcı aktifken oturum süresi dolmak üzereyse popup
  gösterilir; Uzat `session/me` ile cookie kaydırır.
- **WA Etiket ekle (#r460):** kompakt `RequestTagAddButton` `h-8` / `text-xs`.
- **Dizin Detaylar popup başlık (#r460):** `Vatandaş Bilgi Listesi` (`nav.citizenDirectory`).
- **WA chat footer Birim/Kurum İçi (#r460):** şablon satırında `ml-auto` sağa yaslı (bir satır yukarı).
- **Sayfa Yetkileri (#1893/#r449/#r451/#r453/#r455/#r459):** not metni “Anasayfa…”; aynı satırda Varsayılanlara Dön ← Kaydet;
  Kaydet Kurum İçi Mesajlar FAB solunda (`--fab-inline-clearance - 8.5rem`); Kaydet `min-w-[13rem]` (Round 718).
- **Birimler Yönetici Ata (#r453):** Sorumlu/Müdür açılır panel genişliği trigger ile aynı
  (`users-edit-dropdown-menu` max-width yok); Yeni Birim Ekle açınca yarım kalan satır
  aksiyonları (Yönetici Ata/Sil/Düzenle) temizlenir.
- **Oluşturma Modu varsayılan LDAP (#r449/#r452):** Kullanıcı/Birim yeni form; seçili LDAP
  etiketi yanıp sönen yeşil (`create-mode-ldap-pulse` / `ccc-blink`).
- **Ek görev birimler dropdown metin (#r452):** `users-dept-compact-menu` satır fontu ~0.78rem.
- **Dahili/Ünvan (#r449):** Dahili yalnız rakam; Ünvan rakamsız.
- **Yönetici Ata (#r449):** boşken “Müdür seçiniz...”; buton `sm`.
- **Kullanıcı Rol: Sorumlu (card #1897/#1898/#r513):** dropdown’da `Sorumlu`; kayıtta `roleCode=Manager`
  (yeni RoleCode yok) + `skipManagerQuota=true` → birim `ResponsibleUserIds`’e eklenir;
  `skipManagerQuota=false` (Müdür) → birim `ManagerUserId` atanır ve Responsible listesinden çıkarılır;
  müdür kontenjanı yalnız `ManagerUserId` / Sorumlu-olmayan Manager sayar; birden fazla Sorumlu OK;
  düzenlemede UI rolü Responsible listesinden `Sorumlu` geri map edilir; sayfa yetkileri Manager ile aynı.
- **Yönetici Ata ↔ Kullanıcı Rol senkronu (#r513):** Birimler’de Müdür/Sorumlular kaydı ilgili
  kullanıcıları `RoleCode=Manager` yapar (Users’da Müdür / Sorumlu görünür); listeden çıkanlar
  başka birimde lider değilse Personel’e düşer.
- **Yönetici Ata inline (card #1854 reopen):** Müdür/Sorumlular sütunlarında dropdown
  (`Müdür seçiniz...` / `Sorumlu seçiniz...`); Kaydet/İptal; aksiyon butonları büyütülür.
- **Adres boş etiket ortası (card #1876 reopen):** Adres Bilgileri tamamen boşsa üç alt etiket
  kolon içinde ortalanır (`.address-detail-my-request__grid--empty`).
- **Vatandaş dizin Son Tarih + yazdır (card #r446):** ticket DTO `dueDateUtc`; Durum sonrası
  Son Tarih; yazdırma tek pencere (`printHtmlDocument` — HTML `onload` print yok), kolonlar ortalı,
  Talep No/Tarih/Birim geniş.
- **Talep Etiketi düzenleme (card #1896 reopen):** Operator/CRM edit modunda `RequestTagPicker`;
  kayıt `updateSocialMessage` category.
- **Oluşturma Modu sırası (card #r446):** Birimler/Kullanıcılar’da LDAP → Manuel.
- **Buton metinleri (card #r446):** `Yeni Birim Ekle` / `Yeni Kullanıcı Ekle`.
- **Birimler Müdür sütunu (card #1854):** `managerUserId` boşsa birimdeki aktif Manager rolündeki
  kullanıcının adı gösterilir.
- **Vatandaş dizin talep popup (card #1889/#1895):** Durum StatusPill + öncelik Talep No altında;
  Birim↔Durum kolon sırası; yazdırmada Talep Detayları tablosu.
- **Talep Etiketi detay (card #1896/#2698):** Operator / CitizenRequestManager için Talep Bilgileri
  sonunda `citizenSourceMessage.category`; boşsa satır yok (`—` yok). Düzenle’de picker durur.
- **Grid kişi metni (card #1891):** birim altındaki kişi satırı `text-sm font-semibold`.
- **Vatandaş dashboard pie'ları yalnız VT (Vatandaş Talebi) sayar (card #1845):** `citizenJobs`,
  `BuildRequestTagChartAsync` (Talep Etiketi) ve üç mahalle grafiği (`Tamamlanan`/`Yapılmakta`/
  `İşleme Alınan`) bir Job'ı yalnız bağlı `SocialMessage.CitizenRequestNumber != null` ise sayar
  (`CitizenVtJobFilter.WhereHasCitizenRequestNumber`); `RequestType=Citizen` tek başına yeterli
  değildir — manuel/rutin oluşturulan Citizen job'lar VT numarası taşımayabilir ve grafiğe girmemelidir.
  Aynı filtre `GetDashboardChartDrilldownQuery` (mahalle + vatandaş satırları) için de
  geçerlidir — birbirinden sapmamalıdır. (Not: `Vatandaş Talep Kanalları` pie'ı bu kuralın
  DIŞINDA kalır — kendi `RequestType∈{...}` genişletilmiş adaylık mantığını korur,
  VT-only filtreye çevrilmedi.)
- **Birim/departman odaklı dashboard pie'ları VT'yi dışlar (card #1849/#2570):** `Birimler`
  sayfasındaki `Taleplerim` (`myRequests`) ve tenant geneli birim pie'ları
  (`BuildExternalUnitDepartmentChartsAsync`: oluşturan/bekleyen/yapılmakta/tamamlayan/projeler)
  vatandaş kaynaklı job'ları `WhereIsNotCitizenSourced` ile hariç tutar — `RequestType=Citizen`,
  WA/çağrı/e-Devlet `SourceType` ve `CitizenRequestNumber` dolu kayıtlar. Drilldown
  (`GetDashboardChartDrilldownQuery` owner/target birim satırları) aynı filtreyi kullanır.
  Vatandaş Talebi kartları VT'yi `#1845` ile ayrı gösterdiğinden Birimler pie'larında tekrar
  görünmemelidir.
- **Taleplerim pie = `scope=mine` listesi:** Operator/CRM pie'da Routine + SocialMessage /
  CitizenRequest / EDevlet yok; aktif birim `OwnerDepartmentId` ile sınırlı — aksi halde pie
  (özellikle Geciken) Taleplerim gridinden büyük çıkar.
- **Reporter/Operator grafik dilimleri detay popup'ı açar (card #1343/#1338, Operator erişimi
  #1852):** Üst Düzey Yönetici panosunda
  Taleplerim HARİÇ birim-dışı + mahalle grafikleri diliminde tıklama `DashboardChartDrilldownModal`'ı açar
  (`externalRequestCreators/Pending/InProgress/Fulfillers`, `externalProjectsInProgress/Completed`,
  mahalle + birim VT durum pie'ları — #2565/#2566); popup Taleplerim detay modalıyla
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
- **Gridview üstü satırlar sayfa boyutuyla oynamaz:** `.desktop-page-shell > :not(.desktop-page-fill)`
  desktop'ta `flex-shrink: 0`. `.scope-chips` `overflow-x: auto` olduğu için scroll kapsayıcısıdır ve
  `min-height: auto` = 0'a çözülür; kural olmadan sayfa başına kayıt 10 → 100 yapıldığında taşan
  flex alanı çip satırından çalınıyor, çipler eziliyor ve gridview başlığı yukarı doğru büyüyordu.
  Taşmayı yalnız `.desktop-page-fill` paneli emmelidir (grid kendi içinde scroll eder).
- **AppFooter Lumespec markası:** Tüm footer yüzeyleri (`AppShell`, login, wallboard) ortak
  `AppFooter` kullanır; marka `/lumespec-logo.png` wordmark'ıdır (eski 4-kare SVG + uppercase
  metin yok). Logo `h-7 sm:h-8`, satır `py-0`, alt şerit `3px`; `--fab-footer-clearance: 2rem`
  birlikte korunur (#2348 reopen / #1960).
- **Birime Gelen pie Yapılmakta Olan (#r542):** `INCOMING_SLICE_STATUS.inProgress` →
  `status=in-progress` (mavi chip); `approved` değil.
- **Dashboard dönem TZ (#r542):** `getPeriodRange` yerel `YYYY-MM-DDTHH:mm` üretir; API çağrıları
  `toApiDateParam` ile ISO'ya çevrilir — chip'te `31.12. 21:00` / −3 saat kayması olmaz.
- **Sidebar outgoing aktif (#r542):** `/outgoing-requests` pathname eşleşince query yok sayılır
  (`?view=pending` menüyü boyar); `/dashboard` istisnası korunur.
- **Öncelik Normal rengi (#r542):** `getPriorityColorClass('Normal')` = `text-emerald-600`
  (grid + detay ortak; sarı değil).
- **Drilldown popup header (#r542/#r545/#r546/#2068):** ortada kurum logosu; slice başlığın alt satırında; Talep
  Etiketi + mahalle + Vatandaş Talepleri + Kanallar + Talep Oluşturan / Bekleyen / Yapılmakta /
  Tamamlanan Talepler + Yapılmakta/Tamamlanan Projeler pie'larında Yazdır
  (Taleplerim `detail-print-action` ghost, #2626) + X hover bildirimler
  gibi (`hover:bg-red-50 hover:text-red-600`); mahalle/etiket/birim-dışı pie Durum=`StatusPill`+`GridStatusLabel`;
  sütun `Birim` (mahalle/etiket); **Son Tarih yok** (mahalle/etiket); Tamamlanmış/İptal tarihi Durum pill
  **alt satırında** (Giden grid ile aynı — ayrı `Tamamlanma Tarihi` sütunu yok); yazdırmada `Tamamlanma Tarihi` sütunu kalır.
- **Overflow tooltip (#r545/#2065/#2072/#2078):** hücre ortası; max-width ~18rem; 2. satır `text-align: center`.
- **Mesaj Onayı Durum tarihi (#2067):** Completed→`completedAtUtc`, Cancelled→`updatedAtUtc` Durum pill altında.
- **Mesaj Onayı banner (#2064):** “…talebin **durumu** ve notu…” (Tamamlanma/İptal ifadesi yok).
- **Mesaj Onayı Notu Düzenle modal (#2073/#2079/#2081/#2084/#2091):** genişlik `max-w-md`; yükseklik `py-5` +
  textarea `rows={4}`; aksiyon butonları `size="sm"`.
- **Mesajı Onayla ConfirmDialog genişliği:** `wide: true` → `max-w-md px-6 py-5` (Notu Düzenle ile aynı
  kutu boyutu; dar `max-w-sm p-6` kullanılmaz).
- **Mesajı Onayla confirm metni:** `Mesajı onayladığınızda, …` (`göndermeyi onayladığınızda` değil).
- **Talep detay Açıklama punto:** JobsPage / Taleplerim (`MyRequestDetailMainCard`) / Görevlerim ilgili talep
  özeti `text-sm leading-5` (eski `text-xs` / `text-[13px]` değil).
- **Detay Öncelik başlık punto:** Görev Bilgileri / Talep Bilgileri başlığındaki Öncelik = etiket
  `text-xs font-bold`, değer `text-[11px] font-semibold` (Birime Gelen Talep Bilgileri ile aynı — #2109).
- **Recovered timeline Durum Yapılmakta:** mavi `pending` (Geciken değilse); overdue → turuncu
  `current` (görev reopen / Mesaj Onayı reopen sonrası Tamamlanma→Yapılmakta).
- **Süreç Durum Değişikliği Yapılmakta:** `getStatusChangeTextClass` → `text-sky-500` (mavi).
- **Görevi Tamamla / İptal Et yardım satırı:** Tamamla popup'ta Görev No yeşil (`text-emerald-600`);
  İptal Et popup'ta açıklama `G-{yıl}-{no}` ile başlar ve Görev No kırmızıdır (`text-red-600`).
  İptal Et popup'ta Tamamla ile aynı **Dosya ekle** (geçici upload, Vazgeç'te silinir — #6a6b6c07).
  Talebi İptal Et / Görevi Tamamla not popup'ları aynı `form-card` köşe + ortak başlık
  (`1.125rem` bold/700) + help `0.875rem`; textarea `0.9375rem`; etiket `İptal Nedeni` (colon yok) (#6a75d625 / #6a75d5eb).
- **Sms Onayı (#2112/#6a6b6824/#6a6b6c8e/#6a6ee0ee/#6a5e1e23):** `/sms-delivery-approval` — Vatandaş Talepleri altında
  WhatsApp'ın hemen altında; nav etiketi `Sms Onayı`; WhatsApp ile aynı `emphasized` hiza/punto +
  Lucide `MessageSquareText` (reopen #6a6b6c8e — renkli svg yok). `pageKey smsDeliveryApproval`
  (Operator varsayılan açık; Staff/Reporter/Manager kapalı; BE SMS modunda Manager erişemez).
  Nav rozeti phone `to-send` sayısı. Banner altı chip'ler Mesaj Onayı ile aynı; liste
  `channel=phone`. Mesaj Onayı listesi `channel=whatsapp` **ve Phone** (iki aşamalı: yönetici
  önce Phone terminal mesajını serbest bırakır — SMS gitmez; release sonrası Operatör Sms
  Onayı to-send'te SMS gönderir). `to-send` filtresi `RespondedAtUtc == null` DEĞİL:
  İşleme Alındı/Yapılmakta SMS'i `RespondedAtUtc`'yi erken set eder; terminal bekleyen =
  `ReleasedAt != null && (RespondedAtUtc == null || RespondedAtUtc < ReleasedAt)` (#6a5e1e23).
- **Çağrı non-terminal SMS birim boş satırı (#6a6f19af):** İşleme Alındı/Yapılmakta SMS'inde
  `{GönderilenBirim}` değerinden önce 1 boş satır (`EnsureBlankLineBeforeTargetDepartments`) —
  terminal SMS ile aynı.
- **Çağrı formu ↔ WA profil (#6a6f1d32 / #2513):** Phone (çağrı) VT oluşturma/güncelleme
  `Job.CitizenName` ve adres alanlarını talep bazlı tutar; aynı numarada WhatsApp mesajı olan
  `CitizenConversation` profiline **yazılmaz** (`CitizenConversationLinkGuard` + Convert/UpdateJob
  profil sync). WA sağ panelde kaydedilen Vatandaş Bilgileri çağrı talebi veya dizin kaydıyla
  ezilmez. WA convert formu profili güncelleyebilir (kanal WhatsApp).
- **Taslak Mesajlar liste ikonu (#6a6f1ab6):** şablon listesinde yeşil=aktif / kırmızı=pasif
  yuvarlak nokta (`tpl.isActive`).
- **Mesaj Onayı İşlemler (#2050/#2082/#2086/#2088/#2105/#2106/#2108):** `toSend` = Detaylar / Notu Düzenle /
  Mesajı Onayla (`nowrap`); `sent` ve `all` = yalnız Detaylar. Detay popup: `toSend`'de Notu Düzenle +
  Mesajı Onayla; `sent`/`all`'da bu butonlar yok (Yazdır da gizli).
  Vatandaş Adı/Telefon ~11rem, İşlemler geniş (~22rem); buton yüksekliği `2.125rem` (#2105);
  Telefon No başlığı `font-bold` (#2106); Notu Düzenle=`PenLine`, Mesajı Onayla=`Check`.
- **Mesaj/SMS onay tarihi sütunu (#2512/#2514):** `sent` ve `all` görünümlerinde Talep Durumu Notu
  sonrası — Mesaj Onayı: `MessageApprovedAtUtc` = `CitizenTerminalMessageReleasedAtUtc`;
  Sms Onayı: `MessageApprovedAtUtc` = terminal SMS `RespondedAtUtc` (release sonrası).
- **Mesaj Onayı Detaylar (#2088/#2089/#2106):** `toSend` header'da Notu Düzenle + Mesajı Onayla; **Talep Durumunu
  Değiştir yok** (süreç kaldırıldı). Yazdır gizlenir.
- **Breadcrumb (#2085):** `/citizen-message-approval` → "Vatandaşa Gönderilecek Mesaj Onayı" (slug değil).
- **WA Düzenlendi/Beklemede (#2084):** title case (uppercase CSS yok).
- **WA terminal Not (#2093):** buton/popup metni `Not`; iptal=kırmızı, tamamlanma=turkuaz.
- **WA Onaylayan Yönetici (#2092/#2110):** serbest bırakma audit'inden ad; turkuaz buton; etiket
  `Onaylayan Yönetici` (eski: Mesajı Onaylayan Yönetici); hover 250ms tooltip.
- **Pie drilldown (#2087):** thead dikdörtgen (`border-radius: 0`); gövde ~0.82rem; Yazdır biraz büyük.
  `actions-cell` min-width ~18.5rem.
- **Pie drilldown grid tipografi (#2080):** Taleplerim ile aynı — `thead` 0.78rem + letter-spacing 0.06em + biraz yüksek; `td` 0.9rem (dizin popup #1889 kalıbı).
- **Birimden Giden işlem gap (#2071):** `.my-requests-table .request-actions` gap `0.7rem`.
- **Birim pie drilldown (#2070):** sütun `Birim`; Talep No `T-{yıl}-Onay Bekleyen` (+ Öncelik alt satır); Durum=StatusPill.
- **Toast (#2074/#2075 reopen):** iptal başarı mesajı `error` (kırmızı); auto-hide **≤5 sn**;
  `onClose` ref ile sabitlenir (parent re-render timer’ı sıfırlamaz).
- **Mesaj Onayı / grid Başlık (#2076/#2077):** `cell-title` max-width ~11.5rem; overflow tooltip metin anchor'ı altında.
- **Vatandaş Talepleri pie (#r546/#6a6ceed0):** VT sayısı `WhereHasCitizenRequestNumber`;
  dilim tıklanınca `DashboardChartDrilldownModal` (Reporter/Operator/SystemAdmin);
  BE `BuildCitizenRowsAsync`.
- **Pie / sütun Filtreyi sil (#r546/#2096/#6a75c994):** `fromPie=1` **veya** aktif sütun başlığı
  filtresi varken scope-chip satırında (aynı konum) kırmızı yanıp sönen `Filtreyi sil`; tıklanınca
  sütun filtreleri + pie query temizlenir. Başka sayfaya geçince (`pathname`) sütun filtreleri
  sıfırlanır; chip/buton geçişlerinde de temizlenir.
- **Dashboard Bekleyen Görevlerim alt metin (#6a75c91c reopen):** `(Birim İçi/Birim Dışı)` — "Bekleyen ve Geciken" eklenmez (geri alındı).
- **WA kişi kartı (#6a75a9c2/#6a75cccc/#6a75ccfa/#6a75cd3f):** webhook `contacts` → `[kişi kartı]\nAd\ntelefon` (bullet/tire/ayraç yok; isim ile numara ayrı satır); balonda User ikonu (emerald çerçeve); konum MapPin/Haritada aç kişi kartında çıkmaz (thread lat/lng sızmaz). FE eski `Ad ·/ - telefon` kayıtlarını da satır kırarak gösterir. İsim/numara metni `text-xs font-semibold` (sm değil; medium→semibold hafif bump — #6a75cccc).
- **Birimdeki Bekleyen Son Tarih (#6a75e88c):** `hideDueDateColumn` false for department `pending` (overdue ile birlikte).
- **Görev Tarihi Yeni+Tip (#6a75e10f):** Yeni rozeti ile Görev Tipi aynı satırda yan yana (`showTaskTypeUnderDate`).
- **Dizin telefon (#6a75e40c):** `formatDirectoryPhone` → `xxx xxx xx xx`.
- **WA Talep Eki turkuaz (#6a75e2f0):** `SocialConversationMediaBubble` add-as-attachment `bg-teal-500`.
- **SMS alıcı (#6a75eea2):** `WhatsAppRecipientResolver` Job.CitizenPhone fallback.
- **SMS LiveSend (#6a75eea2):** Round 643 sonrası `IsEnabled` ⇒ gerçek gönderim (`EffectiveLiveSendEnabled`); Operatör release SMS fail → ValidationException.
- **WA etiket revert (#6a75d1bf reopen):** Talep Etiketi readonly textbox geri; başlık min-height 2.5rem.
- **WA modal etiket menü (#2504):** `RequestTagPicker` menü metni `text-xs` (compactMenuText yok).
- **Görevlerim detay Öncelik düzenle (#2503 reopen):** trigger `min-width: 7rem` / `max-width: 14rem`;
  açılır panel trigger genişliğinde (`menuWidth` yok); menü öğeleri `max-width: 14rem`.
- **WA otomatik zamanlı yanıt (#2545):** şablon auto-reply `Sent` mesajlarında `Onaylayan Yönetici`
  chip gösterilmez; yalnız `Pending` terminal ve `Failed` re-engagement. Zaman ayarlı otomatik
  yanıt balonunun altında mavi `rounded-full` `Otomatik Mesaj` etiketi (`isAutomaticMessage`;
  Onaylayan Yönetici chip boyutu/çerçevesi).
- **WA balon saat satırı (#2544):** `İletildi` / `Düzenlendi` ve saat `items-center` + `leading-none`.
- **WA medya Önizle (#6a75cc3f):** gelen görsel/video/ses Önizle butonu yeşil (`variant=success`) + Eye ikonu.
- **Dashboard pie lejant Ara... (R549/R550/R552):** mahalle, birim-dışı ve **Talep Etiketi**
  pie'larında Ara... **başlık satırının sağına**. Personelimin Görevleri / Çözme Süresi pie'larında Ara... yok. X ikonu kırmızı; metin
  ~0.9rem; arama state parent'ta — boş eşleşmede input unmount olmaz (backspace odak kaybı yok).
- **Personelimin Görevi Çözme Süresi sırası (R549 / #2038):** 0 olmayan en küçük ortalama saatten
  artan sıra; 0'lar sonda.
- **Drilldown yazdır Tamamlanma Tarihi (#r547):** `col-completed` ~18% / min 9.5rem — başlık
  hücre border'ından taşmaz.
- **Boş Adres Bilgileri tire (#r547/#6a6ba6ad):** `-` değeri üst etiketin genişliğinde ortalanır;
  üç boş kolon da Adres Bilgileri alt çizgisi altında ortalı
  (`width: fit-content` item + `text-align: center` value).
- **Dashboard scroll (#r545):** pie/kart öncesi `main#main-content` (desktop; shell
  `md:overflow-visible`) scrollTop sessionStorage; dönüşte içerik oturana kadar tekrarlı restore.
- **Birime Gelen kanal (#r545):** VT satırında sosyal kanal yoksa unlinked `SocialMessage` → `Phone`
  (chart ile aynı); `?? WhatsApp` varsayımı yok. `citizen=1` tüm VT; `channel=` alias eşleşmeli.
- **Operator Taleplerim dilimi (#r545):** Staff gibi `Onaylanmış/Yapılmakta`.
- **Wallboard görev kaynağı:** "Ekrana Yansıt" listesinde rutin görevler gösterilmez; yalnız
  açık durumdaki numaralı rutin olmayan görevler listelenir. Vatandaş talebinde Oluşturan satırının
  başında kanal ikonu görünür; vatandaş satırı için özel renk veya sıra numarası şeridi kullanılmaz.
- **Wallboard Görev No alt öncelik (#2122):** Normal öncelik gösterilmez; yalnız Yüksek / Çok Yüksek /
  Kritik (`shouldShowGridPrioritySubline` ile grid ile aynı kural).
- **Wallboard Reporter vurgusu:** Üst Düzey Yönetici talebi satırında talep yeri altında oluşturan adı
  ayrı satırda kalır; "Üst Düzey Yönetici" oluşturan metni ve Görev Sahibi metni turuncu kalır.
  Başlık fontu normal ağırlıkta kalır, Görev Sahibi normal satırda Görevin Talep Yeri verisiyle aynı
  tondadır; reporter turuncusu `wallboard-task-owner` genel rengini ezmelidir. Başlık font size'ı
  tablo yoğunluğuna göre düşük kalır.
- **Wallboard Geciken stat accent'i:** Yalnız `Geciken` kutusunun alt border/accent
  çizgisi `Kapat` butonunun `var(--color-destructive)` kırmızısıyla aynı kalır.
- **Wallboard Birim Dışı stat accent'i:** `Birim Dışı` kutusunun alt border/accent çizgisi turuncu
  kalır ama çok koyu kahverengiye dönmez; `Geciken` kırmızı kuralından bağımsızdır.
- **Grid durum/son tarih uyarı renkleri (cards #1387/#1649/#1650):** `Yapılmakta` status chip'i
  mavi (`bg-sky-100 text-sky-700`); `Yapılmakta (Geciken)` iki satır (alt satır
  ortalı `(Geciken)`) ve **solid** turuncu chip (`bg-orange-500 text-white`, açık
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
- **`RoutineTaskCreated` bildirimde yok (#6a6bba0d):** feed ve okunmamış sayaç
  `Action != RoutineTaskCreated` ile elenir.
- **`Bildirim güncellendi` feed'de yok (#6a6bbc18):** `CitizenMessage*` audit aksiyonları ve
  `ActionTitle` fallback başlığı (`Bildirim güncellendi`) feed + okunmamış sayıdan çıkarılır.
  Okunmamış rozet `NotificationAuditRules.ShouldCountAuditAsUnread` ile feed ile aynı kuralları
  kullanır; görev yan etkisi job audit'leri sayılmaz (#2564).
- **Çok birimli müdür bildirim kapsamı (#6a6bafb7):** `NotificationAudience` yönetici birim
  genişlemesi `X-Active-Department-Id` ile daralır; feed + okunmamış rozet yalnız seçili
  birimin talep/görevlerine aittir. Kişisel atama/oluşturma bildirimleri birimden bağımsız kalır.
  FE birim değişince `notifications` query invalidate.
- **Dış birim hedef müdür — sahip onayı öncesi bildirim yok (#6a6c67cb):** hedef/koordinasyon
  birimi `PendingOwnerApproval` taleplerini feed'e almaz; sahip onayından sonra görünür
  (Birime Gelen `isIncomingExternalForActiveDept` ile aynı kural).
- **Dış birim sahip onayı bildirimi (#6a6c73f2 / #6a6c80bf):** `JobOwnerApproved` + `ExternalUnit`
  başlık `Birim Dışı Gelen Talep`; açıklamada onaylayan kişi yerine sahip birim adı.
- **Tek aktif oturum (#6a6c805e):** yeni login hemen yeni `ccc_sid` yazar ve önceki
  oturumu düşürür. Uyarı popup'ı (otomatik kapanmaz, X/Tamam) yeni giriş yapanada değil,
  eski oturumdaki kullanıcıya. Cookie düşse bile ekran açık kalır; paralel 401'ler
  `session-expired` ile login'e atmaz (`sessionSupersededPending`). X/Tamam → login.
- **Login CAPTCHA (#2272):** Google reCAPTCHA v2 (checkbox); yalnız `Recaptcha:SiteKey` +
  `Recaptcha:SecretKey` yapılandırıldığında ve istemci IP'si tenant `trustedNetworkCidrs`
  dışında kaldığında login formunda gösterilir + `/connect/token`, `session/login`,
  `interactive/start` (kimlik bilgisi gönderildiğinde) sunucuda `siteverify` ile doğrulanır.
  Trusted ağ / exchange ticket (`auth-ticket:`) isteklerinde CAPTCHA zorunlu değildir.
- **Tarayıcı sekmesi ikonu:** Prod (`*.tire.bel.tr`, `testtim` hariç) Tire `favicon.png`; demo/Lumespec
  host (`*.lumespec.com`, `testtim.tire.bel.tr`) `lumespec-icon.png` (logo metni olmadan yalnız katman
  ikonu). İsteğe bağlı build override: `VITE_FAVICON_URL`.
- **Birim içi JobCreated bildirim başlığı (#6a6ca1d4):** InternalUnit →
  `Birim İçi Talep oluşturuldu` (yönetici feed).
- **Bildirim modal tarih = Ara (#6a6c6a6d / #6a75d499 / #6a75d499 reopen):** başlangıç/bitiş = Ara
  genişlik (`8.5rem`); tarih metin/ikon küçültülür (`~0.7rem` / `0.65rem`); Ara placeholder
  `0.72rem`. Seçili tarih truncate olursa DateTimePicker `title` ile tam değer gösterilir.
- **Gelen Talep Yeri çerçevesi (#6a6c72f4):** kolon genişliği artırılmaz; birim yeşil çerçevesi
  (`FramedDepartmentStack` max-width) biraz genişler.
- **Ek süre/revizyon onaycısı bildirim kapsamı:** `TaskRevision` approval onaycısı, görevin atanmış/owner
  kullanıcısı olmasa bile audit-feed ve okunmamış rozet kapsamına dahildir; kalıcı `Notification` yazılmaz.
- **Ek süre talebi bildirim Detay popup'ı (card #1394):** yöneticiye giden `TaskExtraTimeRequested`
  (başlık `Ek süre talebi`) Detay ile **Birimdeki Görevler** popup'ını açar (`/department-tasks?taskId=…`,
  `TasksPage mode=departmentTasks`). Audit-feed actionUrl da `/my-tasks` değil `/department-tasks`
  üretir; FE başlık eşleşmesi eski yanlış URL'leri de department scope'a zorlar. Görevlerim popup'ı
  kullanılmaz — onay/red "Ek süre talebini gör" bu yüzeyde görünür.
- **Bildirim zili okunmamış rozeti (#2793):** `notification-bell-badge` köşede
  (`right/top: -0.35rem / -0.45rem`), `z-index: 30`, kırmızı halka (`border` beyaz değil —
  `scope-chip-overdue-badge` ile aynı); header ve zil butonu `overflow-visible` (üst kapsayıcı
  `overflow-x-hidden` rozeti kesmemeli). Rozet sayısı `unread-count` API + liste okunmamışların
  üst sınırı; query key aktif birimle hizalı.
- **Bildirim dropdown okundu aksiyonu:** "Tümünü Okundu yap" butonu küçük bildirim dropdown'unda
  kapatma X'inin solundadır, yeşil metinlidir, çerçeveli buton gibi görünür ve iki satır metin
  (`Tümünü` / `Okundu yap`) arasında okunabilir boşluk kullanır;
  "Tüm bildirimleri gör" modal toolbar'ında da tek satır `Tümünü okundu yap` aksiyonu görünür.
- **Bildirim başlığı vurguları:** okunmamış satırda `güncellendi`, `oluşturuldu`, `atandı`,
  `yönlendirildi`, `Yönetici notu atandı`, `Ek süre talebi` ve onay/red/tamamlandı/iptal
  kelimeleri bold (+ renk); okununca ağırlık normale döner (#6a6ca25f).
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
- **`titleTagChannel`** (NotificationResponse, card #1846): `titleTag` = `Vatandaş Talebi` olan
  bildirimlerde bağlı `SocialMessage.Channel` de döner; `NotificationBell.tsx` bunu `titleTag`'in
  hemen önünde `ChannelIcon` olarak basar. Birim adı gösteren (Reporter) `titleTag` satırlarında
  `titleTagChannel` `null` kalır — kanal ikonu yalnız Vatandaş Talebi etiketiyle birlikte görünür.

- **Yeni Kullanıcı / Yeni Birim oluşturunca form kapanmaz (card #2258):** `UsersPage.handleCreateUser`
  ve `DepartmentsPage.handleCreate` başarı sonrası artık `closeCreateForm()`/`setShowForm(false)`
  ÇAĞIRMIYOR — yalnız `resetForm()`/`resetCreateForm()` (alanları temizler, `create=1` URL param'ı
  kalır, form açık kalır). Yeni bir "oluştur" akışı eklersen aynı deseni izle.
- **Sistem Yönetimi (`DepartmentType: "Administration"`) hiçbir birim listesinde görünmez (card
  #2256):** filtre `GetDepartmentsQuery`'de (`WHERE DepartmentType != "Administration"`) — frontend'in
  TÜM birim dropdown'ları/listeleri `api.getDepartments()` üzerinden bu query'ye çıkıyor, tek
  noktadan gizleniyor. `GetMyDepartments` (department-switcher, kullanıcının kendi bağlamı) bu
  filtreye dahil DEĞİL — kasıtlı, farklı semantik. Yeni bir tenant kurulumunda (`ApplyInstallSeedData`
  + `BootstrapTenantCommand`) da sadece admin + Sistem Yönetimi oluşur; origin/Tire'de bu artık
  demo reposuyla aynı desen (bkz. `RemoveSampleSeedData` migration'ı — **yalnız yeni/boş DB'lerde
  güvenli, yenitim gibi gerçek veri içeren bir DB'ye deploy etmeden önce o departman/kullanıcı
  ID'lerinin hâlâ gerçek veriye bağlı olup olmadığını kontrol et**, aksi halde testtim'de yaşanan FK
  çakışmasının çok daha yıkıcı bir versiyonu prod'da tetiklenebilir).
- **Kullanıcı rozetindeki birim adı ARTIK kısaltılmıyor (card #2260 → #2264 reopen):** #2260'da
  eklenen `truncateDepartmentBadgeLabel` ("Müd..." kısaltması) #2264'te kaldırıldı — kullanıcı
  kısaltma yerine alanın genişletilmesini istedi. `AppShell.tsx`'teki rozet butonu artık
  `max-w-[26rem]` + `whitespace-nowrap` (CSS `truncate` yok) ile tam birim adını gösterir. Yeniden
  bir kısaltma ihtiyacı çıkarsa önce genişlik artırımını dene, "Müd..." desenine dönme.
- **Anasayfa metrik kartlarında başlık/alt-başlık ayrımı `sublabel` alanıyla yapılır** (card #2259):
  `MetricCard.sublabel` alt satırda `normal-case tracking-normal` ile basılır — yeni bir metrik
  kartı eklerken uzun bileşik ifadeleri (`"X Y Z"`) `label`+`sublabel` olarak böl, tek satıra sıkıştırma.
  `sublabel`sız kartlarda da label bloğu `min-h-[2.75rem]` ile sublabel'lı komşularla aynı
  yükseklikte kalır; değer ikinci grid satırında, ikon `row-span-2 self-center` ile ortalanır.
- **Ayarlar > Görünüm "Varsayılana Dön" artık gerçekten fabrika ayarına döner ve anında kaydeder**
  (card #2261, eskiden "Yüklü Değerlere Dön" = son kaydedilen değerlere dönerdi): `SettingsPage`
  `resetAppearanceToDefault()` — `DEFAULT_TENANT_APPEARANCE` değerlerini (logo dahil) backend'e kaydeder,
  `setAppearance(refreshed)` ile sidebar/giriş ekranı da anında güncellenir (aynı desen #2251).
  Varsayılan logo `frontend/public/default-institution-logo.png` (Lumespec wordmark) — hem FE
  `DEFAULT_TENANT_APPEARANCE.logoUrl` hem BE `TenantAppearanceService.DefaultAppearance` aynı yolu
  kullanır; ikisi birlikte değişmeli. **Var olan/özelleştirilmiş tenant'ları etkilemez** —
  `resolveTenantAppearance`'da `...appearance` spread'i `logoUrl: null` bile olsa default'u ezer,
  bu default yalnız (a) hiç `TenantSetting` satırı olmayan yepyeni tenant'larda ve (b) "Varsayılana
  Dön"e elle basılınca devreye girer.
- **Görünüm Önizleme logosu (#2276/#2328):** Yalnız Ayarlar > Görünüm önizlemesinde logo çerçeveli
  `MunicipalitySeal` ile gösterilir (`h-20 w-36` çerçeve; logo görseli `imageClassName` ~80%);
  sidebar/login ölçüleri etkilenmez.
- **Vatandaş Çağrı Talebi vatandaş adı (#2331):** `CreateRequestPage` vatandaş adı alanı blur/submit'te
  `normalizeTitleCaseField` (kelime başı büyük harf, TR locale); başlık/açıklama ilk-harf kuralı ayrı kalır.
- **Vatandaş Bilgi Listesi detay popup VT/Öncelik (#2287):** talep no biraz küçük, öncelik biraz büyük
  (`citizen-directory-tickets-table` scoped CSS).
- **Vatandaş Bilgi Listesi Talep Kanalı (#2285):** `Talep Kanalı` sütunu `FilterableTh` ile
  filtrelenebilir ve sıralanabilir; etiket `sourceChannelLabel` üzerinden Türkçe kanal adıyla eşleşir.
- **Birimler liste araması (#2283):** Birim ara kutusu yalnız birim adı, müdür ve sorumlu
  adlarında arar; gridde görünmeyen `departmentType` (`Müdürlük` vb.) haystack'e dahil edilmez.
- **Yeni Kullanıcı/Yeni Birim formunda Oluşturma Modu üstü LDAP ipucu** (card #2263):
  `!ldapEnabled` iken açıklama paragrafının altına ek bir `helper-copy` satırı
  (`departments.ldapNotConfiguredHint` / `users.ldapNotConfiguredHint`) eklenir; LDAP
  ayarlandığında kaybolur — statik `newFormDescription` metnine ASLA gömme, koşullu kalsın.
- **Log UserCreated detayı (#2290/#2301):** `ApplicationUser` oluşturma logları Detay'da `Kullanıcı:` +
  `Rol:` etiketli satırlar gösterir; ham `role=Manager` İngilizce metni kullanıcıya basılmaz.
- **Log UserDeleted detayı (#2302):** silinen kullanıcı artık DB'de olmadığından audit `Details`
  alanında `username`/`role` saklanır; `GetAuditLogsQuery` geçmiş kayıtları parse ederek Detay'da gösterir.
- **Kullanıcılar/Birimler grid dropdown (#2296):** satır içi düzenleme dropdown'ları `menuPortal={false}`
  ile satırla birlikte kayar; `.table-wrap` scroll'unda menü kapanır; thead z-index dropdown üstündedir.
- **Kurum içi yazıyor göstergesi (#2307 / #2353 / Round 717):** aktif sohbette karşı taraf yazarken SignalR
  `ReceiveInternalMessageTyping` ile header'da birim satırının altında `Yazıyor` + animasyonlu
  üç nokta gösterilir; `POST /internal-messages/typing` yalnız alıcıya iletilir. Gönderen yazmaya
  devam ederken ~1.8 sn heartbeat ile yenilenir; alıcı/gönderen idle TTL ~3 sn (#2500 reopen),
  gösterge biraz küçük (#2512); dalga dikey hareketi orijinal `-0.22rem` yerine
  `-0.055rem` (container `0.5rem`, `align-items: center` — #2512 reopen).
  `activeChatRef` + unmount'ta
  `isTyping:false`; yazma durduğunda (draft dolu olsa bile) ~2 sn sonra heartbeat durur ve
  `isTyping:false` gönderilir (#2500). `POST` SignalR bağlantısına bekletilmez (`ensureSignalRConnected` paralel).
  Cookie-only SPA oturumunda hub JWT
  `POST /auth/session/signalr-access-token` ile üretilir; hub grupları `user-{guid}` küçük harf
  normalize (`SignalRGroupNames`); bağlantı sonrası `RegisterPresence`. SignalR kaçarsa açık
  sohbette `GET /internal-messages/typing/{otherUserId}` 1 sn poll yedekler.
- **Kurum içi görsel lightbox (Round 717):** FAB sohbetinde görsel tıklanınca
  `SocialConversationMediaPreview` (büyüteç, dosya adı, İndir) — WA ile aynı.
- **Kurum içi panel yüksekliği (Round 719):** `h-[min(80dvh,50rem)]` / `sm:h-[min(74dvh,46rem)]`
  (banner Canlı Özet üst hizası; Round 718 aşırı kısaltma geri alındı).
- **WA pending görsel lightbox (Round 718):** `WhatsAppOutboundAttachmentChip` görselde
  `cursor-zoom-in` + dahili `SocialConversationMediaPreview` (sayfa + modal).
- **Inbound görsel genişlik (Round 719):** balon içinde `w-full max-w-full object-contain`
  (balon max-width değişmez; dik foto sağ boşluk kapanır).
- **WA gelen doküman adı (Round 719):** yalnız `/whatsapp` — çerçeve `w-full`, isim `truncate`.
- **WA/modal textbox lag (Round 717 / #2418):** `DeferredComposerInput` / `DeferredComposerTextarea`
  local state + `startTransition` parent update; blur'da senkron flush. WA liste/konuşma arama, profil
  alanları, ek caption, modal ad/telefon kapsamda. `RichTextEditor` rAF + `startTransition`.
- **WA ek lazy load (#2486):** `SocialConversationMediaBubble` görünür alana girdikten sonra medya indirir;
  görünür değilken dosya adı placeholder.
- **Parantez max ipucu (#2506):** Talep Oluştur ve WA `CitizenRequestModal` formlarında `(max …)` küçük harf;
  `job-field-label` uppercase ipucu metnini bozmaz (`normal-case` + CSS). Diğer sayfalarda `(Max …)` kalabilir.
- **Talep Oluştur native doğrulama (#2353 reopen):** formlarda `noValidate` — tarayıcı hover tooltip'i
  çıkmaz; zorunluluk uygulama onayı/RichText ile kalır.
- **Birime Gelen İşlemler yüksekliği (#2484):** actions hücresi `request-actions` sınıfını kullanır;
  butonlar `min-height: 2.2rem`.
- **WhatsApp konuşma listesi arama (#1960 reopen):** telefon/ad/talep no araması en az 3 karakter
  sonra filtreler (InternalMessagesFab ile aynı eşik).
- **Birimler düzenle popup (#2294):** `Tür` alanı UI'da yok; mevcut `departmentType` kayıtta korunur.
- **WA beklemedeki mesaj Düzenle (#2299 reopen):** düzenleme modunda balon yüksekliği `minHeight` ile
  kilitlenir; alt aksiyon satırı sabit `min-h` ile konuşma alanı kaymaz.
- **Kurum İçi FAB zemin (#2300 / #6a75a09a):** panel kökü, konuşma listesi ve aktif sohbet scroll
  alanı standart `color-background` (bej `#ece5dd` sohbet zemini geri alındı).
- **Yerel birim oluşturma (#2303/#2310):** başarı `ConfirmDialog` popup'ıdır; başlık altında ayraç
  çizgisi (`titleDivider`) ve `Tamam` butonu yeşil (`variant: success`).
- **Kullanıcılar arama (#2309):** liste araması en az 3 karakter sonra filtreler (Birimler ile aynı).
- **Ayarlar önizleme (#2305 reopen):** logo dış oval çerçeve yüksekliği `h-22 w-36` (logo ~%88).
- **Kullanıcı düzenle Ek birimler (#2308 reopen):** birincil birim hücresi gri; ek birimler dropdown
  tetikleyicisi beyaz zemin + `min-h-8`; panel `max-h-88`. Ek roller tetikleyicisi `min-h-7`; panel
  `max-h-72`.
- **Birimler Yönetici Ata dropdown (#2311):** Müdür/Sorumlu panel öğe metni `0.8125rem`.
- **Birimler Yönetici Ata Kaydet/İptal (#2295 reopen):** `1.85rem` yükseklik, `0.6875rem` punto.
- **Users/Birimler liste araması (#1531):** Yeni Kullanıcı/Birim Ekle veya İptal ile form
  açılıp/kapanırken `userSearchText` / `deptSearchText` temizlenir.
- **Log birim audit metni (#2302 reopen):** `Department` entity logları Detay'da `Birim: {ad}` gösterir;
  güncellemede `Birim: eski → yeni`; ham `Department '…'` İngilizce metni kullanıcıya basılmaz.
  `GetAuditLogsQuery` silinen birim adını `Details`'ten parse eder.
- **Birim sil onay (#2294 reopen):** Sil/İptal eşit genişlikte (`min-width: 4.75rem`).
- **Users düzenle Kaydet/İptal (#2295):** hafif büyük (`2.12rem`).

## 6. Tenant / Auth

- **Tenant çözümleme önceliği:** `X-Tenant-Id` header > `CustomDomain` (Host) > `SingleTenant`
  (tek aktif) > `ManualSelection`.
- **OpenIddict stateless password flow; refresh token YOK; access token 8 saat.**
- **`RoleCode` → Türkçe etiket (kartlar bu adları kullanır):** `Reporter` = "Üst Düzey Yönetici",
  `Operator` = "Vatandaş Talep Operatörü", `CitizenRequestManager` = "Vatandaş Talep Yöneticisi",
  `Manager` = "Müdür". CRM scoped rol — detay [`authorization-matrix.md`](authorization-matrix.md) §1.1.
- **CitizenRequestManager talep oluşturabilir:** birim içi/dışı taleplerde Staff gibi yalnızca kendi
  çalışabildiği sahip birimle açar ve sahip birim onayına düşer (card #1080).
- **Login sonrası tek hedef navigasyon:** interactive giriş tamamlanınca `LoginPage` ayrıca bir
  path'e gitmez; authenticated router `getDefaultLandingPath(session.user)` ile tek hedefi seçer.
  Sonradan `/dashboard`'a gitmek SystemAdmin Ayarlar ekranını iki kez yükletir/flicker üretir (card #2263).
- Detay: [`adaptive-auth-20260322.md`](adaptive-auth-20260322.md), [`authorization-matrix.md`](authorization-matrix.md).
