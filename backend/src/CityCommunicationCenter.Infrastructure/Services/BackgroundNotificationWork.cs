namespace CityCommunicationCenter.Infrastructure.Services;

internal static class BackgroundNotificationWork
{
    public static Task Enqueue(ILogger logger, string operation, Func<Task> work)
    {
        _ = Task.Run(async () =>
        {
            try
            {
                await work();
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Arka plan bildirimi başarısız oldu. {Operation}", operation);
            }
        });
        return Task.CompletedTask;
    }
}
