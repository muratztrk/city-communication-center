namespace CityCommunicationCenter.Application.Features.AuditLogs;

public sealed record GetEntityAuditLogQuery(Guid TenantId, string EntityType, Guid EntityId) : IQuery<IReadOnlyList<EntityAuditLogEntryResponse>>;

public sealed class GetEntityAuditLogQueryHandler : IQueryHandler<GetEntityAuditLogQuery, IReadOnlyList<EntityAuditLogEntryResponse>>
{
    private readonly IApplicationDbContext _dbContext;

    public GetEntityAuditLogQueryHandler(IApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async ValueTask<IReadOnlyList<EntityAuditLogEntryResponse>> Handle(GetEntityAuditLogQuery request, CancellationToken cancellationToken)
    {
        var entityIdStr = request.EntityId.ToString();
        var logs = await _dbContext.AuditLogs
            .Where(l => l.TenantId == request.TenantId && l.EntityType == request.EntityType && l.EntityId == entityIdStr)
            .OrderBy(l => l.EventTimeUtc)
            .ToListAsync(cancellationToken);

        var missingUserIds = logs
            .Where(l => l.ActorDisplayName == null && l.ActorUserId.HasValue)
            .Select(l => l.ActorUserId!.Value)
            .Distinct()
            .ToList();

        var userNames = missingUserIds.Count > 0
            ? await _dbContext.Users
                .Where(u => missingUserIds.Contains(u.UserId))
                .Select(u => new { u.UserId, u.DisplayName })
                .ToDictionaryAsync(u => u.UserId, u => u.DisplayName, cancellationToken)
            : new Dictionary<Guid, string>();

        return logs.Select(l => new EntityAuditLogEntryResponse(
            l.AuditLogId,
            l.Action,
            l.ActorDisplayName ?? (l.ActorUserId.HasValue ? userNames.GetValueOrDefault(l.ActorUserId.Value, "—") : "—"),
            l.DepartmentName,
            l.StatusAtEvent,
            l.Notes ?? l.Details,
            l.EventTimeUtc
        )).ToList();
    }
}
