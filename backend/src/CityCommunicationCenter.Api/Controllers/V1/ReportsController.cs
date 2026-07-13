using CityCommunicationCenter.Application.Features.Reports;

namespace CityCommunicationCenter.Api.Controllers.V1;

[Route("api/v1/reports")]
[TenantRequired]
public sealed class ReportsController : ApiControllerBase
{
    private readonly IMediator _sender;

    public ReportsController(IMediator sender)
    {
        _sender = sender;
    }

    [HttpGet("dashboard")]
    public async Task<ActionResult<DashboardResponse>> GetDashboard(
        [FromQuery] DateTimeOffset? from,
        [FromQuery] DateTimeOffset? to,
        CancellationToken cancellationToken)
    {
        var response = await _sender.Send(new GetDashboardQuery(from, to), cancellationToken);
        return Ok(response);
    }

    [HttpGet("dashboard-chart")]
    public async Task<ActionResult<DashboardChartResponse>> GetDashboardChart(
        [FromQuery] DateTimeOffset? from,
        [FromQuery] DateTimeOffset? to,
        CancellationToken cancellationToken)
    {
        var response = await _sender.Send(new GetDashboardChartQuery(from, to), cancellationToken);
        return Ok(response);
    }

    [HttpGet("dashboard-status-charts")]
    public async Task<ActionResult<DashboardStatusChartsResponse>> GetDashboardStatusCharts(
        [FromQuery] DateTimeOffset? from,
        [FromQuery] DateTimeOffset? to,
        CancellationToken cancellationToken,
        [FromQuery] TaskDashboardFilter staffTaskType = TaskDashboardFilter.All,
        [FromQuery] TaskDashboardFilter departmentTaskType = TaskDashboardFilter.All,
        [FromQuery] TaskDashboardFilter myTaskType = TaskDashboardFilter.All,
        [FromQuery] RequestTagDashboardFilter requestTagStatus = RequestTagDashboardFilter.All)
    {
        var response = await _sender.Send(new GetDashboardStatusChartsQuery(
            from, to, staffTaskType, departmentTaskType, myTaskType, requestTagStatus), cancellationToken);
        return Ok(response);
    }

    [HttpGet("dashboard-chart-drilldown")]
    public async Task<ActionResult<DashboardChartDrilldownResponse>> GetDashboardChartDrilldown(
        [FromQuery] string chartKey,
        [FromQuery] string sliceKey,
        [FromQuery] DateTimeOffset? from,
        [FromQuery] DateTimeOffset? to,
        CancellationToken cancellationToken)
    {
        var response = await _sender.Send(
            new GetDashboardChartDrilldownQuery(chartKey ?? string.Empty, sliceKey ?? string.Empty, from, to),
            cancellationToken);
        return Ok(response);
    }

    [HttpGet("sla")]
    public async Task<ActionResult<SlaReportResponse>> GetSla(CancellationToken cancellationToken)
    {
        var response = await _sender.Send(new GetSlaReportQuery(), cancellationToken);
        return Ok(response);
    }

    [HttpGet("workload")]
    public async Task<ActionResult<IEnumerable<WorkloadReportItemResponse>>> GetWorkload(CancellationToken cancellationToken)
    {
        var response = await _sender.Send(new GetWorkloadReportQuery(), cancellationToken);
        return Ok(response);
    }

    [HttpGet("citizen-channels")]
    public async Task<ActionResult<DashboardChartResponse>> GetCitizenChannelChart(
        [FromQuery] DateTimeOffset? from,
        [FromQuery] DateTimeOffset? to,
        CancellationToken cancellationToken)
    {
        var response = await _sender.Send(new GetCitizenChannelChartQuery(from, to), cancellationToken);
        return Ok(response);
    }

    [HttpGet("social-trends")]
    public async Task<ActionResult<IEnumerable<SocialTrendReportItemResponse>>> GetSocialTrends(CancellationToken cancellationToken)
    {
        var response = await _sender.Send(new GetSocialTrendReportQuery(), cancellationToken);
        return Ok(response);
    }

    [HttpGet("executive")]
    [Authorize(Roles = "SystemAdmin,Manager")]
    public async Task<ActionResult<ExecutiveReportResponse>> GetExecutiveReport(
        [FromQuery] string period = "monthly",
        [FromQuery] DateTimeOffset? fromUtc = null,
        [FromQuery] DateTimeOffset? toUtc = null,
        CancellationToken cancellationToken = default)
    {
        var response = await _sender.Send(new GetExecutiveReportQuery(period, fromUtc, toUtc), cancellationToken);
        return Ok(response);
    }
}
