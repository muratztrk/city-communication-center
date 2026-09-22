using CityCommunicationCenter.Application.Common;
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

    public AcknowledgeCitizenConversationDepartmentReviewCommandHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
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

        review.AcknowledgedAtUtc = DateTimeOffset.UtcNow;
        review.UpdatedByUserId = actor.UserId;
        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}
