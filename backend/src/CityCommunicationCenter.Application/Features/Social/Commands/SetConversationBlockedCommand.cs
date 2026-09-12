namespace CityCommunicationCenter.Application.Features.Social;

public sealed record SetConversationBlockedCommand(
    Guid CitizenConversationId,
    bool IsBlocked) : ICommand<bool>;

public sealed class SetConversationBlockedCommandHandler : ICommandHandler<SetConversationBlockedCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public SetConversationBlockedCommandHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<bool> Handle(SetConversationBlockedCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var canManage = Enum.TryParse<RoleCode>(context.RoleCode, true, out var roleCode)
            && roleCode is RoleCode.Operator or RoleCode.SystemAdmin;
        if (!canManage)
        {
            throw new ForbiddenAccessException(
                "Numara engeli yalnızca Vatandaş Talep Operatörü veya Sistem Yöneticisi değiştirebilir.");
        }

        var conversation = await _dbContext.CitizenConversations
            .Where(item => item.CitizenConversationId == request.CitizenConversationId && item.TenantId == tenantId)
            .FirstOrDefaultAsync(cancellationToken);
        if (conversation is null)
        {
            return false;
        }

        conversation.IsBlocked = request.IsBlocked;
        var actorName = string.IsNullOrWhiteSpace(context.UserDisplayName)
            ? null
            : context.UserDisplayName.Trim();
        var now = DateTimeOffset.UtcNow;
        if (request.IsBlocked)
        {
            conversation.UnreadCount = 0;
            conversation.BlockedByUserId = context.UserId;
            conversation.BlockedByDisplayName = actorName;
            conversation.BlockedAtUtc = now;
        }
        else
        {
            conversation.UnblockedByUserId = context.UserId;
            conversation.UnblockedByDisplayName = actorName;
            conversation.UnblockedAtUtc = now;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}
