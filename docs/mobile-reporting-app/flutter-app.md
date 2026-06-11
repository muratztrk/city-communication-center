# Flutter App Design — Screens & Components

## pubspec.yaml (key dependencies)

```yaml
name: ccc_mobile
description: City Communication Center — Executive Reporting

environment:
  sdk: ">=3.4.0 <4.0.0"
  flutter: ">=3.22.0"

dependencies:
  flutter:
    sdk: flutter
  flutter_localizations:
    sdk: flutter

  # HTTP & auth
  dio: ^5.7.0
  flutter_secure_storage: ^9.2.2

  # State management
  flutter_riverpod: ^2.5.1
  riverpod_annotation: ^2.3.5

  # Charts
  fl_chart: ^0.68.0

  # Utilities
  intl: ^0.19.0
  shared_preferences: ^2.3.2

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^4.0.0
  riverpod_generator: ^2.4.3
  build_runner: ^2.4.11
```

---

## Environment Configuration

```dart
// lib/api/config.dart
const String kApiBase = String.fromEnvironment(
  'API_BASE',
  defaultValue: 'http://localhost:15000',
);

const String kTenantId = String.fromEnvironment(
  'TENANT_ID',
  defaultValue: '',
);
```

Build with:
```bash
flutter build apk \
  --dart-define=API_BASE=https://ccc.tirebld.gov.tr \
  --dart-define=TENANT_ID=b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e
```

---

## API Client

```dart
// lib/api/client.dart
class CccApiClient {
  late final Dio _dio;

  CccApiClient(String baseUrl, AuthTokenStorage storage) {
    _dio = Dio(BaseOptions(
      baseUrl: '$baseUrl/api/v1',
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 30),
    ));

    _dio.interceptors.add(AuthInterceptor(storage));
  }
}

class AuthInterceptor extends Interceptor {
  final AuthTokenStorage _storage;
  AuthInterceptor(this._storage);

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    final token = await _storage.getAccessToken();
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    if (kTenantId.isNotEmpty) {
      options.headers['X-Tenant-Id'] = kTenantId;
    }
    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    if (err.response?.statusCode == 401) {
      await _storage.clearToken();
      // Navigate to login — handled by router
    }
    handler.next(err);
  }
}
```

---

## Auth Flow

```dart
// lib/features/auth/auth_service.dart
Future<AuthResult> login(String username, String password) async {
  final response = await _dio.post('/connect/token', data: {
    'grant_type': 'password',
    'username': username,
    'password': password,
    if (kTenantId.isNotEmpty) 'tenant_id': kTenantId,
    'scope': 'openid profile email',
  }, options: Options(
    contentType: 'application/x-www-form-urlencoded',
  ));

  final token = response.data['access_token'] as String;
  final claims = JwtDecoder.decode(token);
  final role = claims['role'] as String?;

  // Only allow Mayor (SystemAdmin) and Manager
  if (role != 'SystemAdmin' && role != 'Manager') {
    throw UnauthorizedException('Bu uygulama yalnızca yöneticiler içindir.');
  }

  await _storage.saveToken(token, claims);
  return AuthResult.success(claims);
}
```

---

## Models

```dart
// lib/models/executive_report.dart
class ExecutiveReport {
  final ExecutiveKpi kpi;
  final List<TimeSeriesPoint> timeSeries;
  final List<ChannelStat> byChannel;
  final List<DepartmentStat> byDepartment;
}

class ExecutiveKpi {
  final int totalRequests;
  final int completedRequests;
  final double completionRate;
  final double avgResolutionHours;
  final double slaComplianceRate;
  final int overdueCount;
  final int pendingApprovals;
  final int openSocialMessages;
}

class TimeSeriesPoint {
  final String label;
  final int created;
  final int completed;
}

class ChannelStat {
  final String channel;
  final int count;
  final String colorKey;
}

class DepartmentStat {
  final String departmentId;
  final String name;
  final int total;
  final int completed;
  final double completionRate;
  final int overdueCount;
  final double avgResolutionHours;
}
```

---

## Period Selector Widget

```dart
// lib/widgets/period_selector.dart
enum ReportPeriod { weekly, monthly, yearly }

class PeriodSelector extends StatelessWidget {
  final ReportPeriod selected;
  final ValueChanged<ReportPeriod> onChanged;

  // Renders: [Haftalık] [Aylık] [Yıllık] segmented button
  // Highlighted button = selected period
}
```

---

## KPI Card Widget

```dart
// lib/widgets/stat_card.dart
class StatCard extends StatelessWidget {
  final String title;       // e.g. "Toplam Talep"
  final String value;       // e.g. "342"
  final String? delta;      // e.g. "+12% ↑" — null hides delta
  final Color deltaColor;   // green if positive, red if negative
  final IconData icon;
}
```

---

## Bar Chart Widget

```dart
// lib/widgets/trend_bar_chart.dart
// Uses fl_chart BarChart
// Two bar groups per x-axis point: created (blue) + completed (green)
// X-axis: period labels from timeSeries
// Tooltip: shows exact values on tap
```

---

## Providers (Riverpod)

