using CityCommunicationCenter.Domain.Entities;
using CityCommunicationCenter.Infrastructure.Services;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace CityCommunicationCenter.Infrastructure.Persistence.Interceptors;

public sealed class AuditLogSyslogInterceptor : SaveChangesInterceptor
{
    private readonly IServiceProvider _services;
    // AsyncLocal: SaveChangesAsync kayıt sonrası başka bir thread'de devam edebilir.
    // ThreadLocal o devamda boş kalır ve denetim satırı syslog'a hiç gitmez.
    private static readonly AsyncLocal<List<AuditLog>?> PendingLogs = new();

    public AuditLogSyslogInterceptor(IServiceProvider services)
    {
        _services = services;
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        Capture(eventData);
        return ValueTask.FromResult(result);
    }

    public override InterceptionResult<int> SavingChanges(
        DbContextEventData eventData,
        InterceptionResult<int> result)
    {
        Capture(eventData);
        return result;
    }

    public override async ValueTask<int> SavedChangesAsync(
        SaveChangesCompletedEventData eventData,
        int result,
        CancellationToken cancellationToken = default)
    {
        await ForwardPendingAsync();
        return result;
    }

    public override int SavedChanges(SaveChangesCompletedEventData eventData, int result)
    {
        ForwardPendingAsync().GetAwaiter().GetResult();
        return result;
    }

    public override void SaveChangesFailed(DbContextErrorEventData eventData)
    {
        PendingLogs.Value?.Clear();
    }

    public override Task SaveChangesFailedAsync(DbContextErrorEventData eventData, CancellationToken cancellationToken = default)
    {
        PendingLogs.Value?.Clear();
        return Task.CompletedTask;
    }

    private static void Capture(DbContextEventData eventData)
    {
        if (eventData.Context is null) return;

        var newLogs = eventData.Context.ChangeTracker.Entries<AuditLog>()
            .Where(e => e.State == Microsoft.EntityFrameworkCore.EntityState.Added)
            .Select(e => e.Entity)
            .ToList();
        if (newLogs.Count == 0) return;

        var pending = PendingLogs.Value ?? [];
        pending.AddRange(newLogs);
        PendingLogs.Value = pending;
    }

    private async Task ForwardPendingAsync()
    {
        var logs = PendingLogs.Value;
        if (logs is null || logs.Count == 0) return;

        var batch = logs.ToArray();
        logs.Clear();

        try
        {
            using var scope = _services.CreateScope();
            var forwarder = scope.ServiceProvider.GetRequiredService<ISyslogForwarderService>();
            foreach (var log in batch)
            {
                // İstek iptal olsa da kayıt yazıldıysa syslog anında gitsin.
                await forwarder.ForwardAuditLogAsync(log, CancellationToken.None);
            }
        }
        catch
        {
            // Syslog iletimi iş kaydını düşürmez.
        }
    }
}
