using CityCommunicationCenter.Application.Common;
using CityCommunicationCenter.Application.Features.Departments;
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

        var isSystemAdmin = actor.RoleCode == RoleCode.SystemAdmin;
        var isCitizenRequestManager = UserRoleAccess.IsCitizenRequestManager(actor);
        if (!isSystemAdmin && actor.RoleCode != RoleCode.Manager && !isCitizenRequestManager)
        {
            throw new ForbiddenAccessException("Bu inceleme bildirimlerini görüntüleme yetkiniz yok.");
        }

        // CRM tüm bekleyen incelemeleri görür. Müdür ve sorumlu yalnız kendi birimleriyle sınırlıdır.
        var scopedDepartmentIds = isSystemAdmin || isCitizenRequestManager
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

        var managedDepartmentIds = isSystemAdmin
            ? new List<Guid>()
            : await _dbContext.Departments
                .AsNoTracking()
                .Where(department => department.TenantId == tenantId
                    && (department.ManagerUserId == actor.UserId || department.DeputyManagerUserId == actor.UserId))
                .Select(department => department.DepartmentId)
                .ToListAsync(cancellationToken);

        var reviews = await query
            .OrderByDescending(review => review.RequestedAtUtc)
            .Select(review => new PendingDepartmentReviewRow(
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
                    .FirstOrDefault(),
                review.DismissedByUserIdsJson))
            .ToListAsync(cancellationToken);

        return reviews
            .Where(review => isSystemAdmin
                || managedDepartmentIds.Contains(review.DepartmentId)
                || !DepartmentResponseFactory.ParseResponsibleUserIds(review.DismissedByUserIdsJson).Contains(actor.UserId))
            .Select(review => new CitizenConversationDepartmentReviewDto(
                review.ReviewId,
                review.CitizenConversationId,
                review.DepartmentId,
                review.DepartmentName,
                review.JobId,
                review.SocialMessageId,
                review.RequestedByUserId,
                review.RequestedByDisplayName,
                review.RequestedAtUtc,
                review.CitizenPhone,
                review.CitizenName,
                DismissOnly: !isSystemAdmin && !managedDepartmentIds.Contains(review.DepartmentId)))
            .ToList();
    }

    private sealed record PendingDepartmentReviewRow(
        Guid ReviewId,
        Guid CitizenConversationId,
        Guid DepartmentId,
        string DepartmentName,
        Guid JobId,
        Guid SocialMessageId,
        Guid RequestedByUserId,
        string? RequestedByDisplayName,
        DateTimeOffset RequestedAtUtc,
        string? CitizenPhone,
        string? CitizenName,
        string? DismissedByUserIdsJson);
}
