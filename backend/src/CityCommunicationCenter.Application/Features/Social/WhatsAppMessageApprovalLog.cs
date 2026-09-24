namespace CityCommunicationCenter.Application.Features.Social;

internal static class WhatsAppMessageApprovalLog
{
    public const string WaitingRepliedAction = "WhatsAppWaitingReplied";
    public const string PendingApprovalClearedAction = "WhatsAppPendingApprovalCleared";
    public const string MessageRelayedAction = "WhatsAppMessageRelayed";

    public static async Task WriteAsync(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor,
        CitizenConversation conversation,
        string action,
        CancellationToken cancellationToken)
    {
        var context = tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        string? actorName = null;
        if (context.UserId is Guid userId)
        {
            actorName = await dbContext.Users.AsNoTracking()
                .Where(user => user.UserId == userId && user.TenantId == tenantId)
                .Select(user => user.DisplayName)
                .FirstOrDefaultAsync(cancellationToken);
        }

        dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = tenantId,
            EntityType = nameof(CitizenConversation),
            EntityId = conversation.CitizenConversationId.ToString(),
            Action = action,
            ActorUserId = context.UserId,
            ActorDisplayName = string.IsNullOrWhiteSpace(actorName) ? null : actorName.Trim(),
            EventTimeUtc = DateTimeOffset.UtcNow,
            Details = conversation.CitizenName,
            Notes = conversation.CitizenPhone,
        });
    }
}
