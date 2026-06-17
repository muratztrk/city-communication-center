# İş Akışı ve Süreç Tasarım Dokümanı

Hazırlanma tarihi: 18 Haziran 2026

Bu doküman City Communication Center içindeki talep, görev, sosyal mesaj ve bildirim süreçlerini açıklar.

## 1. Süreç Alanları

Ana süreçler:

- İç birim talebi
- Dış birim talebi
- Vatandaş/sosyal mesajdan talep
- Görev atama ve tamamlama
- Müdür onay ve kapatma
- Süresi geçmiş talep/görev takibi
- Bildirim ve detay yönlendirme

## 2. İç Birim Talebi

İç birim talebi, kullanıcının kendi birimi içinde veya kendi sorumluluğundaki iş için açtığı taleptir.

```mermaid
flowchart TD
    A["Kullanıcı talep oluşturur"] --> B["Job kaydı oluşur"]
    B --> C["Sahip birim belirlenir"]
    C --> D["Görev veya talep beklemeye alınır"]
    D --> E["Müdür/personel görevi işler"]
    E --> F["Tamamlama girilir"]
    F --> G["Gerekirse müdür kapanış onayı verir"]
    G --> H["Talep tamamlandı/kapatıldı"]
```

Temel ekranlar:

- Talep Oluştur
- Taleplerim
- Görevlerim
- Birimdeki Görevler

## 3. Dış Birim Talebi

Dış birim talebi, talep sahibi birimden hedef birime yönlendirilen akıştır.

```mermaid
flowchart TD
    A["Kaynak birim talep oluşturur"] --> B["Hedef birim seçilir"]
    B --> C["Kaynak birim müdür onayı"]
    C -->|Onay| D["Hedef birime düşer"]
    C -->|Ret| R["Talep reddedilir"]
    D --> E["Hedef birim onayı"]
    E -->|Onay| F["Görev/iş başlatılır"]
    E -->|Ret| G["Talep kaynak birime döner veya reddedilir"]
    F --> H["Personel ataması"]
    H --> I["Tamamlama"]
    I --> J["Kapanış onayı"]
```

Temel ekranlar:

- Birimden Giden Talepler
- Birime Gelen Talepler
- Personelimin Görevleri

## 4. Koordinasyonlu Talep

Koordinasyonlu talepte birden fazla birim sürece dahil olur.

```mermaid
flowchart TD
    A["Talep oluşturulur"] --> B["Ana hedef birim belirlenir"]
    B --> C["Koordine birimler eklenir"]
    C --> D["Her birim kendi görevlerini takip eder"]
    D --> E["Alt görevler tamamlanır"]
    E --> F["Genel ilerleme oranı güncellenir"]
    F --> G["Talep kapanışa gider"]
```

Koordine birimler `JobDepartment` kayıtlarıyla tutulur.

## 5. Vatandaş/Sosyal Mesaj Akışı

```mermaid
flowchart TD
    A["Vatandaş sosyal kanaldan yazar"] --> B["Webhook mesajı alır"]
    B --> C["SocialMessage oluşur"]
    C --> D["Operatör mesajı inceler"]
    D --> E{Talep oluşturulsun mu?}
    E -->|Hayır| F["Mesaja cevap verilir veya kapatılır"]
    E -->|Evet| G["Talebe dönüştürülür"]
    G --> H["Birim/yönlendirme seçilir"]
    H --> I["Normal talep iş akışı başlar"]
```

Kanallar:

- WhatsApp
- X
- Facebook
- Instagram
- Email
- WebForm
- Diğer

## 6. Görev Atama Akışı

```mermaid
flowchart TD
    A["Görev oluşur"] --> B{Atama tipi}
    B -->|Departman havuzu| C["AssignedDepartmentId dolu, AssignedUserId boş"]
    B -->|Kişi ataması| D["AssignedUserId dolu"]
    C --> E["Personel görevi sahiplenir"]
    D --> F["Personel görevi görür"]
    E --> F
    F --> G["İşlem başlar"]
    G --> H["Tamamlandı olarak işaretlenir"]
    H --> I["Müdür kapanış onayı"]
```

Departman havuzu görevleri yalnızca ilgili departmandaki uygun personel tarafından sahiplenilebilir.

## 7. Görev Kapanış Akışı

```mermaid
flowchart TD
    A["Personel görevi tamamlar"] --> B["Tamamlama notu ve ekleri girer"]
    B --> C["Müdür incelemesine düşer"]
    C --> D{Kapanış uygun mu?}
    D -->|Evet| E["Kapanış onaylanır"]
    D -->|Hayır| F["Kapanış reddedilir veya revizyon istenir"]
    F --> G["Personel yeniden işlem yapar"]
    G --> B
```

## 8. Revizyon Akışı

Revizyon, tamamlanan veya kapanışa gelen işlerde ek düzeltme istendiğinde kullanılır.

```mermaid
flowchart TD
    A["Müdür revizyon ister"] --> B["Revizyon nedeni girilir"]
    B --> C["Görev personele geri döner"]
    C --> D["Personel düzeltir"]
    D --> E["Tekrar tamamlar"]
    E --> F["Müdür tekrar değerlendirir"]
```

## 9. Süresi Geçmiş Talep/Görev Mantığı

Bir talep veya görev şu koşullarda süresi geçmiş sayılır:

- Son tarih doludur.
- Son tarih şu andan küçüktür.
- Kayıt tamamlandı/kapatıldı durumunda değildir.

Bu kayıtlar ilgili ekranlarda özel filtrelerle gösterilir:

- Taleplerim > Son Tarihi Geçmiş Taleplerim
- Birime Gelen Talepler > Son Tarihi Geçmiş Talepler
- Birimden Giden Talepler > Son Tarihi Geçmiş Talepler

## 10. Bildirim Akışı

```mermaid
flowchart TD
    A["İş olayı gerçekleşir"] --> B["Notification kaydı oluşur"]
    B --> C["SignalR ile kullanıcıya yayınlanır"]
    C --> D["Bildirim ikonunda sayı artar"]
    D --> E["Kullanıcı bildirime tıklar"]
    E --> F["İlgili talep/görev detayı açılır"]
    F --> G["Bildirim okundu kabul edilir"]
```

Bildirim kaynakları:

- Yeni görev
- Talep onayı
- Görev ataması
- Tamamlama
- Reddetme
- Revizyon
- Sosyal mesaj

## 11. İptal ve Geri Gönderme

İptal:

- Talep/görev artık işleme alınmayacaksa kullanılır.
- İptal nedeni girilmelidir.
- Audit log'da izlenmelidir.

Geri gönderme:

- Yanlış veya eksik talep hedef birim tarafından kaynak birime geri gönderilebilir.
- Açıklama girilmelidir.
- Kaynak birim düzeltme veya yeniden yönlendirme yapabilir.

## 12. İş Akışı Tasarım İlkeleri

- Kullanıcı yalnızca rolü ve birimi kapsamındaki kayıtları görmelidir.
- Departman havuzu görevleri açık kişi ataması olmadan bekleyebilir.
- Müdür/system admin yeniden atama yapabilir.
- Talep ve görev geçmişi audit log ile izlenmelidir.
- Sosyal mesajdan oluşan taleplerde kaynak bağlantısı korunmalıdır.
- Süresi geçmiş kayıtlar ayrı filtrelerle görünür olmalıdır.
