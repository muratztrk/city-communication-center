using CityCommunicationCenter.Application.Features.Users;

namespace CityCommunicationCenter.Application.Features.Auth;

/// <summary>
/// Refresh token'ı sunucudaki oturumla karşılaştırır. Token üzerindeki bilgilere güvenmez: rol ve
/// kullanıcı bilgileri güncel kayıttan okunur. Web oturumuna dokunmaz.
/// </summary>
public sealed record RefreshMobileSessionCommand(
    Guid UserId,
    Guid TenantId,
    Guid MobileSessionId) : ICommand<AuthenticatedTokenPayload?>;

public sealed class RefreshMobileSessionCommandHandler : ICommandHandler<RefreshMobileSessionCommand, AuthenticatedTokenPayload?>
{
    private readonly IApplicationDbContext _dbContext;

    public RefreshMobileSessionCommandHandler(IApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async ValueTask<AuthenticatedTokenPayload?> Handle(RefreshMobileSessionCommand request, CancellationToken cancellationToken)
    {
        var user = await _dbContext.Users
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(
                entity => entity.UserId == request.UserId
                    && entity.TenantId == request.TenantId
                    && entity.IsActive
                    && entity.MobileSessionId == request.MobileSessionId,
                cancellationToken);
        if (user is null)
        {
            return null;
        }

        var tenantName = await _dbContext.Tenants
            .IgnoreQueryFilters()
            .Where(tenant => tenant.TenantId == request.TenantId && tenant.IsActive)
            .Select(tenant => tenant.DisplayName)
            .FirstOrDefaultAsync(cancellationToken);
        if (tenantName is null)
        {
            return null;
        }

        return new AuthenticatedTokenPayload(
            user.UserId,
            user.TenantId,
            user.DepartmentId,
            user.Username,
            user.DisplayName,
            user.Email ?? string.Empty,
            user.RoleCode.ToString(),
            UserRoleAccess.GetAdditionalRoleCodeStrings(user),
            tenantName,
            user.UserSource == UserSource.Manual ? "LocalUser" : "Ldap",
            user.ActiveSessionId ?? Guid.Empty,
            user.MobileSessionId);
    }
}
