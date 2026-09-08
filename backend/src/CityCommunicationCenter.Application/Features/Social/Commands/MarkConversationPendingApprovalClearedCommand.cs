namespace CityCommunicationCenter.Application.Features.Social;

public sealed record MarkConversationPendingApprovalClearedCommand(Guid CitizenConversationId) : ICommand<bool>;

public sealed class MarkConversationPendingApprovalClearedCommandHandler
    : ICommandHandler<MarkConversationPendingApprovalClearedCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public MarkConversationPendingApprovalClearedCommandHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<bool> Handle(
        MarkConversationPendingApprovalClearedCommand request,
        CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();

        var conversation = await _dbContext.CitizenConversations
            .Where(c => c.CitizenConversationId == request.CitizenConversationId && c.TenantId == tenantId)
            .FirstOrDefaultAsync(cancellationToken);

        if (conversation is null) return false;

        conversation.PendingApprovalClearedAtUtc = DateTimeOffset.UtcNow;
        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}
