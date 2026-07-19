namespace CityCommunicationCenter.Application.Features.Admin;

public sealed record GetAuditLogsQuery(Guid TenantId) : IQuery<IReadOnlyList<AuditLogResponse>>;

public sealed class GetAuditLogsQueryHandler : IQueryHandler<GetAuditLogsQuery, IReadOnlyList<AuditLogResponse>>
{
    private readonly IApplicationDbContext _dbContext;

    public GetAuditLogsQueryHandler(IApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async ValueTask<IReadOnlyList<AuditLogResponse>> Handle(GetAuditLogsQuery request, CancellationToken cancellationToken)
    {
        // AsNoTracking + üst sınır: log tablosu append-only büyür; sayfa istemci tarafında
        // sayfaladığı için en yeni 5000 kayıt fazlasıyla yeterli (review bulgusu, round 388).
        var audits = await _dbContext.AuditLogs
            .AsNoTracking()
            .OrderByDescending(entity => entity.EventTimeUtc)
            .Take(5000)
            .ToListAsync(cancellationToken);

        // Talep/Görev satırlarını bildirim gövdesi kalıbıyla ("T-yyyy-n — başlık — ifade")
        // gösterebilmek için numara/başlık/aktör toplu çözülür (card #1713).
        var jobIds = audits
            .Where(a => a.EntityType == nameof(Job) && Guid.TryParse(a.EntityId, out _))
            .Select(a => Guid.Parse(a.EntityId))
            .Distinct()
            .ToList();
        var taskIds = audits
            .Where(a => a.EntityType == nameof(WorkTask) && Guid.TryParse(a.EntityId, out _))
            .Select(a => Guid.Parse(a.EntityId))
            .Distinct()
            .ToList();
        var actorIds = audits
            .Where(a => a.ActorUserId.HasValue)
            .Select(a => a.ActorUserId!.Value)
            .Distinct()
            .ToList();

        var jobsById = (await _dbContext.Jobs
                .Where(j => jobIds.Contains(j.JobId))
                .Select(j => new { j.JobId, j.JobNumber, j.JobNumberYear, j.Title })
                .ToListAsync(cancellationToken))
            .ToDictionary(j => j.JobId);
        var tasksById = (await _dbContext.Tasks
                .Where(t => taskIds.Contains(t.TaskId))
                .Select(t => new { t.TaskId, t.TaskNumber, t.TaskNumberYear, t.Title })
                .ToListAsync(cancellationToken))
            .ToDictionary(t => t.TaskId);
        var actorNamesById = (await _dbContext.Users
                .Where(u => actorIds.Contains(u.UserId))
                .Select(u => new { u.UserId, u.DisplayName })
                .ToListAsync(cancellationToken))
            .ToDictionary(u => u.UserId, u => u.DisplayName);

        return audits
            .Select(entity =>
            {
                string? entityNumber = null;
                string? entityTitle = null;
                if (entity.EntityType == nameof(Job)
                    && Guid.TryParse(entity.EntityId, out var jobId)
                    && jobsById.TryGetValue(jobId, out var job))
                {
                    entityTitle = job.Title;
                    if (job.JobNumber.HasValue)
                        entityNumber = FormatEntityNumber("T", job.JobNumber.Value, job.JobNumberYear);
                }
                else if (entity.EntityType == nameof(WorkTask)
                    && Guid.TryParse(entity.EntityId, out var taskId)
                    && tasksById.TryGetValue(taskId, out var task))
                {
                    entityTitle = task.Title;
                    if (task.TaskNumber.HasValue)
                        entityNumber = FormatEntityNumber("G", task.TaskNumber.Value, task.TaskNumberYear);
                }

                var actorDisplayName = entity.ActorDisplayName;
                if (string.IsNullOrWhiteSpace(actorDisplayName) && entity.ActorUserId.HasValue)
                {
                    actorNamesById.TryGetValue(entity.ActorUserId.Value, out actorDisplayName);
                }

                return new AuditLogResponse(
                    entity.AuditLogId,
                    entity.TenantId,
                    entity.EntityType,
                    entity.EntityId,
                    entity.Action,
                    entity.ActorUserId,
                    entity.EventTimeUtc,
                    entity.Details,
                    entity.Notes,
                    actorDisplayName,
                    entityNumber,
                    entityTitle);
            })
            .ToList();
    }

    private static string FormatEntityNumber(string prefix, int number, int? year) =>
        year.HasValue ? $"{prefix}-{year}-{number}" : $"{prefix}-{number}";
}
