namespace CityCommunicationCenter.Application.Features.Social;

public sealed record GetRequestTagsQuery : IQuery<IReadOnlyList<RequestTagResponse>>;

public sealed class GetRequestTagsQueryHandler
    : IQueryHandler<GetRequestTagsQuery, IReadOnlyList<RequestTagResponse>>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public GetRequestTagsQueryHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<IReadOnlyList<RequestTagResponse>> Handle(
        GetRequestTagsQuery request,
        CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();

        return await _dbContext.RequestTags
            .AsNoTracking()
            .Where(entity => entity.TenantId == tenantId)
            .OrderBy(entity => entity.Name)
            .Select(entity => new RequestTagResponse(entity.TagId, entity.Name))
            .ToListAsync(cancellationToken);
    }
}
