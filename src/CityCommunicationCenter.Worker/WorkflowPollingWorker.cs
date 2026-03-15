namespace CityCommunicationCenter.Worker;

public sealed class WorkflowPollingWorker : BackgroundService
{
    private readonly ILogger<WorkflowPollingWorker> _logger;

    public WorkflowPollingWorker(ILogger<WorkflowPollingWorker> logger)
    {
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            _logger.LogInformation(
                "Workflow polling worker heartbeat at {TimestampUtc}",
                DateTimeOffset.UtcNow);

            await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
        }
    }
}
