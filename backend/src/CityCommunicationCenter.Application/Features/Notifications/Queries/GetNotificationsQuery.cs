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
            .Where(entity =>
                entity.TenantId == tenantId
                && (!context.UserId.HasValue || entity.UserId == context.UserId.Value))
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

            // "Hepsini okundu yap" imlecinden sonraki (ve aktörün kendisi olmadığı) denetim kayıtları
            // okunmamış sayılır; böylece talep/görev süreçlerindeki değişiklikler rozette uyarı verir (card 634).
            var readThroughUtc = await _dbContext.NotificationReadCursors.AsNoTracking()
                .Where(cursor => cursor.TenantId == tenantId && cursor.UserId == userId)
                .Select(cursor => (DateTimeOffset?)cursor.ReadThroughUtc)
                .FirstOrDefaultAsync(cancellationToken) ?? DateTimeOffset.MinValue;

            // Talep ve görev aşamalarındaki tüm değişiklikler denetim kaydından (AuditLog) bildirim olarak yansıtılır:
            // kullanıcının oluşturduğu talepler + atandığı / sahibi olduğu / oluşturduğu görevler.
            // Ayrıca yöneticinin onayını bekleyen talepler de feed'e eklenir (card 440) — okunmamış
            // sayacıyla tutarlı kalması için aynı NotificationAudience mantığı kullanılır.
            // Yönetilen birimlerin dahil olduğu talep/görevler de feed'e girer (card 541).
            var managerJobIds = await NotificationAudience.GetManagerInvolvedJobIdsAsync(
                _dbContext, tenantId, userId, cancellationToken);
            var managerTaskIds = await NotificationAudience.GetManagerDepartmentTaskIdsAsync(
                _dbContext, tenantId, userId, cancellationToken);
            var jobRecords = await _dbContext.Jobs.AsNoTracking()
                .Where(j => j.TenantId == tenantId && (j.CreatedByUserId == userId || managerJobIds.Contains(j.JobId)))
                .Select(j => new { JobId = j.JobId.ToString(), j.Title, j.JobNumber, j.JobNumberYear })
                .ToListAsync(cancellationToken);
            var taskRecords = await _dbContext.Tasks.AsNoTracking()
                .Where(t => t.TenantId == tenantId && (t.AssignedUserId == userId || t.OwnerUserId == userId || t.CreatedByUserId == userId || managerTaskIds.Contains(t.TaskId)))
                .Select(t => new { TaskId = t.TaskId.ToString(), t.Title, t.TaskNumber, t.TaskNumberYear })
                .ToListAsync(cancellationToken);

            var jobsById = jobRecords.ToDictionary(j => j.JobId);
            var tasksById = taskRecords.ToDictionary(t => t.TaskId);
            var taskIdSet = taskRecords.Select(t => t.TaskId).ToHashSet();
            var entityIds = jobRecords.Select(j => j.JobId).Concat(taskRecords.Select(t => t.TaskId)).Distinct().ToList();

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

                    string? entityTitle = null;
                    string? entityNumber = null;
                    if (isTask && tasksById.TryGetValue(a.EntityId, out var taskRec))
                    {
                        entityTitle = taskRec.Title;
                        if (taskRec.TaskNumber.HasValue)
                            entityNumber = $"Görev No: {FormatNumber("G", taskRec.TaskNumber.Value, taskRec.TaskNumberYear)}";
                    }
                    else if (!isTask && jobsById.TryGetValue(a.EntityId, out var jobRec))
                    {
                        entityTitle = jobRec.Title;
                        if (jobRec.JobNumber.HasValue)
                            entityNumber = $"Talep No: {FormatNumber("T", jobRec.JobNumber.Value, jobRec.JobNumberYear)}";
                    }

                    var messageParts = new List<string>();
                    if (!string.IsNullOrWhiteSpace(a.ActorDisplayName)) messageParts.Add(a.ActorDisplayName);
                    if (!string.IsNullOrWhiteSpace(entityTitle)) messageParts.Add(entityTitle);
                    if (!string.IsNullOrWhiteSpace(entityNumber)) messageParts.Add(entityNumber);
                    var noteDetail = FormatNote(!string.IsNullOrWhiteSpace(a.Notes) ? a.Notes : a.Details);
                    if (!string.IsNullOrWhiteSpace(noteDetail)) messageParts.Add(noteDetail);

                    // İmleçten sonraki ve kullanıcının kendi yapmadığı olaylar okunmamış (rozette sayılır);
                    // tekil olarak okunamaz (IsHistorical), "Hepsini okundu yap" ile topluca okunur (card 634).
                    var isHistoricalRead = a.EventTimeUtc <= readThroughUtc || a.ActorUserId == userId;

                    feed.Add(new NotificationResponse(
                        a.AuditLogId,
                        taskId,
                        userId,
                        "InApp",
                        "Sent",
                        ActionTitle(a.Action),
                        string.Join(" — ", messageParts),
                        isHistoricalRead,
                        isTask
                            ? $"/my-tasks?taskId={a.EntityId}"
                            : $"/my-requests?jobId={a.EntityId}",
                        a.EventTimeUtc,
                        IsHistorical: true));
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
        "JobSupportAdded" => "Destek kaydı eklendi",
        "TaskCreated" => "Görev oluşturuldu",
        "RoutineTaskCreated" => "Rutin görev oluşturuldu",
        "TaskAssigned" => "Görev atandı",
        "TaskClaimedFromPool" => "Görev havuzdan alındı",
        "TaskProgressUpdated" => "Görev ilerlemesi güncellendi",
        "TaskCompleted" => "Görev tamamlandı",
        "TaskCancelled" => "Görev iptal edildi",
        "TaskRevisionRequested" => "Görev iade edildi",
        "TaskRevisionApproved" => "Revizyon onaylandı",
        "TaskRevisionRejected" => "Revizyon reddedildi",
        "TaskCloseApproved" => "Görev kapatma onaylandı",
        "TaskCloseRejected" => "Görev kapatma reddedildi",
        _ => "İşlem gerçekleşti",
    };

    private static string FormatNumber(string prefix, int number, int? year) =>
        year.HasValue ? $"{prefix}-{year}-{number}" : $"{prefix}-{number}";

    // Bildirim mesajlarında kullanıcıya gösterilen denetim notlarını sadeleştirir:
    // teknik/hata ayıklama notlarını gizler, İngilizce ifadeleri Türkçeye çevirir (card 308).
    private static string? FormatNote(string? note)
    {
        if (string.IsNullOrWhiteSpace(note)) return null;
        var trimmed = string.Join(
            " ",
            note.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));

        // Saf teknik/debug notlarını kullanıcıya gösterme.
        if (trimmed.StartsWith("Targets=", StringComparison.OrdinalIgnoreCase) ||
            trimmed.StartsWith("Status=", StringComparison.OrdinalIgnoreCase))
            return null;

        // İngilizce ifadeleri Türkçeleştir.
        if (trimmed.StartsWith("Assigned to:", StringComparison.OrdinalIgnoreCase))
            return "Atanan:" + trimmed["Assigned to:".Length..];

        if (trimmed.StartsWith("Assigned to user", StringComparison.OrdinalIgnoreCase))
            return "Bir personele atandı";

        if (trimmed.Equals("Unassigned (pool)", StringComparison.OrdinalIgnoreCase))
            return "Havuza eklendi";

        if (trimmed.StartsWith("Routine task created", StringComparison.OrdinalIgnoreCase))
            return null;

        if (trimmed.StartsWith("Created after job owner approval", StringComparison.OrdinalIgnoreCase) ||
            trimmed.StartsWith("Created from job owner user selection", StringComparison.OrdinalIgnoreCase))
            return null;

        if (trimmed.StartsWith("Created task", StringComparison.OrdinalIgnoreCase) ||
            trimmed.StartsWith("Created a task", StringComparison.OrdinalIgnoreCase) ||
            trimmed.StartsWith("Task created", StringComparison.OrdinalIgnoreCase) ||
            trimmed.StartsWith("Task was created", StringComparison.OrdinalIgnoreCase))
            return null;

        return trimmed;
    }
}
