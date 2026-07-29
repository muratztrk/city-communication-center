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
}
