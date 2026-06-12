namespace CityCommunicationCenter.Application.Features.Notifications;

public sealed record GetNotificationsQuery() : IQuery<IReadOnlyList<NotificationResponse>>;

public sealed class GetNotificationsQueryHandler : IQueryHandler<GetNotificationsQuery, IReadOnlyList<NotificationResponse>>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public GetNotificationsQueryHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<IReadOnlyList<NotificationResponse>> Handle(GetNotificationsQuery request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();

        // Gerçek (push) bildirimleri.
        var notifications = await _dbContext.Notifications
            .AsNoTracking()
            .Where(entity => entity.TenantId == tenantId)
            .OrderByDescending(entity => entity.SentAtUtc)
            .Take(100)
            .Select(entity => new NotificationResponse(
                entity.NotificationId,
                entity.TaskId,
                entity.UserId,
                entity.Channel.ToString(),
                entity.DeliveryStatus.ToString(),
                entity.Title,
                entity.Message,
                entity.IsRead,
                entity.ActionUrl,
                entity.SentAtUtc))
            .ToListAsync(cancellationToken);

        var feed = new List<NotificationResponse>(notifications);

        if (context.UserId.HasValue)
        {
            var userId = context.UserId.Value;

            // Talep ve görev aşamalarındaki tüm değişiklikler denetim kaydından (AuditLog) bildirim olarak yansıtılır:
            // kullanıcının oluşturduğu talepler + atandığı / sahibi olduğu / oluşturduğu görevler.
            var jobIds = await _dbContext.Jobs.AsNoTracking()
                .Where(j => j.TenantId == tenantId && j.CreatedByUserId == userId)
                .Select(j => j.JobId.ToString())
                .ToListAsync(cancellationToken);
            var taskIds = await _dbContext.Tasks.AsNoTracking()
                .Where(t => t.TenantId == tenantId && (t.AssignedUserId == userId || t.OwnerUserId == userId || t.CreatedByUserId == userId))
                .Select(t => t.TaskId.ToString())
                .ToListAsync(cancellationToken);

            var taskIdSet = taskIds.ToHashSet();
            var entityIds = jobIds.Concat(taskIds).Distinct().ToList();

            if (entityIds.Count > 0)
            {
                var logs = await _dbContext.AuditLogs.AsNoTracking()
                    .Where(a => a.TenantId == tenantId && entityIds.Contains(a.EntityId))
                    .OrderByDescending(a => a.EventTimeUtc)
                    .Take(100)
                    .ToListAsync(cancellationToken);

                foreach (var a in logs)
                {
                    var isTask = taskIdSet.Contains(a.EntityId);
                    Guid? taskId = isTask && Guid.TryParse(a.EntityId, out var g) ? g : null;
                    var message = !string.IsNullOrWhiteSpace(a.Notes) ? a.Notes
                        : !string.IsNullOrWhiteSpace(a.Details) ? a.Details
                        : null;
                    if (!string.IsNullOrWhiteSpace(a.ActorDisplayName))
                    {
                        message = string.IsNullOrWhiteSpace(message) ? a.ActorDisplayName : $"{a.ActorDisplayName} — {message}";
                    }

                    feed.Add(new NotificationResponse(
                        a.AuditLogId,
                        taskId,
                        userId,
                        "InApp",
                        "Sent",
                        ActionTitle(a.Action),
                        message ?? string.Empty,
                        true,
                        isTask ? $"/my-tasks?taskId={a.EntityId}" : $"/my-requests?jobId={a.EntityId}",
                        a.EventTimeUtc));
                }
            }
        }

        return feed
            .OrderByDescending(n => n.SentAtUtc)
            .Take(100)
            .ToList();
    }

    private static string ActionTitle(string action) => action switch
    {
        "JobCreated" => "Talep oluşturuldu",
        "JobUpdated" => "Talep güncellendi",
        "JobCancelled" => "Talep iptal edildi",
        "JobDeleted" => "Talep silindi",
        "JobOwnerApproved" => "Talep onaylandı",
        "JobOwnerRejected" => "Talep reddedildi",
        "JobTargetApproved" => "Hedef birim onayladı",
        "JobTargetRejected" => "Hedef birim reddetti",
        "JobReturnRequested" => "Talep iade edildi",
        "JobReturnedToPending" => "Talep onaya geri döndü",
        "TaskCreated" => "Görev oluşturuldu",
        "RoutineTaskCreated" => "Rutin görev oluşturuldu",
        "TaskAssigned" => "Görev atandı",
        "TaskClaimedFromPool" => "Görev havuzdan alındı",
        "TaskProgressUpdated" => "Görev ilerlemesi güncellendi",
        "TaskCompleted" => "Görev tamamlandı",
        "TaskCancelled" => "Görev iptal edildi",
        "TaskRevisionRequested" => "Görev iade edildi (revizyon)",
        "TaskRevisionApproved" => "Revizyon onaylandı",
        "TaskRevisionRejected" => "Revizyon reddedildi",
        "TaskCloseApproved" => "Görev kapatma onaylandı",
        "TaskCloseRejected" => "Görev kapatma reddedildi",
        _ => action,
    };
}
