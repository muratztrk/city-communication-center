using CityCommunicationCenter.Domain.Enums;
using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Application.Features.CitizenMessageApprovals;

/// <summary>
/// Terminal vatandaş talebinin görüntülenecek/gönderilecek notunu çözer — tamamlanmışta son
/// tamamlanan görevin notu, iptalde talep iptal nedeni (veya son iptal edilen görevin notu),
/// <c>CitizenJobStatusNotifier.EnqueueTerminalFollowUpsAsync</c> ile aynı öncelik sırasıyla (card #2039).
/// </summary>
internal static class CitizenMessageApprovalNoteResolver
{
    private const string ReleasedAction = "CitizenMessageApprovalReleased";
    private const string ReopenedAction = "CitizenMessageJobReopenedToProcessingReceived";
    private const string CompletionNoteEditedAction = "CitizenMessageApprovalCompletionNoteEdited";
    private const string CancelNoteEditedAction = "CitizenMessageApprovalCancelNoteEdited";
    private const string TaskCompletedAction = "TaskCompleted";

    public static async Task<string?> ResolveAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        Job job,
        CancellationToken cancellationToken)
    {
        if (job.Status == JobStatus.Cancelled)
        {
            if (!string.IsNullOrWhiteSpace(job.CancelReason))
            {
                return job.CancelReason;
            }

            return await dbContext.Tasks
                .AsNoTracking()
                .Where(t => t.TenantId == tenantId
                    && t.JobId == job.JobId
                    && t.CurrentStatus == WorkflowTaskStatus.Cancelled)
                .OrderByDescending(t => t.UpdatedAtUtc)
                .Select(t => t.RevisionReason)
                .FirstOrDefaultAsync(cancellationToken);
        }

        if (job.Status == JobStatus.Completed)
        {
            return await dbContext.Tasks
                .AsNoTracking()
                .Where(t => t.TenantId == tenantId
                    && t.JobId == job.JobId
                    && (t.CompletedAtUtc != null || t.CurrentStatus == WorkflowTaskStatus.Completed))
                .OrderByDescending(t => t.CompletedAtUtc ?? t.UpdatedAtUtc)
                .Select(t => t.Notes)
                .FirstOrDefaultAsync(cancellationToken)
                ?? await dbContext.Tasks
                    .AsNoTracking()
                    .Where(t => t.TenantId == tenantId && t.JobId == job.JobId)
                    .OrderByDescending(t => t.UpdatedAtUtc)
                    .Select(t => t.Notes)
                    .FirstOrDefaultAsync(cancellationToken);
        }

        return null;
    }

    /// <summary>
    /// Yöneticinin "Mesajı Onayla" anındaki onay notu — operatör Sms Onayı / WA düzenlemesi
    /// sonrası görev notu değişse bile Tamamlama Notu olarak sabit kalır (#2528).
    /// Operatör SMS gönderimi ikinci <c>CitizenMessageApprovalReleased</c> yazmış olabilir;
    /// bu yüzden son kayıt değil, mevcut döngüdeki ilk yönetici onayı alınır.
    /// </summary>
    public static async Task<string?> ResolveReleasedApprovalNoteAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        Guid jobId,
        CancellationToken cancellationToken)
    {
        var cycle = await GetCycleBoundsAsync(dbContext, tenantId, jobId, cancellationToken);
        var releasedNote = await QueryReleasedInCycle(dbContext, tenantId, jobId, cycle.ReopenedAt)
            .OrderBy(audit => audit.EventTimeUtc)
            .Select(audit => audit.Notes ?? audit.Details)
            .FirstOrDefaultAsync(cancellationToken);
        if (!string.IsNullOrWhiteSpace(releasedNote))
        {
            return releasedNote.Trim();
        }

        // Çağrı geçmişi: Released audit yokken operatör Sms Onayı task.Notes'u ezer.
        // Tamamlama, personelin/yöneticinin daha eski anlık görüntüsü olmalı.
        var cycleEdits = await QueryNoteEditsInCycle(dbContext, tenantId, jobId, cycle.ReopenedAt)
            .OrderBy(audit => audit.EventTimeUtc)
            .Select(audit => audit.Notes)
            .ToListAsync(cancellationToken);
        var firstEdit = FirstNonEmpty(cycleEdits);
        var lastEdit = LastNonEmpty(cycleEdits);
        if (firstEdit is not null
            && lastEdit is not null
            && !string.Equals(firstEdit, lastEdit, StringComparison.Ordinal))
        {
            return firstEdit;
        }

        var completedSnapshot = await ResolveTaskCompletedSnapshotAsync(
            dbContext, tenantId, jobId, cancellationToken);
        if (!string.IsNullOrWhiteSpace(completedSnapshot)
            && lastEdit is not null
            && !string.Equals(completedSnapshot, lastEdit, StringComparison.Ordinal))
        {
            return completedSnapshot;
        }

        return null;
    }

    /// <summary>
    /// Vatandaş Bilgi Listesi detay popup'ında "Vatandaşa Giden Mesaj" alanı.
    /// WhatsApp: operatör bekleyen balonu düzenler (görev notu değişmez) → konuşma kaydı.
    /// SMS: operatör Sms Onayı'nda Notu Düzenle görev notunu ezer → serbest bırakmadan
    /// <b>sonraki</b> NoteEdited veya iletilen SMS gövdesindeki terminal not.
    /// Canlı <c>task.Notes</c> Tamamlama ile karışmasın diye <see cref="ResolveAsync"/> kullanılmaz.
    /// </summary>
    public static async Task<string?> ResolveOutboundDisplayNoteAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        Job job,
        SocialChannel channel,
        Guid socialMessageId,
        string? responseContent,
        CancellationToken cancellationToken)
    {
        var cycle = await GetCycleBoundsAsync(dbContext, tenantId, job.JobId, cancellationToken);
        var firstReleasedAt = await QueryReleasedInCycle(dbContext, tenantId, job.JobId, cycle.ReopenedAt)
            .OrderBy(audit => audit.EventTimeUtc)
            .Select(audit => (DateTimeOffset?)audit.EventTimeUtc)
            .FirstOrDefaultAsync(cancellationToken);

        var postReleaseEdits = QueryNoteEditsInCycle(dbContext, tenantId, job.JobId, cycle.ReopenedAt);
        if (firstReleasedAt.HasValue)
        {
            var releasedAt = firstReleasedAt.Value;
            postReleaseEdits = postReleaseEdits.Where(audit => audit.EventTimeUtc > releasedAt);
        }

        var lastPostReleaseEdit = await postReleaseEdits
            .OrderByDescending(audit => audit.EventTimeUtc)
            .Select(audit => audit.Notes)
            .FirstOrDefaultAsync(cancellationToken);

        if (channel == SocialChannel.Phone)
        {
            // Operatörün Sms Onayı'nda yazdığı not, iletilen SMS'ten (büyük harf) önce gelir.
            if (!string.IsNullOrWhiteSpace(lastPostReleaseEdit))
            {
                return lastPostReleaseEdit.Trim();
            }

            if (!string.IsNullOrWhiteSpace(responseContent))
            {
                var transmitted = ExtractTrailingTerminalNote(responseContent);
                if (!string.IsNullOrWhiteSpace(transmitted))
                {
                    return transmitted;
                }
            }

            return null;
        }

        if (channel == SocialChannel.WhatsApp)
        {
            var outboundContents = await dbContext.ConversationEntries.AsNoTracking()
                .Where(entry => entry.SocialMessageId == socialMessageId
                    && entry.Direction == ConversationEntryDirection.Outbound
                    && entry.DeliveryStatus != ConversationDeliveryStatus.Failed)
                .OrderByDescending(entry => entry.SentAt)
                .Select(entry => entry.Content)
                .ToListAsync(cancellationToken);

            foreach (var content in outboundContents)
            {
                var transmitted = ExtractTrailingTerminalNote(content);
                if (!string.IsNullOrWhiteSpace(transmitted))
                {
                    return transmitted;
                }
            }
        }

        return string.IsNullOrWhiteSpace(lastPostReleaseEdit) ? null : lastPostReleaseEdit.Trim();
    }

    internal static string? ExtractTrailingTerminalNote(string content)
    {
        var trimmed = content.TrimEnd();
        var separatorIndex = trimmed.LastIndexOf("\n\n", StringComparison.Ordinal);
        if (separatorIndex < 0)
        {
            return null;
        }

        var tail = trimmed[(separatorIndex + 2)..].Trim();
        return string.IsNullOrWhiteSpace(tail) ? null : tail;
    }

    private static async Task<CycleBounds> GetCycleBoundsAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        Guid jobId,
        CancellationToken cancellationToken)
    {
        var entityId = jobId.ToString();
        var reopenedAt = await dbContext.AuditLogs.AsNoTracking()
            .Where(audit => audit.TenantId == tenantId
                && audit.EntityId == entityId
                && audit.Action == ReopenedAction)
            .OrderByDescending(audit => audit.EventTimeUtc)
            .Select(audit => (DateTimeOffset?)audit.EventTimeUtc)
            .FirstOrDefaultAsync(cancellationToken);
        return new CycleBounds(reopenedAt);
    }

    private static IQueryable<AuditLog> QueryReleasedInCycle(
        IApplicationDbContext dbContext,
        Guid tenantId,
        Guid jobId,
        DateTimeOffset? reopenedAt)
    {
        var entityId = jobId.ToString();
        var released = dbContext.AuditLogs.AsNoTracking()
            .Where(audit => audit.TenantId == tenantId
                && audit.EntityId == entityId
                && audit.Action == ReleasedAction);
        if (reopenedAt.HasValue)
        {
            var cycleStart = reopenedAt.Value;
            released = released.Where(audit => audit.EventTimeUtc > cycleStart);
        }

        return released;
    }

    private static IQueryable<AuditLog> QueryNoteEditsInCycle(
        IApplicationDbContext dbContext,
        Guid tenantId,
        Guid jobId,
        DateTimeOffset? reopenedAt)
    {
        var entityId = jobId.ToString();
        var edits = dbContext.AuditLogs.AsNoTracking()
            .Where(audit => audit.TenantId == tenantId
                && audit.EntityId == entityId
                && (audit.Action == CompletionNoteEditedAction
                    || audit.Action == CancelNoteEditedAction));
        if (reopenedAt.HasValue)
        {
            var cycleStart = reopenedAt.Value;
            edits = edits.Where(audit => audit.EventTimeUtc > cycleStart);
        }

        return edits;
    }

    private static async Task<string?> ResolveTaskCompletedSnapshotAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        Guid jobId,
        CancellationToken cancellationToken)
    {
        var taskIds = await dbContext.Tasks.AsNoTracking()
            .Where(task => task.TenantId == tenantId && task.JobId == jobId)
            .Select(task => task.TaskId.ToString())
            .ToListAsync(cancellationToken);
        if (taskIds.Count == 0)
        {
            return null;
        }

        var note = await dbContext.AuditLogs.AsNoTracking()
            .Where(audit => audit.TenantId == tenantId
                && audit.EntityType == nameof(WorkTask)
                && taskIds.Contains(audit.EntityId)
                && audit.Action == TaskCompletedAction)
            .OrderByDescending(audit => audit.EventTimeUtc)
            .Select(audit => audit.Notes ?? audit.Details)
            .FirstOrDefaultAsync(cancellationToken);
        return string.IsNullOrWhiteSpace(note) ? null : note.Trim();
    }

    private static string? FirstNonEmpty(IReadOnlyList<string?> values)
    {
        foreach (var value in values)
        {
            if (!string.IsNullOrWhiteSpace(value))
            {
                return value.Trim();
            }
        }

        return null;
    }

    private static string? LastNonEmpty(IReadOnlyList<string?> values)
    {
        for (var index = values.Count - 1; index >= 0; index--)
        {
            var value = values[index];
            if (!string.IsNullOrWhiteSpace(value))
            {
                return value.Trim();
            }
        }

        return null;
    }

    private readonly record struct CycleBounds(DateTimeOffset? ReopenedAt);
}
