using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Application.Features.Social;
using CityCommunicationCenter.Application.Features.Tasks;
using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Application.Features.Jobs;

public sealed record ApproveJobTargetCommand(Guid JobId, Guid DepartmentId, Guid? ActorUserId, string? Comment) : ICommand<bool>;

public sealed class ApproveJobTargetCommandHandler : ICommandHandler<ApproveJobTargetCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;
    private readonly ISlaCalculatorService _slaCalculator;
    private readonly ICitizenJobStatusNotifier? _citizenJobStatusNotifier;

    public ApproveJobTargetCommandHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor,
        ISlaCalculatorService slaCalculator,
        ICitizenJobStatusNotifier? citizenJobStatusNotifier = null)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
        _slaCalculator = slaCalculator;
        _citizenJobStatusNotifier = citizenJobStatusNotifier;
    }

    public async ValueTask<bool> Handle(ApproveJobTargetCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var utcNow = DateTimeOffset.UtcNow;
        var job = await _dbContext.Jobs.FirstOrDefaultAsync(j => j.JobId == request.JobId && j.TenantId == tenantId, cancellationToken);
        if (job is null) return false;

        var actor = await JobWorkflowAuthorization.RequireActorAsync(_dbContext, request.ActorUserId, tenantId, cancellationToken);
        await JobWorkflowAuthorization.EnsureManagesDepartmentOrCitizenRequestManagerAsync(
            _dbContext, actor, job, request.DepartmentId, "Hedef departman onay yetkiniz yok.", cancellationToken);

        var jd = await _dbContext.JobDepartments.FirstOrDefaultAsync(
            e => e.JobId == job.JobId && e.DepartmentId == request.DepartmentId
            && e.Role == JobDepartmentRole.Target,
            cancellationToken);
        if (jd is null)
        {
            throw new ValidationException([
                new FluentValidation.Results.ValidationFailure(nameof(request.DepartmentId), "Hedef kaydi bulunamadi.")
            ]);
        }

        if (jd.ApprovalStatus != JobApprovalStatus.Pending)
        {
            throw new ValidationException([
                new FluentValidation.Results.ValidationFailure(nameof(request.DepartmentId), "Sadece onay bekleyen kayitlar onaylanabilir.")
            ]);
        }

        var previousTaskCount = await _dbContext.Tasks
            .AsNoTracking()
            .CountAsync(entity => entity.JobId == job.JobId && entity.TenantId == tenantId, cancellationToken);
        var previousDisplayStatus = CitizenJobStatusLabelHelper.GetDisplayStatus(
            job.Status,
            job.DueDateUtc,
            previousTaskCount,
            utcNow);

        jd.ApprovalStatus = JobApprovalStatus.Approved;
        jd.ApprovedByUserId = actor.UserId;
        jd.DecidedAtUtc = utcNow;
        jd.UpdatedAtUtc = utcNow;
        jd.UpdatedByUserId = actor.UserId;

        var all = await _dbContext.JobDepartments.Where(e => e.JobId == job.JobId).ToListAsync(cancellationToken);
        var targets = all.Where(x => x.Role == JobDepartmentRole.Target).ToList();
        var ownerOk = all.Any(x => x.Role == JobDepartmentRole.Owner && x.ApprovalStatus == JobApprovalStatus.Approved);
        var targetsOk = targets.All(x => x.ApprovalStatus == JobApprovalStatus.Approved || x.ApprovalStatus == JobApprovalStatus.NotRequired);
        var isCoordinatedExternal = job.RequestType == JobRequestType.ExternalUnit
            && (job.IsCoordinated || targets.Count > 1);

        var createdTaskCount = 0;
        // Koordine taleplerde ilk hedef birim onayı talebi aktive eder; diğer hedefler bağımsız onaylar (card #866).
        var shouldActivate = isCoordinatedExternal
            ? ownerOk
            : ownerOk && targetsOk;

        if (shouldActivate)
        {
            job.Status = JobStatus.Active;
            job.UpdatedAtUtc = utcNow;
            job.UpdatedByUserId = actor.UserId;
            if (job.JobNumber is null)
            {
                job.JobNumberYear = utcNow.Year;
                job.JobNumber = await SequenceNumberHelper.NextJobNumberAsync(_dbContext, tenantId, utcNow.Year, cancellationToken);
            }
            if (job.DueDateUtc is null)
            {
                var settings = await _dbContext.TenantSettings.FirstOrDefaultAsync(cancellationToken);
                if (settings is not null && settings.DefaultSlaHours > 0)
                {
                    job.DueDateUtc = await _slaCalculator.CalculateDueDateAsync(
                        utcNow, settings.DefaultSlaHours, tenantId, request.DepartmentId, cancellationToken);
                }
            }
            if (!isCoordinatedExternal)
            {
                createdTaskCount = await JobOwnerTaskProvisioning.EnsureOwnerTasksAsync(
                    _dbContext, tenantId, job, actor.UserId, utcNow, cancellationToken);
            }
        }

        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = tenantId,
            EntityType = nameof(Job),
            EntityId = job.JobId.ToString(),
            Action = "JobTargetApproved",
            ActorUserId = actor.UserId,
            ActorDisplayName = actor.DisplayName,
            StatusAtEvent = job.Status.ToString(),
            Notes = request.Comment,
            Details = $"Dept={request.DepartmentId} {request.Comment} CreatedTasks={createdTaskCount}"
        });

        await _dbContext.SaveChangesAsync(cancellationToken);
        if (_citizenJobStatusNotifier is not null)
        {
            await _citizenJobStatusNotifier.NotifyStatusChangedAsync(
                tenantId,
                job.JobId,
                previousDisplayStatus,
                cancellationToken);
        }

        return true;
    }
}

