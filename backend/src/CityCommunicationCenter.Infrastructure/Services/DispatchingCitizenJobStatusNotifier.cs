using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Domain.Entities;
using Microsoft.Extensions.DependencyInjection;

namespace CityCommunicationCenter.Infrastructure.Services;

/// <summary>
/// WA/çağrı talep oluşturma yanıtını vatandaş durum şablonu (Graph/SMS) bekletmesin (#3948).
/// Durum değişimi ve terminal serbest bırakma sonucu beklenir.
/// </summary>
internal sealed class DispatchingCitizenJobStatusNotifier : ICitizenJobStatusNotifier
{
    private readonly CitizenJobStatusNotifier _inner;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<DispatchingCitizenJobStatusNotifier> _logger;

    public DispatchingCitizenJobStatusNotifier(
        CitizenJobStatusNotifier inner,
        IServiceScopeFactory scopeFactory,
        ILogger<DispatchingCitizenJobStatusNotifier> logger)
    {
        _inner = inner;
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    public Task NotifyCreatedAsync(
        Guid tenantId,
        SocialMessage message,
        Job job,
        int taskCount,
        CancellationToken cancellationToken = default)
    {
        var messageId = message.SocialMessageId;
        var jobId = job.JobId;
        return BackgroundNotificationWork.Enqueue(
            _logger,
            $"citizen-created JobId={jobId} SocialMessageId={messageId}",
            async () =>
            {
                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();
                var inner = scope.ServiceProvider.GetRequiredService<CitizenJobStatusNotifier>();
                var loadedMessage = await db.SocialMessages
                    .IgnoreQueryFilters()
                    .FirstOrDefaultAsync(
                        entity => entity.SocialMessageId == messageId && entity.TenantId == tenantId,
                        CancellationToken.None);
                var loadedJob = await db.Jobs
                    .IgnoreQueryFilters()
                    .FirstOrDefaultAsync(
                        entity => entity.JobId == jobId && entity.TenantId == tenantId,
                        CancellationToken.None);
                if (loadedMessage is null || loadedJob is null)
                {
                    return;
                }

                await inner.NotifyCreatedAsync(
                    tenantId,
                    loadedMessage,
                    loadedJob,
                    taskCount,
                    CancellationToken.None);
            });
    }

    public Task NotifyStatusChangedAsync(
        Guid tenantId,
        Guid jobId,
        string previousDisplayStatus,
        CancellationToken cancellationToken = default) =>
        _inner.NotifyStatusChangedAsync(tenantId, jobId, previousDisplayStatus, cancellationToken);

    public Task<bool> ReleaseTerminalMessagesAsync(
        Guid tenantId,
        Guid jobId,
        Guid? routingDepartmentUserId = null,
        CancellationToken cancellationToken = default) =>
        _inner.ReleaseTerminalMessagesAsync(tenantId, jobId, routingDepartmentUserId, cancellationToken);
}
