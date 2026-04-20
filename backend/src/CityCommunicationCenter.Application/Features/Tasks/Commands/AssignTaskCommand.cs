using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Application.Features.Tasks;

public sealed record AssignTaskCommand(
    Guid TaskId,
    Guid? ActorUserId,
    Guid? DepartmentId,
    Guid? UserId) : ICommand<bool>;

public sealed class AssignTaskCommandValidator : AbstractValidator<AssignTaskCommand>
{
    public AssignTaskCommandValidator()
    {
        RuleFor(c => c)
            .Must(c => c.DepartmentId.HasValue || c.UserId.HasValue)
            .WithMessage("En az bir atama hedefi gereklidir.");
    }
}

public sealed class AssignTaskCommandHandler : IRequestHandler<AssignTaskCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public AssignTaskCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async Task<bool> Handle(AssignTaskCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var task = await _dbContext.Tasks.FirstOrDefaultAsync(e => e.TaskId == request.TaskId, cancellationToken);
        if (task is null) return false;

        var job = await _dbContext.Jobs.FirstOrDefaultAsync(e => e.JobId == task.JobId, cancellationToken)
            ?? throw Validation(nameof(request.TaskId), "Gorev icin is bulunamadi.");

        await TaskWorkflowAuthorization.EnsureCanAssignAsync(_dbContext, task, job, request.ActorUserId, cancellationToken);

        if (task.CurrentStatus is WorkflowTaskStatus.Completed or WorkflowTaskStatus.Cancelled)
        {
            throw Validation(nameof(request.TaskId), "Tamamlanmis veya iptal edilmis gorev yeniden atanamaz.");
        }

        Department? targetDepartment = null;
        if (request.DepartmentId.HasValue)
        {
            targetDepartment = await _dbContext.Departments.FirstOrDefaultAsync(
                e => e.DepartmentId == request.DepartmentId.Value, cancellationToken);
            if (targetDepartment is null)
            {
                throw Validation(nameof(request.DepartmentId), "Secilen departman bulunamadi.");
            }
        }

        ApplicationUser? targetUser = null;
        if (request.UserId.HasValue)
        {
            targetUser = await _dbContext.Users.FirstOrDefaultAsync(e => e.UserId == request.UserId.Value, cancellationToken);
            if (targetUser is null || !targetUser.IsActive)
            {
                throw Validation(nameof(request.UserId), "Secilen kullanici bulunamadi veya aktif degil.");
            }

            if (targetDepartment is not null && targetUser.DepartmentId != targetDepartment.DepartmentId)
            {
                throw Validation(nameof(request.UserId), "Secilen kullanici secilen departmana ait degil.");
            }

            targetDepartment ??= await _dbContext.Departments.FirstOrDefaultAsync(
                e => e.DepartmentId == targetUser.DepartmentId, cancellationToken);
        }

        if (request.UserId.HasValue && targetDepartment is null)
        {
            throw Validation(nameof(request.DepartmentId), "Kullanici icin gecerli bir departman bulunamadi.");
        }

        var previousDepartmentId = task.AssignedDepartmentId;
        var previousUserId = task.AssignedUserId;

        task.AssignedDepartmentId = targetDepartment?.DepartmentId;
        task.AssignedUserId = targetUser?.UserId;
        task.AssigningManagerId = request.ActorUserId;
        task.CurrentStatus = WorkflowTaskStatus.Assigned;
        task.UpdatedByUserId = request.ActorUserId;
        task.UpdatedAtUtc = DateTimeOffset.UtcNow;

        _dbContext.AssignmentHistories.Add(new AssignmentHistory
        {
            AssignmentId = Guid.NewGuid(),
            TenantId = context.TenantId!.Value,
            TaskId = request.TaskId,
            FromDepartmentId = previousDepartmentId,
            ToDepartmentId = targetDepartment?.DepartmentId,
            FromUserId = previousUserId,
            ToUserId = targetUser?.UserId,
            ActionType = "Assign",
            CreatedByUserId = request.ActorUserId
        });

        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = context.TenantId.Value,
            EntityType = nameof(WorkTask),
            EntityId = request.TaskId.ToString(),
            Action = "TaskAssigned",
            ActorUserId = request.ActorUserId
        });

        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    private static ValidationException Validation(string p, string m) =>
        new([new FluentValidation.Results.ValidationFailure(p, m)]);
}
