namespace CityCommunicationCenter.Application.Features.Notifications;

public sealed record GetNotificationsQuery() : IQuery<IReadOnlyList<NotificationResponse>>;

public sealed class GetNotificationsQueryHandler : IRequestHandler<GetNotificationsQuery, IReadOnlyList<NotificationResponse>>
{
    private readonly IApplicationDbContext _dbContext;

    public GetNotificationsQueryHandler(IApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<IReadOnlyList<NotificationResponse>> Handle(GetNotificationsQuery request, CancellationToken cancellationToken)
    {
        return await _dbContext.Notifications
            .OrderByDescending(entity => entity.SentAtUtc)
            .Select(entity => new NotificationResponse(
                entity.NotificationId,
                entity.TaskId,
                entity.UserId,
                entity.Channel.ToString(),
                entity.DeliveryStatus.ToString(),
                entity.Message,
                entity.SentAtUtc))
            .ToListAsync(cancellationToken);
    }
}