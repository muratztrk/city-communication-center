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
        return await _dbContext.AuditLogs
            .OrderByDescending(entity => entity.EventTimeUtc)
            .Select(entity => new AuditLogResponse(
                entity.AuditLogId,
                entity.TenantId,
                entity.EntityType,
                entity.EntityId,
                entity.Action,
                entity.ActorUserId,
                entity.EventTimeUtc,
                entity.Details))
            .ToListAsync(cancellationToken);
    }
}