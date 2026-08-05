namespace CityCommunicationCenter.Application.Features.InternalMessages;

public sealed record NotifyInternalMessageTypingCommand(Guid RecipientUserId, Guid? ActorUserId, bool IsTyping)
    : ICommand<Unit>;

public sealed class NotifyInternalMessageTypingCommandValidator : AbstractValidator<NotifyInternalMessageTypingCommand>
{
    public NotifyInternalMessageTypingCommandValidator()
    {
        RuleFor(command => command.RecipientUserId)
            .NotEmpty()
            .WithMessage("Alıcı kullanıcı gereklidir.");
    }
}

public sealed class NotifyInternalMessageTypingCommandHandler
    : ICommandHandler<NotifyInternalMessageTypingCommand, Unit>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;
    private readonly INotificationPushService _notificationPushService;

    public NotifyInternalMessageTypingCommandHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor,
        INotificationPushService notificationPushService)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
        _notificationPushService = notificationPushService;
    }

    public async ValueTask<Unit> Handle(NotifyInternalMessageTypingCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var currentUserId = request.ActorUserId ?? context.UserId
            ?? throw new ForbiddenAccessException("Oturum kullanıcısı bulunamadı.");

        if (request.RecipientUserId == currentUserId)
        {
            return Unit.Value;
        }

        var recipientExists = await _dbContext.Users
            .AnyAsync(
                user => user.TenantId == tenantId
                    && user.UserId == request.RecipientUserId
                    && user.IsActive,
                cancellationToken);

        if (!recipientExists)
        {
            throw new ValidationException("Alıcı kullanıcı bulunamadı.");
        }

        await _notificationPushService.SendInternalMessageTypingToUserAsync(
            tenantId,
            request.RecipientUserId,
            new InternalMessageTypingPayload(currentUserId, request.RecipientUserId, request.IsTyping),
            cancellationToken);

        return Unit.Value;
    }
}
