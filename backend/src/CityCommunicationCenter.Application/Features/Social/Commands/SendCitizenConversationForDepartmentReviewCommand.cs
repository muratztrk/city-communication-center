using CityCommunicationCenter.Application.Common;
using CityCommunicationCenter.Domain.Entities;
using CityCommunicationCenter.Domain.Enums;

namespace CityCommunicationCenter.Application.Features.Social;

public sealed record SendCitizenConversationForDepartmentReviewCommand(
    Guid CitizenConversationId,
    Guid DepartmentId,
    Guid? ActorUserId) : ICommand<CitizenConversationDepartmentReviewDto?>;

public sealed class SendCitizenConversationForDepartmentReviewCommandValidator
    : AbstractValidator<SendCitizenConversationForDepartmentReviewCommand>
{
    public SendCitizenConversationForDepartmentReviewCommandValidator()
    {
        RuleFor(command => command.CitizenConversationId)
            .NotEmpty()
            .WithMessage("Konuşma kimliği gereklidir.");
        RuleFor(command => command.DepartmentId)
            .NotEmpty()
            .WithMessage("Birim seçimi gereklidir.");
    }
}

public sealed class SendCitizenConversationForDepartmentReviewCommandHandler
    : ICommandHandler<SendCitizenConversationForDepartmentReviewCommand, CitizenConversationDepartmentReviewDto?>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public SendCitizenConversationForDepartmentReviewCommandHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<CitizenConversationDepartmentReviewDto?> Handle(
        SendCitizenConversationForDepartmentReviewCommand request,
        CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();
        var actor = await ActorAuthorization.RequireActiveActorAsync(
            _dbContext,
            request.ActorUserId,
            tenantId,
            cancellationToken);

        if (actor.RoleCode is not (RoleCode.Operator or RoleCode.SystemAdmin))
        {
            throw new ForbiddenAccessException("Bu işlem yalnızca vatandaş operatörü tarafından yapılabilir.");
        }

        var conversationExists = await _dbContext.CitizenConversations
            .AsNoTracking()
            .AnyAsync(
                c => c.CitizenConversationId == request.CitizenConversationId && c.TenantId == tenantId,
                cancellationToken);
        if (!conversationExists)
        {
            return null;
        }

        var departmentExists = await _dbContext.Departments
            .AsNoTracking()
            .AnyAsync(
                d => d.DepartmentId == request.DepartmentId && d.TenantId == tenantId,
                cancellationToken);
        if (!departmentExists)
        {
            throw new ValidationException([
                new FluentValidation.Results.ValidationFailure(
                    nameof(request.DepartmentId),
                    "Seçilen birim bulunamadı.")
            ]);
        }

        var tickets = await CitizenConversationTicketLookup.GetTicketsForConversationAsync(
            _dbContext,
            tenantId,
            request.CitizenConversationId,
            cancellationToken);
        var latestTicket = CitizenConversationTicketLookup.ResolveLatestTicketForDepartment(
            tickets,
            request.DepartmentId);
        if (latestTicket is null || !latestTicket.JobId.HasValue)
        {
            throw new ValidationException([
                new FluentValidation.Results.ValidationFailure(
                    nameof(request.DepartmentId),
                    "Bu numara için seçilen birime bağlı talep bulunamadı.")
            ]);
        }

        var utcNow = DateTimeOffset.UtcNow;
        var activeReviews = await _dbContext.CitizenConversationDepartmentReviews
            .Where(review => review.TenantId == tenantId
                && review.CitizenConversationId == request.CitizenConversationId
                && review.DepartmentId == request.DepartmentId
                && review.AcknowledgedAtUtc == null)
            .OrderByDescending(review => review.RequestedAtUtc)
            .ToListAsync(cancellationToken);

        CitizenConversationDepartmentReview review;
        if (activeReviews.Count > 0)
        {
            review = activeReviews[0];
            foreach (var duplicate in activeReviews.Skip(1))
            {
                _dbContext.CitizenConversationDepartmentReviews.Remove(duplicate);
            }

            review.JobId = latestTicket.JobId.Value;
            review.SocialMessageId = latestTicket.SocialMessageId;
            review.RequestedByUserId = actor.UserId;
            review.RequestedAtUtc = utcNow;
            review.UpdatedByUserId = actor.UserId;
        }
        else
        {
            review = new CitizenConversationDepartmentReview
            {
                ReviewId = Guid.NewGuid(),
                TenantId = tenantId,
                CitizenConversationId = request.CitizenConversationId,
                DepartmentId = request.DepartmentId,
                JobId = latestTicket.JobId.Value,
                SocialMessageId = latestTicket.SocialMessageId,
                RequestedByUserId = actor.UserId,
                RequestedAtUtc = utcNow,
                CreatedByUserId = actor.UserId,
            };
            _dbContext.CitizenConversationDepartmentReviews.Add(review);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        var departmentName = await _dbContext.Departments
            .AsNoTracking()
            .Where(d => d.DepartmentId == request.DepartmentId && d.TenantId == tenantId)
            .Select(d => d.Name)
            .FirstOrDefaultAsync(cancellationToken) ?? string.Empty;

        var conversationProfile = await _dbContext.CitizenConversations
            .AsNoTracking()
            .Where(c => c.CitizenConversationId == request.CitizenConversationId && c.TenantId == tenantId)
            .Select(c => new { c.CitizenPhone, c.CitizenName })
            .FirstOrDefaultAsync(cancellationToken);

        return new CitizenConversationDepartmentReviewDto(
            review.ReviewId,
            review.CitizenConversationId,
            review.DepartmentId,
            departmentName,
            review.JobId,
            review.SocialMessageId,
            review.RequestedByUserId,
            actor.DisplayName,
            review.RequestedAtUtc,
            conversationProfile?.CitizenPhone,
            conversationProfile?.CitizenName);
    }
}
