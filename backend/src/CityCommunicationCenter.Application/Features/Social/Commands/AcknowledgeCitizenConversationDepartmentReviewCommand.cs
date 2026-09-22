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
        Notification? operatorNotification = null;
        if (closesForEveryone)
        {
            review.AcknowledgedAtUtc = DateTimeOffset.UtcNow;
            operatorNotification = await CreateOperatorReviewedNotificationAsync(
                tenantId,
                actor.UserId,
                review,
                cancellationToken);
            if (operatorNotification is not null)
            {
                _dbContext.Notifications.Add(operatorNotification);
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

        if (operatorNotification is not null)
        {
            await _notificationPushService.SendToUserAsync(
                tenantId,
                operatorNotification.UserId,
                new NotificationPayload(
                    operatorNotification.NotificationId,
                    operatorNotification.Title,
                    operatorNotification.Message,
                    operatorNotification.ActionUrl),
                cancellationToken);
        }

        return true;
    }

    /// <summary>
    /// Müdür onayı, incelemeye gönderen Vatandaş Talep Operatörünün zil listesine düşer (#6ab23883).
    /// </summary>
    private async Task<Notification?> CreateOperatorReviewedNotificationAsync(
        Guid tenantId,
        Guid actorUserId,
        CitizenConversationDepartmentReview review,
        CancellationToken cancellationToken)
    {
        if (review.RequestedByUserId == Guid.Empty || review.RequestedByUserId == actorUserId)
        {
            return null;
        }

        var requester = await _dbContext.Users
            .AsNoTracking()
            .Where(user => user.UserId == review.RequestedByUserId && user.TenantId == tenantId && user.IsActive)
            .Select(user => new { user.RoleCode, user.AdditionalRoleCodesJson })
            .FirstOrDefaultAsync(cancellationToken);
        if (requester is null)
        {
            return null;
        }

        var isOperator = requester.RoleCode == RoleCode.Operator
            || UserRoleAccess.ParseAdditionalRoleCodes(requester.AdditionalRoleCodesJson).Contains(RoleCode.Operator);
        if (!isOperator)
        {
            return null;
        }

        var departmentName = await _dbContext.Departments
            .AsNoTracking()
            .Where(department => department.DepartmentId == review.DepartmentId && department.TenantId == tenantId)
            .Select(department => department.Name)
            .FirstOrDefaultAsync(cancellationToken);

        var message = string.IsNullOrWhiteSpace(departmentName)
            ? "Birim mesaj incelemesini tamamladı."
            : $"{departmentName} mesaj incelemesini tamamladı.";

        return new Notification
        {
            NotificationId = Guid.NewGuid(),
            TenantId = tenantId,
            UserId = review.RequestedByUserId,
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
