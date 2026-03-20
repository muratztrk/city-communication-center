using Microsoft.AspNetCore.Identity;

namespace CityCommunicationCenter.Infrastructure.Services;

internal sealed class LocalUserPasswordService : ILocalUserPasswordService
{
    private readonly PasswordHasher<ApplicationUser> _passwordHasher = new();

    public string HashPassword(ApplicationUser user, string password)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(password);
        return _passwordHasher.HashPassword(user, password);
    }

    public bool VerifyPassword(ApplicationUser user, string password)
    {
        if (string.IsNullOrWhiteSpace(user.PasswordHash) || string.IsNullOrWhiteSpace(password))
        {
            return false;
        }

        var result = _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, password);
        return result is PasswordVerificationResult.Success or PasswordVerificationResult.SuccessRehashNeeded;
    }
}