namespace CityCommunicationCenter.Application.Features.Social;

public sealed record MarkConversationWaitingRepliedCommand(Guid CitizenConversationId) : ICommand<bool>;

public sealed class MarkConversationWaitingRepliedCommandHandler
    : ICommandHandler<MarkConversationWaitingRepliedCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public MarkConversationWaitingRepliedCommandHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<bool> Handle(
        MarkConversationWaitingRepliedCommand request,
        CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();

        var conversation = await _dbContext.CitizenConversations
            .Where(c => c.CitizenConversationId == request.CitizenConversationId && c.TenantId == tenantId)
            .FirstOrDefaultAsync(cancellationToken);

        if (conversation is null) return false;

        conversation.WaitingReplyClearedAtUtc = DateTimeOffset.UtcNow;
        await WhatsAppMessageApprovalLog.WriteAsync(
            _dbContext,
            _tenantContextAccessor,
            conversation,
            WhatsAppMessageApprovalLog.WaitingRepliedAction,
            cancellationToken);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}
