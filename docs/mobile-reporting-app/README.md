# CCC Executive Mobile App — Design Document

**Project:** City Communication Center — Executive Reporting Mobile Application  
**Version:** 1.0  
**Date:** 2026-06-10  
**Status:** Design / Pre-implementation

---

## 1. Purpose

A mobile application that gives **mayors**, **department managers**, and senior executives a real-time executive view of the city communication center platform. Supports weekly, monthly, and yearly reporting with drill-down by channel, department, and SLA performance.

---

## 2. Target Users & Roles

| Role | Scope | Capabilities |
|---|---|---|
| **Mayor / SystemAdmin** | Full tenant (all departments) | All KPIs, all departments, all channels |
| **Manager** | Scoped to their departments | Department-specific KPIs, their staff performance |

> **Reporter** and **Staff** roles are out of scope for this app.

---

## 3. Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Mobile framework | **Flutter** | Already used in `cupcenter` and `diemo` |
| HTTP client | `dio` | Auth interceptor, timeout handling |
| State management | `riverpod` | Consistent with modern Flutter patterns |
| Charts | `fl_chart` | Bar, line, pie charts — highly customizable |
| Secure storage | `flutter_secure_storage` | JWT token persistence |
| Internationalization | `flutter_localizations` + `intl` | Turkish + English |
| Date formatting | `intl` | Locale-aware formatting |

---

## 4. Architecture Overview

```
ccc-mobile/
├── lib/
│   ├── main.dart
│   ├── api/
│   │   ├── client.dart          # Dio instance + interceptors
│   │   ├── auth_service.dart    # /connect/token + token storage
│   │   └── reports_service.dart # All report endpoints
│   ├── features/
│   │   ├── auth/
│   │   │   ├── login_screen.dart
│   │   │   └── auth_provider.dart
│   │   ├── home/
│   │   │   ├── home_screen.dart
│   │   │   ├── kpi_card.dart
│   │   │   ├── trend_bar_chart.dart
│   │   │   └── home_provider.dart
│   │   ├── channels/
│   │   │   ├── channels_screen.dart
│   │   │   └── channels_provider.dart
│   │   ├── departments/
│   │   │   ├── departments_screen.dart
│   │   │   └── departments_provider.dart
│   │   └── sla/
│   │       ├── sla_screen.dart
│   │       └── sla_provider.dart
│   ├── models/
│   │   ├── executive_report.dart
│   │   ├── kpi_summary.dart
│   │   ├── time_series_point.dart
│   │   └── department_stat.dart
│   ├── widgets/
│   │   ├── period_selector.dart
│   │   ├── stat_card.dart
│   │   └── channel_pie_chart.dart
│   └── l10n/
│       ├── app_tr.arb
│       └── app_en.arb
├── pubspec.yaml
└── README.md
```

---

## 5. Backend: New Executive Report Endpoint

### 5.1 Endpoint

```
GET /api/v1/reports/executive
```

**Access:** `SystemAdmin`, `Manager` only  
**Query parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `period` | `string` | Yes | `weekly` \| `monthly` \| `yearly` |
| `fromUtc` | `DateTimeOffset` | No | Start of range (defaults to last 7/30/12 periods) |
| `toUtc` | `DateTimeOffset` | No | End of range (defaults to now) |

### 5.2 Response Shape

```json
{
  "kpi": {
    "totalRequests": 342,
    "completedRequests": 287,
    "completionRate": 83.9,
    "avgResolutionHours": 18.4,
    "slaComplianceRate": 76.2,
    "overdueCount": 12,
    "pendingApprovals": 5,
    "openSocialMessages": 28
  },
  "timeSeries": [
    { "label": "Haz 2026", "created": 45, "completed": 38 },
    { "label": "May 2026", "created": 52, "completed": 47 },
    { "label": "Nis 2026", "created": 38, "completed": 31 }
  ],
  "byChannel": [
    { "channel": "WhatsApp", "count": 120, "colorKey": "success" },
    { "channel": "Facebook", "count": 98, "colorKey": "primary" },
    { "channel": "Instagram", "count": 54, "colorKey": "danger" },
    { "channel": "Email", "count": 43, "colorKey": "info" },
    { "channel": "Phone", "count": 27, "colorKey": "warning" }
  ],
  "byDepartment": [
    {
      "departmentId": "...",
      "name": "Temizlik İşleri",
      "total": 89,
      "completed": 72,
      "completionRate": 80.9,
      "overdue": 3,
      "avgResolutionHours": 14.2
    }
  ]
}
```

