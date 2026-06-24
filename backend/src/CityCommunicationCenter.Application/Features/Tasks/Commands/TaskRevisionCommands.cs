using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Application.Features.Notifications;
using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Application.Features.Tasks;

public sealed record RequestTaskRevisionCommand(Guid TaskId, Guid? ActorUserId, string Reason, DateTimeOffset? ProposedDueDateUtc, Guid? TargetManagerUserId) : ICommand<bool>;

public sealed class RequestTaskRevisionCommandValidator : AbstractValidator<RequestTaskRevisionCommand>
{
    public RequestTaskRevisionCommandValidator()
    {
        RuleFor(c => c.Reason).NotEmpty().WithMessage("Revizyon nedeni zorunludur.");
    }
}

public sealed class RequestTaskRevisionCommandHandler : ICommandHandler<RequestTaskRevisionCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;
    private readonly INotificationPushService _notificationPushService;

    public RequestTaskRevisionCommandHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor,
        INotificationPushService notificationPushService)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
        _notificationPushService = notificationPushService;
    }

    public async ValueTask<bool> Handle(RequestTaskRevisionCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var task = await _dbContext.Tasks.FirstOrDefaultAsync(e => e.TaskId == request.TaskId && e.TenantId == tenantId, cancellationToken);
        if (task is null) return false;

        await TaskWorkflowAuthorization.EnsureCanActAsAssigneeAsync(_dbContext, task, request.ActorUserId, tenantId, cancellationToken);

        if (task.CurrentStatus is WorkflowTaskStatus.Completed or WorkflowTaskStatus.Cancelled or WorkflowTaskStatus.Rejected)
        {
            throw new ValidationException([
                new FluentValidation.Results.ValidationFailure(nameof(request.TaskId), "Tamamlanmis/iptal edilmis gorevlere revizyon istenemez.")
            ]);
        }

        var hasPendingRevision = await _dbContext.Approvals.AnyAsync(
            e => e.SubjectType == ApprovalSubjectType.TaskRevision
                && e.SubjectId == task.TaskId
                && e.Decision == ApprovalDecision.Pending,
            cancellationToken);
        if (hasPendingRevision)
        {
            throw new ValidationException([
                new FluentValidation.Results.ValidationFailure(nameof(request.TaskId), "Bu gorev icin zaten bekleyen bir ek sure talebi var.")
            ]);
        }

        var utcNow = DateTimeOffset.UtcNow;
        task.RevisionReason = request.Reason;
        task.UpdatedAtUtc = utcNow;
        task.UpdatedByUserId = request.ActorUserId;

        var stepOrder = await _dbContext.Approvals.CountAsync(
            e => e.SubjectType == ApprovalSubjectType.TaskRevision && e.SubjectId == task.TaskId, cancellationToken) + 1;

        _dbContext.Approvals.Add(new WorkflowApproval
        {
            ApprovalId = Guid.NewGuid(),
            TenantId = tenantId,
            SubjectType = ApprovalSubjectType.TaskRevision,
            SubjectId = task.TaskId,
            StepOrder = stepOrder,
            ApproverUserId = request.TargetManagerUserId ?? task.AssigningManagerId ?? Guid.Empty,
            Decision = ApprovalDecision.Pending,
            Comment = request.Reason,
            CreatedByUserId = request.ActorUserId
        });

        var isExtraTimeRequest = request.ProposedDueDateUtc.HasValue;
        var auditAction = isExtraTimeRequest ? "TaskExtraTimeRequested" : "TaskRevisionRequested";

        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = tenantId,
            EntityType = nameof(WorkTask),
            EntityId = task.TaskId.ToString(),
            Action = auditAction,
            ActorUserId = request.ActorUserId,
            StatusAtEvent = task.CurrentStatus.ToString(),
            Notes = request.Reason,
            Details = request.Reason
        });

        await _dbContext.SaveChangesAsync(cancellationToken);

        if (isExtraTimeRequest)
        {
            var approverUserId = await ResolveExtraTimeApproverUserIdAsync(
                tenantId,
                task,
                request.TargetManagerUserId,
                cancellationToken);
            if (approverUserId.HasValue && approverUserId.Value != request.ActorUserId)
            {
                var actionUrl = $"/department-tasks?taskId={task.TaskId}";
                await InAppNotificationSender.SendAsync(
                    _dbContext,
                    _notificationPushService,
                    tenantId,
                    approverUserId.Value,
                    "Ek süre talebi",
                    task.Title,
                    task.TaskId,
                    actionUrl,
                    request.ActorUserId,
                    cancellationToken);
            }
        }

        return true;
    }

    private async Task<Guid?> ResolveExtraTimeApproverUserIdAsync(
        Guid tenantId,
        WorkTask task,
        Guid? targetManagerUserId,
        CancellationToken cancellationToken)
    {
        if (targetManagerUserId is { } explicitManager && explicitManager != Guid.Empty)
        {
            return explicitManager;
        }

        if (task.AssigningManagerId is { } assigningManager && assigningManager != Guid.Empty)
        {
            return assigningManager;
        }

        if (!task.AssignedDepartmentId.HasValue)
        {
            return null;
        }

        var department = await _dbContext.Departments.AsNoTracking()
            .FirstOrDefaultAsync(
                entity => entity.TenantId == tenantId && entity.DepartmentId == task.AssignedDepartmentId.Value,
                cancellationToken);

        return department?.ManagerUserId;
    }
}

