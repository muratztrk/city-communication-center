namespace CityCommunicationCenter.Application.Features.Notifications;

public sealed record GetUnreadNotificationCountQuery(Guid UserId) : IQuery<int>;

public sealed class GetUnreadNotificationCountQueryHandler : IRequestHandler<GetUnreadNotificationCountQuery, int>
{
    private readonly IApplicationDbContext _dbContext;

    public GetUnreadNotificationCountQueryHandler(IApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<int> Handle(GetUnreadNotificationCountQuery request, CancellationToken cancellationToken)
    {
        return await _dbContext.Notifications
            .CountAsync(entity => entity.UserId == request.UserId && !entity.IsRead, cancellationToken);
    }
}
