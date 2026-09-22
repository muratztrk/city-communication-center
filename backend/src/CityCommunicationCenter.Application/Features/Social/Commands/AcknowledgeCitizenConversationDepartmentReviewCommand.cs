using CityCommunicationCenter.Application.Common;
using CityCommunicationCenter.Application.Features.Departments;
using CityCommunicationCenter.Application.Features.Users;
using CityCommunicationCenter.Domain.Enums;

namespace CityCommunicationCenter.Application.Features.Social;

public sealed record AcknowledgeCitizenConversationDepartmentReviewCommand(
    Guid ReviewId,
    Guid? ActorUserId) : ICommand<bool>;

public sealed class AcknowledgeCitizenConversationDepartmentReviewCommandValidator
    : AbstractValidator<AcknowledgeCitizenConversationDepartmentReviewCommand>
{
    public AcknowledgeCitizenConversationDepartmentReviewCommandValidator()
    {
        RuleFor(command => command.ReviewId)
            .NotEmpty()
            .WithMessage("İnceleme kimliği gereklidir.");
    }
}

public sealed class AcknowledgeCitizenConversationDepartmentReviewCommandHandler
    : ICommandHandler<AcknowledgeCitizenConversationDepartmentReviewCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;
    private readonly INotificationPushService _notificationPushService;

    public AcknowledgeCitizenConversationDepartmentReviewCommandHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor,
        INotificationPushService notificationPushService)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
        _notificationPushService = notificationPushService;
    }

    public async ValueTask<bool> Handle(
        AcknowledgeCitizenConversationDepartmentReviewCommand request,
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
            throw new ForbiddenAccessException("Bu inceleme bildirimini onaylama yetkiniz yok.");
        }

        var review = await _dbContext.CitizenConversationDepartmentReviews
            .Where(entity => entity.ReviewId == request.ReviewId && entity.TenantId == tenantId)
            .FirstOrDefaultAsync(cancellationToken);

        if (review is null || review.AcknowledgedAtUtc.HasValue)
        {
            return false;
        }

        if (!isSystemAdmin && !isCitizenRequestManager)
        {
            var canAccessDepartment = await UserDepartmentAccess.CanWorkInDepartmentAsync(
                _dbContext,
                tenantId,
                actor,
                review.DepartmentId,
                cancellationToken);
            if (!canAccessDepartment)
            {
                throw new ForbiddenAccessException("Bu birime ait inceleme bildirimini onaylama yetkiniz yok.");
            }
        }

        var department = await _dbContext.Departments
            .AsNoTracking()
            .Where(entity => entity.DepartmentId == review.DepartmentId && entity.TenantId == tenantId)
            .Select(entity => new
            {
                entity.Name,
                entity.ManagerUserId,
                entity.DeputyManagerUserId,
                entity.ResponsibleUserIdsJson,
            })
            .FirstOrDefaultAsync(cancellationToken);

        var responsibleIds = DepartmentResponseFactory.ParseResponsibleUserIds(department?.ResponsibleUserIdsJson);
        var isDepartmentLeader = department is not null
            && (department.ManagerUserId == actor.UserId || department.DeputyManagerUserId == actor.UserId);
        var isResponsible = responsibleIds.Contains(actor.UserId);
        var isDepartmentCitizenRequestManager = await UserRoleAccess.IsCitizenRequestManagerInDepartmentAsync(
            _dbContext,
            tenantId,
            actor,
            review.DepartmentId,
            cancellationToken);
        if (!isSystemAdmin && !isDepartmentLeader && !isResponsible && !isDepartmentCitizenRequestManager)
        {
            throw new ForbiddenAccessException("Bu birime ait inceleme bildirimini onaylama yetkiniz yok.");
        }

        review.UpdatedByUserId = actor.UserId;
        review.AcknowledgedAtUtc = DateTimeOffset.UtcNow;
        var notifications = await CreateReviewedNotificationsAsync(
            tenantId,
            actor,
            review,
            department?.Name,
            department?.ManagerUserId,
            department?.DeputyManagerUserId,
            responsibleIds,
            cancellationToken);
        foreach (var notification in notifications)
        {
            _dbContext.Notifications.Add(notification);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        foreach (var notification in notifications)
        {
            await _notificationPushService.SendToUserAsync(
                tenantId,
                notification.UserId,
                new NotificationPayload(
                    notification.NotificationId,
                    notification.Title,
                    notification.Message,
                    notification.ActionUrl,
                    SuppressToast: true),
                cancellationToken);
        }

        return true;
    }

    /// <summary>
    /// İncelendi Yap, hedef birimin müdür, vekil, sorumlu ve VTY ziline düşer.
    /// Metin: birim + basan kullanıcı. Köşe uyarısı çıkmaz (#6ab23883, #6ab25b70).
    /// </summary>
    private async Task<IReadOnlyList<Notification>> CreateReviewedNotificationsAsync(
        Guid tenantId,
        ApplicationUser actor,
        CitizenConversationDepartmentReview review,
        string? departmentName,
        Guid? managerUserId,
        Guid? deputyManagerUserId,
        IReadOnlyCollection<Guid> responsibleIds,
        CancellationToken cancellationToken)
    {
        var recipientIds = new HashSet<Guid>();
        if (managerUserId is Guid managerId && managerId != Guid.Empty)
        {
            recipientIds.Add(managerId);
        }

        if (deputyManagerUserId is Guid deputyId && deputyId != Guid.Empty)
        {
            recipientIds.Add(deputyId);
        }

        foreach (var responsibleId in responsibleIds)
        {
            if (responsibleId != Guid.Empty)
            {
                recipientIds.Add(responsibleId);
            }
        }

        var assignedUserIds = await _dbContext.UserDepartmentAssignments
            .AsNoTracking()
            .Where(assignment => assignment.TenantId == tenantId && assignment.DepartmentId == review.DepartmentId)
            .Select(assignment => assignment.UserId)
            .ToListAsync(cancellationToken);

        var candidates = await _dbContext.Users
            .AsNoTracking()
            .Where(user => user.TenantId == tenantId && user.IsActive && (
                user.DepartmentId == review.DepartmentId
                || recipientIds.Contains(user.UserId)
                || assignedUserIds.Contains(user.UserId)))
            .Select(user => new
            {
                user.UserId,
                user.RoleCode,
                user.AdditionalRoleCodesJson,
                user.DepartmentId,
            })
            .ToListAsync(cancellationToken);

        var activeIds = candidates.Select(user => user.UserId).ToHashSet();
        recipientIds.RemoveWhere(userId => !activeIds.Contains(userId));

        foreach (var user in candidates)
        {
            var inDepartment = user.DepartmentId == review.DepartmentId || assignedUserIds.Contains(user.UserId);
            if (inDepartment && UserRoleAccess.IsCitizenRequestManager(user.RoleCode, user.AdditionalRoleCodesJson))
            {
                recipientIds.Add(user.UserId);
            }
        }

        if (recipientIds.Count == 0)
        {
            return [];
        }

        var actorName = string.IsNullOrWhiteSpace(actor.DisplayName)
            ? (string.IsNullOrWhiteSpace(actor.Username) ? "Kullanıcı" : actor.Username)
            : actor.DisplayName.Trim();
        actorName = actorName.Replace("{", string.Empty, StringComparison.Ordinal).Replace("}", string.Empty, StringComparison.Ordinal);
        var unitName = string.IsNullOrWhiteSpace(departmentName) ? "Birim" : departmentName.Trim();
        var message = unitName + " {{" + actorName + "}} tarafından mesaj incelemesi tamamlandı.";

        return recipientIds
            .Select(userId => new Notification
            {
                NotificationId = Guid.NewGuid(),
                TenantId = tenantId,
                UserId = userId,
                Channel = NotificationChannel.InApp,
                DeliveryStatus = NotificationDeliveryStatus.Sent,
                Title = "Mesaj incelendi",
                Message = message,
                IsRead = false,
                ActionUrl = $"/my-requests?jobId={review.JobId}",
                SentAtUtc = DateTimeOffset.UtcNow,
                CreatedByUserId = actor.UserId,
            })
            .ToList();
    }
}
