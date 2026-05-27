namespace CityCommunicationCenter.Application.Features.Social;

public sealed record ReceiveSocialWebhookCommand(string Channel, Guid? ActorUserId, SocialWebhookRequest Request) : ICommand<Guid>;

public sealed class ReceiveSocialWebhookCommandHandler : ICommandHandler<ReceiveSocialWebhookCommand, Guid>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public ReceiveSocialWebhookCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<Guid> Handle(ReceiveSocialWebhookCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var message = new SocialMessage
        {
            SocialMessageId = Guid.NewGuid(),
            TenantId = context.TenantId!.Value,
            Channel = Enum.TryParse<SocialChannel>(request.Channel, true, out var parsedChannel)
                ? parsedChannel
                : SocialChannel.Other,
            ExternalMessageId = request.Request.ExternalMessageId,
            CitizenHandle = request.Request.CitizenHandle,
            Content = request.Request.Content,
            Latitude = request.Request.Latitude,
            Longitude = request.Request.Longitude,
            ReceivedAtUtc = request.Request.ReceivedAtUtc ?? DateTimeOffset.UtcNow,
            CreatedByUserId = request.ActorUserId
        };

        _dbContext.SocialMessages.Add(message);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return message.SocialMessageId;
    }
}
