using CityCommunicationCenter.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using AuthenticationOptions = CityCommunicationCenter.Infrastructure.Options.AuthenticationOptions;

namespace CityCommunicationCenter.Api.Services;

internal sealed class InitialPasswordSeeder
{
    private readonly CityCommunicationCenterDbContext _dbContext;
    private readonly ILocalUserPasswordService _passwordService;
    private readonly AuthenticationOptions _authenticationOptions;

    public InitialPasswordSeeder(
        CityCommunicationCenterDbContext dbContext,
        ILocalUserPasswordService passwordService,
        IOptions<AuthenticationOptions> authenticationOptions)
    {
        _dbContext = dbContext;
        _passwordService = passwordService;
        _authenticationOptions = authenticationOptions.Value;
    }

    public async Task SeedAsync(CancellationToken cancellationToken = default)
    {
        if (!_authenticationOptions.EnableLocalUsers || string.IsNullOrWhiteSpace(_authenticationOptions.InitialPassword))
        {
            return;
        }

        var seedUsernames = InitialData.SeedLocalUsernames;
        var seedUserIds = seedUsernames.Keys.ToArray();

        var users = await _dbContext.Users
            .Where(user => seedUserIds.Contains(user.UserId))
            .ToListAsync(cancellationToken);

        if (users.Count == 0)
        {
            return;
        }

        var hasChanges = false;

        foreach (var user in users)
        {
            var userChanged = false;

            if (string.IsNullOrWhiteSpace(user.Username) && seedUsernames.TryGetValue(user.UserId, out var username))
            {
                user.Username = username;
                userChanged = true;
            }

            if (string.IsNullOrWhiteSpace(user.PasswordHash))
            {
                user.PasswordHash = _passwordService.HashPassword(user, _authenticationOptions.InitialPassword);
                userChanged = true;
            }

            if (userChanged)
            {
                user.UpdatedAtUtc = DateTimeOffset.UtcNow;
                user.UpdatedByUserId = InitialData.AdminUserId;
                hasChanges = true;
            }
        }

        if (!hasChanges)
        {
            return;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
    }
}
