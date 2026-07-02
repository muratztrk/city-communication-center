using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Application.Features.Social;
using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Application.Features.Tasks;

public sealed record CompleteTaskCommand(Guid TaskId, Guid? ActorUserId, string? ResultNote, decimal? ActualHours) : ICommand<bool>;

public sealed class CompleteTaskCommandValidator : AbstractValidator<CompleteTaskCommand>
{
    public CompleteTaskCommandValidator()
    {
        RuleFor(x => x.ResultNote)
            .NotEmpty()
            .WithMessage("Tamamlama notu gereklidir.");
    }
}

public sealed class CompleteTaskCommandHandler : ICommandHandler<CompleteTaskCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;
    private readonly ICitizenJobStatusNotifier? _citizenJobStatusNotifier;

    public CompleteTaskCommandHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor,
        ICitizenJobStatusNotifier? citizenJobStatusNotifier = null)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
        _citizenJobStatusNotifier = citizenJobStatusNotifier;
    }

    public async ValueTask<bool> Handle(CompleteTaskCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var task = await _dbContext.Tasks.FirstOrDefaultAsync(e => e.TaskId == request.TaskId && e.TenantId == tenantId, cancellationToken);
        if (task is null) return false;

        if (task.CurrentStatus is WorkflowTaskStatus.Completed or WorkflowTaskStatus.Cancelled)
        {
            throw Validation(nameof(request.TaskId), "Tamamlanmis veya iptal edilmis gorev yeniden tamamlanamaz.");
        }

        await TaskWorkflowAuthorization.EnsureCanActAsAssigneeAsync(_dbContext, task, request.ActorUserId, tenantId, cancellationToken);

        var utcNow = DateTimeOffset.UtcNow;
        var parentJob = await _dbContext.Jobs.FirstOrDefaultAsync(
            entity => entity.JobId == task.JobId && entity.TenantId == tenantId,
            cancellationToken);
        var previousTaskCount = await _dbContext.Tasks
            .AsNoTracking()
            .CountAsync(entity => entity.JobId == task.JobId && entity.TenantId == tenantId, cancellationToken);
        var previousDisplayStatus = parentJob is null
            ? null
            : CitizenJobStatusLabelHelper.GetDisplayStatus(parentJob.Status, parentJob.DueDateUtc, previousTaskCount, utcNow);

        task.ActualHours = request.ActualHours ?? task.ActualHours;
        if (!string.IsNullOrWhiteSpace(request.ResultNote))
        {
            task.Notes = request.ResultNote;
        }

        task.UpdatedAtUtc = utcNow;
        task.UpdatedByUserId = request.ActorUserId;
        task.CurrentStatus = WorkflowTaskStatus.Completed;
        task.CompletedAtUtc = utcNow;
        task.CompletionPercentage = 100;

        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = tenantId,
            EntityType = nameof(WorkTask),
            EntityId = task.TaskId.ToString(),
            Action = "TaskCompleted",
            ActorUserId = request.ActorUserId,
            StatusAtEvent = WorkflowTaskStatus.Completed.ToString(),
            Notes = request.ResultNote,
            Details = request.ResultNote
        });

        await _dbContext.SaveChangesAsync(cancellationToken);
        await TaskWorkflowAuthorization.RecomputeJobCompletionAsync(_dbContext, task.JobId, cancellationToken);
        await _dbContext.SaveChangesAsync(cancellationToken);
        if (_citizenJobStatusNotifier is not null && previousDisplayStatus is not null)
        {
            await _citizenJobStatusNotifier.NotifyStatusChangedAsync(
                tenantId,
                task.JobId,
                previousDisplayStatus,
                cancellationToken);
        }

        return true;
    }

    private static ValidationException Validation(string p, string m) =>
        new([new FluentValidation.Results.ValidationFailure(p, m)]);
}