### 5.3 Implementation Notes

- `timeSeries` bucketing logic:
  - `weekly` → last 8 ISO weeks, label = `"W{n} MMM"`
  - `monthly` → last 12 months, label = `"MMM yyyy"`
  - `yearly` → last 5 calendar years, label = `"yyyy"`
- `avgResolutionHours` = average of `(CompletedAtUtc - CreatedAtUtc)` for completed jobs within period
- `slaComplianceRate` = `completedOnTime / totalWithDueDate * 100` where "on time" = `CompletedAtUtc <= DueDateUtc`
- Manager scope: filter by departments the user manages (reuse `UserDepartmentAccess.GetScopedDepartmentIdsAsync`)
- New CQRS file: `Application/Features/Reports/Queries/GetExecutiveReportQuery.cs`
- New controller action in existing `ReportsController`

---

## 6. Screens

### 6.1 Login Screen

```
┌─────────────────────────────────┐
│                                 │
│         [City Logo]             │
│    Yönetici Raporlama           │
│                                 │
│  ┌─────────────────────────┐    │
│  │ Kullanıcı adı           │    │
│  └─────────────────────────┘    │
│  ┌─────────────────────────┐    │
│  │ Şifre              👁   │    │
│  └─────────────────────────┘    │
│                                 │
│     [Giriş Yap]                 │
│                                 │
└─────────────────────────────────┘
```

**Notes:**
- Same `POST /connect/token` password flow as web app
- `tenant_id` pre-configured from build-time env (single-tenant deploy) or selected from list
- Token stored in `flutter_secure_storage`

---

### 6.2 Home Screen (Executive Dashboard)

```
┌─────────────────────────────────────────┐
│  ☰  Yönetici Paneli        [TR|EN] [👤] │
├─────────────────────────────────────────┤
│  [Haftalık]  [Aylık]  [Yıllık]         │  ← Period selector
├────────────┬────────────────────────────┤
│ 📋 Toplam  │ ✅ Tamamlanan             │
│    342     │  287  (%83.9)             │
├────────────┼────────────────────────────┤
│ ⏱ Ort.Süre │ 🎯 SLA Uyumu             │
│  18.4 saat │  %76.2                    │
├────────────┴────────────────────────────┤
│  📊 Talep Trendi                        │
│                                         │
│  50 ┤ ██ ░░  ██ ░░  ██ ░░  ██ ░░      │
│  25 ┤                                  │
│   0 ┤ Nis   May   Haz   Tem           │
│       ■ Oluşturulan  □ Tamamlanan     │
├─────────────────────────────────────────┤
│  ➤ Kanala Göre Dağılım                 │
│  ➤ Birime Göre Performans              │
│  ➤ SLA Raporu                          │
│  ➤ Bekleyen Onaylar  (5)               │
└─────────────────────────────────────────┘
```

**Behaviour:**
- Period selector defaults to `Aylık` (monthly)
- All 4 cards + chart + list items reload when period changes
- Cards show delta vs previous period (e.g., `+12% ↑` in green)
- Pull-to-refresh

---

### 6.3 Channels Screen

