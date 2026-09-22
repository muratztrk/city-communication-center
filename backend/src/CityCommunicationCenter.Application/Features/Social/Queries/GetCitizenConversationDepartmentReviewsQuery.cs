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

        var isCitizenRequestManager = UserRoleAccess.IsCitizenRequestManager(actor);
        if (actor.RoleCode != RoleCode.SystemAdmin
            && actor.RoleCode != RoleCode.Manager
            && !isCitizenRequestManager)
        {
            throw new ForbiddenAccessException("Bu inceleme bildirimlerini görüntüleme yetkiniz yok.");
        }

        var visibleDepartmentIds = await VisibleReviewDepartmentIdsAsync(
            tenantId,
            actor,
            isCitizenRequestManager,
            cancellationToken);
        if (visibleDepartmentIds.Count == 0)
        {
            return [];
        }

        var query = _dbContext.CitizenConversationDepartmentReviews
            .AsNoTracking()
            .Where(review => review.TenantId == tenantId
                && review.AcknowledgedAtUtc == null
                && visibleDepartmentIds.Contains(review.DepartmentId));

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
                _dbContext.Departments
                    .Where(department => department.DepartmentId == _dbContext.Users
                        .Where(user => user.UserId == review.RequestedByUserId)
                        .Select(user => user.DepartmentId)
                        .FirstOrDefault())
                    .Select(department => department.Name)
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

        return reviews
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
                review.RequestedByDepartmentName,
                DismissOnly: false))
            .ToList();
    }

    /// <summary>
    /// Balon yalnız seçilen hedef birimin müdürü, vekili, sorumlusu ve o birimdeki VTY içindir (#6ab25e9f).
    /// </summary>
    private async Task<HashSet<Guid>> VisibleReviewDepartmentIdsAsync(
        Guid tenantId,
        ApplicationUser actor,
        bool isCitizenRequestManager,
        CancellationToken cancellationToken)
    {
        var departments = await _dbContext.Departments
            .AsNoTracking()
            .Where(department => department.TenantId == tenantId)
            .Select(department => new
            {
                department.DepartmentId,
                department.ManagerUserId,
                department.DeputyManagerUserId,
                department.ResponsibleUserIdsJson,
            })
            .ToListAsync(cancellationToken);

        var visible = departments
            .Where(department => department.ManagerUserId == actor.UserId
                || department.DeputyManagerUserId == actor.UserId
                || DepartmentResponseFactory.ParseResponsibleUserIds(department.ResponsibleUserIdsJson).Contains(actor.UserId))
            .Select(department => department.DepartmentId)
            .ToHashSet();

        if (!isCitizenRequestManager)
        {
            return visible;
        }

        var membershipIds = await UserDepartmentAccess.GetMembershipDepartmentIdsAsync(
            _dbContext,
            tenantId,
            actor,
            cancellationToken);
        foreach (var departmentId in membershipIds)
        {
            visible.Add(departmentId);
        }

        return visible;
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
        string? RequestedByDepartmentName,
        DateTimeOffset RequestedAtUtc,
        string? CitizenPhone,
        string? CitizenName);
}
