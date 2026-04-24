namespace CityCommunicationCenter.Application.Features.Admin;

public sealed record UpdateTenantLdapSettingsCommand(
    Guid TenantId,
    bool Enabled,
    string? Host,
    int Port,
    bool UseSsl,
    bool IgnoreCertificateErrors,
    string? Domain,
    string? SearchBase,
    string? BindDn,
    string? BindPassword,
    bool ClearBindPassword,
    string? UserAttribute) : ICommand<Unit>;

public sealed class UpdateTenantLdapSettingsCommandHandler : ICommandHandler<UpdateTenantLdapSettingsCommand, Unit>
{
    private readonly ITenantLdapSettingsService _tenantLdapSettingsService;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public UpdateTenantLdapSettingsCommandHandler(
        ITenantLdapSettingsService tenantLdapSettingsService,
        ITenantContextAccessor tenantContextAccessor)
    {
        _tenantLdapSettingsService = tenantLdapSettingsService;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<Unit> Handle(UpdateTenantLdapSettingsCommand request, CancellationToken cancellationToken)
    {
        await _tenantLdapSettingsService.SaveSettingsAsync(
            request.TenantId,
            new TenantLdapSettingsUpdate(
                request.Enabled,
                request.Host,
                request.Port,
                request.UseSsl,
                request.IgnoreCertificateErrors,
                request.Domain,
                request.SearchBase,
                request.BindDn,
                request.BindPassword,
                request.ClearBindPassword,
                request.UserAttribute),
            _tenantContextAccessor.GetCurrent().UserId,
            cancellationToken);

        return Unit.Value;
    }
}