```
┌─────────────────────────────────────────┐
│  ← Kanala Göre Dağılım                  │
│  [Haftalık]  [Aylık]  [Yıllık]         │
├─────────────────────────────────────────┤
│                                         │
│         [Pie Chart]                     │
│      WhatsApp  35%                      │
│      Facebook  28%                      │
│      Instagram 16%                      │
│      E-posta   13%                      │
│      Telefon    8%                      │
│                                         │
├─────────────────────────────────────────┤
│  Kanal          Sayı    Oran            │
│  📱 WhatsApp    120     35%  ████████  │
│  📘 Facebook     98     28%  ███████   │
│  📸 Instagram    54     16%  ████      │
│  📧 E-posta      43     13%  ███       │
│  📞 Telefon      27      8%  ██        │
└─────────────────────────────────────────┘
```

---

### 6.4 Departments Screen

```
┌─────────────────────────────────────────┐
│  ← Birim Performansı                    │
│  [Haftalık]  [Aylık]  [Yıllık]         │
├─────────────────────────────────────────┤
│  Sıralama: [Tamamlanma %▼] [Toplam]    │
├─────────────────────────────────────────┤
│  1. Temizlik İşleri              %80.9  │
│     89 görev  ██████████████░░░         │
│     Ort. 14.2 saat  ⚠ 3 geciken       │
│─────────────────────────────────────────│
│  2. Yol ve Ulaşım                %74.3  │
│     61 görev  ████████████░░░░░         │
│     Ort. 22.1 saat  ⚠ 7 geciken       │
│─────────────────────────────────────────│
│  3. Park ve Bahçeler             %91.2  │
│     34 görev  ████████████████░         │
│     Ort. 9.6 saat   ✅ 0 geciken       │
└─────────────────────────────────────────┘
```

**Tap row** → Detail screen with that department's time-series chart + staff list.

---

### 6.5 SLA Report Screen

```
┌─────────────────────────────────────────┐
│  ← SLA Raporu                           │
├─────────────────────────────────────────┤
│                                         │
│         🎯  %76.2                       │
│         SLA Uyum Oranı                  │
│                                         │
├──────────────┬──────────────────────────┤
│ ⚠ Geciken    │ 📅 Bugün Bitiyor         │
│    12 görev  │    8 görev               │
├──────────────┴──────────────────────────┤
│  Son 6 Ay SLA Trendi                    │
│                                         │
│  100% ─────────────────────────         │
│   80% ──────────╮  ╭───────────         │
│   60%           ╰──╯                    │
│        Oca Feb Mar Nis May Haz          │
│                                         │
├─────────────────────────────────────────┤
│  Birim              SLA   Geciken       │
│  Temizlik İşleri   %80.9     3          │
│  Yol ve Ulaşım     %74.3     7          │
│  Park ve Bahçeler  %91.2     0          │
└─────────────────────────────────────────┘
```

---

### 6.6 Settings Screen

```
┌─────────────────────────────────────────┐
│  ← Ayarlar                              │
├─────────────────────────────────────────┤
│  Dil                      [TR ▼]        │
│  Tema                    [Koyu ▼]       │
│  Bildirimler              [Açık]        │
├─────────────────────────────────────────┤
│  Hesap                                  │
│  Kullanıcı: Ahmet Yılmaz               │
│  Rol: SystemAdmin                       │
│  Tenant: Tire Belediyesi               │
├─────────────────────────────────────────┤
│  [Çıkış Yap]                           │
└─────────────────────────────────────────┘
```

---

## 7. Navigation Structure

```
Bottom Navigation Bar:
┌──────┬──────────┬───────────┬──────┐
│  🏠  │   📊     │    🏛     │  ⚙  │
│ Ana  │ Kanallar │  Birimler │Ayar │
└──────┴──────────┴───────────┴──────┘

+ Floating fab or menu item for SLA report
```

---

## 8. Auth & Security

| Concern | Solution |
|---|---|
| Token storage | `flutter_secure_storage` (Keychain on iOS, Keystore on Android) |
| Token expiry (8h) | Dio interceptor catches 401, clears token, redirects to login |
| Tenant selection | Build-time `TENANT_ID` env var (same pattern as web frontend) |
| Role enforcement | Check `role` claim after login; redirect non-Mayor/Manager to error screen |

