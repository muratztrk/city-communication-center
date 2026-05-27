namespace CityCommunicationCenter.Application.Features.Jobs;

public sealed record UpdateJobCommand(
    Guid JobId,
    Guid? ActorUserId,
    string Title,
    string Description,
    string Priority,
    DateTimeOffset? StartDateUtc,
    DateTimeOffset? DueDateUtc,
    double? Latitude,
    double? Longitude) : ICommand<bool>;

public sealed class UpdateJobCommandValidator : AbstractValidator<UpdateJobCommand>
{
    public UpdateJobCommandValidator()
    {
        RuleFor(c => c.Title).NotEmpty().WithMessage("Is basligi zorunludur.");
        RuleFor(c => c.Description).NotEmpty().WithMessage("Is aciklamasi zorunludur.");
        RuleFor(c => c.Priority).NotEmpty().WithMessage("Oncelik zorunludur.");
    }
}

public sealed class UpdateJobCommandHandler : ICommandHandler<UpdateJobCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public UpdateJobCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<bool> Handle(UpdateJobCommand request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();
        var job = await _dbContext.Jobs
            .FirstOrDefaultAsync(j => j.JobId == request.JobId && j.TenantId == tenantId, cancellationToken);

        if (job is null) return false;

        var actor = await JobWorkflowAuthorization.RequireActorAsync(_dbContext, request.ActorUserId, tenantId, cancellationToken);

        if (job.Status is not (JobStatus.Draft or JobStatus.PendingOwnerApproval or JobStatus.PendingExternalApproval or JobStatus.RevisionRequested))
        {
            throw new ValidationException([
                new FluentValidation.Results.ValidationFailure(nameof(request.JobId), "Sadece onay bekleyen veya taslak isler duzenlenebilir.")
            ]);
        }

        if (actor.RoleCode is not Domain.Enums.RoleCode.SystemAdmin && job.CreatedByUserId != actor.UserId)
        {
            await JobWorkflowAuthorization.EnsureManagesDepartmentAsync(
                _dbContext, actor, job.OwnerDepartmentId, "Bu isi duzenleme yetkiniz yok.", cancellationToken);
        }

        var utcNow = DateTimeOffset.UtcNow;
        job.Title = request.Title;
        job.Description = request.Description;
        job.Priority = request.Priority;
        job.StartDateUtc = request.StartDateUtc;
        job.DueDateUtc = request.DueDateUtc;
        job.Latitude = request.Latitude;
        job.Longitude = request.Longitude;
        job.UpdatedAtUtc = utcNow;
        job.UpdatedByUserId = actor.UserId;

        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = tenantId,
            EntityType = nameof(Job),
            EntityId = job.JobId.ToString(),
            Action = "JobUpdated",
            ActorUserId = actor.UserId,
            ActorDisplayName = actor.DisplayName,
            StatusAtEvent = job.Status.ToString(),
            Notes = $"Title updated: {job.Title}",
            Details = $"Title={job.Title}"
        });

        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}
