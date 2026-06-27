using CityCommunicationCenter.Application.Abstractions;
using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Application.Features.Tasks;

// Tamamlanmış/İptal edilmiş bir görevin durumunu (Yapılmakta/Tamamlanmış/İptal) değiştirir (card #1005).
public sealed record ChangeTaskStatusCommand(Guid TaskId, Guid? ActorUserId, string NewStatus, string Reason) : ICommand<bool>;

public sealed class ChangeTaskStatusCommandValidator : AbstractValidator<ChangeTaskStatusCommand>
{
    public ChangeTaskStatusCommandValidator()
    {
        RuleFor(c => c.NewStatus).NotEmpty().WithMessage("Yeni görev durumu gereklidir.");
        RuleFor(c => c.Reason).NotEmpty().WithMessage("Durum değişikliği nedeni gereklidir.");
    }
}

public sealed class ChangeTaskStatusCommandHandler : ICommandHandler<ChangeTaskStatusCommand, bool>
{
    private static readonly WorkflowTaskStatus[] AllowedTargets =
        [WorkflowTaskStatus.InProgress, WorkflowTaskStatus.Completed, WorkflowTaskStatus.Cancelled];

    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public ChangeTaskStatusCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<bool> Handle(ChangeTaskStatusCommand request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();

        var task = await _dbContext.Tasks.FirstOrDefaultAsync(
            e => e.TaskId == request.TaskId && e.TenantId == tenantId, cancellationToken);
        if (task is null) return false;

        // Yalnızca tamamlanmış veya iptal edilmiş görevin durumu değiştirilebilir.
        if (task.CurrentStatus is not (WorkflowTaskStatus.Completed or WorkflowTaskStatus.Cancelled))
            throw Validation(nameof(request.TaskId), "Yalnızca tamamlanmış veya iptal edilmiş görevin durumu değiştirilebilir.");

        if (!Enum.TryParse<WorkflowTaskStatus>(request.NewStatus, true, out var newStatus) || !AllowedTargets.Contains(newStatus))
            throw Validation(nameof(request.NewStatus), $"Geçersiz görev durumu: {request.NewStatus}");

        if (newStatus == task.CurrentStatus)
            throw Validation(nameof(request.NewStatus), "Görev zaten bu durumda.");

        // Yetki: görevin atananı veya SystemAdmin (Tamamla/İptal ile aynı).
        await TaskWorkflowAuthorization.EnsureCanActAsAssigneeAsync(_dbContext, task, request.ActorUserId, tenantId, cancellationToken);

        var utcNow = DateTimeOffset.UtcNow;
        task.CurrentStatus = newStatus;
        task.UpdatedAtUtc = utcNow;
        task.UpdatedByUserId = request.ActorUserId;

        switch (newStatus)
        {
            case WorkflowTaskStatus.InProgress:
                task.CompletedAtUtc = null;
                task.CompletionPercentage = 0;
                break;
            case WorkflowTaskStatus.Completed:
                task.CompletedAtUtc = utcNow;
                task.CompletionPercentage = 100;
                task.Notes = request.Reason;
                break;
            case WorkflowTaskStatus.Cancelled:
                task.CompletedAtUtc = null;
                task.RevisionReason = request.Reason;
                break;
        }

        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = tenantId,
            EntityType = nameof(WorkTask),
            EntityId = task.TaskId.ToString(),
            Action = "TaskStatusChanged",
            ActorUserId = request.ActorUserId,
            StatusAtEvent = newStatus.ToString(),
            Notes = request.Reason,
            Details = request.Reason
        });

        var parentJob = await _dbContext.Jobs.FirstOrDefaultAsync(
            e => e.JobId == task.JobId && e.TenantId == tenantId, cancellationToken);

        await _dbContext.SaveChangesAsync(cancellationToken);

        await TaskWorkflowAuthorization.RecomputeJobCompletionAsync(_dbContext, task.JobId, cancellationToken);

        // RecomputeJobCompletionAsync talep durumunu yalnızca terminal'e YÜKSELTİR, geri düşürmez.
        // Görev "Yapılmakta"ya geri alındığında terminal (Completed/Cancelled/Rejected) takılı kalır →
        // talebi tekrar Active yap (card #1005).
        if (parentJob is not null
            && newStatus == WorkflowTaskStatus.InProgress
            && parentJob.Status is JobStatus.Completed or JobStatus.Cancelled or JobStatus.Rejected)
        {
            parentJob.Status = JobStatus.Active;
            parentJob.CompletedAtUtc = null;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        return true;
    }

    private static ValidationException Validation(string p, string m) =>
        new([new FluentValidation.Results.ValidationFailure(p, m)]);
}
