namespace CityCommunicationCenter.Application.Features.Me;

public sealed record GetUserQuickReplyTemplatesQuery : IQuery<IReadOnlyList<UserQuickReplyTemplateResponse>>;

public sealed class GetUserQuickReplyTemplatesQueryHandler
    : IQueryHandler<GetUserQuickReplyTemplatesQuery, IReadOnlyList<UserQuickReplyTemplateResponse>>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public GetUserQuickReplyTemplatesQueryHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<IReadOnlyList<UserQuickReplyTemplateResponse>> Handle(
        GetUserQuickReplyTemplatesQuery request,
        CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var userId = context.UserId ?? throw new ForbiddenAccessException("Oturum gerekli.");

        return await _dbContext.UserQuickReplyTemplates
            .AsNoTracking()
            .Where(entity => entity.TenantId == tenantId && entity.UserId == userId)
            .OrderBy(entity => entity.Name)
            .Select(entity => new UserQuickReplyTemplateResponse(entity.TemplateId, entity.Name, entity.Content))
            .ToListAsync(cancellationToken);
    }
}
