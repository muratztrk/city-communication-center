namespace CityCommunicationCenter.Application.Abstractions.Identity;

public interface IUserManagementConfigurationProvider
{
    Task<UserManagementConfiguration> GetConfigurationAsync(Guid tenantId, CancellationToken cancellationToken = default);
}

public sealed record UserManagementConfiguration(bool LocalUsersEnabled, bool LdapEnabled);