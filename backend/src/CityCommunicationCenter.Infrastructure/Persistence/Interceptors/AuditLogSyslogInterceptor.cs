using CityCommunicationCenter.Domain.Entities;
using CityCommunicationCenter.Infrastructure.Services;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace CityCommunicationCenter.Infrastructure.Persistence.Interceptors;

public sealed class AuditLogSyslogInterceptor : SaveChangesInterceptor
{
    private readonly IServiceProvider _services;
    // ThreadLocal so concurrent requests don't share the pending list
    private readonly ThreadLocal<List<AuditLog>> _pending = new(() => []);

    public AuditLogSyslogInterceptor(IServiceProvider services)
    {
        _services = services;
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        if (eventData.Context is not null)
        {
            var newLogs = eventData.Context.ChangeTracker.Entries<AuditLog>()
                .Where(e => e.State == Microsoft.EntityFrameworkCore.EntityState.Added)
                .Select(e => e.Entity)
                .ToList();

            _pending.Value!.AddRange(newLogs);
        }

        return ValueTask.FromResult(result);
    }

    public override async ValueTask<int> SavedChangesAsync(
        SaveChangesCompletedEventData eventData,
        int result,
        CancellationToken cancellationToken = default)
    {
        var logs = _pending.Value!;
        if (logs.Count > 0)
        {
            using var scope = _services.CreateScope();
            var forwarder = scope.ServiceProvider.GetRequiredService<ISyslogForwarderService>();
            foreach (var log in logs)
            {
                await forwarder.ForwardAuditLogAsync(log, cancellationToken);
            }
            logs.Clear();
        }

        return result;
    }

    public override void SaveChangesFailed(DbContextErrorEventData eventData)
    {
        _pending.Value!.Clear();
    }

    public override Task SaveChangesFailedAsync(DbContextErrorEventData eventData, CancellationToken cancellationToken = default)
    {
        _pending.Value!.Clear();
        return Task.CompletedTask;
    }
}
