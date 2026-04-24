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
    public async Task<ActionResult<DashboardResponse>> GetDashboard(CancellationToken cancellationToken)
    {
        var response = await _sender.Send(new GetDashboardQuery(), cancellationToken);
        return Ok(response);
    }

    [HttpGet("dashboard-chart")]
    public async Task<ActionResult<DashboardChartResponse>> GetDashboardChart(CancellationToken cancellationToken)
    {
        var response = await _sender.Send(new GetDashboardChartQuery(), cancellationToken);
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

    [HttpGet("social-trends")]
    public async Task<ActionResult<IEnumerable<SocialTrendReportItemResponse>>> GetSocialTrends(CancellationToken cancellationToken)
    {
        var response = await _sender.Send(new GetSocialTrendReportQuery(), cancellationToken);
        return Ok(response);
    }
}