public sealed record RejectJobTargetCommand(Guid JobId, Guid DepartmentId, Guid? ActorUserId, string Reason) : ICommand<bool>;

public sealed class RejectJobTargetCommandValidator : AbstractValidator<RejectJobTargetCommand>
{
    public RejectJobTargetCommandValidator() { RuleFor(c => c.Reason).NotEmpty().WithMessage("Red nedeni zorunludur."); }
}

public sealed class RejectJobTargetCommandHandler : ICommandHandler<RejectJobTargetCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public RejectJobTargetCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<bool> Handle(RejectJobTargetCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var utcNow = DateTimeOffset.UtcNow;
        var job = await _dbContext.Jobs.FirstOrDefaultAsync(j => j.JobId == request.JobId && j.TenantId == tenantId, cancellationToken);
        if (job is null) return false;

        var actor = await JobWorkflowAuthorization.RequireActorAsync(_dbContext, request.ActorUserId, tenantId, cancellationToken);
        await JobWorkflowAuthorization.EnsureManagesDepartmentOrCitizenRequestManagerAsync(
            _dbContext, actor, job, request.DepartmentId, "Hedef departman red yetkiniz yok.", cancellationToken);

        var jd = await _dbContext.JobDepartments.FirstOrDefaultAsync(
            e => e.JobId == job.JobId && e.DepartmentId == request.DepartmentId
            && e.Role == JobDepartmentRole.Target,
            cancellationToken);
        if (jd is null || jd.ApprovalStatus != JobApprovalStatus.Pending)
        {
            throw new ValidationException([
                new FluentValidation.Results.ValidationFailure(nameof(request.DepartmentId), "Onay bekleyen kayit bulunamadi.")
            ]);
        }

        jd.ApprovalStatus = JobApprovalStatus.Rejected;
        jd.ApprovedByUserId = actor.UserId;
        jd.DecidedAtUtc = utcNow;
        jd.RejectReason = request.Reason;
        jd.UpdatedAtUtc = utcNow;
        jd.UpdatedByUserId = actor.UserId;

        // Hedef birim reddettiğinde o birime ait açık görevleri iptal et (card #856).
        var activeTargetTasks = await _dbContext.Tasks
            .Where(task => task.JobId == job.JobId
                && task.TenantId == tenantId
                && task.AssignedDepartmentId == request.DepartmentId
                && task.CurrentStatus != WorkflowTaskStatus.Completed
                && task.CurrentStatus != WorkflowTaskStatus.Cancelled
                && task.CurrentStatus != WorkflowTaskStatus.Rejected)
            .ToListAsync(cancellationToken);

        foreach (var targetTask in activeTargetTasks)
        {
            targetTask.CurrentStatus = WorkflowTaskStatus.Cancelled;
            targetTask.RevisionReason = request.Reason;
            targetTask.UpdatedAtUtc = utcNow;
            targetTask.UpdatedByUserId = actor.UserId;
        }

        job.UpdatedAtUtc = utcNow;
        job.UpdatedByUserId = actor.UserId;

        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = tenantId,
            EntityType = nameof(Job),
            EntityId = job.JobId.ToString(),
            Action = "JobTargetRejected",
            ActorUserId = actor.UserId,
            ActorDisplayName = actor.DisplayName,
            StatusAtEvent = job.Status.ToString(),
            Notes = request.Reason,
            Details = request.Reason
        });

        await _dbContext.SaveChangesAsync(cancellationToken);

        var previousStatus = job.Status;
        var newJobStatus = await TaskWorkflowAuthorization.RecomputeJobCompletionAsync(_dbContext, job.JobId, cancellationToken);
        if (newJobStatus.HasValue && job.Status != previousStatus)
        {
            job.UpdatedAtUtc = utcNow;
            job.UpdatedByUserId = actor.UserId;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}
