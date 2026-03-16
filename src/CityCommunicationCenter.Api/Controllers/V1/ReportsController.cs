using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Domain.Enums;
using CityCommunicationCenter.Infrastructure.Persistence;
using CityCommunicationCenter.Shared.Contracts;
using Microsoft.AspNetCore.Mvc;
using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Api.Controllers.V1;

[Route("api/v1/reports")]
public sealed class ReportsController : ApiControllerBase
{
    private static readonly WorkflowTaskStatus[] OpenTaskStatuses =
    [
        WorkflowTaskStatus.Draft,
        WorkflowTaskStatus.PendingApproval,
        WorkflowTaskStatus.Assigned,
        WorkflowTaskStatus.InProgress
    ];

    private readonly CityCommunicationCenterDbContext _dbContext;

    public ReportsController(
        CityCommunicationCenterDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor)
        : base(tenantContextAccessor)
    {
        _dbContext = dbContext;
    }

    [HttpGet("dashboard")]
    public async Task<ActionResult<DashboardResponse>> GetDashboard(CancellationToken cancellationToken)
    {
        if (!TryGetTenantId(out var tenantId, out var error))
        {
            return error;
        }

        var response = new DashboardResponse(
            await CountOpenTasksAsync(tenantId.Value, overdue: null, cancellationToken),
            await _dbContext.CountTasksAsync(tenantId.Value, includeStatus: WorkflowTaskStatus.PendingApproval, ct: cancellationToken),
            await _dbContext.CountSocialMessagesAsync(tenantId.Value, excludeStatus: SocialMessageStatus.Closed, ct: cancellationToken),
            await _dbContext.CountFailedNotificationsAsync(tenantId.Value, cancellationToken));

        return Ok(response);
    }

    [HttpGet("sla")]
    public async Task<ActionResult<SlaReportResponse>> GetSla(CancellationToken cancellationToken)
    {
        if (!TryGetTenantId(out var tenantId, out var error))
        {
            return error;
        }

        var response = new SlaReportResponse(
            await CountOpenTasksAsync(tenantId.Value, overdue: true, cancellationToken),
            await _dbContext.CountTasksDueTodayAsync(tenantId.Value, cancellationToken));

        return Ok(response);
    }

    [HttpGet("workload")]
    public async Task<ActionResult<IEnumerable<WorkloadReportItemResponse>>> GetWorkload(CancellationToken cancellationToken)
    {
        if (!TryGetTenantId(out var tenantId, out var error))
        {
            return error;
        }

        var workload = await _dbContext.GetWorkloadByDepartmentAsync(tenantId.Value, cancellationToken);
        var response = workload.Select(w => new WorkloadReportItemResponse(w.DeptId, w.Count)).ToList();

        return Ok(response);
    }

    private async Task<int> CountOpenTasksAsync(Guid tenantId, bool? overdue, CancellationToken cancellationToken)
    {
        var total = 0;
        foreach (var status in OpenTaskStatuses)
        {
            total += await _dbContext.CountTasksAsync(
                tenantId,
                includeStatus: status,
                overdue: overdue,
                ct: cancellationToken);
        }

        return total;
    }

    [HttpGet("social-trends")]
    public async Task<ActionResult<IEnumerable<SocialTrendReportItemResponse>>> GetSocialTrends(CancellationToken cancellationToken)
    {
        if (!TryGetTenantId(out var tenantId, out var error))
        {
            return error;
        }

        var trends = await _dbContext.GetSocialTrendsAsync(tenantId.Value, cancellationToken);
        var response = trends.Select(t => new SocialTrendReportItemResponse(t.Channel, t.Count)).ToList();

        return Ok(response);
    }
}
