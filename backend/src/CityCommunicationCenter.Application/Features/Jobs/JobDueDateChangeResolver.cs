namespace CityCommunicationCenter.Application.Features.Jobs;

/// <summary>
/// Son Tarih düzenleyenleri — talep ve görev detayında aynı liste (#3890 / #3890 r3).
/// </summary>
internal static class JobDueDateChangeResolver
{
    /// <summary>
    /// <paramref name="jobId"/> için <c>JobDueDateUpdated</c> + verilen görevlerin
    /// <c>TaskDueDateUpdated</c> denetim kayıtlarını, aynı aktör + 10 sn penceresinde tekilleştirip
    /// en yeni üstte döndürür.
    /// </summary>
    public static async Task<List<JobDueDateChangeResponse>> ResolveAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        Guid jobId,
        IReadOnlyCollection<Guid> taskIds,
        CancellationToken cancellationToken)
    {
        var taskIdStrings = taskIds.Select(id => id.ToString()).ToList();
        var jobDueDateAuditRows = await dbContext.AuditLogs
            .AsNoTracking()
            .Where(log => log.TenantId == tenantId
                && log.EntityType == nameof(Job)
                && log.EntityId == jobId.ToString()
                && log.Action == "JobDueDateUpdated")
            .Select(log => new { log.ActorUserId, log.ActorDisplayName, log.EventTimeUtc })
            .ToListAsync(cancellationToken);
        var taskDueDateAuditRows = taskIdStrings.Count == 0
            ? []
            : await dbContext.AuditLogs
                .AsNoTracking()
                .Where(log => log.TenantId == tenantId
                    && log.EntityType == nameof(WorkTask)
                    && taskIdStrings.Contains(log.EntityId)
                    && log.Action == "TaskDueDateUpdated")
                .Select(log => new { log.ActorUserId, log.ActorDisplayName, log.EventTimeUtc })
                .ToListAsync(cancellationToken);

        // Tek bir kullanıcı işlemi birden fazla audit üretir: görev son tarihi değişince
        // TaskDueDateUpdated + senkron JobDueDateUpdated (ve diğer aktif görevler), talep son
        // tarihi değişince JobDueDateUpdated + her aktif görev için TaskDueDateUpdated. Bunlar
        // aynı SaveChanges içinde yazıldığı için aynı aktör + birkaç saniye penceresi tek
        // "düzenleme" sayılır; yoksa tek değişiklikte ad yerine «Düzenleyenler» çıkıyordu (#3890).
        var dueDateAuditRows = new List<(Guid? ActorUserId, string? ActorDisplayName, DateTimeOffset EventTimeUtc)>();
        foreach (var row in jobDueDateAuditRows
                     .Concat(taskDueDateAuditRows)
                     .OrderByDescending(row => row.EventTimeUtc))
        {
            var duplicateIndex = dueDateAuditRows.FindIndex(existing =>
                existing.ActorUserId == row.ActorUserId
                && (existing.EventTimeUtc - row.EventTimeUtc).Duration() <= TimeSpan.FromSeconds(10));
            if (duplicateIndex >= 0)
            {
                if (string.IsNullOrWhiteSpace(dueDateAuditRows[duplicateIndex].ActorDisplayName)
                    && !string.IsNullOrWhiteSpace(row.ActorDisplayName))
                {
                    dueDateAuditRows[duplicateIndex] = (row.ActorUserId, row.ActorDisplayName, dueDateAuditRows[duplicateIndex].EventTimeUtc);
                }

                continue;
            }

            dueDateAuditRows.Add((row.ActorUserId, row.ActorDisplayName, row.EventTimeUtc));
        }

        var dueDateActorIds = dueDateAuditRows
            .Where(row => row.ActorUserId.HasValue && string.IsNullOrWhiteSpace(row.ActorDisplayName))
            .Select(row => row.ActorUserId!.Value)
            .Distinct()
            .ToList();
        var dueDateActorNames = dueDateActorIds.Count == 0
            ? new Dictionary<Guid, string?>()
            : await dbContext.Users
                .AsNoTracking()
                .Where(user => dueDateActorIds.Contains(user.UserId))
                .Select(user => new { user.UserId, user.DisplayName })
                .ToDictionaryAsync(user => user.UserId, user => (string?)user.DisplayName, cancellationToken);

        return dueDateAuditRows
            .Select(row => new JobDueDateChangeResponse(
                !string.IsNullOrWhiteSpace(row.ActorDisplayName)
                    ? row.ActorDisplayName
                    : row.ActorUserId is Guid actorId && dueDateActorNames.TryGetValue(actorId, out var name)
                        ? name
                        : null,
                row.EventTimeUtc))
            .ToList();
    }
}
