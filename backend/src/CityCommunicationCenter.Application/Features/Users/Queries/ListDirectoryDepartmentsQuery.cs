using Microsoft.Extensions.Localization;

namespace CityCommunicationCenter.Application.Features.Users;

public sealed record ListDirectoryDepartmentsQuery : IQuery<IReadOnlyList<string>>;

public sealed class ListDirectoryDepartmentsQueryHandler : IQueryHandler<ListDirectoryDepartmentsQuery, IReadOnlyList<string>>
{
    private readonly ITenantContextAccessor _tenantContextAccessor;
    private readonly ILdapAuthenticationService _ldapAuthenticationService;
    private readonly ITenantLdapSettingsService _tenantLdapSettingsService;
    private readonly IStringLocalizer<ApplicationResource> _localizer;

    public ListDirectoryDepartmentsQueryHandler(
        ITenantContextAccessor tenantContextAccessor,
        ILdapAuthenticationService ldapAuthenticationService,
        ITenantLdapSettingsService tenantLdapSettingsService,
        IStringLocalizer<ApplicationResource> localizer)
    {
        _tenantContextAccessor = tenantContextAccessor;
        _ldapAuthenticationService = ldapAuthenticationService;
        _tenantLdapSettingsService = tenantLdapSettingsService;
        _localizer = localizer;
    }

    public async ValueTask<IReadOnlyList<string>> Handle(ListDirectoryDepartmentsQuery request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();
        var ldapSettings = await _tenantLdapSettingsService.GetSettingsAsync(tenantId, cancellationToken);
        if (!ldapSettings.CanSearch)
        {
            throw new ValidationException(_localizer["ValidationLdapSearchUnavailable"]);
        }

        return await _ldapAuthenticationService.ListDepartmentNamesAsync(tenantId, cancellationToken);
    }
}
