
namespace CityCommunicationCenter.Application.Features.Social;

public sealed record GetSocialMessagesQuery() : IQuery<IReadOnlyList<SocialMessageSummaryResponse>>;

public sealed class GetSocialMessagesQueryHandler : IQueryHandler<GetSocialMessagesQuery, IReadOnlyList<SocialMessageSummaryResponse>>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public GetSocialMessagesQueryHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<IReadOnlyList<SocialMessageSummaryResponse>> Handle(GetSocialMessagesQuery request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();

        return await _dbContext.SocialMessages
            .AsNoTracking()
            .Where(entity => entity.TenantId == tenantId)
            .OrderByDescending(entity => entity.ReceivedAtUtc)
            .Select(entity => new SocialMessageSummaryResponse(
                entity.SocialMessageId,
                entity.Channel.ToString(),
                entity.CitizenHandle,
                entity.Category,
                entity.Status.ToString(),
                entity.AssignedDepartmentId,
                entity.JobId,
                entity.ReceivedAtUtc))
            .ToListAsync(cancellationToken);
    }
}