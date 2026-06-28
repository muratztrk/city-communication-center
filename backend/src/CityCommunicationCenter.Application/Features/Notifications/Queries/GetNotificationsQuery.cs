namespace CityCommunicationCenter.Application.Features.Notifications;

using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

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

            // Tek tek okunmuş geçmiş bildirimler (imleç değil, tekil işaret) okundu görünür (card 633).
            var readAuditIds = (await _dbContext.NotificationAuditReads.AsNoTracking()
                .Where(entry => entry.TenantId == tenantId && entry.UserId == userId)
                .Select(entry => entry.AuditLogId)
                .ToListAsync(cancellationToken))
                .ToHashSet();

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
                .Where(j => j.TenantId == tenantId && (
                    j.CreatedByUserId == userId
                    || managerJobIds.Contains(j.JobId)
                    || _dbContext.Tasks.Any(task => task.JobId == j.JobId
                        && (task.AssignedUserId == userId || task.OwnerUserId == userId))))
                .Select(j => new { JobGuid = j.JobId, JobId = j.JobId.ToString(), j.Title, j.JobNumber, j.JobNumberYear })
                .ToListAsync(cancellationToken);
            var taskRecords = await _dbContext.Tasks.AsNoTracking()
                .Where(t => t.TenantId == tenantId && (t.AssignedUserId == userId || t.OwnerUserId == userId || t.CreatedByUserId == userId || managerTaskIds.Contains(t.TaskId)))
                .Select(t => new { TaskGuid = t.TaskId, TaskId = t.TaskId.ToString(), t.Title, t.TaskNumber, t.TaskNumberYear, JobGuid = t.JobId, JobId = t.JobId.ToString() })
                .ToListAsync(cancellationToken);

            var jobsById = jobRecords.ToDictionary(j => j.JobId);
            var tasksById = taskRecords.ToDictionary(t => t.TaskId);

            // card #1072/#1078: Talebi Üst Düzey Yönetici (Reporter) ya da Vatandaş Talep Operatörü
            // (Operator) oluşturmuşsa o kullanıcının birim adını bildirim başlık etiketi yap.
            var originTagJobIds = jobRecords.Select(t => t.JobGuid)
                .Concat(taskRecords.Select(t => t.JobGuid))
                .Distinct()
                .ToList();
            var originTagDeptByJobId = originTagJobIds.Count == 0
                ? new Dictionary<Guid, string>()
                : await _dbContext.Jobs.AsNoTracking()
                    .Where(j => j.TenantId == tenantId && originTagJobIds.Contains(j.JobId))
                    .Join(
                        _dbContext.Users.AsNoTracking(),
                        j => j.CreatedByUserId,
                        u => (Guid?)u.UserId,
                        (j, u) => new { JobId = j.JobId, u.RoleCode, u.DepartmentId, u.TenantId })
                    .Where(x => x.TenantId == tenantId && (x.RoleCode == RoleCode.Reporter || x.RoleCode == RoleCode.Operator))
                    .Join(
                        _dbContext.Departments.AsNoTracking(),
                        x => x.DepartmentId,
                        department => department.DepartmentId,
                        (x, department) => new
                        {
                            x.JobId,
                            department.TenantId,
                            DeptName = department.Name,
                        })
                    .Where(x => x.TenantId == tenantId && x.DeptName != null)
                    .ToDictionaryAsync(x => x.JobId, x => x.DeptName!, cancellationToken);
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
                    if (a.ActorUserId == userId)
                    {
                        continue;
                    }

                    if (IsJobStatusSideEffectOfTaskChange(a))
                    {
                        continue;
                    }

                    var isTask = taskIdSet.Contains(a.EntityId);
                    Guid? taskId = isTask && Guid.TryParse(a.EntityId, out var g) ? g : null;

                    string? entityTitle = null;
                    string? entityNumber = null;
                    if (isTask && tasksById.TryGetValue(a.EntityId, out var taskRec))
                    {
                        entityTitle = taskRec.Title;
                        if (taskRec.TaskNumber.HasValue)
                            entityNumber = FormatNumber("G", taskRec.TaskNumber.Value, taskRec.TaskNumberYear);
                    }
                    else if (!isTask && jobsById.TryGetValue(a.EntityId, out var jobRec))
                    {
                        entityTitle = jobRec.Title;
                        if (jobRec.JobNumber.HasValue)
                            entityNumber = $"Talep No: {FormatNumber("T", jobRec.JobNumber.Value, jobRec.JobNumberYear)}";
                    }

                    var messageParts = new List<string>();
                    if (a.Action == "TaskStatusChanged"
                        && !string.IsNullOrWhiteSpace(a.Details)
                        && a.Details.Contains("->", StringComparison.Ordinal))
                    {
                        var transition = a.Details.Split("->", 2, StringSplitOptions.TrimEntries);
                        if (transition.Length == 2)
                        {
                            if (!string.IsNullOrWhiteSpace(entityNumber)) messageParts.Add(entityNumber);
                            if (!string.IsNullOrWhiteSpace(entityTitle)) messageParts.Add(entityTitle);
                            messageParts.Add($"{FormatTaskStatusLabel(transition[0])} -> {FormatTaskStatusLabel(transition[1])}");
                        }
                    }
                    else
                    {
                        if (!string.IsNullOrWhiteSpace(a.ActorDisplayName)) messageParts.Add(a.ActorDisplayName);
                        if (!string.IsNullOrWhiteSpace(entityNumber)) messageParts.Add(entityNumber);
                        if (!string.IsNullOrWhiteSpace(entityTitle)) messageParts.Add(entityTitle);
                        var noteDetail = FormatNote(!string.IsNullOrWhiteSpace(a.Notes) ? a.Notes : a.Details);
                        if (!string.IsNullOrWhiteSpace(noteDetail)) messageParts.Add(noteDetail);
                    }

                    // İmleçten sonraki ve kullanıcının kendi yapmadığı olaylar okunmamış (rozette sayılır).
                    // Tek tıkla okunabilir (tekil işaret, card 633) veya "Hepsini okundu yap" ile imleç
                    // toplu ilerletilir (card 634).
                    var isHistoricalRead = a.EventTimeUtc <= readThroughUtc
                        || a.ActorUserId == userId
                        || readAuditIds.Contains(a.AuditLogId);

                    string? titleTag = null;
                    if (isTask && IsTaskStatusChange(a)
                        && tasksById.TryGetValue(a.EntityId, out var tagTask))
                    {
                        originTagDeptByJobId.TryGetValue(tagTask.JobGuid, out titleTag);
                    }
                    else if (!isTask && jobsById.TryGetValue(a.EntityId, out var tagJob))
                    {
                        originTagDeptByJobId.TryGetValue(tagJob.JobGuid, out titleTag);
                    }

                    feed.Add(new NotificationResponse(
                        a.AuditLogId,
                        taskId,
                        userId,
                        "InApp",
                        "Sent",
                        ResolveActionTitle(a),
                        string.Join(" — ", messageParts),
                        isHistoricalRead,
                        isTask
                            ? $"/my-tasks?taskId={a.EntityId}"
                            : $"/my-requests?jobId={a.EntityId}",
                        a.EventTimeUtc,
                        IsHistorical: true,
                        TitleTag: titleTag));
                }
            }
        }

        return feed
            .OrderByDescending(n => n.SentAtUtc)
            .Take(100)
            .ToList();
    }

    // Görev durumu değişikliği bildirimi mi (Görev Durumu Değişti / Tamamlandı / İptal Edildi) — card #1072.
    private static bool IsTaskStatusChange(AuditLog audit) =>
        audit.EntityType == nameof(WorkTask)
        && (audit.Action is "TaskStatusChanged" or "TaskCompleted" or "TaskCancelled"
            || audit.StatusAtEvent == WorkflowTaskStatus.Completed.ToString()
            || audit.StatusAtEvent == WorkflowTaskStatus.Cancelled.ToString());

    private static bool IsJobStatusSideEffectOfTaskChange(AuditLog audit) =>
        audit.EntityType == nameof(Job)
        && !string.IsNullOrWhiteSpace(audit.Notes)
        && (audit.Notes.Contains("Görev durumu değişikliği sonucu talep durumu güncellendi", StringComparison.Ordinal)
            || audit.Notes.Contains("Görev iptali sonucu talep durumu güncellendi", StringComparison.Ordinal));

    private static string ResolveActionTitle(AuditLog audit) =>
        audit.Action switch
        {
            "TaskCompleted" => "Görev Tamamlandı",
            "TaskCancelled" => "Görev İptal Edildi",
            _ when audit.EntityType == nameof(WorkTask)
                && audit.StatusAtEvent == WorkflowTaskStatus.Completed.ToString() => "Görev Tamamlandı",
            _ when audit.EntityType == nameof(WorkTask)
                && audit.StatusAtEvent == WorkflowTaskStatus.Cancelled.ToString() => "Görev İptal Edildi",
            _ => ActionTitle(audit.Action),
        };

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
        "JobManagerNoteAdded" => "Yönetici notu eklendi",
        "JobManagerNoteDeleted" => "Yönetici notu silindi",
        "TaskCreated" => "Görev oluşturuldu",
        "RoutineTaskCreated" => "Rutin görev oluşturuldu",
        "TaskAssigned" => "Görev atandı",
        "TaskClaimedFromPool" => "Görev havuzdan alındı",
        "TaskProgressUpdated" => "Görev ilerlemesi güncellendi",
        "TaskCompleted" => "Görev Tamamlandı",
        "TaskCancelled" => "Görev İptal Edildi",
        "TaskRevisionRequested" => "Görev iade edildi",
        "TaskExtraTimeRequested" => "Ek süre talebi",
        "TaskRevisionApproved" => "Revizyon onaylandı",
        "TaskExtraTimeApproved" => "Ek süre talebi onaylandı",
        "TaskRevisionRejected" => "Revizyon reddedildi",
        "TaskExtraTimeRejected" => "Ek süre talebi reddedildi",
        "TaskCloseApproved" => "Görev kapatma onaylandı",
        "TaskCloseRejected" => "Görev kapatma reddedildi",
        "TaskStatusChanged" => "Görev Durumu Değişti",
        "JobCompleted" => "Talep Tamamlandı",
        _ => "İşlem gerçekleşti",
    };

    private static string FormatNumber(string prefix, int number, int? year) =>
        year.HasValue ? $"{prefix}-{year}-{number}" : $"{prefix}-{number}";

    private static string FormatTaskStatusLabel(string status) => status switch
    {
        "InProgress" => "Yapılmakta",
        "Completed" => "Tamamlanmış",
        "Cancelled" => "İptal",
        "Assigned" => "Atanmış",
        "Waiting" => "Bekleyen",
        "Rejected" => "Reddedildi",
        _ => status,
    };

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
            trimmed.StartsWith("Status=", StringComparison.OrdinalIgnoreCase) ||
            // Talep onaylanınca "CreatedTasks=N" teknik detayı bildirimde görünmesin (card 641).
            trimmed.StartsWith("CreatedTasks=", StringComparison.OrdinalIgnoreCase))
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

        trimmed = System.Text.RegularExpressions.Regex.Replace(trimmed,
            @"\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\b",
            match => DateTimeOffset.TryParse(match.Value, out var date)
                ? date.ToLocalTime().ToString("dd.MM.yyyy HH:mm")
                : match.Value);

        return trimmed;
    }
}
