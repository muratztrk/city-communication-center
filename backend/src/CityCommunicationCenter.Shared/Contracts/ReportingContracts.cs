namespace CityCommunicationCenter.Shared.Contracts;

public sealed record DashboardResponse(
    int OpenTaskCount,
    int PendingApprovalCount,
    int ActiveSocialMessageCount,
    int RejectedOrCancelledRequestCount,
    int UnassignedItemCount,
    // Manager-specific metrics
    int MyPendingRequestCount,
    int OutgoingPendingCount,
    int OutgoingInProgressCount,
    int MyPendingTaskCount,
    int MyPendingTaskNavBadgeCount,
    int DeptPendingTaskCount,
    int MyTotalRequestCount,
    int IncomingTotalCount,
    int OutgoingTotalCount,
    int DeptTotalTaskCount);

public sealed record DashboardChartResponse(
    string TitleKey,
    IReadOnlyList<DashboardChartSlice> Slices);

public sealed record DashboardStatusChartsResponse(
    IReadOnlyList<DashboardChartResponse> Charts);

public sealed record DashboardChartSlice(
    string Label,
    double Value,
    string ColorHint);

public sealed record DashboardChartDrilldownRow(
    Guid JobId,
    int? JobNumber,
    int? JobNumberYear,
    string Title,
    DateTimeOffset CreatedAtUtc,
    string Status,
    string? DepartmentName,
    string? Neighborhood,
    DateTimeOffset? TerminalDateUtc,
    DateTimeOffset? DueDateUtc,
    int? CitizenRequestNumber,
    int? CitizenRequestNumberYear,
    string? SourceChannel = null,
    /// <summary>Talep No altındaki Öncelik satırı — birim pie drilldown (#2070).</summary>
    string? Priority = null,
    /// <summary>Talep Etiketi pie: Birim yerine Vatandaş Adı / Telefon (#6a6c9fed).</summary>
    string? CitizenName = null,
    string? CitizenPhone = null);

public sealed record DashboardChartDrilldownResponse(
    IReadOnlyList<DashboardChartDrilldownRow> Rows);

public sealed record SlaReportResponse(
    int OverdueTaskCount,
    int DueTodayTaskCount);

public sealed record WorkloadReportItemResponse(
    Guid DepartmentId,
    int OpenTaskCount);

public sealed record SocialTrendReportItemResponse(
    string Channel,
    int MessageCount);

// ── Executive Report ─────────────────────────────────────────────────────

public sealed record ExecutiveReportResponse(
    ExecutiveKpiResponse Kpi,
    IReadOnlyList<TimeSeriesPointResponse> TimeSeries,
    IReadOnlyList<ChannelStatResponse> ByChannel,
    IReadOnlyList<DepartmentStatResponse> ByDepartment);

public sealed record ExecutiveKpiResponse(
    int TotalRequests,
    int CompletedRequests,
    double CompletionRate,
    double AvgResolutionHours,
    double SlaComplianceRate,
    int OverdueCount,
    int PendingApprovals,
    int OpenSocialMessages);

public sealed record TimeSeriesPointResponse(
    string Label,
    int Created,
    int Completed);

public sealed record ChannelStatResponse(
    string Channel,
    int Count,
    string ColorKey);

public sealed record DepartmentStatResponse(
    Guid DepartmentId,
    string Name,
    int Total,
    int Completed,
    double CompletionRate,
    int OverdueCount,
    double AvgResolutionHours);
