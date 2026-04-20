
namespace CityCommunicationCenter.Application.Features.Social;

public sealed record DeleteSocialMessageCommand(Guid MessageId, Guid TenantId) : ICommand<bool>;

public sealed class DeleteSocialMessageCommandHandler : IRequestHandler<DeleteSocialMessageCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;

    public DeleteSocialMessageCommandHandler(IApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<bool> Handle(DeleteSocialMessageCommand request, CancellationToken cancellationToken)
    {
        var message = await _dbContext.SocialMessages
            .FirstOrDefaultAsync(
                entity => entity.SocialMessageId == request.MessageId && entity.TenantId == request.TenantId,
                cancellationToken);

        if (message is null)
        {
            return false;
        }

        _dbContext.SocialMessages.Remove(message);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}
