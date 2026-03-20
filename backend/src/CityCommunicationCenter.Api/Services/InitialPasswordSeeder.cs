using CityCommunicationCenter.Application.Abstractions.Identity;
using CityCommunicationCenter.Infrastructure.Options;
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

        var seedUserEmails = InitialData.SeedUserEmails;

        var users = await _dbContext.Users
            .Where(user => user.Email != null && seedUserEmails.Contains(user.Email) && string.IsNullOrWhiteSpace(user.PasswordHash))
            .ToListAsync(cancellationToken);

        if (users.Count == 0)
        {
            return;
        }

        foreach (var user in users)
        {
            user.PasswordHash = _passwordService.HashPassword(user, _authenticationOptions.InitialPassword);
            user.UpdatedAtUtc = DateTimeOffset.UtcNow;
            user.UpdatedByUserId = InitialData.AdminUserId;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
    }
}
