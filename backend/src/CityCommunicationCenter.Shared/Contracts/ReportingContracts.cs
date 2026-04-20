namespace CityCommunicationCenter.Shared.Contracts;

public sealed record DashboardResponse(
    int OpenTaskCount,
    int PendingApprovalCount,
    int ActiveSocialMessageCount,
    int UnassignedItemCount);

public sealed record DashboardChartResponse(
    string TitleKey,
    IReadOnlyList<DashboardChartSlice> Slices);

public sealed record DashboardChartSlice(
    string Label,
    int Value,
    string ColorHint);

public sealed record SlaReportResponse(
    int OverdueTaskCount,
    int DueTodayTaskCount);

public sealed record WorkloadReportItemResponse(
    Guid DepartmentId,
    int OpenTaskCount);

public sealed record SocialTrendReportItemResponse(
    string Channel,
    int MessageCount);
