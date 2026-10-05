using CityCommunicationCenter.Application.Common;

namespace CityCommunicationCenter.Application.Features.Social;

public sealed record OpenCitizenConversationDepartmentReviewCommand(
    Guid ReviewId,
    Guid? ActorUserId) : ICommand<bool>;

public sealed class OpenCitizenConversationDepartmentReviewCommandValidator
    : AbstractValidator<OpenCitizenConversationDepartmentReviewCommand>
{
    public OpenCitizenConversationDepartmentReviewCommandValidator()
    {
        RuleFor(command => command.ReviewId)
            .NotEmpty()
            .WithMessage("İnceleme kimliği gereklidir.");
    }
}

public sealed class OpenCitizenConversationDepartmentReviewCommandHandler
    : ICommandHandler<OpenCitizenConversationDepartmentReviewCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public OpenCitizenConversationDepartmentReviewCommandHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<bool> Handle(
        OpenCitizenConversationDepartmentReviewCommand request,
        CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();
        await ActorAuthorization.RequireActiveActorAsync(
            _dbContext,
            request.ActorUserId,
            tenantId,
            cancellationToken);

        var review = await _dbContext.CitizenConversationDepartmentReviews
            .Where(entity => entity.ReviewId == request.ReviewId && entity.TenantId == tenantId)
            .FirstOrDefaultAsync(cancellationToken);
        if (review is null || review.AcknowledgedAtUtc.HasValue)
        {
            return false;
        }

        var utcNow = DateTimeOffset.UtcNow;
        var siblings = await _dbContext.CitizenConversationDepartmentReviews
            .Where(entity => entity.TenantId == tenantId
                && entity.DepartmentId == review.DepartmentId
                && entity.RequestedByUserId == review.RequestedByUserId
                && entity.AcknowledgedAtUtc == null
                && entity.TargetDepartmentOpenedAtUtc == null)
            .ToListAsync(cancellationToken);

        foreach (var sibling in siblings)
        {
            sibling.TargetDepartmentOpenedAtUtc = utcNow;
            sibling.UpdatedAtUtc = utcNow;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}
