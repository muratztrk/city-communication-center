namespace CityCommunicationCenter.Application.Features.Notifications;

public sealed record UnsubscribePushCommand(string Endpoint) : ICommand<bool>;

public sealed class UnsubscribePushCommandHandler : IRequestHandler<UnsubscribePushCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;

    public UnsubscribePushCommandHandler(IApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<bool> Handle(UnsubscribePushCommand request, CancellationToken cancellationToken)
    {
        var subscription = await _dbContext.PushSubscriptions
            .FirstOrDefaultAsync(entity => entity.Endpoint == request.Endpoint, cancellationToken);

        if (subscription is null) return false;

        subscription.IsActive = false;
        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}
