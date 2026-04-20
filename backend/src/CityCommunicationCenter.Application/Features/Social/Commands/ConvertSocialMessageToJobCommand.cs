using CityCommunicationCenter.Application.Features.Jobs;

namespace CityCommunicationCenter.Application.Features.Social;

public sealed record ConvertSocialMessageToJobCommand(
    Guid MessageId,
    Guid? ActorUserId,
    string Title,
    string Description,
    Guid OwnerDepartmentId,
    string Priority,
    DateTimeOffset? DueDateUtc) : ICommand<JobSummaryResponse?>;

public sealed class ConvertSocialMessageToJobCommandValidator : AbstractValidator<ConvertSocialMessageToJobCommand>
{
    public ConvertSocialMessageToJobCommandValidator()
    {
        RuleFor(c => c.Title).NotEmpty().WithMessage("Is basligi zorunludur.");
        RuleFor(c => c.Description).NotEmpty().WithMessage("Is aciklamasi zorunludur.");
        RuleFor(c => c.Priority).NotEmpty().WithMessage("Oncelik zorunludur.");
        RuleFor(c => c.OwnerDepartmentId).NotEmpty().WithMessage("Sahip mudurluk zorunludur.");
    }
}

public sealed class ConvertSocialMessageToJobCommandHandler : IRequestHandler<ConvertSocialMessageToJobCommand, JobSummaryResponse?>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;
    private readonly ISender _sender;

    public ConvertSocialMessageToJobCommandHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor,
        ISender sender)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
        _sender = sender;
    }

    public async Task<JobSummaryResponse?> Handle(ConvertSocialMessageToJobCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var message = await _dbContext.SocialMessages.FirstOrDefaultAsync(
            e => e.SocialMessageId == request.MessageId, cancellationToken);
        if (message is null) return null;

        if (message.JobId.HasValue)
        {
            var existingJob = await _dbContext.Jobs.FirstOrDefaultAsync(
                j => j.JobId == message.JobId.Value, cancellationToken);
            if (existingJob is not null)
            {
                return await JobSummaryResponseFactory.CreateAsync(_dbContext, existingJob, cancellationToken);
            }
        }

        var jobSummary = await _sender.Send(new CreateJobCommand(
            request.ActorUserId,
            request.Title,
            request.Description,
            request.OwnerDepartmentId,
            request.Priority,
            StartDateUtc: null,
            request.DueDateUtc,
            TargetDepartmentIds: null,
            SourceType: JobSourceType.SocialMessage.ToString(),
            SourceRefId: message.SocialMessageId), cancellationToken);

        message.JobId = jobSummary.JobId;
        message.Status = SocialMessageStatus.ConvertedToTask;
        message.UpdatedByUserId = request.ActorUserId;
        message.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _dbContext.SaveChangesAsync(cancellationToken);

        return jobSummary;
    }
}
