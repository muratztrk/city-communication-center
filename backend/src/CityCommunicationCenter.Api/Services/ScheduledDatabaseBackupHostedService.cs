using CityCommunicationCenter.Application.Abstractions;

namespace CityCommunicationCenter.Api.Services;

public sealed class ScheduledDatabaseBackupHostedService : BackgroundService
{
    private static readonly TimeSpan PollInterval = TimeSpan.FromMinutes(1);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<ScheduledDatabaseBackupHostedService> _logger;

    public ScheduledDatabaseBackupHostedService(
        IServiceScopeFactory scopeFactory,
        ILogger<ScheduledDatabaseBackupHostedService> logger)
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
                using var scope = _scopeFactory.CreateScope();
                var settings = scope.ServiceProvider.GetRequiredService<ITenantFileStorageSettingsService>();
                await settings.ProcessScheduledDatabaseBackupsAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Zamanlı veritabanı yedeği taraması başarısız oldu.");
            }

            try
            {
                await Task.Delay(PollInterval, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
        }
    }
}
