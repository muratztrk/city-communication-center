using CityCommunicationCenter.Domain.Enums;
using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Application.Features.CitizenMessageApprovals;

/// <summary>
/// Terminal vatandaş talebinin görüntülenecek/gönderilecek notunu çözer — tamamlanmışta son
/// tamamlanan görevin notu, iptalde talep iptal nedeni (veya son iptal edilen görevin notu),
/// `CitizenJobStatusNotifier.EnqueueTerminalFollowUpsAsync` ile aynı öncelik sırasıyla (card #2039).
/// </summary>
internal static class CitizenMessageApprovalNoteResolver
{
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
        var entityId = jobId.ToString();
        var reopenAt = await dbContext.AuditLogs.AsNoTracking()
            .Where(audit => audit.TenantId == tenantId
                && audit.EntityId == entityId
                && audit.Action == "CitizenMessageJobReopenedToProcessingReceived")
            .OrderByDescending(audit => audit.EventTimeUtc)
            .Select(audit => (DateTimeOffset?)audit.EventTimeUtc)
            .FirstOrDefaultAsync(cancellationToken);

        var released = dbContext.AuditLogs.AsNoTracking()
            .Where(audit => audit.TenantId == tenantId
                && audit.EntityId == entityId
                && audit.Action == "CitizenMessageApprovalReleased");
        if (reopenAt.HasValue)
        {
            var cycleStart = reopenAt.Value;
            released = released.Where(audit => audit.EventTimeUtc > cycleStart);
        }

        return await released
            .OrderBy(audit => audit.EventTimeUtc)
            .Select(audit => audit.Notes)
            .FirstOrDefaultAsync(cancellationToken);
    }

    /// <summary>
    /// Vatandaş Bilgi Listesi detay popup'ında "Vatandaşa Giden Mesaj" alanı — onay ekranında
    /// düzenlenmiş not veya iletilen terminal not (SMS <c>ResponseContent</c> / WA konuşma kaydı).
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
        var noteEdited = await dbContext.AuditLogs.AsNoTracking().AnyAsync(
            audit => audit.TenantId == tenantId
                && audit.EntityId == job.JobId.ToString()
                && (audit.Action == "CitizenMessageApprovalCompletionNoteEdited"
                    || audit.Action == "CitizenMessageApprovalCancelNoteEdited"),
            cancellationToken);

        if (noteEdited)
        {
            return await ResolveAsync(dbContext, tenantId, job, cancellationToken);
        }

        // SMS: operatör Sms Onayı'nda düzenlediyse görev notu (yukarıdaki dal);
        // yoksa iletilen SMS gövdesindeki terminal not.
        if (channel == SocialChannel.Phone)
        {
            if (!string.IsNullOrWhiteSpace(responseContent))
            {
                var transmitted = ExtractTrailingTerminalNote(responseContent);
                if (!string.IsNullOrWhiteSpace(transmitted))
                {
                    return transmitted;
                }
            }

            return await ResolveAsync(dbContext, tenantId, job, cancellationToken);
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

        return await ResolveAsync(dbContext, tenantId, job, cancellationToken);
    }

    private static string? ExtractTrailingTerminalNote(string content)
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
}
