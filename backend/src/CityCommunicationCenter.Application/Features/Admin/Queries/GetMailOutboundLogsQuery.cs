using CityCommunicationCenter.Domain.Enums;
using CityCommunicationCenter.Shared.Contracts;

namespace CityCommunicationCenter.Application.Features.Admin;

public sealed record GetMailOutboundLogsQuery(
    Guid TenantId,
    DateTimeOffset? FromUtc = null,
    DateTimeOffset? ToUtc = null,
    MailOutboundKind? Kind = null) : IQuery<MailOutboundLogsResponse>;

public sealed class GetMailOutboundLogsQueryHandler : IQueryHandler<GetMailOutboundLogsQuery, MailOutboundLogsResponse>
{
    private const int MaxItems = 5000;

    private readonly IApplicationDbContext _dbContext;

    public GetMailOutboundLogsQueryHandler(IApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async ValueTask<MailOutboundLogsResponse> Handle(GetMailOutboundLogsQuery request, CancellationToken cancellationToken)
    {
        var query = _dbContext.MailOutboundLogs.AsNoTracking().AsQueryable();

        if (request.FromUtc is DateTimeOffset fromUtc)
        {
            query = query.Where(entity => entity.CreatedAtUtc >= fromUtc);
        }

        if (request.ToUtc is DateTimeOffset toUtc)
        {
            query = query.Where(entity => entity.CreatedAtUtc < toUtc);
        }

        if (request.Kind is MailOutboundKind kind)
        {
            query = query.Where(entity => entity.Kind == kind);
        }

        var totalMatching = await query.CountAsync(cancellationToken);
        var successCount = await query.CountAsync(entity => entity.Success, cancellationToken);
        var failureCount = totalMatching - successCount;

        var items = await query
            .OrderByDescending(entity => entity.CreatedAtUtc)
            .Take(MaxItems)
            .Select(entity => new MailOutboundLogItemResponse(
                entity.MailOutboundLogId,
                entity.TenantId,
                entity.Kind.ToString(),
                entity.RecipientEmail,
                entity.RecipientUserId,
                entity.JobId,
                entity.TaskId,
                entity.RequestNumber,
                entity.Subject,
                entity.Success,
                entity.ErrorMessage,
                entity.TextLength,
                entity.BodyPreview,
                entity.CreatedAtUtc,
                entity.RecipientUserId.HasValue
                    ? _dbContext.Users
                        .AsNoTracking()
                        .Where(user => user.UserId == entity.RecipientUserId.Value)
                        .Select(user => (string?)user.DisplayName)
                        .FirstOrDefault()
                    : null))
            .ToListAsync(cancellationToken);

        return new MailOutboundLogsResponse(totalMatching, successCount, failureCount, items);
    }
}