---

## 9. Period Selector Logic

| Period | Default Range | Bucket Size | Labels |
|---|---|---|---|
| `weekly` | Last 8 weeks | 1 ISO week | `W24 Haz`, `W23 May` |
| `monthly` | Last 12 months | 1 calendar month | `Haz 2026`, `May 2026` |
| `yearly` | Last 5 years | 1 calendar year | `2026`, `2025`, `2024` |

The period selector sends `fromUtc` / `toUtc` computed on device to the backend query.

---

## 10. Comparison Delta Logic

Each KPI card shows a delta vs the **previous equivalent period**:

- Monthly view: current month vs last month
- Weekly view: current week vs last week  
- Yearly view: current year vs last year

Two API calls are made in parallel: current period + previous period. Delta is computed client-side.

---

## 11. Localization

| Key | Turkish | English |
|---|---|---|
| `home.totalRequests` | Toplam Talep | Total Requests |
| `home.completed` | Tamamlanan | Completed |
| `home.avgResolutionTime` | Ort. Çözüm Süresi | Avg. Resolution Time |
| `home.slaCompliance` | SLA Uyumu | SLA Compliance |
| `home.trend` | Talep Trendi | Request Trend |
| `period.weekly` | Haftalık | Weekly |
| `period.monthly` | Aylık | Monthly |
| `period.yearly` | Yıllık | Yearly |
| `channel.WhatsApp` | WhatsApp | WhatsApp |
| `channel.Facebook` | Facebook | Facebook |
| `sla.overdueCount` | Geciken Görev | Overdue Tasks |
| `sla.dueTodayCount` | Bugün Bitiyor | Due Today |

---

## 12. Push Notifications (Phase 2)

Connect to the existing SignalR hub at `/hubs/notifications` using `signalr_netcore` Flutter package. Use Firebase Cloud Messaging (FCM) for background push — the backend already supports FCM via `PushSubscription` entity.

Notification types relevant to executives:
- New high-priority citizen request
- SLA breach (task overdue)
- Pending approval waiting > 24h

---

## 13. Implementation Phases

### Phase 1 — Core Reporting (MVP)
- [ ] Backend: `GetExecutiveReportQuery` + `ReportsController` action
- [ ] Flutter: Project scaffold + auth flow
- [ ] Flutter: Home screen with KPI cards + bar chart
- [ ] Flutter: Channels screen (pie chart)
- [ ] Flutter: Departments screen (ranked list)
- [ ] Flutter: SLA screen

### Phase 2 — Enhanced UX
- [ ] Delta comparison (current vs previous period)
- [ ] Department drill-down (tap → per-dept detail)
- [ ] Push notifications via SignalR
- [ ] Export report as PDF

### Phase 3 — Advanced Analytics
- [ ] Staff performance leaderboard (Managers only)
- [ ] Citizen satisfaction trends
- [ ] Geographic heatmap (jobs have `Latitude`/`Longitude`)

---

## 14. API Endpoints Used

| Endpoint | Purpose |
|---|---|
| `POST /connect/token` | Login (existing) |
| `GET /api/v1/reports/executive` | **NEW** — main data source |
| `GET /api/v1/reports/sla` | SLA overview (existing, enhance with date range) |
| `GET /api/v1/reports/workload` | Dept workload (existing, enhance with date range) |
| `GET /api/v1/departments` | Department names (existing) |
| `GET /api/v1/me` | Current user info (existing) |

---

## 15. Project Location

```
Works/
├── city-communication-center/   ← Backend API (extend here)
└── ccc-mobile/                  ← New Flutter app
```

The Flutter app is a separate repository / folder from the backend.

---

*Prepared for implementation review. See `backend-api.md` for detailed backend design and `screens.md` for wireframe specifications.*
