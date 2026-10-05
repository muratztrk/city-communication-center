namespace CityCommunicationCenter.Application.Features.Social;

public sealed record SetConversationOperatorLockCommand(
    Guid CitizenConversationId,
    bool IsLocked) : ICommand<bool>;

public sealed class SetConversationOperatorLockCommandHandler
    : ICommandHandler<SetConversationOperatorLockCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public SetConversationOperatorLockCommandHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<bool> Handle(
        SetConversationOperatorLockCommand request,
        CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var canManage = Enum.TryParse<RoleCode>(context.RoleCode, true, out var roleCode)
            && roleCode is RoleCode.Operator or RoleCode.SystemAdmin;
        if (!canManage)
        {
            throw new ForbiddenAccessException(
                "Kilitleme yalnızca Vatandaş Talep Operatörü veya Sistem Yöneticisi tarafından yapılabilir.");
        }

        var conversation = await _dbContext.CitizenConversations
            .Where(item => item.CitizenConversationId == request.CitizenConversationId && item.TenantId == tenantId)
            .FirstOrDefaultAsync(cancellationToken);
        if (conversation is null)
        {
            return false;
        }

        var actorName = string.IsNullOrWhiteSpace(context.UserDisplayName)
            ? null
            : context.UserDisplayName.Trim();
        var now = DateTimeOffset.UtcNow;

        if (request.IsLocked)
        {
            if (conversation.OperatorLockedByUserId is Guid lockedBy
                && lockedBy != context.UserId
                && lockedBy != Guid.Empty)
            {
                throw new ForbiddenAccessException("Bu numara başka bir kullanıcı tarafından kilitlendi.");
            }

            conversation.OperatorLockedByUserId = context.UserId;
            conversation.OperatorLockedByDisplayName = actorName;
            conversation.OperatorLockedAtUtc = now;
        }
        else
        {
            if (conversation.OperatorLockedByUserId is Guid lockedBy
                && lockedBy != context.UserId
                && lockedBy != Guid.Empty
                && roleCode != RoleCode.SystemAdmin)
            {
                throw new ForbiddenAccessException("Kilidi yalnızca kilitleyen kullanıcı veya sistem yöneticisi açabilir.");
            }

            conversation.OperatorLockedByUserId = null;
            conversation.OperatorLockedByDisplayName = null;
            conversation.OperatorLockedAtUtc = null;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}
