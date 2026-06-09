using CityCommunicationCenter.Application.Features.Users;
using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Application.Features.Tasks;

public sealed record CreateRoutineTaskCommand(
    Guid? ActorUserId,
    string Title,
    string Description,
    string Priority,
    DateTimeOffset? DueDateUtc,
    string? Notes) : ICommand<TaskSummaryResponse>;

public sealed class CreateRoutineTaskCommandValidator : AbstractValidator<CreateRoutineTaskCommand>
{
    public CreateRoutineTaskCommandValidator()
    {
        RuleFor(c => c.Title).NotEmpty().WithMessage("Gorev basligi zorunludur.");
        RuleFor(c => c.Description).NotEmpty().WithMessage("Gorev aciklamasi zorunludur.");
        RuleFor(c => c.Priority).NotEmpty().WithMessage("Oncelik alani zorunludur.");
    }
}

public sealed class CreateRoutineTaskCommandHandler : ICommandHandler<CreateRoutineTaskCommand, TaskSummaryResponse>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;
    private readonly ISlaCalculatorService _slaCalculator;

    public CreateRoutineTaskCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor, ISlaCalculatorService slaCalculator)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
        _slaCalculator = slaCalculator;
    }

    public async ValueTask<TaskSummaryResponse> Handle(CreateRoutineTaskCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();

        var actor = await TaskWorkflowAuthorization.RequireActiveActorAsync(_dbContext, request.ActorUserId, tenantId, cancellationToken);

        var departmentId = await UserDepartmentAccess.GetDefaultDepartmentIdAsync(
            _dbContext, tenantId, actor, context.ActiveDepartmentId, cancellationToken);

        var utcNow = DateTimeOffset.UtcNow;

        // Son tarih girilmezse varsayılan SLA süresi eklenerek otomatik son tarih oluşturulur.
        var dueDateUtc = request.DueDateUtc;
        if (dueDateUtc is null)
        {
            var settings = await _dbContext.TenantSettings
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.TenantId == tenantId, cancellationToken);
            if (settings is not null && settings.DefaultSlaHours > 0)
            {
                dueDateUtc = await _slaCalculator.CalculateDueDateAsync(
                    utcNow, settings.DefaultSlaHours, tenantId, departmentId, cancellationToken);
            }
        }

        var year = utcNow.Year;
        var jobNumber = await SequenceNumberHelper.NextJobNumberAsync(_dbContext, tenantId, year, cancellationToken);
        var taskNumber = await SequenceNumberHelper.NextTaskNumberAsync(_dbContext, tenantId, year, cancellationToken);

        var job = new Job
        {
            JobId = Guid.NewGuid(),
            TenantId = tenantId,
            Title = request.Title.Trim(),
            Description = request.Description.Trim(),
            OwnerDepartmentId = departmentId,
            Status = Domain.Enums.JobStatus.Active,
            Priority = request.Priority.Trim(),
            RequestType = Domain.Enums.JobRequestType.InternalUnit,
            SourceType = Domain.Enums.JobSourceType.Routine,
            DueDateUtc = dueDateUtc,
            CreatedByUserId = context.UserId,
            JobNumber = jobNumber,
            JobNumberYear = year
        };

        _dbContext.Jobs.Add(job);

        _dbContext.JobDepartments.Add(new JobDepartment
        {
            JobDepartmentId = Guid.NewGuid(),
            TenantId = tenantId,
            JobId = job.JobId,
            DepartmentId = departmentId,
            Role = Domain.Enums.JobDepartmentRole.Owner,
            ApprovalStatus = Domain.Enums.JobApprovalStatus.Approved,
            RequestedByUserId = actor.UserId,
            RequestedAtUtc = DateTimeOffset.UtcNow,
            ApprovedByUserId = actor.UserId,
            DecidedAtUtc = DateTimeOffset.UtcNow,
            CreatedByUserId = context.UserId
        });

        var task = new WorkTask
        {
            TaskId = Guid.NewGuid(),
            TenantId = tenantId,
            JobId = job.JobId,
            Title = request.Title.Trim(),
            Description = request.Description.Trim(),
            AssignedDepartmentId = departmentId,
            AssignedUserId = actor.UserId,
            OwnerUserId = actor.UserId,
            CurrentStatus = WorkflowTaskStatus.Assigned,
            Priority = request.Priority.Trim(),
            DueDateUtc = dueDateUtc,
            Notes = request.Notes,
            CreatedByUserId = context.UserId,
            TaskNumber = taskNumber,
            TaskNumberYear = year
        };

        _dbContext.Tasks.Add(task);

        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = tenantId,
            EntityType = nameof(WorkTask),
            EntityId = task.TaskId.ToString(),
            Action = "RoutineTaskCreated",
            ActorUserId = context.UserId,
            ActorDisplayName = actor.DisplayName,
            StatusAtEvent = WorkflowTaskStatus.Assigned.ToString(),
            Details = $"Routine task created by {actor.DisplayName}, assigned to self"
        });

        await _dbContext.SaveChangesAsync(cancellationToken);
        return await TaskSummaryResponseFactory.CreateAsync(_dbContext, task, cancellationToken);
    }
}
