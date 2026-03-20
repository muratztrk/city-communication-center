namespace CityCommunicationCenter.Application.Features.Admin;

public sealed record GetTenantSettingsQuery(Guid TenantId) : IQuery<TenantSettingsResponse?>;

public sealed class GetTenantSettingsQueryHandler : IRequestHandler<GetTenantSettingsQuery, TenantSettingsResponse?>
{
    private readonly IApplicationDbContext _dbContext;

    public GetTenantSettingsQueryHandler(IApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<TenantSettingsResponse?> Handle(GetTenantSettingsQuery request, CancellationToken cancellationToken)
    {
        var settings = await _dbContext.TenantSettings
            .FirstOrDefaultAsync(entity => entity.TenantId == request.TenantId, cancellationToken);

        return settings is null
            ? null
            : new TenantSettingsResponse(
                settings.TenantId,
                settings.DisplayName,
                settings.Theme,
                settings.Domain,
                settings.DefaultSlaHours);
    }
}