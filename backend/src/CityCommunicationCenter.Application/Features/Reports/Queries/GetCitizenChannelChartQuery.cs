using CityCommunicationCenter.Application.Abstractions;
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

        // Social-media-sourced citizen jobs — group by SocialChannel
        var socialCounts = await _dbContext.Jobs
            .AsNoTracking()
            .Where(j => j.TenantId == tenantId
                && j.RequestType == JobRequestType.Citizen
                && j.SourceType == JobSourceType.SocialMessage
                && j.SourceRefId != null
                && (!request.FromUtc.HasValue || j.CreatedAtUtc >= request.FromUtc.Value)
                && (!request.ToUtc.HasValue || j.CreatedAtUtc <= request.ToUtc.Value))
            .Join(
                _dbContext.SocialMessages.AsNoTracking(),
                j => j.SourceRefId,
                sm => (Guid?)sm.SocialMessageId,
                (_, sm) => sm.Channel)
            .GroupBy(ch => ch)
            .Select(g => new { Channel = g.Key, Count = g.Count() })
            .ToListAsync(cancellationToken);

        // Other citizen jobs — group by SourceType (Manual / CitizenRequest / Integration)
        var otherCounts = await _dbContext.Jobs
            .AsNoTracking()
            .Where(j => j.TenantId == tenantId
                && j.RequestType == JobRequestType.Citizen
                && j.SourceType != JobSourceType.SocialMessage
                && (!request.FromUtc.HasValue || j.CreatedAtUtc >= request.FromUtc.Value)
                && (!request.ToUtc.HasValue || j.CreatedAtUtc <= request.ToUtc.Value))
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
        _ => "neutral",
    };
}
