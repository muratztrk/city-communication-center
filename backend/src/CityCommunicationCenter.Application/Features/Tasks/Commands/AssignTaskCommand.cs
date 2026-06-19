using CityCommunicationCenter.Application.Features.Users;
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

public sealed class AssignTaskCommandHandler : ICommandHandler<AssignTaskCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;
    private readonly ISlaCalculatorService _slaCalculator;

    public AssignTaskCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor, ISlaCalculatorService slaCalculator)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
        _slaCalculator = slaCalculator;
    }

    public async ValueTask<bool> Handle(AssignTaskCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var task = await _dbContext.Tasks.FirstOrDefaultAsync(e => e.TaskId == request.TaskId && e.TenantId == tenantId, cancellationToken);
        if (task is null) return false;

        var job = await _dbContext.Jobs.FirstOrDefaultAsync(e => e.JobId == task.JobId && e.TenantId == tenantId, cancellationToken)
            ?? throw Validation(nameof(request.TaskId), "Gorev icin is bulunamadi.");

        await TaskWorkflowAuthorization.EnsureCanAssignAsync(_dbContext, task, job, request.ActorUserId, tenantId, cancellationToken);

        if (task.CurrentStatus is WorkflowTaskStatus.Completed or WorkflowTaskStatus.Cancelled)
        {
            throw Validation(nameof(request.TaskId), "Tamamlanmis veya iptal edilmis gorev yeniden atanamaz.");
        }

        Department? targetDepartment = null;
        if (request.DepartmentId.HasValue)
        {
            targetDepartment = await _dbContext.Departments.FirstOrDefaultAsync(
                e => e.DepartmentId == request.DepartmentId.Value && e.TenantId == tenantId, cancellationToken);
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

            if (targetDepartment is not null &&
                !await UserDepartmentAccess.CanWorkInDepartmentAsync(_dbContext, tenantId, targetUser, targetDepartment.DepartmentId, cancellationToken))
            {
                throw Validation(nameof(request.UserId), "Secilen kullanici secilen departmana ait degil.");
            }

            if (targetDepartment is null)
            {
                var defaultDepartmentId = await UserDepartmentAccess.GetDefaultDepartmentIdAsync(
                    _dbContext,
                    tenantId,
                    targetUser,
                    context.ActiveDepartmentId,
                    cancellationToken);
                targetDepartment = await _dbContext.Departments.FirstOrDefaultAsync(
                    e => e.DepartmentId == defaultDepartmentId && e.TenantId == tenantId, cancellationToken);
            }
        }

        if (request.UserId.HasValue && targetDepartment is null)
        {
            throw Validation(nameof(request.DepartmentId), "Kullanici icin gecerli bir departman bulunamadi.");
        }

        var previousDepartmentId = task.AssignedDepartmentId;
        var previousUserId = task.AssignedUserId;
        var utcNow = DateTimeOffset.UtcNow;

        task.AssignedDepartmentId = targetDepartment?.DepartmentId;
        task.AssignedUserId = targetUser?.UserId;
        // Bir kullanıcıya atandıysa atanma anını kaydet; havuza/birime bırakıldıysa temizle (card 589).
        task.AssignedAtUtc = targetUser is not null ? utcNow : null;
        task.AssigningManagerId = request.ActorUserId;
        task.CurrentStatus = WorkflowTaskStatus.Assigned;
        task.UpdatedByUserId = request.ActorUserId;
        task.UpdatedAtUtc = utcNow;
        if (task.DueDateUtc is null)
        {
            var settings = await _dbContext.TenantSettings
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.TenantId == tenantId, cancellationToken);
            if (settings is not null && settings.DefaultSlaHours > 0)
            {
                task.DueDateUtc = await _slaCalculator.CalculateDueDateAsync(
                    utcNow, settings.DefaultSlaHours, tenantId, task.AssignedDepartmentId, cancellationToken);
            }
        }

        _dbContext.AssignmentHistories.Add(new AssignmentHistory
        {
            AssignmentId = Guid.NewGuid(),
            TenantId = tenantId,
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
            TenantId = tenantId,
            EntityType = nameof(WorkTask),
            EntityId = request.TaskId.ToString(),
            Action = "TaskAssigned",
            ActorUserId = request.ActorUserId,
            StatusAtEvent = WorkflowTaskStatus.Assigned.ToString()
        });

        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    private static ValidationException Validation(string p, string m) =>
        new([new FluentValidation.Results.ValidationFailure(p, m)]);
}
