using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Application.Features.Tasks;

public sealed record AssignTaskCommand(
    Guid TaskId,
    Guid? ActorUserId,
    Guid? DepartmentId,
    Guid? UserId,
    string ActionType) : ICommand<bool>;

public sealed class AssignTaskCommandValidator : AbstractValidator<AssignTaskCommand>
{
    public AssignTaskCommandValidator()
    {
        RuleFor(command => command)
            .Must(command => command.DepartmentId.HasValue || command.UserId.HasValue)
            .WithMessage("En az bir atama hedefi gereklidir.");
        RuleFor(command => command.ActionType)
            .NotEmpty()
            .WithMessage("Atama aksiyonu zorunludur.");
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
        var task = await _dbContext.Tasks.FirstOrDefaultAsync(entity => entity.TaskId == request.TaskId, cancellationToken);
        if (task is null)
        {
            return false;
        }

        await TaskWorkflowAuthorization.EnsureCanAssignAsync(
            _dbContext,
            task,
            request.ActorUserId,
            cancellationToken);

        if (task.CurrentStatus is WorkflowTaskStatus.Closed or WorkflowTaskStatus.Completed)
        {
            throw CreateValidationException(nameof(request.TaskId), "Kapali veya tamamlanmis gorev yeniden atanamaz.");
        }

        Department? targetDepartment = null;
        if (request.DepartmentId.HasValue)
        {
            targetDepartment = await _dbContext.Departments
                .FirstOrDefaultAsync(entity => entity.DepartmentId == request.DepartmentId.Value, cancellationToken);

            if (targetDepartment is null)
            {
                throw CreateValidationException(nameof(request.DepartmentId), "Secilen departman bulunamadi.");
            }
        }

        ApplicationUser? targetUser = null;
        if (request.UserId.HasValue)
        {
            targetUser = await _dbContext.Users
                .FirstOrDefaultAsync(entity => entity.UserId == request.UserId.Value, cancellationToken);

            if (targetUser is null || !targetUser.IsActive)
            {
                throw CreateValidationException(nameof(request.UserId), "Secilen kullanici bulunamadi veya aktif degil.");
            }

            if (targetDepartment is not null && targetUser.DepartmentId != targetDepartment.DepartmentId)
            {
                throw CreateValidationException(nameof(request.UserId), "Secilen kullanici secilen departmana ait degil.");
            }

            targetDepartment ??= await _dbContext.Departments
                .FirstOrDefaultAsync(entity => entity.DepartmentId == targetUser.DepartmentId, cancellationToken);
        }

        if (request.UserId.HasValue && targetDepartment is null)
        {
            throw CreateValidationException(nameof(request.DepartmentId), "Kullanici icin gecerli bir departman bulunamadi.");
        }

        var previousDepartmentId = task.AssignedDepartmentId ?? task.TargetDepartmentId;
        var previousUserId = task.AssignedUserId;

        task.AssignedDepartmentId = targetDepartment?.DepartmentId;
        task.AssignedUserId = targetUser?.UserId;
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
            ActionType = request.ActionType,
            CreatedByUserId = request.ActorUserId
        });

        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = context.TenantId.Value,
            EntityType = nameof(WorkTask),
            EntityId = request.TaskId.ToString(),
            Action = "TaskAssigned",
            ActorUserId = request.ActorUserId,
            Details = request.ActionType
        });
        await _dbContext.SaveChangesAsync(cancellationToken);

        return true;
    }

    private static ValidationException CreateValidationException(string propertyName, string message)
    {
        return new ValidationException([
            new FluentValidation.Results.ValidationFailure(propertyName, message)
        ]);
    }
}