public sealed record ApproveTaskRevisionCommand(Guid TaskId, Guid? ActorUserId, string? Comment, DateTimeOffset? NewDueDateUtc) : ICommand<bool>;

public sealed class ApproveTaskRevisionCommandHandler : ICommandHandler<ApproveTaskRevisionCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;
    private readonly INotificationPushService _notificationPushService;

    public ApproveTaskRevisionCommandHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor,
        INotificationPushService notificationPushService)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
        _notificationPushService = notificationPushService;
    }

    public async ValueTask<bool> Handle(ApproveTaskRevisionCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var task = await _dbContext.Tasks.FirstOrDefaultAsync(e => e.TaskId == request.TaskId && e.TenantId == tenantId, cancellationToken);
        if (task is null) return false;

        var job = await _dbContext.Jobs.FirstOrDefaultAsync(e => e.JobId == task.JobId && e.TenantId == tenantId, cancellationToken);
        if (job is null) return false;

        await TaskWorkflowAuthorization.EnsureCanApproveTaskCloseAsync(_dbContext, task, job, request.ActorUserId, tenantId, cancellationToken);

        var pendingApproval = await GetPendingApprovalAsync(task.TaskId, cancellationToken)
            ?? throw new ValidationException([
                new FluentValidation.Results.ValidationFailure(nameof(request.TaskId), "Bu gorev icin bekleyen ek sure talebi bulunamadi.")
            ]);

        var utcNow = DateTimeOffset.UtcNow;
        if (request.NewDueDateUtc.HasValue) task.DueDateUtc = request.NewDueDateUtc;
        task.UpdatedAtUtc = utcNow;
        task.UpdatedByUserId = request.ActorUserId;

        UpdateApproval(pendingApproval, ApprovalDecision.Approved, request.ActorUserId, request.Comment, utcNow);

        var isExtraTime = await TaskRevisionNotifications.IsExtraTimeRequestAsync(
            _dbContext, tenantId, task.TaskId, pendingApproval, cancellationToken);

        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = tenantId,
            EntityType = nameof(WorkTask),
            EntityId = task.TaskId.ToString(),
            Action = isExtraTime ? "TaskExtraTimeApproved" : "TaskRevisionApproved",
            ActorUserId = request.ActorUserId,
            StatusAtEvent = task.CurrentStatus.ToString(),
            Notes = request.Comment,
            Details = request.Comment
        });

        await _dbContext.SaveChangesAsync(cancellationToken);

        if (isExtraTime && pendingApproval.CreatedByUserId is { } requesterId && requesterId != Guid.Empty)
        {
            var actionUrl = $"/my-tasks?taskId={task.TaskId}";
            await InAppNotificationSender.SendAsync(
                _dbContext,
                _notificationPushService,
                tenantId,
                requesterId,
                "Ek süre talebi onaylandı",
                task.Title,
                task.TaskId,
                actionUrl,
                request.ActorUserId,
                cancellationToken);
        }

        return true;
    }

    private Task<WorkflowApproval?> GetPendingApprovalAsync(Guid taskId, CancellationToken cancellationToken) =>
        _dbContext.Approvals
            .Where(e => e.SubjectType == ApprovalSubjectType.TaskRevision
                && e.SubjectId == taskId
                && e.Decision == ApprovalDecision.Pending)
            .OrderBy(e => e.StepOrder)
            .FirstOrDefaultAsync(cancellationToken);

    private static void UpdateApproval(WorkflowApproval pending, ApprovalDecision decision, Guid? actorUserId, string? comment, DateTimeOffset utcNow)
    {
        pending.Decision = decision;
        pending.ApproverUserId = actorUserId ?? pending.ApproverUserId;
        pending.Comment = comment ?? pending.Comment;
        pending.DecisionDateUtc = utcNow;
        pending.UpdatedAtUtc = utcNow;
        pending.UpdatedByUserId = actorUserId;
    }
}

