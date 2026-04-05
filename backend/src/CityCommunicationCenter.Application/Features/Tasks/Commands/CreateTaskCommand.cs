using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Application.Features.Tasks;

public sealed record CreateTaskCommand(
    Guid? ActorUserId,
    string Title,
    string Description,
    string TaskType,
    string SourceType,
    Guid? SourceRefId,
    Guid? TargetDepartmentId,
    string Priority,
    DateTimeOffset? DueDateUtc) : ICommand<TaskSummaryResponse>;

public sealed class CreateTaskCommandValidator : AbstractValidator<CreateTaskCommand>
{
    public CreateTaskCommandValidator()
    {
        RuleFor(command => command.Title)
            .NotEmpty()
            .WithMessage("Gorev basligi zorunludur.");
        RuleFor(command => command.Description)
            .NotEmpty()
            .WithMessage("Gorev aciklamasi zorunludur.");
        RuleFor(command => command.TaskType)
            .NotEmpty()
            .WithMessage("Gorev tipi zorunludur.");
        RuleFor(command => command.SourceType)
            .NotEmpty()
            .WithMessage("Kaynak tipi zorunludur.");
        RuleFor(command => command.Priority)
            .NotEmpty()
            .WithMessage("Oncelik alani zorunludur.");
    }
}

public sealed class CreateTaskCommandHandler : IRequestHandler<CreateTaskCommand, TaskSummaryResponse>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public CreateTaskCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async Task<TaskSummaryResponse> Handle(CreateTaskCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        Guid? assignedUserId = null;
        Guid? assignedDepartmentId = null;
        var initialStatus = WorkflowTaskStatus.Draft;

        if (context.UserId.HasValue)
        {
            var currentUser = await _dbContext.Users
                .FirstOrDefaultAsync(entity => entity.UserId == context.UserId.Value, cancellationToken);

            if (currentUser?.ManagerUserId != null)
            {
                assignedUserId = currentUser.ManagerUserId;
                assignedDepartmentId = currentUser.DepartmentId;
                initialStatus = WorkflowTaskStatus.PendingApproval;
            }
        }

        var task = new WorkTask
        {
            TaskId = Guid.NewGuid(),
            TenantId = context.TenantId!.Value,
            Title = request.Title.Trim(),
            Description = request.Description.Trim(),
            TaskType = Enum.Parse<TaskType>(request.TaskType, true),
            SourceType = Enum.Parse<SourceType>(request.SourceType, true),
            SourceRefId = request.SourceRefId,
            TargetDepartmentId = request.TargetDepartmentId ?? assignedDepartmentId,
            AssignedDepartmentId = assignedDepartmentId,
            AssignedUserId = assignedUserId,
            CurrentStatus = initialStatus,
            Priority = request.Priority.Trim(),
            DueDateUtc = request.DueDateUtc,
            CreatedByUserId = context.UserId
        };

        _dbContext.Tasks.Add(task);
        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = context.TenantId.Value,
            EntityType = nameof(WorkTask),
            EntityId = task.TaskId.ToString(),
            Action = "TaskCreated",
            ActorUserId = context.UserId,
            Details = assignedUserId.HasValue ? $"Manager auto-assignment: {assignedUserId}" : null
        });
        await _dbContext.SaveChangesAsync(cancellationToken);

        return await TaskSummaryResponseFactory.CreateAsync(_dbContext, task, cancellationToken);
    }
}