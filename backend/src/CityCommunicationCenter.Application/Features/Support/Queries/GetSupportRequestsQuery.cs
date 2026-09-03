namespace CityCommunicationCenter.Application.Features.Support;

public sealed record SupportRequestResponse(
    Guid SupportRequestId,
    string Subject,
    string Message,
    string? PageContext,
    DateTimeOffset CreatedAtUtc,
    string SubmittedByDisplayName);

public sealed record GetSupportRequestsQuery() : IQuery<IReadOnlyList<SupportRequestResponse>>;

public sealed class GetSupportRequestsQueryHandler : IQueryHandler<GetSupportRequestsQuery, IReadOnlyList<SupportRequestResponse>>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public GetSupportRequestsQueryHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<IReadOnlyList<SupportRequestResponse>> Handle(GetSupportRequestsQuery request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();

        var requests = await _dbContext.SupportRequests
            .Where(entity => entity.TenantId == tenantId)
            .OrderByDescending(entity => entity.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        var userIds = requests
            .Where(entity => entity.CreatedByUserId.HasValue)
            .Select(entity => entity.CreatedByUserId!.Value)
            .Distinct()
            .ToList();

        var userNames = userIds.Count > 0
            ? await _dbContext.Users
                .Where(user => userIds.Contains(user.UserId))
                .Select(user => new { user.UserId, user.DisplayName })
                .ToDictionaryAsync(user => user.UserId, user => user.DisplayName, cancellationToken)
            : new Dictionary<Guid, string>();

        return requests.Select(entity => new SupportRequestResponse(
            entity.SupportRequestId,
            entity.Subject,
            entity.Message,
            entity.PageContext,
            entity.CreatedAtUtc,
            entity.CreatedByUserId.HasValue ? userNames.GetValueOrDefault(entity.CreatedByUserId.Value, "—") : "—"
        )).ToList();
    }
}
