
namespace CityCommunicationCenter.Application.Features.Social;

public sealed record RouteSocialMessageCommand(Guid MessageId, Guid? ActorUserId, Guid? DepartmentId, Guid? UserId) : ICommand<bool>;

public sealed class RouteSocialMessageCommandHandler : IRequestHandler<RouteSocialMessageCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;

    public RouteSocialMessageCommandHandler(IApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<bool> Handle(RouteSocialMessageCommand request, CancellationToken cancellationToken)
    {
        var message = await _dbContext.SocialMessages.FirstOrDefaultAsync(entity => entity.SocialMessageId == request.MessageId, cancellationToken);
        if (message is null)
        {
            return false;
        }

        message.AssignedDepartmentId = request.DepartmentId;
        message.Status = SocialMessageStatus.Routed;
        message.UpdatedByUserId = request.ActorUserId;
        message.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}