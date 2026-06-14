namespace CityCommunicationCenter.Application.Features.Social;

public sealed record MarkConversationReadCommand(Guid CitizenConversationId) : ICommand<bool>;

public sealed class MarkConversationReadCommandHandler : ICommandHandler<MarkConversationReadCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public MarkConversationReadCommandHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<bool> Handle(MarkConversationReadCommand request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();

        var conversation = await _dbContext.CitizenConversations
            .Where(c => c.CitizenConversationId == request.CitizenConversationId && c.TenantId == tenantId)
            .FirstOrDefaultAsync(cancellationToken);

        if (conversation is null) return false;

        conversation.UnreadCount = 0;
        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}
