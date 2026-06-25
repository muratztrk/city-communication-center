using System.Security.Cryptography;
using CityCommunicationCenter.Application.Features.Users;
using Microsoft.Extensions.Caching.Memory;

namespace CityCommunicationCenter.Infrastructure.Services;

internal sealed class AuthenticationExchangeTicketService : IAuthenticationExchangeTicketService
{
    private const string TicketPrefix = "auth-ticket:";
    private static readonly TimeSpan TicketLifetime = TimeSpan.FromMinutes(2);
    private readonly IMemoryCache _memoryCache;
    private readonly CityCommunicationCenterDbContext _dbContext;

    public AuthenticationExchangeTicketService(IMemoryCache memoryCache, CityCommunicationCenterDbContext dbContext)
    {
        _memoryCache = memoryCache;
        _dbContext = dbContext;
    }

    public Task<PasswordGrantExchangeCredentials> CreateAsync(
        Guid tenantId,
        Guid userId,
        string authenticationMode,
        CancellationToken cancellationToken = default)
    {
        var username = TicketPrefix + Guid.NewGuid().ToString("N");
        var password = GenerateSecret();
        var state = new TicketState(tenantId, userId, authenticationMode, HashSecret(password), DateTimeOffset.UtcNow.Add(TicketLifetime));
        _memoryCache.Set(username, state, state.ExpiresAtUtc);

        return Task.FromResult(new PasswordGrantExchangeCredentials(username, password));
    }

    public async Task<AuthenticatedUserDescriptor?> ConsumeAsync(
        Guid tenantId,
        string username,
        string password,
        CancellationToken cancellationToken = default)
    {
        if (!username.StartsWith(TicketPrefix, StringComparison.Ordinal))
        {
            return null;
        }

        if (!_memoryCache.TryGetValue<TicketState>(username, out var state) || state is null)
        {
            return null;
        }

        if (state.TenantId != tenantId || state.ExpiresAtUtc <= DateTimeOffset.UtcNow || !VerifySecret(password, state.SecretHash))
        {
            return null;
        }

        _memoryCache.Remove(username);
        return await LoadDescriptorAsync(state.TenantId, state.UserId, state.AuthenticationMode, cancellationToken);
    }

    private async Task<AuthenticatedUserDescriptor?> LoadDescriptorAsync(
        Guid tenantId,
        Guid userId,
        string authenticationMode,
        CancellationToken cancellationToken)
    {
        var tenant = await _dbContext.Tenants
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(entity => entity.TenantId == tenantId && entity.IsActive, cancellationToken);
        if (tenant is null)
        {
            return null;
        }

        var user = await _dbContext.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(entity => entity.TenantId == tenantId && entity.UserId == userId && entity.IsActive, cancellationToken);
        if (user is null)
        {
            return null;
        }

        return new AuthenticatedUserDescriptor(
            user.UserId,
            user.TenantId,
            user.DepartmentId,
            user.Username,
            user.DisplayName,
            user.Email ?? string.Empty,
            user.RoleCode.ToString(),
            UserRoleAccess.GetAdditionalRoleCodeStrings(user),
            tenant.DisplayName,
            authenticationMode);
    }

    private static byte[] HashSecret(string value)
    {
        return SHA256.HashData(Encoding.UTF8.GetBytes(value));
    }

    private static bool VerifySecret(string value, byte[] expectedHash)
    {
        var actualHash = SHA256.HashData(Encoding.UTF8.GetBytes(value));
        return CryptographicOperations.FixedTimeEquals(actualHash, expectedHash);
    }

    private static string GenerateSecret()
    {
        return Convert.ToHexString(RandomNumberGenerator.GetBytes(24));
    }

    private sealed record TicketState(
        Guid TenantId,
        Guid UserId,
        string AuthenticationMode,
        byte[] SecretHash,
        DateTimeOffset ExpiresAtUtc);
}