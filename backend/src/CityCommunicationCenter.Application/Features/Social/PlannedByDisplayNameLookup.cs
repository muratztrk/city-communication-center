namespace CityCommunicationCenter.Application.Features.Social;

/// <summary>Vatandaş talebi plana alındığında konuşma balonunda plana alan kişi.</summary>
internal static class PlannedByDisplayNameLookup
{
    public static async Task<Dictionary<Guid, string>> ByMessageIdAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        IReadOnlyCollection<Guid> messageIds,
        CancellationToken cancellationToken)
    {
        if (messageIds.Count == 0) return [];

        var links = await dbContext.SocialMessages
            .AsNoTracking()
            .Where(message => messageIds.Contains(message.SocialMessageId))
            .Select(message => new { message.SocialMessageId, message.JobId })
            .ToListAsync(cancellationToken);

        var jobIds = links
            .Where(link => link.JobId.HasValue)
            .Select(link => link.JobId!.Value)
            .Distinct()
            .ToList();
        var sourceIds = links.Select(link => link.SocialMessageId).Distinct().ToList();

        var jobs = new List<(Guid JobId, Guid? SourceRefId, string Name)>();
        if (jobIds.Count > 0)
        {
            var byId = await dbContext.Jobs
                .AsNoTracking()
                .Where(job => job.TenantId == tenantId
                    && job.PlannedByDisplayName != null
                    && jobIds.Contains(job.JobId))
                .Select(job => new { job.JobId, job.SourceRefId, job.PlannedByDisplayName })
                .ToListAsync(cancellationToken);
            jobs.AddRange(byId.Select(job => (job.JobId, job.SourceRefId, job.PlannedByDisplayName!.Trim())));
        }

        if (sourceIds.Count > 0)
        {
            var bySource = await dbContext.Jobs
                .AsNoTracking()
                .Where(job => job.TenantId == tenantId
                    && job.PlannedByDisplayName != null
                    && job.SourceRefId != null
                    && sourceIds.Contains(job.SourceRefId.Value))
                .Select(job => new { job.JobId, job.SourceRefId, job.PlannedByDisplayName })
                .ToListAsync(cancellationToken);
            jobs.AddRange(bySource.Select(job => (job.JobId, job.SourceRefId, job.PlannedByDisplayName!.Trim())));
        }

        var byJobId = new Dictionary<Guid, string>();
        var bySourceId = new Dictionary<Guid, string>();
        foreach (var job in jobs)
        {
            if (!string.IsNullOrWhiteSpace(job.Name))
            {
                byJobId.TryAdd(job.JobId, job.Name);
                if (job.SourceRefId.HasValue) bySourceId.TryAdd(job.SourceRefId.Value, job.Name);
            }
        }

        var result = new Dictionary<Guid, string>();
        foreach (var link in links)
        {
            if (link.JobId.HasValue && byJobId.TryGetValue(link.JobId.Value, out var byIdName))
            {
                result[link.SocialMessageId] = byIdName;
                continue;
            }

            if (bySourceId.TryGetValue(link.SocialMessageId, out var bySourceName))
            {
                result[link.SocialMessageId] = bySourceName;
            }
        }

        return result;
    }

    public static string? ForPlannedPendingMessage(
        string? content,
        string? deliveryStatusLabel,
        string? existingName,
        IReadOnlyDictionary<Guid, string> plannedByByMessageId,
        Guid socialMessageId)
    {
        if (!string.IsNullOrWhiteSpace(existingName)) return existingName;
        if (deliveryStatusLabel is not (nameof(ConversationDeliveryStatus.Pending)
            or nameof(ConversationDeliveryStatus.Failed)))
        {
            return existingName;
        }

        if (content?.Contains("Plana Alındı", StringComparison.Ordinal) != true) return existingName;
        return plannedByByMessageId.TryGetValue(socialMessageId, out var name) ? name : existingName;
    }
}
