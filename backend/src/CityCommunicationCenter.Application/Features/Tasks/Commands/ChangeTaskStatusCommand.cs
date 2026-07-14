using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Application.Features.Social;
using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Application.Features.Tasks;

// Tamamlanmış/İptal edilmiş bir görevin durumunu (Yapılmakta/Tamamlanmış/İptal) değiştirir (card #1005).
public sealed record ChangeTaskStatusCommand(Guid TaskId, Guid? ActorUserId, string NewStatus, string Reason) : ICommand<bool>;

public sealed class ChangeTaskStatusCommandValidator : AbstractValidator<ChangeTaskStatusCommand>
{
    public ChangeTaskStatusCommandValidator()
    {
        RuleFor(c => c.NewStatus).NotEmpty().WithMessage("Yeni görev durumu gereklidir.");
        RuleFor(c => c.Reason)
            .NotEmpty().WithMessage("Durum değişikliği nedeni gereklidir.")
            .MaximumLength(100).WithMessage("Durum değişikliği nedeni en fazla 100 karakter olabilir.");
    }
}

public sealed class ChangeTaskStatusCommandHandler : ICommandHandler<ChangeTaskStatusCommand, bool>
{
    private static readonly WorkflowTaskStatus[] AllowedTargets =
        [WorkflowTaskStatus.InProgress, WorkflowTaskStatus.Completed, WorkflowTaskStatus.Cancelled];

    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;
    private readonly ICitizenJobStatusNotifier? _citizenJobStatusNotifier;

    public ChangeTaskStatusCommandHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor,
        ICitizenJobStatusNotifier? citizenJobStatusNotifier = null)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
        _citizenJobStatusNotifier = citizenJobStatusNotifier;
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

        // Durum Değiştir yalnızca bir kez kullanılabilir (card #1475).
        var alreadyChanged = await _dbContext.AuditLogs.AsNoTracking()
            .AnyAsync(a => a.TenantId == tenantId
                && a.EntityType == nameof(WorkTask)
                && a.EntityId == task.TaskId.ToString()
                && a.Action == "TaskStatusChanged", cancellationToken);
        if (alreadyChanged)
            throw Validation(nameof(request.TaskId), "Görevin durumu yalnızca bir kez değiştirilebilir.");

        if (!Enum.TryParse<WorkflowTaskStatus>(request.NewStatus, true, out var newStatus) || !AllowedTargets.Contains(newStatus))
            throw Validation(nameof(request.NewStatus), $"Geçersiz görev durumu: {request.NewStatus}");

        if (newStatus == task.CurrentStatus)
            throw Validation(nameof(request.NewStatus), "Görev zaten bu durumda.");

        // Yetki: görevin atananı veya SystemAdmin (Tamamla/İptal ile aynı).
        await TaskWorkflowAuthorization.EnsureCanActAsAssigneeAsync(_dbContext, task, request.ActorUserId, tenantId, cancellationToken);

        var previousStatus = task.CurrentStatus;
        var utcNow = DateTimeOffset.UtcNow;
        var parentJob = await _dbContext.Jobs.FirstOrDefaultAsync(
            e => e.JobId == task.JobId && e.TenantId == tenantId, cancellationToken);
        var previousTaskCount = await _dbContext.Tasks
            .AsNoTracking()
            .CountAsync(entity => entity.JobId == task.JobId && entity.TenantId == tenantId, cancellationToken);
        var previousDisplayStatus = parentJob is null
            ? null
            : CitizenJobStatusLabelHelper.GetDisplayStatus(parentJob.Status, parentJob.DueDateUtc, previousTaskCount, utcNow);

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

        // Durum Değişikliği Geçmişi denetim kaydında işlemi yapan kişinin adı görünmeli (card #2).
        var actorDisplayName = request.ActorUserId.HasValue
            ? await _dbContext.Users.AsNoTracking()
                .Where(u => u.UserId == request.ActorUserId.Value && u.TenantId == tenantId)
                .Select(u => u.DisplayName)
                .FirstOrDefaultAsync(cancellationToken)
            : null;

        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = tenantId,
            EntityType = nameof(WorkTask),
            EntityId = task.TaskId.ToString(),
            Action = "TaskStatusChanged",
            ActorUserId = request.ActorUserId,
            ActorDisplayName = actorDisplayName,
            StatusAtEvent = newStatus.ToString(),
            Notes = request.Reason,
            Details = $"{previousStatus}->{newStatus}"
        });

        await _dbContext.SaveChangesAsync(cancellationToken);

        JobStatus? previousJobStatus = parentJob?.Status;
        await TaskWorkflowAuthorization.RecomputeJobCompletionAsync(_dbContext, task.JobId, cancellationToken);

        // Karışık terminal durumda recompute Active yapar; InProgress'e geri almada da
        // Completed/Cancelled takılı kalabilir → Active yap (card #1005).
        if (parentJob is not null
            && newStatus == WorkflowTaskStatus.InProgress
            && parentJob.Status is JobStatus.Completed or JobStatus.Cancelled or JobStatus.Rejected)
        {
            parentJob.Status = JobStatus.Active;
            parentJob.CompletedAtUtc = null;
        }

        // Görev durum değişikliği talebi iptale/redde düşürürse, yazılan neden talebin İptal
        // Notu olarak da yansısın (tamamlama notu zaten tamamlanan görevin Notes'undan türetilir) — card #3.
        if (parentJob is not null
            && newStatus == WorkflowTaskStatus.Cancelled
            && parentJob.Status is JobStatus.Cancelled or JobStatus.Rejected)
        {
            parentJob.CancelReason = request.Reason;
        }

        if (parentJob is not null && previousJobStatus.HasValue && parentJob.Status != previousJobStatus.Value)
        {
            _dbContext.AuditLogs.Add(new AuditLog
            {
                AuditLogId = Guid.NewGuid(),
                TenantId = tenantId,
                EntityType = nameof(Job),
                EntityId = parentJob.JobId.ToString(),
                Action = parentJob.Status switch
                {
                    JobStatus.Completed => "JobCompleted",
                    JobStatus.Cancelled => "JobCancelled",
                    _ => "JobUpdated",
                },
                ActorUserId = request.ActorUserId,
                StatusAtEvent = parentJob.Status.ToString(),
                Notes = "Görev durumu değişikliği sonucu talep durumu güncellendi.",
                Details = request.Reason
            });
        }

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
