namespace CityCommunicationCenter.Application.Features.Social;

public sealed record GetWhatsAppMessageApprovalLogsQuery(string? Kind) : IQuery<IReadOnlyList<WhatsAppMessageApprovalLogItemResponse>>;

public sealed class GetWhatsAppMessageApprovalLogsQueryHandler
    : IQueryHandler<GetWhatsAppMessageApprovalLogsQuery, IReadOnlyList<WhatsAppMessageApprovalLogItemResponse>>
{
    private const int MaxItems = 2000;

    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public GetWhatsAppMessageApprovalLogsQueryHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<IReadOnlyList<WhatsAppMessageApprovalLogItemResponse>> Handle(
        GetWhatsAppMessageApprovalLogsQuery request,
        CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();
        var actions = ResolveActions(request.Kind);

        var rows = await _dbContext.AuditLogs.AsNoTracking()
            .Where(log => log.TenantId == tenantId
                && log.EntityType == nameof(CitizenConversation)
                && actions.Contains(log.Action))
            .OrderByDescending(log => log.EventTimeUtc)
            .Take(MaxItems)
            .Select(log => new WhatsAppMessageApprovalLogItemResponse(
                log.AuditLogId,
                log.Details,
                log.Notes,
                log.EventTimeUtc,
                log.Action,
                log.ActorDisplayName))
            .ToListAsync(cancellationToken);

        return rows;
    }

    private static string[] ResolveActions(string? kind) => kind switch
    {
        "waitingReplied" => [WhatsAppMessageApprovalLog.WaitingRepliedAction],
        "pendingApprovalCleared" => [WhatsAppMessageApprovalLog.PendingApprovalClearedAction],
        _ =>
        [
            WhatsAppMessageApprovalLog.WaitingRepliedAction,
            WhatsAppMessageApprovalLog.PendingApprovalClearedAction,
        ],
    };
}