public sealed record RejectTaskRevisionCommand(Guid TaskId, Guid? ActorUserId, string? Comment) : ICommand<bool>;

public sealed class RejectTaskRevisionCommandHandler : ICommandHandler<RejectTaskRevisionCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;
    private readonly INotificationPushService _notificationPushService;

    public RejectTaskRevisionCommandHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor,
        INotificationPushService notificationPushService)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
        _notificationPushService = notificationPushService;
    }

    public async ValueTask<bool> Handle(RejectTaskRevisionCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var task = await _dbContext.Tasks.FirstOrDefaultAsync(e => e.TaskId == request.TaskId && e.TenantId == tenantId, cancellationToken);
        if (task is null) return false;

        var job = await _dbContext.Jobs.FirstOrDefaultAsync(e => e.JobId == task.JobId && e.TenantId == tenantId, cancellationToken);
        if (job is null) return false;

        await TaskWorkflowAuthorization.EnsureCanApproveTaskCloseAsync(_dbContext, task, job, request.ActorUserId, tenantId, cancellationToken);

        var utcNow = DateTimeOffset.UtcNow;

        var pending = await _dbContext.Approvals
            .Where(e => e.SubjectType == ApprovalSubjectType.TaskRevision
                && e.SubjectId == task.TaskId
                && e.Decision == ApprovalDecision.Pending)
            .OrderBy(e => e.StepOrder)
            .FirstOrDefaultAsync(cancellationToken);

        if (pending is null)
        {
            throw new ValidationException([
                new FluentValidation.Results.ValidationFailure(nameof(request.TaskId), "Bu gorev icin bekleyen ek sure talebi bulunamadi.")
            ]);
        }

        pending.Decision = ApprovalDecision.Rejected;
        pending.ApproverUserId = request.ActorUserId ?? pending.ApproverUserId;
        pending.Comment = request.Comment ?? pending.Comment;
        pending.DecisionDateUtc = utcNow;
        pending.UpdatedAtUtc = utcNow;
        pending.UpdatedByUserId = request.ActorUserId;
        task.UpdatedAtUtc = utcNow;
        task.UpdatedByUserId = request.ActorUserId;

        var isExtraTime = await TaskRevisionNotifications.IsExtraTimeRequestAsync(
            _dbContext, tenantId, task.TaskId, pending, cancellationToken);

        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = tenantId,
            EntityType = nameof(WorkTask),
            EntityId = task.TaskId.ToString(),
            Action = isExtraTime ? "TaskExtraTimeRejected" : "TaskRevisionRejected",
            ActorUserId = request.ActorUserId,
            StatusAtEvent = task.CurrentStatus.ToString(),
            Notes = request.Comment,
            Details = request.Comment
        });

        await _dbContext.SaveChangesAsync(cancellationToken);

        if (isExtraTime && pending.CreatedByUserId is { } requesterId && requesterId != Guid.Empty)
        {
            var actionUrl = $"/my-tasks?taskId={task.TaskId}";
            await InAppNotificationSender.SendAsync(
                _dbContext,
                _notificationPushService,
                tenantId,
                requesterId,
                "Ek süre talebi reddedildi",
                task.Title,
                task.TaskId,
                actionUrl,
                request.ActorUserId,
                cancellationToken);
        }

        return true;
    }
}

internal static class TaskRevisionNotifications
{
    internal static Task<bool> IsExtraTimeRequestAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        Guid taskId,
        WorkflowApproval pendingApproval,
        CancellationToken cancellationToken)
    {
        var windowStart = pendingApproval.CreatedAtUtc.AddSeconds(-5);
        var windowEnd = pendingApproval.CreatedAtUtc.AddSeconds(5);
        return dbContext.AuditLogs.AsNoTracking().AnyAsync(
            entry => entry.TenantId == tenantId
                && entry.EntityType == nameof(WorkTask)
                && entry.EntityId == taskId.ToString()
                && entry.Action == "TaskExtraTimeRequested"
                && entry.EventTimeUtc >= windowStart
                && entry.EventTimeUtc <= windowEnd,
            cancellationToken);
    }
}
