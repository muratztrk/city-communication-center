# `docs/` İndeksi

Bu klasördeki dokümanların ne işe yaradığı ve ne kadar güncel olduğu. **Kod yazmadan önce
hangi dosyayı açacağını buradan bul.**

> ⭐ **Koda başlamadan önce mutlaka:** [`feature-invariants.md`](feature-invariants.md)
> — "ne bozulmamalı" kurallarının yaşayan listesi. Diğer dokümanlar arka plan/referans.

## Önce-oku (yaşayan, kart akışına bağlı)

| Dosya | Ne için | Tazelik |
|---|---|---|
| [`feature-invariants.md`](feature-invariants.md) | Kart öncesi "bunu bozma" kuralları (alan alan) | 🟢 yaşayan |
| [`../tasks/lessons.md`](../tasks/lessons.md) | Regresyon hikâyeleri / kök-neden dersleri | 🟢 yaşayan |
| [`../tasks/todo.md`](../tasks/todo.md) | Kart bazlı uygulama logu (round'lar) | 🟢 yaşayan |

## Mimari & tasarım (referans)

| Dosya | Ne için | Son commit | Tazelik |
|---|---|---|---|
| [`technical-design.md`](technical-design.md) | Kapsamlı teknik tasarım (781 satır) | 2026-06-23 | 🟢 güncel |
| [`workflow-design.md`](workflow-design.md) | İş akışı / süreç tasarımı | 2026-06-26 | 🟢 güncel |
| [`database-design.md`](database-design.md) | Veritabanı şeması | 2026-06-18 | 🟢 güncel |
| [`authorization-matrix.md`](authorization-matrix.md) | Rol/yetki matrisi | 2026-06-18 | 🟢 güncel |
| [`architecture-refactor-20260319.md`](architecture-refactor-20260319.md) | Tek seferlik refactor logu | 2026-04-06 | ⚪ tarihsel arşiv |
| [`current-task-flow.md`](current-task-flow.md) | Görev/sosyal akış anlatımı | 2026-04-06 | 🟡 eski — koddan teyit et |

## Entegrasyon & operasyon (referans)

| Dosya | Ne için | Son commit | Tazelik |
|---|---|---|---|
| [`api-integration-guide.md`](api-integration-guide.md) | API entegrasyon rehberi | 2026-06-18 | 🟢 güncel |
| [`whatsapp-social-integration-guide.md`](whatsapp-social-integration-guide.md) | WhatsApp / sosyal medya entegrasyonu | 2026-06-18 | 🟢 güncel |
| [`adaptive-auth-20260322.md`](adaptive-auth-20260322.md) | Tenant resolution + adaptive auth | 2026-03-23 | 🟡 eski — koddan teyit et |
| [`deployment-guide.md`](deployment-guide.md) | Kurulum / deployment | 2026-06-18 | 🟢 güncel |
| [`operations-admin-guide.md`](operations-admin-guide.md) | Operasyon / admin | 2026-06-26 | 🟢 güncel |
| [`troubleshooting-guide.md`](troubleshooting-guide.md) | Bakım / sorun giderme | 2026-06-18 | 🟢 güncel |
| [`user-manual.md`](user-manual.md) | Son kullanıcı kılavuzu (921 satır) | 2026-06-26 | 🟢 güncel |
| [`mobile-reporting-app/`](mobile-reporting-app/) | Mobil raporlama uygulaması notları | — | 🟢 |

**Tazelik anahtarı:** 🟢 güncel · 🟡 eski, koddan doğrula · ⚪ tarihsel arşiv (güncel sanma).

> Statik dokümanlar ("Hazırlanma tarihi: …" başlıklı olanlar) bir kez yazıldı; çelişki
> görürsen **kod kaynaktır**. Düzelttiğin bilgiyi mümkünse `feature-invariants.md`'ye taşı —
> orası kart akışında okunan tek yer.
