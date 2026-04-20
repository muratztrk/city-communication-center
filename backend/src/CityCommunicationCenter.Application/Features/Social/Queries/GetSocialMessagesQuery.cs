
namespace CityCommunicationCenter.Application.Features.Social;

public sealed record GetSocialMessagesQuery() : IQuery<IReadOnlyList<SocialMessageSummaryResponse>>;

public sealed class GetSocialMessagesQueryHandler : IRequestHandler<GetSocialMessagesQuery, IReadOnlyList<SocialMessageSummaryResponse>>
{
    private readonly IApplicationDbContext _dbContext;

    public GetSocialMessagesQueryHandler(IApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<IReadOnlyList<SocialMessageSummaryResponse>> Handle(GetSocialMessagesQuery request, CancellationToken cancellationToken)
    {
        return await _dbContext.SocialMessages
            .OrderByDescending(entity => entity.ReceivedAtUtc)
            .Select(entity => new SocialMessageSummaryResponse(
                entity.SocialMessageId,
                entity.Channel.ToString(),
                entity.CitizenHandle,
                entity.Category,
                entity.Status.ToString(),
                entity.AssignedDepartmentId,
                entity.JobId,
                entity.ReceivedAtUtc))
            .ToListAsync(cancellationToken);
    }
}