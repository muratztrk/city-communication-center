namespace CityCommunicationCenter.Application.Abstractions.Identity;

public interface IAuthenticationExchangeTicketService
{
    Task<PasswordGrantExchangeCredentials> CreateAsync(
        Guid tenantId,
        Guid userId,
        string authenticationMode,
        CancellationToken cancellationToken = default);

    Task<AuthenticatedUserDescriptor?> ConsumeAsync(
        Guid tenantId,
        string username,
        string password,
        CancellationToken cancellationToken = default);
}

public sealed record PasswordGrantExchangeCredentials(string Username, string Password);