
namespace CityCommunicationCenter.Application.Features.Social;

public sealed record GetSocialMessageByIdQuery(Guid MessageId) : IQuery<SocialMessageDetailResponse?>;

public sealed class GetSocialMessageByIdQueryHandler : IQueryHandler<GetSocialMessageByIdQuery, SocialMessageDetailResponse?>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public GetSocialMessageByIdQueryHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<SocialMessageDetailResponse?> Handle(GetSocialMessageByIdQuery request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();
        var message = await _dbContext.SocialMessages
            .AsNoTracking()
            .FirstOrDefaultAsync(
                entity => entity.SocialMessageId == request.MessageId && entity.TenantId == tenantId,
                cancellationToken);
        if (message is null)
        {
            return null;
        }

        var assignedDepartmentName = message.AssignedDepartmentId.HasValue
            ? await _dbContext.Departments
                .AsNoTracking()
                .Where(department => department.DepartmentId == message.AssignedDepartmentId.Value && department.TenantId == tenantId)
                .Select(department => department.Name)
                .FirstOrDefaultAsync(cancellationToken)
            : null;

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
            assignedDepartmentName,
            message.JobId,
            message.ReceivedAtUtc,
            message.Latitude,
            message.Longitude,
            string.IsNullOrWhiteSpace(message.Tags)
                ? Array.Empty<string>()
                : message.Tags.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));
    }
}
