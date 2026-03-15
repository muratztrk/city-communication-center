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
            await _dbContext.CountTasksAsync(tenantId.Value, excludeStatus: WorkflowTaskStatus.Closed, ct: cancellationToken),
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
            await _dbContext.CountTasksAsync(tenantId.Value, excludeStatus: WorkflowTaskStatus.Closed, overdue: true, ct: cancellationToken),
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
