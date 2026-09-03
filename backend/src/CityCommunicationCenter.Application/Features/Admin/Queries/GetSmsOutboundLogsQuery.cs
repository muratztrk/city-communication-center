using CityCommunicationCenter.Domain.Enums;
using CityCommunicationCenter.Shared.Contracts;

namespace CityCommunicationCenter.Application.Features.Admin;

public sealed record GetSmsOutboundLogsQuery(
    Guid TenantId,
    DateTimeOffset? FromUtc = null,
    DateTimeOffset? ToUtc = null,
    SmsOutboundKind? Kind = null) : IQuery<SmsOutboundLogsResponse>;

public sealed class GetSmsOutboundLogsQueryHandler : IQueryHandler<GetSmsOutboundLogsQuery, SmsOutboundLogsResponse>
{
    private const int MaxItems = 5000;

    private readonly IApplicationDbContext _dbContext;

    public GetSmsOutboundLogsQueryHandler(IApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async ValueTask<SmsOutboundLogsResponse> Handle(GetSmsOutboundLogsQuery request, CancellationToken cancellationToken)
    {
        var query = _dbContext.SmsOutboundLogs.AsNoTracking().AsQueryable();

        if (request.FromUtc is DateTimeOffset fromUtc)
        {
            query = query.Where(entity => entity.CreatedAtUtc >= fromUtc);
        }

        if (request.ToUtc is DateTimeOffset toUtc)
        {
            query = query.Where(entity => entity.CreatedAtUtc < toUtc);
        }

        if (request.Kind is SmsOutboundKind kind)
        {
            query = query.Where(entity => entity.Kind == kind);
        }

        var totalMatching = await query.CountAsync(cancellationToken);
        var successCount = await query.CountAsync(entity => entity.Success, cancellationToken);
        var failureCount = totalMatching - successCount;

        var items = await query
            .OrderByDescending(entity => entity.CreatedAtUtc)
            .Take(MaxItems)
            .Select(entity => new SmsOutboundLogItemResponse(
                entity.SmsOutboundLogId,
                entity.TenantId,
                entity.Kind.ToString(),
                entity.RecipientPhoneMasked,
                entity.RecipientUserId,
                entity.JobId,
                entity.SocialMessageId,
                entity.TaskId,
                entity.RequestNumber,
                entity.Success,
                entity.Provider,
                entity.ProviderCode,
                entity.ProviderMessage,
                entity.TextLength,
                entity.BodyPreview,
                entity.CreatedAtUtc))
            .ToListAsync(cancellationToken);

        return new SmsOutboundLogsResponse(totalMatching, successCount, failureCount, items);
    }
}
