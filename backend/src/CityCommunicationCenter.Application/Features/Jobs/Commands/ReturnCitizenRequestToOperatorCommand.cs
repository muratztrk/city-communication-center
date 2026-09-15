using CityCommunicationCenter.Application.Features.Reports;
using CityCommunicationCenter.Application.Features.Users;
using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Application.Features.Jobs;

/// <summary>
/// Onaylanmış hedef birimde açık görev kalmayan vatandaş talebini operatöre iade eder (cards #3675-#3677).
/// </summary>
public sealed record ReturnCitizenRequestToOperatorCommand(
    Guid JobId,
    Guid? ActorUserId,
    Guid DepartmentId,
    string Reason) : ICommand<bool>;

public sealed class ReturnCitizenRequestToOperatorCommandValidator : AbstractValidator<ReturnCitizenRequestToOperatorCommand>
{
    public ReturnCitizenRequestToOperatorCommandValidator()
    {
        RuleFor(c => c.JobId).NotEmpty().WithMessage("Talep zorunludur.");
        RuleFor(c => c.DepartmentId).NotEmpty().WithMessage("Birim zorunludur.");
        RuleFor(c => c.Reason).NotEmpty().WithMessage("Operatöre iade nedeni zorunludur.")
            .MaximumLength(400).WithMessage("Operatöre iade nedeni en fazla 400 karakter olabilir.");
    }
}

public sealed class ReturnCitizenRequestToOperatorCommandHandler : ICommandHandler<ReturnCitizenRequestToOperatorCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public ReturnCitizenRequestToOperatorCommandHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<bool> Handle(ReturnCitizenRequestToOperatorCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var utcNow = DateTimeOffset.UtcNow;

        var job = await _dbContext.Jobs.FirstOrDefaultAsync(
            j => j.JobId == request.JobId && j.TenantId == tenantId,
            cancellationToken);
        if (job is null)
        {
            return false;
        }

        if (!JobCitizenRequestHelper.IsCitizenRequest(job))
        {
            throw Validation(nameof(request.JobId), "Yalnızca vatandaş talepleri operatöre iade edilebilir.");
        }

        if (job.Status != JobStatus.Active)
        {
            throw Validation(nameof(request.JobId), "Yalnızca aktif talepler operatöre iade edilebilir.");
        }

        var openTaskCount = await _dbContext.Tasks.CountAsync(
            t => t.JobId == job.JobId
                && t.TenantId == tenantId
                && t.CurrentStatus != WorkflowTaskStatus.Completed
                && t.CurrentStatus != WorkflowTaskStatus.Cancelled
                && t.CurrentStatus != WorkflowTaskStatus.Rejected,
            cancellationToken);
        if (openTaskCount > 0)
        {
            throw Validation(nameof(request.JobId), "Açık görevi olan talepler operatöre iade edilemez.");
        }

        if (!CitizenVtDashboardClassification.IsProcessingReceived(
                new CitizenVtDashboardClassification.JobSlice(job.Status, job.DueDateUtc, openTaskCount),
                utcNow))
        {
            throw Validation(nameof(request.JobId), "Talep işleme alındı durumunda değil.");
        }

        var actor = await JobWorkflowAuthorization.RequireActorAsync(_dbContext, request.ActorUserId, tenantId, cancellationToken);
        var isSystemAdmin = JobWorkflowAuthorization.IsSystemAdmin(actor);
        var canManageAsManager = await JobWorkflowAuthorization.CanManageJobAsDepartmentLeaderAsync(
            _dbContext,
            actor,
            request.DepartmentId,
            cancellationToken);
        var canManageAsCitizenRequestManager = await UserRoleAccess.CanManageCitizenRequestInTargetDepartmentAsync(
            _dbContext,
            tenantId,
            actor,
            job,
            request.DepartmentId,
            cancellationToken);

        if (!isSystemAdmin && !canManageAsManager && !canManageAsCitizenRequestManager)
        {
            throw new ForbiddenAccessException("Talebi operatöre iade etme yetkiniz yok.");
        }

        var targetDepartment = await _dbContext.JobDepartments.FirstOrDefaultAsync(
            jd => jd.JobId == job.JobId
                && jd.Role == JobDepartmentRole.Target
                && jd.DepartmentId == request.DepartmentId
                && jd.ApprovalStatus == JobApprovalStatus.Approved,
            cancellationToken);
        if (targetDepartment is null)
        {
            throw Validation(nameof(request.DepartmentId), "Onaylanmış hedef birim kaydı bulunamadı.");
        }

        var trimmedReason = request.Reason.Trim();
        job.ReturnedToOperatorAtUtc = utcNow;
        job.ReturnedToOperatorReason = trimmedReason;
        job.ReturnedToOperatorByUserId = actor.UserId;
        job.ReturnedToOperatorFromDepartmentId = request.DepartmentId;
        job.UpdatedAtUtc = utcNow;
        job.UpdatedByUserId = actor.UserId;

        _dbContext.JobDepartments.Remove(targetDepartment);

        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = tenantId,
            EntityType = nameof(Job),
            EntityId = job.JobId.ToString(),
            Action = "CitizenRequestReturnedToOperator",
            ActorUserId = actor.UserId,
            ActorDisplayName = actor.DisplayName,
            StatusAtEvent = job.Status.ToString(),
            Notes = trimmedReason,
            Details = $"DepartmentId={request.DepartmentId}",
        });

        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    private static ValidationException Validation(string property, string message) =>
        new([new FluentValidation.Results.ValidationFailure(property, message)]);
}
