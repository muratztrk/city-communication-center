using CityCommunicationCenter.Application.Abstractions;

namespace CityCommunicationCenter.Api.Services;

public sealed class OverdueJobSmsPollingHostedService : BackgroundService
{
    private static readonly TimeSpan PollInterval = TimeSpan.FromMinutes(15);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<OverdueJobSmsPollingHostedService> _logger;

    public OverdueJobSmsPollingHostedService(
        IServiceScopeFactory scopeFactory,
        ILogger<OverdueJobSmsPollingHostedService> logger)
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
                var notifier = scope.ServiceProvider.GetRequiredService<IOverdueJobSmsNotifier>();
                await notifier.ProcessOverdueJobsAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Geciken talep SMS arka plan taraması başarısız oldu.");
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
