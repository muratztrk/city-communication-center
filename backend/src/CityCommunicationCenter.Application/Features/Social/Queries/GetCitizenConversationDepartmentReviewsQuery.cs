using CityCommunicationCenter.Application.Common;
using CityCommunicationCenter.Application.Features.Users;
using CityCommunicationCenter.Domain.Enums;

namespace CityCommunicationCenter.Application.Features.Social;

public sealed record GetCitizenConversationDepartmentReviewsQuery(Guid? ActorUserId)
    : IQuery<IReadOnlyList<CitizenConversationDepartmentReviewDto>>;

public sealed class GetCitizenConversationDepartmentReviewsQueryHandler
    : IQueryHandler<GetCitizenConversationDepartmentReviewsQuery, IReadOnlyList<CitizenConversationDepartmentReviewDto>>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public GetCitizenConversationDepartmentReviewsQueryHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<IReadOnlyList<CitizenConversationDepartmentReviewDto>> Handle(
        GetCitizenConversationDepartmentReviewsQuery request,
        CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var actor = await ActorAuthorization.RequireActiveActorAsync(
            _dbContext,
            request.ActorUserId ?? context.UserId,
            tenantId,
            cancellationToken);

        if (actor.RoleCode is not (RoleCode.Manager or RoleCode.SystemAdmin))
        {
            throw new ForbiddenAccessException("Bu inceleme bildirimlerini görüntüleme yetkiniz yok.");
        }

        var scopedDepartmentIds = actor.RoleCode == RoleCode.SystemAdmin
            ? null
            : await UserDepartmentAccess.GetScopedDepartmentIdsAsync(
                _dbContext,
                tenantId,
                actor,
                context.ActiveDepartmentId,
                cancellationToken);

        if (scopedDepartmentIds is { Length: 0 })
        {
            return [];
        }

        var query = _dbContext.CitizenConversationDepartmentReviews
            .AsNoTracking()
            .Where(review => review.TenantId == tenantId && review.AcknowledgedAtUtc == null);

        if (scopedDepartmentIds is not null)
        {
            query = query.Where(review => scopedDepartmentIds.Contains(review.DepartmentId));
        }

        return await query
            .OrderByDescending(review => review.RequestedAtUtc)
            .Select(review => new CitizenConversationDepartmentReviewDto(
                review.ReviewId,
                review.CitizenConversationId,
                review.DepartmentId,
                _dbContext.Departments
                    .Where(department => department.DepartmentId == review.DepartmentId)
                    .Select(department => department.Name)
                    .FirstOrDefault() ?? string.Empty,
                review.JobId,
                review.SocialMessageId,
                review.RequestedByUserId,
                _dbContext.Users
                    .Where(user => user.UserId == review.RequestedByUserId)
                    .Select(user => user.DisplayName)
                    .FirstOrDefault(),
                review.RequestedAtUtc,
                _dbContext.CitizenConversations
                    .Where(conversation => conversation.CitizenConversationId == review.CitizenConversationId)
                    .Select(conversation => conversation.CitizenPhone)
                    .FirstOrDefault(),
                _dbContext.CitizenConversations
                    .Where(conversation => conversation.CitizenConversationId == review.CitizenConversationId)
                    .Select(conversation => conversation.CitizenName)
                    .FirstOrDefault()))
            .ToListAsync(cancellationToken);
    }
}
