using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Domain.Entities;
using Microsoft.Extensions.DependencyInjection;

namespace CityCommunicationCenter.Infrastructure.Services;

/// <summary>
/// Talep/görev oluşturma HTTP yanıtını SMTP el sıkışmasına bağlamaz (#3948).
/// Geciken tarama zaten arka plan servisindedir; orada gerçek gönderim beklenir.
/// </summary>
internal sealed class DispatchingJobMailNotifier : IJobMailNotifier
{
    private readonly JobMailNotifier _inner;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<DispatchingJobMailNotifier> _logger;

    public DispatchingJobMailNotifier(
        JobMailNotifier inner,
        IServiceScopeFactory scopeFactory,
        ILogger<DispatchingJobMailNotifier> logger)
    {
        _inner = inner;
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    public Task NotifyIncomingAsync(
        Job job,
        IReadOnlyCollection<Guid> departmentIds,
        Guid? actorUserId = null,
        CancellationToken cancellationToken = default)
    {
        var jobId = job.JobId;
        var tenantId = job.TenantId;
        var departments = departmentIds.ToArray();
        return BackgroundNotificationWork.Enqueue(
            _logger,
            $"incoming-mail JobId={jobId}",
            async () =>
            {
                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();
                var inner = scope.ServiceProvider.GetRequiredService<JobMailNotifier>();
                var loaded = await db.Jobs
                    .IgnoreQueryFilters()
                    .FirstOrDefaultAsync(
                        entity => entity.JobId == jobId && entity.TenantId == tenantId,
                        CancellationToken.None);
                if (loaded is null)
                {
                    return;
                }

                await inner.NotifyIncomingAsync(loaded, departments, actorUserId, CancellationToken.None);
            });
    }

    public Task NotifyTaskAssignedAsync(
        Job job,
        Guid assigneeUserId,
        Guid? assignedDepartmentId,
        Guid? actorUserId = null,
        CancellationToken cancellationToken = default)
    {
        var jobId = job.JobId;
        var tenantId = job.TenantId;
        return BackgroundNotificationWork.Enqueue(
            _logger,
            $"assignment-mail JobId={jobId} AssigneeUserId={assigneeUserId}",
            async () =>
            {
                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();
                var inner = scope.ServiceProvider.GetRequiredService<JobMailNotifier>();
                var loaded = await db.Jobs
                    .IgnoreQueryFilters()
                    .FirstOrDefaultAsync(
                        entity => entity.JobId == jobId && entity.TenantId == tenantId,
                        CancellationToken.None);
                if (loaded is null)
                {
                    return;
                }

                await inner.NotifyTaskAssignedAsync(
                    loaded,
                    assigneeUserId,
                    assignedDepartmentId,
                    actorUserId,
                    CancellationToken.None);
            });
    }

    public Task ProcessOverdueMailsAsync(CancellationToken cancellationToken = default) =>
        _inner.ProcessOverdueMailsAsync(cancellationToken);
}
