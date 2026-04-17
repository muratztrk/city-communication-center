namespace CityCommunicationCenter.Application.Features.Notifications;

public sealed record SubscribePushCommand(
    Guid? ActorUserId,
    string Endpoint,
    string P256dhKey,
    string AuthKey,
    string? UserAgent) : ICommand<Guid>;

public sealed class SubscribePushCommandValidator : AbstractValidator<SubscribePushCommand>
{
    public SubscribePushCommandValidator()
    {
        RuleFor(command => command.Endpoint).NotEmpty().WithMessage("Push endpoint zorunludur.");
        RuleFor(command => command.P256dhKey).NotEmpty().WithMessage("P256dh anahtarı zorunludur.");
        RuleFor(command => command.AuthKey).NotEmpty().WithMessage("Auth anahtarı zorunludur.");
    }
}

public sealed class SubscribePushCommandHandler : IRequestHandler<SubscribePushCommand, Guid>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public SubscribePushCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async Task<Guid> Handle(SubscribePushCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.TenantId!.Value;

        // Upsert: update existing subscription or create new
        var existing = await _dbContext.PushSubscriptions
            .FirstOrDefaultAsync(entity => entity.Endpoint == request.Endpoint, cancellationToken);

        if (existing is not null)
        {
            existing.P256dhKey = request.P256dhKey;
            existing.AuthKey = request.AuthKey;
            existing.UserAgent = request.UserAgent;
            existing.UserId = request.ActorUserId!.Value;
            existing.IsActive = true;
            await _dbContext.SaveChangesAsync(cancellationToken);
            return existing.PushSubscriptionId;
        }

        var subscription = new PushSubscription
        {
            PushSubscriptionId = Guid.NewGuid(),
            TenantId = tenantId,
            UserId = request.ActorUserId!.Value,
            Endpoint = request.Endpoint,
            P256dhKey = request.P256dhKey,
            AuthKey = request.AuthKey,
            UserAgent = request.UserAgent,
            IsActive = true,
            CreatedByUserId = request.ActorUserId,
        };

        _dbContext.PushSubscriptions.Add(subscription);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return subscription.PushSubscriptionId;
    }
}
