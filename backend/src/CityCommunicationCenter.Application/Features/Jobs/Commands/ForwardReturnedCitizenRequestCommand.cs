using CityCommunicationCenter.Application.Features.Users;
using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Application.Features.Jobs;

/// <summary>
/// Operatöre iade edilmiş vatandaş talebini yeni bir hedef birime yönlendirir (cards #3685/#3686).
/// </summary>
public sealed record ForwardReturnedCitizenRequestCommand(
    Guid JobId,
    Guid TargetDepartmentId,
    Guid? ActorUserId,
    string Note) : ICommand<bool>;

public sealed class ForwardReturnedCitizenRequestCommandValidator : AbstractValidator<ForwardReturnedCitizenRequestCommand>
{
    public ForwardReturnedCitizenRequestCommandValidator()
    {
        RuleFor(c => c.JobId).NotEmpty().WithMessage("Talep zorunludur.");
        RuleFor(c => c.TargetDepartmentId).NotEmpty().WithMessage("Yönlendirilecek birim zorunludur.");
        RuleFor(c => c.Note).NotEmpty().WithMessage("Talep yönlendirme notu zorunludur.")
            .MaximumLength(400).WithMessage("Talep yönlendirme notu en fazla 400 karakter olabilir.");
    }
}

public sealed class ForwardReturnedCitizenRequestCommandHandler : ICommandHandler<ForwardReturnedCitizenRequestCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public ForwardReturnedCitizenRequestCommandHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<bool> Handle(ForwardReturnedCitizenRequestCommand request, CancellationToken cancellationToken)
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
            throw Validation(nameof(request.JobId), "Yalnızca vatandaş talepleri yönlendirilebilir.");
        }

        if (job.Status != JobStatus.Active)
        {
            throw Validation(nameof(request.JobId), "Yalnızca aktif talepler yönlendirilebilir.");
        }

        if (!job.ReturnedToOperatorAtUtc.HasValue)
        {
            throw Validation(nameof(request.JobId), "Talep operatöre iade edilmiş durumda değil.");
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
            throw Validation(nameof(request.JobId), "Açık görevi olan talepler yönlendirilemez.");
        }

        var actor = await JobWorkflowAuthorization.RequireActorAsync(_dbContext, request.ActorUserId, tenantId, cancellationToken);
        var isSystemAdmin = JobWorkflowAuthorization.IsSystemAdmin(actor);
        var isOperator = actor.RoleCode == RoleCode.Operator;
        var isCitizenRequestManager = UserRoleAccess.IsCitizenRequestManager(actor);
        if (!isSystemAdmin && !isOperator && !isCitizenRequestManager)
        {
            throw new ForbiddenAccessException("İade edilmiş talebi yönlendirme yetkiniz yok.");
        }

        var existingTarget = await _dbContext.JobDepartments.AnyAsync(
            jd => jd.JobId == job.JobId
                && jd.Role == JobDepartmentRole.Target
                && jd.DepartmentId == request.TargetDepartmentId,
            cancellationToken);
        if (existingTarget)
        {
            throw Validation(nameof(request.TargetDepartmentId), "Bu birim zaten talebin hedefinde.");
        }

        var targetDepartment = await _dbContext.Departments.FirstOrDefaultAsync(
            d => d.DepartmentId == request.TargetDepartmentId && d.TenantId == tenantId,
            cancellationToken)
            ?? throw Validation(nameof(request.TargetDepartmentId), "Yönlendirilecek birim bulunamadı.");

        var trimmedNote = request.Note.Trim();
        var previousDepartmentId = job.ReturnedToOperatorFromDepartmentId;

        _dbContext.JobDepartments.Add(new JobDepartment
        {
            JobDepartmentId = Guid.NewGuid(),
            TenantId = tenantId,
            JobId = job.JobId,
            DepartmentId = request.TargetDepartmentId,
            Role = JobDepartmentRole.Target,
            ApprovalStatus = JobApprovalStatus.Pending,
            RequestedByUserId = actor.UserId,
            RequestedAtUtc = utcNow,
            Notes = trimmedNote,
            CreatedByUserId = actor.UserId,
        });

        job.ReturnedToOperatorAtUtc = null;
        job.UpdatedAtUtc = utcNow;
        job.UpdatedByUserId = actor.UserId;

        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = tenantId,
            EntityType = nameof(Job),
            EntityId = job.JobId.ToString(),
            Action = "CitizenRequestForwardedFromReturn",
            ActorUserId = actor.UserId,
            ActorDisplayName = actor.DisplayName,
            StatusAtEvent = job.Status.ToString(),
            Notes = trimmedNote,
            Details = previousDepartmentId.HasValue
                ? $"From={previousDepartmentId.Value} To={targetDepartment.DepartmentId}"
                : $"To={targetDepartment.DepartmentId}",
        });

        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    private static ValidationException Validation(string property, string message) =>
        new([new FluentValidation.Results.ValidationFailure(property, message)]);
}
