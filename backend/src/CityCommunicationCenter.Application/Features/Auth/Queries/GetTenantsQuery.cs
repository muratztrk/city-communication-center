using CityCommunicationCenter.Application.Common.Tenancy;

namespace CityCommunicationCenter.Application.Features.Auth;

public sealed record GetTenantsQuery() : IQuery<IReadOnlyList<TenantLookupResponse>>;

public sealed class GetTenantsQueryHandler : IRequestHandler<GetTenantsQuery, IReadOnlyList<TenantLookupResponse>>
{
    private readonly IApplicationDbContext _dbContext;

    public GetTenantsQueryHandler(IApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<IReadOnlyList<TenantLookupResponse>> Handle(GetTenantsQuery request, CancellationToken cancellationToken)
    {
        return await _dbContext.Tenants
            .OrderBy(entity => entity.DisplayName)
            .Select(entity => new TenantLookupResponse(
                entity.TenantId,
                entity.MunicipalityName,
                entity.DisplayName,
                entity.DeploymentMode.ToString(),
                TenantDomainNormalizer.Normalize(entity.Domain)))
            .ToListAsync(cancellationToken);
    }
}