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
    string? CitizenPhone = null,
    /// <summary>Birim-dışı pie: Talep Yeri (sahip birim) — Bekleyen/Yapılmakta/Tamamlanan (#2616).</summary>
    string? OwnerDepartmentName = null,
    /// <summary>Talep Oluşturan Birimler pie: Gittiği Yer (#2616).</summary>
    string? DestinationDepartmentName = null,
    /// <summary>Açık (terminal olmayan) görev sayısı — vatandaş İşleme Alındı / Yapılmakta (#2605).</summary>
    int? OpenTaskCount = null);

public sealed record DashboardChartDrilldownResponse(
    IReadOnlyList<DashboardChartDrilldownRow> Rows);

public sealed record CitizenDashboardMapPin(
    Guid JobId,
    string Title,
    string? Neighborhood,
    string? Street,
    string? StreetNo,
    string OpenAddress,
    double? Latitude,
    double? Longitude,
    int? CitizenRequestNumber,
    int? CitizenRequestNumberYear,
    string DisplayStatus,
    DateTimeOffset CreatedAtUtc,
    string? Channel,
    string? DepartmentName,
    string JobStatus,
    DateTimeOffset? DueDateUtc,
    DateTimeOffset? CompletedAtUtc,
    DateTimeOffset? UpdatedAtUtc,
    string? Priority,
    string? CitizenName,
    string? CitizenPhone,
    Guid? SocialMessageId,
    int? JobNumber = null,
    int? JobNumberYear = null,
    string? OwnerDepartmentName = null,
    string? DestinationDepartmentName = null,
    string? LocationMapsUrl = null);

public sealed record CitizenDashboardMapPinsResponse(
    IReadOnlyList<CitizenDashboardMapPin> Pins);

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
    IReadOnlyList<DepartmentStatResponse> ByDepartment,
    IReadOnlyList<NeighborhoodStatResponse> ByNeighborhood);

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

public sealed record NeighborhoodStatResponse(
    string Neighborhood,
    int Total,
    int Completed,
    int InProgress,
    int Processing,
    int Overdue,
    double CompletionRate);
