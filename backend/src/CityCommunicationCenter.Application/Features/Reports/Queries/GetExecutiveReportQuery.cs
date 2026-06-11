using CityCommunicationCenter.Application.Features.Users;
using CityCommunicationCenter.Domain.Enums;
using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Application.Features.Reports;

public sealed record GetExecutiveReportQuery(
    string Period,
    DateTimeOffset? FromUtc,
    DateTimeOffset? ToUtc) : IQuery<ExecutiveReportResponse>;

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

public sealed class GetExecutiveReportQueryHandler : IQueryHandler<GetExecutiveReportQuery, ExecutiveReportResponse>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public GetExecutiveReportQueryHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<ExecutiveReportResponse> Handle(
        GetExecutiveReportQuery request,
        CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var roleCode = context.RoleCode;

        if (roleCode is not ("SystemAdmin" or "Manager"))
            throw new ForbiddenAccessException("Bu rapora erişim yetkiniz yok.");

        var period = request.Period.ToLowerInvariant();
        var (effectiveFrom, effectiveTo) = ResolveRange(period, request.FromUtc, request.ToUtc);

        // Scope departments for Manager role
        Guid[]? scopedDeptIds = null;
        if (roleCode == "Manager" && context.UserId.HasValue)
        {
            var actor = await _dbContext.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    u => u.TenantId == tenantId && u.UserId == context.UserId.Value && u.IsActive,
                    cancellationToken);

            scopedDeptIds = actor is null
                ? []
                : await UserDepartmentAccess.GetScopedDepartmentIdsAsync(
                    _dbContext, tenantId, actor, context.ActiveDepartmentId, cancellationToken);

            if (scopedDeptIds.Length == 0)
                return EmptyReport();
        }

        var utcNow = DateTimeOffset.UtcNow;

        // ── KPI ──────────────────────────────────────────────────────────

        var jobsQuery = _dbContext.Jobs
            .AsNoTracking()
            .Where(j => j.TenantId == tenantId
                && j.CreatedAtUtc >= effectiveFrom
                && j.CreatedAtUtc <= effectiveTo);

        if (scopedDeptIds is not null)
            jobsQuery = jobsQuery.Where(j => scopedDeptIds.Contains(j.OwnerDepartmentId));

        var allJobs = await jobsQuery
            .Select(j => new
            {
                j.Status,
                j.CreatedAtUtc,
                j.CompletedAtUtc,
                j.DueDateUtc,
                j.OwnerDepartmentId,
                j.SourceType,
                j.SourceRefId,
            })
            .ToListAsync(cancellationToken);

        var totalRequests = allJobs.Count;
        var completedJobs = allJobs.Where(j => j.Status == JobStatus.Completed).ToList();
        var completedRequests = completedJobs.Count;
        var completionRate = totalRequests > 0 ? completedRequests * 100.0 / totalRequests : 0;

        var avgResolutionHours = completedJobs.Count > 0
            ? completedJobs
                .Where(j => j.CompletedAtUtc.HasValue)
                .Select(j => (j.CompletedAtUtc!.Value - j.CreatedAtUtc).TotalHours)
                .DefaultIfEmpty(0)
                .Average()
            : 0;

        var jobsWithDue = completedJobs.Where(j => j.DueDateUtc.HasValue && j.CompletedAtUtc.HasValue).ToList();
        var onTimeJobs = jobsWithDue.Count(j => j.CompletedAtUtc!.Value <= j.DueDateUtc!.Value);
        var slaComplianceRate = jobsWithDue.Count > 0 ? onTimeJobs * 100.0 / jobsWithDue.Count : 0;

        var overdueCount = await _dbContext.Tasks
            .AsNoTracking()
            .CountAsync(t => t.TenantId == tenantId
                && t.DueDateUtc.HasValue
                && t.DueDateUtc.Value < utcNow
                && t.CurrentStatus != WorkflowTaskStatus.Completed
                && t.CurrentStatus != WorkflowTaskStatus.Cancelled
                && t.CurrentStatus != WorkflowTaskStatus.Rejected
                && (scopedDeptIds == null || (t.AssignedDepartmentId.HasValue && scopedDeptIds.Contains(t.AssignedDepartmentId.Value))),
                cancellationToken);

        var pendingApprovals = await _dbContext.Jobs
            .AsNoTracking()
            .CountAsync(j => j.TenantId == tenantId
                && (j.Status == JobStatus.PendingOwnerApproval || j.Status == JobStatus.PendingExternalApproval)
                && (scopedDeptIds == null || scopedDeptIds.Contains(j.OwnerDepartmentId)),
                cancellationToken);

        var openSocialMessages = await _dbContext.SocialMessages
            .AsNoTracking()
            .CountAsync(sm => sm.TenantId == tenantId
                && sm.Status != SocialMessageStatus.Closed,
                cancellationToken);

        var kpi = new ExecutiveKpiResponse(
            TotalRequests: totalRequests,
            CompletedRequests: completedRequests,
            CompletionRate: Math.Round(completionRate, 1),
            AvgResolutionHours: Math.Round(avgResolutionHours, 1),
            SlaComplianceRate: Math.Round(slaComplianceRate, 1),
            OverdueCount: overdueCount,
            PendingApprovals: pendingApprovals,
            OpenSocialMessages: openSocialMessages);

        // ── Time Series ───────────────────────────────────────────────────

        var timeSeries = BuildTimeSeries(period, allJobs, effectiveFrom, effectiveTo);

        // ── By Channel ────────────────────────────────────────────────────

        var socialSourceIds = allJobs
            .Where(j => j.SourceType == JobSourceType.SocialMessage && j.SourceRefId.HasValue)
            .Select(j => j.SourceRefId!.Value)
            .ToList();

        var channelStats = new List<ChannelStatResponse>();
        if (socialSourceIds.Count > 0)
        {
            var channels = await _dbContext.SocialMessages
                .AsNoTracking()
                .Where(sm => socialSourceIds.Contains(sm.SocialMessageId))
                .GroupBy(sm => sm.Channel)
                .Select(g => new { Channel = g.Key, Count = g.Count() })
                .ToListAsync(cancellationToken);

            channelStats = channels
                .OrderByDescending(c => c.Count)
                .Select(c => new ChannelStatResponse(
                    Channel: c.Channel.ToString(),
                    Count: c.Count,
                    ColorKey: GetChannelColorKey(c.Channel)))
                .ToList();
        }

        // Non-social citizen jobs grouped by source type
        var otherSourceStats = allJobs
            .Where(j => j.SourceType != JobSourceType.SocialMessage)
            .GroupBy(j => j.SourceType)
            .Select(g => new ChannelStatResponse(
                Channel: g.Key.ToString(),
                Count: g.Count(),
                ColorKey: "neutral"))
            .OrderByDescending(c => c.Count)
            .ToList();

        channelStats.AddRange(otherSourceStats);

        // ── By Department ─────────────────────────────────────────────────

        var deptIds = allJobs.Select(j => j.OwnerDepartmentId).Distinct().ToList();

        var deptNames = await _dbContext.Departments
            .AsNoTracking()
            .Where(d => d.TenantId == tenantId && deptIds.Contains(d.DepartmentId))
            .ToDictionaryAsync(d => d.DepartmentId, d => d.Name, cancellationToken);

        var deptOverdueCounts = await _dbContext.Tasks
            .AsNoTracking()
            .Where(t => t.TenantId == tenantId
                && t.DueDateUtc.HasValue
                && t.DueDateUtc.Value < utcNow
                && t.CurrentStatus != WorkflowTaskStatus.Completed
                && t.CurrentStatus != WorkflowTaskStatus.Cancelled
                && t.CurrentStatus != WorkflowTaskStatus.Rejected
                && deptIds.Contains(t.AssignedDepartmentId ?? Guid.Empty))
            .GroupBy(t => t.AssignedDepartmentId!.Value)
            .Select(g => new { DeptId = g.Key, Count = g.Count() })
            .ToListAsync(cancellationToken);

        var deptOverdueMap = deptOverdueCounts.ToDictionary(x => x.DeptId, x => x.Count);

        var byDepartment = allJobs
            .GroupBy(j => j.OwnerDepartmentId)
            .Select(g =>
            {
                var deptCompleted = g.Where(j => j.Status == JobStatus.Completed).ToList();
                var deptTotal = g.Count();
                var deptCompletionRate = deptTotal > 0 ? deptCompleted.Count * 100.0 / deptTotal : 0;
                var deptAvgHours = deptCompleted.Count > 0
                    ? deptCompleted
                        .Where(j => j.CompletedAtUtc.HasValue)
                        .Select(j => (j.CompletedAtUtc!.Value - j.CreatedAtUtc).TotalHours)
                        .DefaultIfEmpty(0)
                        .Average()
                    : 0;

                return new DepartmentStatResponse(
                    DepartmentId: g.Key,
                    Name: deptNames.GetValueOrDefault(g.Key, "Bilinmiyor"),
                    Total: deptTotal,
                    Completed: deptCompleted.Count,
                    CompletionRate: Math.Round(deptCompletionRate, 1),
                    OverdueCount: deptOverdueMap.GetValueOrDefault(g.Key, 0),
                    AvgResolutionHours: Math.Round(deptAvgHours, 1));
            })
            .OrderByDescending(d => d.Total)
            .ToList();

        return new ExecutiveReportResponse(
            Kpi: kpi,
            TimeSeries: timeSeries,
            ByChannel: channelStats,
            ByDepartment: byDepartment);
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    private static (DateTimeOffset From, DateTimeOffset To) ResolveRange(
        string period, DateTimeOffset? from, DateTimeOffset? to)
    {
        var now = DateTimeOffset.UtcNow;
        if (from.HasValue && to.HasValue)
            return (from.Value, to.Value);

        return period switch
        {
            "weekly" => (now.AddDays(-56), now),   // last 8 weeks
            "yearly" => (now.AddYears(-5), now),   // last 5 years
            _ => (now.AddMonths(-12), now),         // last 12 months (default: monthly)
        };
    }

    private static IReadOnlyList<TimeSeriesPointResponse> BuildTimeSeries(
        string period,
        IReadOnlyList<dynamic> jobs,
        DateTimeOffset from,
        DateTimeOffset to)
    {
        return period switch
        {
            "weekly" => BuildWeeklyBuckets(jobs, from, to),
            "yearly" => BuildYearlyBuckets(jobs, from, to),
            _ => BuildMonthlyBuckets(jobs, from, to),
        };
    }

    private static IReadOnlyList<TimeSeriesPointResponse> BuildMonthlyBuckets(
        IReadOnlyList<dynamic> jobs, DateTimeOffset from, DateTimeOffset to)
    {
        var buckets = new List<TimeSeriesPointResponse>();
        var cursor = new DateTimeOffset(from.Year, from.Month, 1, 0, 0, 0, TimeSpan.Zero);

        while (cursor <= to)
        {
            var bucketStart = cursor;
            var bucketEnd = cursor.AddMonths(1);
            var label = $"{cursor.Year}-{cursor.Month:D2}"; // e.g. "2026-06"

            var created = jobs.Count(j => j.CreatedAtUtc >= bucketStart && j.CreatedAtUtc < bucketEnd);
            var completed = jobs.Count(j =>
                j.Status == JobStatus.Completed
                && j.CompletedAtUtc.HasValue
                && j.CompletedAtUtc >= bucketStart
                && j.CompletedAtUtc < bucketEnd);

            buckets.Add(new TimeSeriesPointResponse(label, created, completed));
            cursor = bucketEnd;
        }

        return buckets;
    }

    private static IReadOnlyList<TimeSeriesPointResponse> BuildWeeklyBuckets(
        IReadOnlyList<dynamic> jobs, DateTimeOffset from, DateTimeOffset to)
    {
        var buckets = new List<TimeSeriesPointResponse>();
        // Align to Monday of the start week
        var cursor = from.Date;
        while (cursor.DayOfWeek != DayOfWeek.Monday)
            cursor = cursor.AddDays(-1);

        var cursorDto = new DateTimeOffset(cursor, TimeSpan.Zero);

        while (cursorDto <= to)
        {
            var bucketStart = cursorDto;
            var bucketEnd = cursorDto.AddDays(7);
            var weekNum = System.Globalization.ISOWeek.GetWeekOfYear(cursorDto.DateTime);
            var label = $"{cursorDto.Year}-W{weekNum:D2}"; // e.g. "2026-W24"

            var created = jobs.Count(j => j.CreatedAtUtc >= bucketStart && j.CreatedAtUtc < bucketEnd);
            var completed = jobs.Count(j =>
                j.Status == JobStatus.Completed
                && j.CompletedAtUtc.HasValue
                && j.CompletedAtUtc >= bucketStart
                && j.CompletedAtUtc < bucketEnd);

            buckets.Add(new TimeSeriesPointResponse(label, created, completed));
            cursorDto = bucketEnd;
        }

        return buckets;
    }

    private static IReadOnlyList<TimeSeriesPointResponse> BuildYearlyBuckets(
        IReadOnlyList<dynamic> jobs, DateTimeOffset from, DateTimeOffset to)
    {
        var buckets = new List<TimeSeriesPointResponse>();
        var startYear = from.Year;
        var endYear = to.Year;

        for (var year = startYear; year <= endYear; year++)
        {
            var bucketStart = new DateTimeOffset(year, 1, 1, 0, 0, 0, TimeSpan.Zero);
            var bucketEnd = bucketStart.AddYears(1);
            var label = year.ToString();

            var created = jobs.Count(j => j.CreatedAtUtc >= bucketStart && j.CreatedAtUtc < bucketEnd);
            var completed = jobs.Count(j =>
                j.Status == JobStatus.Completed
                && j.CompletedAtUtc.HasValue
                && j.CompletedAtUtc >= bucketStart
                && j.CompletedAtUtc < bucketEnd);

            buckets.Add(new TimeSeriesPointResponse(label, created, completed));
        }

        return buckets;
    }

    private static ExecutiveReportResponse EmptyReport() =>
        new(
            Kpi: new ExecutiveKpiResponse(0, 0, 0, 0, 0, 0, 0, 0),
            TimeSeries: [],
            ByChannel: [],
            ByDepartment: []);

    private static string GetChannelColorKey(SocialChannel channel) => channel switch
    {
        SocialChannel.Facebook => "primary",
        SocialChannel.Instagram => "danger",
        SocialChannel.X => "neutral",
        SocialChannel.Email => "info",
        SocialChannel.WebForm => "success",
        SocialChannel.WhatsApp => "success",
        SocialChannel.Phone => "warning",
        _ => "neutral",
    };
}
