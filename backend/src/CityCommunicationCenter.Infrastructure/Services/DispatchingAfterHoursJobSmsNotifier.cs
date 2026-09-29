using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Domain.Entities;
using Microsoft.Extensions.DependencyInjection;

namespace CityCommunicationCenter.Infrastructure.Services;

/// <summary>
/// Mesai dışı SMS HTTP yanıtını SMS ağ geçidine bağlamaz (#3948).
/// Geciken tarama <see cref="IOverdueJobSmsNotifier"/> üzerinden senkron kalır.
/// </summary>
internal sealed class DispatchingAfterHoursJobSmsNotifier : IAfterHoursJobSmsNotifier
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<DispatchingAfterHoursJobSmsNotifier> _logger;

    public DispatchingAfterHoursJobSmsNotifier(
        IServiceScopeFactory scopeFactory,
        ILogger<DispatchingAfterHoursJobSmsNotifier> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    public Task NotifyJobCreatedAsync(
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
            $"after-hours-created-sms JobId={jobId}",
            async () =>
            {
                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();
                var inner = scope.ServiceProvider.GetRequiredService<AfterHoursJobSmsNotifier>();
                var loaded = await db.Jobs
                    .IgnoreQueryFilters()
                    .FirstOrDefaultAsync(
                        entity => entity.JobId == jobId && entity.TenantId == tenantId,
                        CancellationToken.None);
                if (loaded is null)
                {
                    return;
                }

                await inner.NotifyJobCreatedAsync(loaded, departments, actorUserId, CancellationToken.None);
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
            $"after-hours-assigned-sms JobId={jobId} AssigneeUserId={assigneeUserId}",
            async () =>
            {
                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();
                var inner = scope.ServiceProvider.GetRequiredService<AfterHoursJobSmsNotifier>();
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

    public Task NotifyFirstAssignmentAsync(
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
            $"after-hours-first-assign-sms JobId={jobId} AssigneeUserId={assigneeUserId}",
            async () =>
            {
                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();
                var inner = scope.ServiceProvider.GetRequiredService<AfterHoursJobSmsNotifier>();
                var loaded = await db.Jobs
                    .IgnoreQueryFilters()
                    .FirstOrDefaultAsync(
                        entity => entity.JobId == jobId && entity.TenantId == tenantId,
                        CancellationToken.None);
                if (loaded is null)
                {
                    return;
                }

                await inner.NotifyFirstAssignmentAsync(
                    loaded,
                    assigneeUserId,
                    assignedDepartmentId,
                    actorUserId,
                    CancellationToken.None);
            });
    }
}
