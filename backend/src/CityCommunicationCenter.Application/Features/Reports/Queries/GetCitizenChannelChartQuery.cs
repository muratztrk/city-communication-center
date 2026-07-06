using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Application.Features.Users;
using CityCommunicationCenter.Domain.Enums;
using CityCommunicationCenter.Shared.Contracts;
using Microsoft.EntityFrameworkCore;

namespace CityCommunicationCenter.Application.Features.Reports;

public sealed record GetCitizenChannelChartQuery(DateTimeOffset? FromUtc, DateTimeOffset? ToUtc)
    : IQuery<DashboardChartResponse>;

public sealed class GetCitizenChannelChartQueryHandler
    : IQueryHandler<GetCitizenChannelChartQuery, DashboardChartResponse>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public GetCitizenChannelChartQueryHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<DashboardChartResponse> Handle(
        GetCitizenChannelChartQuery request,
        CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var roleCode = context.RoleCode;

        // Only dashboard roles that handle/report citizen requests may access this chart.
        if (roleCode is not ("SystemAdmin" or "Manager" or "Operator" or "Reporter"))
        {
            return new DashboardChartResponse("dashboard.citizenChannels.title", []);
        }

        var linkedCitizenMessages = _dbContext.SocialMessages
            .AsNoTracking()
            .Where(sm => sm.TenantId == tenantId
                && sm.JobId.HasValue
                && sm.CitizenRequestNumber != null);

        var linkedCitizenJobIds = linkedCitizenMessages.Select(sm => sm.JobId!.Value);

        var citizenJobs = _dbContext.Jobs
            .AsNoTracking()
            .Where(j => j.TenantId == tenantId
                && (j.RequestType == JobRequestType.Citizen
                    || j.SourceType == JobSourceType.SocialMessage
                    || j.SourceType == JobSourceType.CitizenRequest
                    || j.SourceType == JobSourceType.EDevlet
                    || linkedCitizenJobIds.Contains(j.JobId))
                && (!request.FromUtc.HasValue || j.CreatedAtUtc >= request.FromUtc.Value)
                && (!request.ToUtc.HasValue || j.CreatedAtUtc <= request.ToUtc.Value));

        if (roleCode == "Manager")
        {
            if (!context.UserId.HasValue)
            {
                return new DashboardChartResponse("dashboard.citizenChannels.title", []);
            }

            var actor = await _dbContext.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.UserId == context.UserId.Value && u.TenantId == tenantId && u.IsActive, cancellationToken);
            var scopedDepartmentIds = actor is null
                ? []
                : await UserDepartmentAccess.GetScopedDepartmentIdsAsync(
                    _dbContext,
                    tenantId,
                    actor,
                    context.ActiveDepartmentId,
                    cancellationToken);

            if (scopedDepartmentIds.Length == 0)
            {
                return new DashboardChartResponse("dashboard.citizenChannels.title", []);
            }

            citizenJobs = citizenJobs.Where(j => scopedDepartmentIds.Contains(j.OwnerDepartmentId)
                || _dbContext.JobDepartments.Any(jd => jd.JobId == j.JobId
                    && jd.Role == JobDepartmentRole.Target
                    && scopedDepartmentIds.Contains(jd.DepartmentId)));
        }

        // VT numbers live on SocialMessage; use the JobId link as the canonical channel source.
        var socialCounts = await linkedCitizenMessages
            .Join(
                citizenJobs,
                sm => sm.JobId!.Value,
                j => j.JobId,
                (sm, _) => sm.Channel)
            .GroupBy(ch => ch)
            .Select(g => new { Channel = g.Key, Count = g.Count() })
            .ToListAsync(cancellationToken);

        // Other VT jobs without a SocialMessage channel — group by SourceType (Manual / CitizenRequest / Integration / EDevlet)
        var otherCounts = await citizenJobs
            .Where(j => !linkedCitizenMessages.Any(sm => sm.JobId == j.JobId))
            .GroupBy(j => j.SourceType)
            .Select(g => new { SourceType = g.Key, Count = g.Count() })
            .ToListAsync(cancellationToken);

        var slices = new List<DashboardChartSlice>();

        foreach (var item in socialCounts.OrderByDescending(x => x.Count))
        {
            slices.Add(new DashboardChartSlice(
                $"channel.{item.Channel}",
                item.Count,
                GetSocialChannelColor(item.Channel)));
        }

        foreach (var item in otherCounts.OrderByDescending(x => x.Count))
        {
            slices.Add(new DashboardChartSlice(
                $"sourceType.{item.SourceType}",
                item.Count,
                GetSourceTypeColor(item.SourceType)));
        }

        return new DashboardChartResponse("dashboard.citizenChannels.title", slices);
    }

    private static string GetSocialChannelColor(SocialChannel channel) => channel switch
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

    private static string GetSourceTypeColor(JobSourceType sourceType) => sourceType switch
    {
        JobSourceType.Manual => "neutral",
        JobSourceType.CitizenRequest => "info",
        JobSourceType.Integration => "primary",
        JobSourceType.EDevlet => "success",
        _ => "neutral",
    };
}
