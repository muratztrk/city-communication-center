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
    public async Task<ActionResult<ExecutiveReportResponse>> GetExecutiveReport(
        [FromQuery] string period = "monthly",
        [FromQuery] DateTimeOffset? from = null,
        [FromQuery] DateTimeOffset? to = null,
        CancellationToken cancellationToken = default)
    {
        var response = await _sender.Send(new GetExecutiveReportQuery(period, from, to), cancellationToken);
        return Ok(response);
    }
}
