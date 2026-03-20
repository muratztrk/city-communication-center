namespace CityCommunicationCenter.Application.Features.Reports;

public sealed record GetSocialTrendReportQuery() : IQuery<IReadOnlyList<SocialTrendReportItemResponse>>;

public sealed class GetSocialTrendReportQueryHandler : IRequestHandler<GetSocialTrendReportQuery, IReadOnlyList<SocialTrendReportItemResponse>>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public GetSocialTrendReportQueryHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async Task<IReadOnlyList<SocialTrendReportItemResponse>> Handle(GetSocialTrendReportQuery request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().TenantId!.Value;
        var trends = await _dbContext.SocialMessages
            .Where(entity => entity.TenantId == tenantId)
            .GroupBy(entity => entity.Channel)
            .Select(group => new SocialTrendReportItemResponse(group.Key.ToString(), group.Count()))
            .ToListAsync(cancellationToken);
        return trends;
    }
}