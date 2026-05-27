using CityCommunicationCenter.Application.Features.Users;
using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Application.Features.Tasks;

public sealed record CreateTaskCommand(
    Guid? ActorUserId,
    Guid JobId,
    string Title,
    string Description,
    string Priority,
    DateTimeOffset? StartDateUtc,
    DateTimeOffset? DueDateUtc,
    decimal? EstimatedHours,
    string? Notes,
    Guid? AssignedDepartmentId,
    Guid? AssignedUserId) : ICommand<TaskSummaryResponse>;

public sealed class CreateTaskCommandValidator : AbstractValidator<CreateTaskCommand>
{
    public CreateTaskCommandValidator()
    {
        RuleFor(c => c.JobId).NotEmpty().WithMessage("Gorev icin is (Job) zorunludur.");
        RuleFor(c => c.Title).NotEmpty().WithMessage("Gorev basligi zorunludur.");
        RuleFor(c => c.Description).NotEmpty().WithMessage("Gorev aciklamasi zorunludur.");
        RuleFor(c => c.Priority).NotEmpty().WithMessage("Oncelik alani zorunludur.");
    }
}

public sealed class CreateTaskCommandHandler : ICommandHandler<CreateTaskCommand, TaskSummaryResponse>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public CreateTaskCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<TaskSummaryResponse> Handle(CreateTaskCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();

        var job = await _dbContext.Jobs.FirstOrDefaultAsync(
                entity => entity.JobId == request.JobId && entity.TenantId == tenantId,
                cancellationToken)
            ?? throw Validation(nameof(request.JobId), "Is bulunamadi.");

        if (job.Status != Domain.Enums.JobStatus.Active)
        {
            throw Validation(nameof(request.JobId), "Sadece aktif islere gorev eklenebilir.");
        }

        var actor = await TaskWorkflowAuthorization.RequireActiveActorAsync(_dbContext, request.ActorUserId, tenantId, cancellationToken);
        var isSystemAdmin = TaskWorkflowAuthorization.IsSystemAdmin(actor);

        var actorDepartmentId = await UserDepartmentAccess.GetDefaultDepartmentIdAsync(
            _dbContext,
            tenantId,
            actor,
            context.ActiveDepartmentId,
            cancellationToken);
        var actorDept = await _dbContext.Departments.FirstOrDefaultAsync(d => d.TenantId == tenantId && d.DepartmentId == actorDepartmentId, cancellationToken);
        var ownerUserId = actorDept?.ManagerUserId;

        var assignedUserId = request.AssignedUserId;
        var assignedDepartmentId = request.AssignedDepartmentId;
        Guid? assigningManagerId = null;

        if (!isSystemAdmin)
        {
            if (actor.RoleCode == RoleCode.Staff)
            {
                if (assignedUserId.HasValue && assignedUserId.Value != actor.UserId)
                {
                    throw Validation(nameof(request.AssignedUserId), "Personel sadece kendisine gorev atayabilir.");
                }

                assignedUserId = actor.UserId;
                assignedDepartmentId ??= actorDepartmentId;
            }
            else if (actor.RoleCode == RoleCode.Manager)
            {
                var managerDept = assignedDepartmentId ?? context.ActiveDepartmentId ?? job.OwnerDepartmentId;
                var isManagerDept = await TaskWorkflowAuthorization.IsManagerOfAsync(_dbContext, actor, managerDept, cancellationToken);
                if (!isManagerDept)
                {
                    throw new ForbiddenAccessException("Bu departman icin gorev olusturma yetkiniz yok.");
                }

                assignedDepartmentId = managerDept;
                assigningManagerId = actor.UserId;
            }
            else
            {
                throw new ForbiddenAccessException("Bu rol gorev olusturamaz.");
            }
        }

        if (assignedUserId.HasValue)
        {
            var target = await _dbContext.Users.FirstOrDefaultAsync(
                u => u.UserId == assignedUserId.Value && u.TenantId == tenantId,
                cancellationToken);
            if (target is null || !target.IsActive)
            {
                throw Validation(nameof(request.AssignedUserId), "Secilen kullanici bulunamadi veya aktif degil.");
            }
            if (assignedDepartmentId.HasValue &&
                !await UserDepartmentAccess.CanWorkInDepartmentAsync(_dbContext, tenantId, target, assignedDepartmentId.Value, cancellationToken))
            {
                throw Validation(nameof(request.AssignedUserId), "Secilen kullanici atanan mudurlukte calismiyor.");
            }

            assignedDepartmentId ??= await UserDepartmentAccess.GetDefaultDepartmentIdAsync(
                _dbContext,
                tenantId,
                target,
                context.ActiveDepartmentId,
                cancellationToken);
            ownerUserId = target.UserId;
        }

        var initialStatus = assignedUserId.HasValue ? WorkflowTaskStatus.Assigned : WorkflowTaskStatus.Waiting;

        var taskYear = DateTimeOffset.UtcNow.Year;
        var taskNumber = await SequenceNumberHelper.NextTaskNumberAsync(_dbContext, tenantId, taskYear, cancellationToken);

        var task = new WorkTask
        {
            TaskId = Guid.NewGuid(),
            TenantId = tenantId,
            JobId = request.JobId,
            Title = request.Title.Trim(),
            Description = request.Description.Trim(),
            AssignedDepartmentId = assignedDepartmentId,
            AssignedUserId = assignedUserId,
            AssigningManagerId = assigningManagerId,
            OwnerUserId = ownerUserId,
            CurrentStatus = initialStatus,
            Priority = request.Priority.Trim(),
            StartDateUtc = request.StartDateUtc,
            DueDateUtc = request.DueDateUtc,
            EstimatedHours = request.EstimatedHours,
            Notes = request.Notes,
            CreatedByUserId = context.UserId,
            TaskNumber = taskNumber,
            TaskNumberYear = taskYear
        };

        _dbContext.Tasks.Add(task);

        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = tenantId,
            EntityType = nameof(WorkTask),
            EntityId = task.TaskId.ToString(),
            Action = "TaskCreated",
            ActorUserId = context.UserId,
            ActorDisplayName = actor.DisplayName,
            StatusAtEvent = initialStatus.ToString(),
            Notes = request.Notes,
            Details = assignedUserId.HasValue ? $"Assigned to user {assignedUserId}" : "Unassigned (pool)"
        });

        await _dbContext.SaveChangesAsync(cancellationToken);
        return await TaskSummaryResponseFactory.CreateAsync(_dbContext, task, cancellationToken);
    }

    private static ValidationException Validation(string property, string message) =>
        new([new FluentValidation.Results.ValidationFailure(property, message)]);
}
