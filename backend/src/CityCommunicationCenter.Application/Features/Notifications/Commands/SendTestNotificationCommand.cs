namespace CityCommunicationCenter.Application.Features.Notifications;

public sealed record SendTestNotificationCommand(
    Guid? ActorUserId,
    string Channel,
    string Recipient,
    string Message) : ICommand<TestNotificationResponse>;

public sealed class SendTestNotificationCommandValidator : AbstractValidator<SendTestNotificationCommand>
{
    public SendTestNotificationCommandValidator()
    {
        RuleFor(command => command.Channel)
            .NotEmpty()
            .WithMessage("Bildirim kanali zorunludur.");
        RuleFor(command => command.Recipient)
            .NotEmpty()
            .WithMessage("Alici bilgisi zorunludur.");
        RuleFor(command => command.Message)
            .NotEmpty()
            .WithMessage("Bildirim mesaji zorunludur.");
    }
}

public sealed class SendTestNotificationCommandHandler : IRequestHandler<SendTestNotificationCommand, TestNotificationResponse>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public SendTestNotificationCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async Task<TestNotificationResponse> Handle(SendTestNotificationCommand request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().TenantId!.Value;
        var notification = new Notification
        {
            NotificationId = Guid.NewGuid(),
            TenantId = tenantId,
            UserId = request.ActorUserId ?? Guid.Empty,
            Channel = Enum.Parse<NotificationChannel>(request.Channel, true),
            DeliveryStatus = NotificationDeliveryStatus.Pending,
            Message = request.Message.Trim(),
            CreatedByUserId = request.ActorUserId
        };

        _dbContext.Notifications.Add(notification);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return new TestNotificationResponse(notification.NotificationId, request.Recipient.Trim());
    }
}