```dart
// lib/features/home/home_provider.dart

@riverpod
Future<ExecutiveReport> executiveReport(
  ExecutiveReportRef ref, {
  required ReportPeriod period,
}) async {
  final service = ref.watch(reportsServiceProvider);
  return service.getExecutiveReport(period: period.name);
}

// Usage in widget:
final report = ref.watch(
  executiveReportProvider(period: _selectedPeriod)
);
report.when(
  data: (r) => _buildDashboard(r),
  loading: () => const CircularProgressIndicator(),
  error: (e, _) => ErrorWidget(e.toString()),
);
```

---

## Screen: HomeScreen

```
State:
  - selectedPeriod: ReportPeriod = monthly
  - report: AsyncValue<ExecutiveReport>

Widgets:
  - AppBar: title + language toggle + user avatar
  - PeriodSelector: onChange → invalidate provider
  - 2×2 Grid of StatCard:
      [Total Requests]  [Completed %]
      [Avg Hours]       [SLA %]
  - TrendBarChart: timeSeries data
  - ListTile shortcuts → Channels, Departments, SLA, Approvals
```

---

## Screen: ChannelsScreen

```
State:
  - selectedPeriod: ReportPeriod

Widgets:
  - AppBar + PeriodSelector
  - PieChart (fl_chart) — byChannel data
  - ListView of channel rows:
      Icon | Name | Count | Percentage bar
```

---

## Screen: DepartmentsScreen

```
State:
  - selectedPeriod: ReportPeriod
  - sortBy: 'completion' | 'total' | 'overdue'

Widgets:
  - AppBar + PeriodSelector + sort toggle
  - ListView of DepartmentTile:
      Rank | Name | Completion % bar
      Avg hours | Overdue badge
  - Tap → DepartmentDetailScreen (Phase 2)
```

---

## Screen: SlaScreen

```
State:
  - selectedPeriod: ReportPeriod

Widgets:
  - AppBar + PeriodSelector
  - Large circular gauge: SLA compliance %
  - Two stat cards: Overdue count | Due Today count
  - LineChart: SLA compliance trend over last 6 months
  - ListView: department SLA breakdown table
```

---

## Navigation

```dart
// lib/app/router.dart — GoRouter
final routes = [
  GoRoute(path: '/login', builder: (_,__) => const LoginScreen()),
  ShellRoute(
    builder: (_,__,child) => MainShell(child: child),
    routes: [
      GoRoute(path: '/',          builder: (_,__) => const HomeScreen()),
      GoRoute(path: '/channels',  builder: (_,__) => const ChannelsScreen()),
      GoRoute(path: '/departments', builder: (_,__) => const DepartmentsScreen()),
      GoRoute(path: '/sla',       builder: (_,__) => const SlaScreen()),
      GoRoute(path: '/settings',  builder: (_,__) => const SettingsScreen()),
    ],
  ),
];
```

Bottom nav bar items: Home · Channels · Departments · SLA · Settings

---

## Color Palette

Mirrors the web app's accent palette:

| Role | Color |
|---|---|
| Primary (blue) | `#3b82f6` |
| Success (green) | `#22c55e` |
| Warning (yellow) | `#facc15` |
| Danger (red) | `#ef4444` |
| Info (cyan) | `#22d3ee` |
| Neutral (gray) | `#6b7280` |

---

## Theming

```dart
// Dark and light mode
// Dark theme: background #0f172a, surface #1e293b (matches web dark theme)
// Light theme: background #f8fafc, surface #ffffff
```

---

## Localization Strings

### TR (app_tr.arb)
```json
{
  "appTitle": "CCC Yönetici",
  "periodWeekly": "Haftalık",
  "periodMonthly": "Aylık",
  "periodYearly": "Yıllık",
  "kpiTotalRequests": "Toplam Talep",
  "kpiCompleted": "Tamamlanan",
  "kpiAvgResolution": "Ort. Çözüm Süresi",
  "kpiSlaCompliance": "SLA Uyumu",
  "hoursUnit": "{n} saat",
  "percentUnit": "%{n}",
  "channelsTitle": "Kanala Göre Dağılım",
  "departmentsTitle": "Birim Performansı",
  "slaTitle": "SLA Raporu",
  "overdueCount": "Geciken Görev",
  "dueTodayCount": "Bugün Bitiyor",
  "logout": "Çıkış Yap",
  "settings": "Ayarlar"
}
```

### EN (app_en.arb)
```json
{
  "appTitle": "CCC Executive",
  "periodWeekly": "Weekly",
  "periodMonthly": "Monthly",
  "periodYearly": "Yearly",
  "kpiTotalRequests": "Total Requests",
  "kpiCompleted": "Completed",
  "kpiAvgResolution": "Avg. Resolution Time",
  "kpiSlaCompliance": "SLA Compliance",
  "hoursUnit": "{n} hours",
  "percentUnit": "{n}%",
  "channelsTitle": "By Channel",
  "departmentsTitle": "Department Performance",
  "slaTitle": "SLA Report",
  "overdueCount": "Overdue Tasks",
  "dueTodayCount": "Due Today",
  "logout": "Sign Out",
  "settings": "Settings"
}
```
