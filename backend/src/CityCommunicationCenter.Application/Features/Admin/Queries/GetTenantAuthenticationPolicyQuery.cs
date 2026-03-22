namespace CityCommunicationCenter.Application.Features.Admin;

public sealed record GetTenantAuthenticationPolicyQuery(Guid TenantId) : IQuery<TenantAuthenticationPolicyResponse?>;

public sealed class GetTenantAuthenticationPolicyQueryHandler : IRequestHandler<GetTenantAuthenticationPolicyQuery, TenantAuthenticationPolicyResponse?>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantAuthenticationPolicyService _tenantAuthenticationPolicyService;

    public GetTenantAuthenticationPolicyQueryHandler(
        IApplicationDbContext dbContext,
        ITenantAuthenticationPolicyService tenantAuthenticationPolicyService)
    {
        _dbContext = dbContext;
        _tenantAuthenticationPolicyService = tenantAuthenticationPolicyService;
    }

    public async Task<TenantAuthenticationPolicyResponse?> Handle(GetTenantAuthenticationPolicyQuery request, CancellationToken cancellationToken)
    {
        var tenantExists = await _dbContext.Tenants
            .AnyAsync(entity => entity.TenantId == request.TenantId, cancellationToken);

        if (!tenantExists)
        {
            return null;
        }

        var settings = await _tenantAuthenticationPolicyService.GetSettingsAsync(request.TenantId, cancellationToken);
        return new TenantAuthenticationPolicyResponse(
            settings.AutomaticSignInEnabled,
            settings.AutomaticSignInMode,
            settings.TrustedNetworkCidrs,
            settings.TrustedProxyCidrs,
            settings.IdentityHeaderName,
            settings.RequireSecondFactorOutsideTrustedNetwork,
            settings.SecondFactorProvider,
            settings.CodeLength,
            settings.CodeTtlSeconds,
            settings.AllowMockCodePreview,
            settings.WebhookUrl,
            settings.CanAttemptAutomaticSignIn,
            settings.CanIssueSecondFactor);
    }
}