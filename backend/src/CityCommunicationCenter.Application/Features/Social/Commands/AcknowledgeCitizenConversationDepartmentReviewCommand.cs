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

        var closesForEveryone = isSystemAdmin || await _dbContext.Departments
            .AsNoTracking()
            .AnyAsync(
                department => department.TenantId == tenantId
                    && department.DepartmentId == review.DepartmentId
                    && (department.ManagerUserId == actor.UserId || department.DeputyManagerUserId == actor.UserId),
                cancellationToken);

        review.UpdatedByUserId = actor.UserId;
        Notification? managerNotification = null;
        if (closesForEveryone)
        {
            review.AcknowledgedAtUtc = DateTimeOffset.UtcNow;
            managerNotification = await CreateManagerReviewedNotificationAsync(
                tenantId,
                actor.UserId,
                review,
                cancellationToken);
            if (managerNotification is not null)
            {
                _dbContext.Notifications.Add(managerNotification);
            }
        }
        else
        {
            var dismissedBy = DepartmentResponseFactory.ParseResponsibleUserIds(review.DismissedByUserIdsJson).ToList();
            if (!dismissedBy.Contains(actor.UserId))
            {
                dismissedBy.Add(actor.UserId);
                review.DismissedByUserIdsJson = DepartmentResponseFactory.SerializeResponsibleUserIds(dismissedBy);
            }
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        if (managerNotification is not null)
        {
            await _notificationPushService.SendToUserAsync(
                tenantId,
                managerNotification.UserId,
                new NotificationPayload(
                    managerNotification.NotificationId,
                    managerNotification.Title,
                    managerNotification.Message,
                    managerNotification.ActionUrl,
                    SuppressToast: true),
                cancellationToken);
        }

        return true;
    }

    /// <summary>
    /// Müdür onayı, birim müdürünün zil listesine düşer; köşe uyarısı çıkmaz (#6ab23883).
    /// </summary>
    private async Task<Notification?> CreateManagerReviewedNotificationAsync(
        Guid tenantId,
        Guid actorUserId,
        CitizenConversationDepartmentReview review,
        CancellationToken cancellationToken)
    {
        var department = await _dbContext.Departments
            .AsNoTracking()
            .Where(entity => entity.DepartmentId == review.DepartmentId && entity.TenantId == tenantId)
            .Select(entity => new { entity.Name, entity.ManagerUserId })
            .FirstOrDefaultAsync(cancellationToken);

        var recipientUserId = department?.ManagerUserId ?? actorUserId;
        if (recipientUserId == Guid.Empty)
        {
            return null;
        }

        var recipientIsActive = await _dbContext.Users
            .AsNoTracking()
            .AnyAsync(
                user => user.UserId == recipientUserId && user.TenantId == tenantId && user.IsActive,
                cancellationToken);
        if (!recipientIsActive)
        {
            return null;
        }

        var message = string.IsNullOrWhiteSpace(department?.Name)
            ? "Birim mesaj incelemesini tamamladı."
            : $"{department.Name} mesaj incelemesini tamamladı.";

        return new Notification
        {
            NotificationId = Guid.NewGuid(),
            TenantId = tenantId,
            UserId = recipientUserId,
            Channel = NotificationChannel.InApp,
            DeliveryStatus = NotificationDeliveryStatus.Sent,
            Title = "Mesaj incelendi",
            Message = message,
            IsRead = false,
            ActionUrl = $"/my-requests?jobId={review.JobId}",
            SentAtUtc = DateTimeOffset.UtcNow,
            CreatedByUserId = actorUserId,
        };
    }
}
