
namespace CityCommunicationCenter.Application.Features.Social;

public sealed record GetSocialMessageByIdQuery(Guid MessageId) : IQuery<SocialMessageDetailResponse?>;

public sealed class GetSocialMessageByIdQueryHandler : IRequestHandler<GetSocialMessageByIdQuery, SocialMessageDetailResponse?>
{
    private readonly IApplicationDbContext _dbContext;

    public GetSocialMessageByIdQueryHandler(IApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<SocialMessageDetailResponse?> Handle(GetSocialMessageByIdQuery request, CancellationToken cancellationToken)
    {
        var message = await _dbContext.SocialMessages.FirstOrDefaultAsync(entity => entity.SocialMessageId == request.MessageId, cancellationToken);
        if (message is null)
        {
            return null;
        }

        return new SocialMessageDetailResponse(
            message.SocialMessageId,
            message.TenantId,
            message.Channel.ToString(),
            message.ExternalMessageId,
            message.CitizenHandle,
            message.Content,
            message.Category,
            message.Status.ToString(),
            message.AssignedDepartmentId,
            message.TaskId,
            message.ReceivedAtUtc,
            string.IsNullOrWhiteSpace(message.Tags)
                ? Array.Empty<string>()
                : message.Tags.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));
    }
}