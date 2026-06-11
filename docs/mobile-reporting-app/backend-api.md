# Backend API Design — Executive Report Endpoint

## New Query: `GetExecutiveReportQuery`

**File:** `Application/Features/Reports/Queries/GetExecutiveReportQuery.cs`

### Input

```csharp
public sealed record GetExecutiveReportQuery(
    string Period,         // "weekly" | "monthly" | "yearly"
    DateTimeOffset? FromUtc,
    DateTimeOffset? ToUtc
) : IQuery<ExecutiveReportResponse>;
```

### Output Contracts (in `Shared/Contracts/`)

```csharp
public sealed record ExecutiveReportResponse(
    ExecutiveKpiResponse Kpi,
    IReadOnlyList<TimeSeriesPointResponse> TimeSeries,
    IReadOnlyList<ChannelStatResponse> ByChannel,
    IReadOnlyList<DepartmentStatResponse> ByDepartment
);

public sealed record ExecutiveKpiResponse(
    int TotalRequests,
    int CompletedRequests,
    double CompletionRate,
    double AvgResolutionHours,
    double SlaComplianceRate,
    int OverdueCount,
    int PendingApprovals,
    int OpenSocialMessages
);

public sealed record TimeSeriesPointResponse(
    string Label,
    int Created,
    int Completed
);

public sealed record ChannelStatResponse(
    string Channel,
    int Count,
    string ColorKey
);

public sealed record DepartmentStatResponse(
    Guid DepartmentId,
    string Name,
    int Total,
    int Completed,
    double CompletionRate,
    int OverdueCount,
    double AvgResolutionHours
);
```

### Handler Logic (pseudocode)

```csharp
// 1. Resolve tenant + enforce Manager/SystemAdmin role
// 2. Compute effective date range from Period if FromUtc/ToUtc not provided
//    - weekly:  last 8 ISO weeks
//    - monthly: last 12 calendar months
//    - yearly:  last 5 calendar years
// 3. Scope to manager's departments if role == Manager
// 4. Query Jobs for KPI:
//    - totalRequests = Jobs.Count(in range)
//    - completedRequests = Jobs.Count(Status == Completed, in range)
//    - completionRate = completedRequests / totalRequests * 100
//    - avgResolutionHours = avg(CompletedAtUtc - CreatedAtUtc) for completed jobs
//    - slaComplianceRate = Jobs where CompletedAtUtc <= DueDateUtc / Jobs with DueDateUtc
//    - overdueCount = Tasks where DueDateUtc < now && not completed/cancelled
//    - pendingApprovals = Jobs where Status == PendingOwnerApproval || PendingExternalApproval
//    - openSocialMessages = SocialMessages where Status != Closed
// 5. Build TimeSeries: group Jobs by period bucket using EF TruncateTo/grouping
//    Each bucket: created count + completed count
// 6. byChannel: group Jobs (Citizen type) by SocialChannel (join SocialMessage)
// 7. byDepartment: group Jobs/Tasks by department with same KPI metrics
```

### Controller Action

```csharp
// ReportsController.cs — add to existing controller
[HttpGet("executive")]
[Authorize(Roles = "SystemAdmin,Manager")]
public async Task<ExecutiveReportResponse> GetExecutiveReport(
    [FromQuery] string period = "monthly",
    [FromQuery] DateTimeOffset? fromUtc = null,
    [FromQuery] DateTimeOffset? toUtc = null,
    CancellationToken cancellationToken = default)
{
    return await _mediator.Send(
        new GetExecutiveReportQuery(period, fromUtc, toUtc),
        cancellationToken);
}
```

### Existing Endpoints to Enhance

#### `GetWorkloadReportQuery` — add date range
```csharp
// Change: add FromUtc/ToUtc parameters
public sealed record GetWorkloadReportQuery(
    DateTimeOffset? FromUtc,
    DateTimeOffset? ToUtc
) : IQuery<IReadOnlyList<WorkloadReportItemResponse>>;
```

#### `GetSlaReportQuery` — add date range
```csharp
public sealed record GetSlaReportQuery(
    DateTimeOffset? FromUtc,
    DateTimeOffset? ToUtc
) : IQuery<SlaReportResponse>;
```

---

## Validation

```csharp
public sealed class GetExecutiveReportQueryValidator : AbstractValidator<GetExecutiveReportQuery>
{
    private static readonly string[] ValidPeriods = ["weekly", "monthly", "yearly"];

    public GetExecutiveReportQueryValidator()
    {
        RuleFor(x => x.Period)
            .Must(p => ValidPeriods.Contains(p.ToLowerInvariant()))
            .WithMessage("Geçersiz period değeri. 'weekly', 'monthly' veya 'yearly' olmalıdır.");

        RuleFor(x => x)
            .Must(x => !x.FromUtc.HasValue || !x.ToUtc.HasValue || x.FromUtc <= x.ToUtc)
            .WithMessage("Başlangıç tarihi bitiş tarihinden önce olmalıdır.");
    }
}
```

---

## Time-Series Bucketing Strategy

PostgreSQL `DATE_TRUNC` via EF raw SQL or LINQ:

```csharp
// monthly example
var buckets = await _dbContext.Jobs
    .Where(j => j.TenantId == tenantId && j.CreatedAtUtc >= fromUtc && j.CreatedAtUtc <= toUtc)
    .GroupBy(j => new {
        Year = j.CreatedAtUtc.Year,
        Month = j.CreatedAtUtc.Month
    })
    .Select(g => new {
        g.Key.Year,
        g.Key.Month,
        Created = g.Count(),
        Completed = g.Count(j => j.Status == JobStatus.Completed)
    })
    .OrderBy(x => x.Year).ThenBy(x => x.Month)
    .ToListAsync(cancellationToken);
```

---

## Authorization Matrix

| Endpoint | SystemAdmin | Manager | Operator | Staff | Reporter |
|---|---|---|---|---|---|
| `GET /reports/executive` | ✅ All | ✅ Dept-scoped | ❌ | ❌ | ❌ |
| `GET /reports/dashboard` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET /reports/workload` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `GET /reports/sla` | ✅ | ✅ | ✅ | ❌ | ❌ |
