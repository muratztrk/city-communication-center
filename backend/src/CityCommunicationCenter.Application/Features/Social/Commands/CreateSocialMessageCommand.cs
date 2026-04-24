namespace CityCommunicationCenter.Application.Features.Social;

public sealed record CreateSocialMessageCommand(
    Guid ActorUserId,
    SocialChannel Channel,
    string CitizenHandle,
    string Content,
    string? Category) : ICommand<Guid>;

public sealed class CreateSocialMessageCommandHandler : ICommandHandler<CreateSocialMessageCommand, Guid>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public CreateSocialMessageCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<Guid> Handle(CreateSocialMessageCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();

        var message = new SocialMessage
        {
            SocialMessageId = Guid.NewGuid(),
            TenantId = context.TenantId!.Value,
            Channel = request.Channel,
            // Prefix with MANUAL- to satisfy the unique (TenantId, Channel, ExternalMessageId) constraint
            ExternalMessageId = $"MANUAL-{Guid.NewGuid():N}",
            CitizenHandle = request.CitizenHandle,
            Content = request.Content,
            Category = string.IsNullOrWhiteSpace(request.Category) ? null : request.Category,
            Status = SocialMessageStatus.New,
            ReceivedAtUtc = DateTimeOffset.UtcNow,
            CreatedByUserId = request.ActorUserId,
        };

        _dbContext.SocialMessages.Add(message);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return message.SocialMessageId;
    }
}
