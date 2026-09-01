using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Application.Abstractions.Identity;
using CityCommunicationCenter.Application.Features.Users;
using Microsoft.EntityFrameworkCore;

namespace CityCommunicationCenter.Api.Services;

public sealed class LdapDailySyncHostedService : BackgroundService
{
    private static readonly TimeZoneInfo TurkeyTimeZone = ResolveTurkeyTimeZone();

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<LdapDailySyncHostedService> _logger;

    public LdapDailySyncHostedService(
        IServiceScopeFactory scopeFactory,
        ILogger<LdapDailySyncHostedService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await TickAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Günlük LDAP senkron kontrolü başarısız oldu.");
            }

            try
            {
                await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
        }
    }

    private async Task TickAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();
        var ldapSettings = scope.ServiceProvider.GetRequiredService<ITenantLdapSettingsService>();
        var mediator = scope.ServiceProvider.GetRequiredService<IMediator>();
        var now = DateTimeOffset.UtcNow;

        var tenantIds = await dbContext.TenantSettings
            .IgnoreQueryFilters()
            .Select(entity => entity.TenantId)
            .Distinct()
            .ToListAsync(cancellationToken);

        foreach (var tenantId in tenantIds)
        {
            var settings = await ldapSettings.GetRuntimeSettingsAsync(tenantId, cancellationToken);
            if (!settings.Enabled || !settings.CanSearch)
            {
                continue;
            }

            if (!LdapDailySyncSchedule.ShouldRun(
                    now,
                    TurkeyTimeZone,
                    settings.DailySyncEnabled,
                    settings.DailySyncTime,
                    settings.DailySyncLastRunDate))
            {
                continue;
            }

            try
            {
                await mediator.Send(new SyncDirectoryCommand(tenantId), cancellationToken);
                _logger.LogInformation("Günlük LDAP kullanıcı senkronu tamamlandı. TenantId={TenantId}", tenantId);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Günlük LDAP kullanıcı senkronu başarısız oldu. TenantId={TenantId}", tenantId);
            }

            await ldapSettings.MarkDailySyncRanAsync(
                tenantId,
                LdapDailySyncSchedule.TurkeyDate(now, TurkeyTimeZone),
                cancellationToken);
        }
    }

    private static TimeZoneInfo ResolveTurkeyTimeZone()
    {
        foreach (var id in new[] { "Europe/Istanbul", "Turkey Standard Time" })
        {
            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById(id);
            }
            catch (TimeZoneNotFoundException)
            {
            }
            catch (InvalidTimeZoneException)
            {
            }
        }

        return TimeZoneInfo.Utc;
    }
}
