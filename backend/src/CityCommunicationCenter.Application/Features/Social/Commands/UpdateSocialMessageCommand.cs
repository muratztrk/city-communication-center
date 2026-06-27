using CityCommunicationCenter.Application.Features.Jobs;

namespace CityCommunicationCenter.Application.Features.Social;

public sealed record UpdateSocialMessageCommand(
    Guid MessageId,
    Guid? ActorUserId,
    SocialChannel Channel,
    string CitizenHandle,
    string Content,
    string? Category,
    double? Latitude,
    double? Longitude) : ICommand<bool>;

public sealed class UpdateSocialMessageCommandValidator : AbstractValidator<UpdateSocialMessageCommand>
{
    public UpdateSocialMessageCommandValidator()
    {
        RuleFor(c => c.CitizenHandle).NotEmpty().WithMessage("Vatandas bilgisi zorunludur.");
        RuleFor(c => c.Content).NotEmpty().WithMessage("Talep icerigi zorunludur.");
    }
}

public sealed class UpdateSocialMessageCommandHandler : ICommandHandler<UpdateSocialMessageCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public UpdateSocialMessageCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<bool> Handle(UpdateSocialMessageCommand request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();
        var actor = await JobWorkflowAuthorization.RequireActorAsync(_dbContext, request.ActorUserId, tenantId, cancellationToken);

        var message = await _dbContext.SocialMessages
            .FirstOrDefaultAsync(m => m.SocialMessageId == request.MessageId && m.TenantId == tenantId, cancellationToken);
        if (message is null) return false;

        if (message.JobId.HasValue)
        {
            var job = await _dbContext.Jobs
                .FirstOrDefaultAsync(j => j.JobId == message.JobId.Value && j.TenantId == tenantId, cancellationToken);
            if (job is null) return false;

            var hasTasks = await _dbContext.Tasks
                .AnyAsync(t => t.JobId == job.JobId && t.TenantId == tenantId, cancellationToken);

            var canOperatorEdit = actor.RoleCode == RoleCode.Operator
                && job.RequestType == JobRequestType.ExternalUnit
                && job.SourceType is JobSourceType.SocialMessage or JobSourceType.CitizenRequest or JobSourceType.EDevlet
                && (job.Status == JobStatus.PendingExternalApproval
                    || (job.Status == JobStatus.Active && !hasTasks));

            if (!canOperatorEdit && actor.RoleCode != RoleCode.SystemAdmin)
            {
                throw new ForbiddenAccessException("Bu vatandas talebini duzenleme yetkiniz yok.");
            }
        }
        else if (actor.RoleCode is not (RoleCode.Operator or RoleCode.SystemAdmin))
        {
            throw new ForbiddenAccessException("Bu vatandas talebini duzenleme yetkiniz yok.");
        }

        message.Channel = request.Channel;
        message.CitizenHandle = request.CitizenHandle.Trim();
        message.Content = request.Content.Trim();
        message.Category = string.IsNullOrWhiteSpace(request.Category) ? null : request.Category.Trim();
        message.Latitude = request.Latitude;
        message.Longitude = request.Longitude;
        message.UpdatedByUserId = actor.UserId;
        message.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}
