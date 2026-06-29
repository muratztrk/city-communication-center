using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Application.Features.Tasks;

public sealed record GetTaskByIdQuery(Guid TaskId) : IQuery<TaskDetailResponse?>;

public sealed class GetTaskByIdQueryHandler : IQueryHandler<GetTaskByIdQuery, TaskDetailResponse?>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public GetTaskByIdQueryHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<TaskDetailResponse?> Handle(GetTaskByIdQuery request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var task = await _dbContext.Tasks.FirstOrDefaultAsync(
            entity => entity.TaskId == request.TaskId && entity.TenantId == tenantId,
            cancellationToken);
        if (task is null) return null;

        var job = await _dbContext.Jobs
            .Where(entity => entity.JobId == task.JobId && entity.TenantId == tenantId)
            .Select(entity => new
            {
                entity.Title,
                entity.Description,
                entity.RequestType,
                entity.SourceType
            })
            .FirstOrDefaultAsync(cancellationToken);

        // "Oluşturan" = talebi oluşturan kişi (işin sahibi), görevi onaylayan/atayan değil.
        var jobCreatedByUserId = await _dbContext.Jobs.AsNoTracking()
            .Where(j => j.JobId == task.JobId)
            .Select(j => j.CreatedByUserId)
            .FirstOrDefaultAsync(cancellationToken);
        var createdByName = jobCreatedByUserId.HasValue
            ? await _dbContext.Users.AsNoTracking()
                .Where(u => u.UserId == jobCreatedByUserId.Value && u.TenantId == tenantId)
                .Select(u => u.DisplayName)
                .FirstOrDefaultAsync(cancellationToken)
            : null;

        var ownerDisplayName = task.OwnerUserId.HasValue
            ? await _dbContext.Users.AsNoTracking()
                .Where(u => u.UserId == task.OwnerUserId.Value && u.TenantId == tenantId)
                .Select(u => u.DisplayName)
                .FirstOrDefaultAsync(cancellationToken)
            : null;

        var assigningManagerDisplayName = task.AssigningManagerId.HasValue
            ? await _dbContext.Users.AsNoTracking()
                .Where(u => u.UserId == task.AssigningManagerId.Value && u.TenantId == tenantId)
                .Select(u => u.DisplayName)
                .FirstOrDefaultAsync(cancellationToken)
            : null;

        var assignedUserDisplayName = task.AssignedUserId.HasValue
            ? await _dbContext.Users.AsNoTracking()
                .Where(u => u.UserId == task.AssignedUserId.Value && u.TenantId == tenantId)
                .Select(u => u.DisplayName)
                .FirstOrDefaultAsync(cancellationToken)
            : null;

        var assignedDepartmentName = task.AssignedDepartmentId.HasValue
            ? await _dbContext.Departments.AsNoTracking()
                .Where(d => d.DepartmentId == task.AssignedDepartmentId.Value && d.TenantId == tenantId)
                .Select(d => d.Name)
                .FirstOrDefaultAsync(cancellationToken)
            : null;

        var approvals = await _dbContext.Approvals
            .Where(entity => entity.TenantId == tenantId
                && (
                    (entity.SubjectType == ApprovalSubjectType.Task && entity.SubjectId == request.TaskId)
                    || (entity.SubjectType == ApprovalSubjectType.TaskClose && entity.SubjectId == request.TaskId)
                    || (entity.SubjectType == ApprovalSubjectType.TaskRevision && entity.SubjectId == request.TaskId)))
            .OrderBy(entity => entity.StepOrder)
            .ToListAsync(cancellationToken);
        var assignmentHistory = await _dbContext.AssignmentHistories
            .Where(entity => entity.TenantId == tenantId && entity.TaskId == request.TaskId)
            .OrderBy(entity => entity.ActionDateUtc)
            .ToListAsync(cancellationToken);

        var attachments = await _dbContext.Attachments
            .AsNoTracking()
            .Where(a => a.TenantId == tenantId && a.EntityType == "Task" && a.EntityId == request.TaskId)
            .OrderBy(a => a.CreatedAtUtc)
            .Select(a => new AttachmentResponse(a.AttachmentId, a.FileName, a.ContentType, a.FileSizeBytes, a.RelativeUrl, a.CreatedAtUtc))
            .ToListAsync(cancellationToken);

        // Durumu belirleyen son işlemi yapan kullanıcı (iptal eden / tamamlayan) denetim kaydından (card 642).
        var taskStatusStr = task.CurrentStatus.ToString();
        string? statusActorDisplayName = null;
        if (taskStatusStr is "Cancelled" or "Completed")
        {
            var statusAction = taskStatusStr == "Completed" ? "TaskCompleted" : "TaskCancelled";
            statusActorDisplayName = await _dbContext.AuditLogs.AsNoTracking()
                .Where(a => a.TenantId == tenantId && a.EntityId == request.TaskId.ToString() && a.Action == statusAction)
                .OrderByDescending(a => a.EventTimeUtc)
                .Select(a => a.ActorDisplayName)
                .FirstOrDefaultAsync(cancellationToken);
        }

        // Görevin durum değişiklikleri geçmişi: yalnızca "Durum Değiştir" değil, TÜM durum geçişleri
        // (Atandı→Yapılmakta vb.) görev audit'lerindeki StatusAtEvent'ten türetilir (card #1097).
        var taskStatusAudits = await _dbContext.AuditLogs.AsNoTracking()
            .Where(a => a.TenantId == tenantId
                && a.EntityType == nameof(WorkTask)
                && a.EntityId == request.TaskId.ToString()
                && a.StatusAtEvent != null)
            .OrderBy(a => a.EventTimeUtc)
            .Select(a => new { a.StatusAtEvent, a.EventTimeUtc })
            .ToListAsync(cancellationToken);
        var statusTransitions = new List<TaskStatusChangeHistoryResponse>();
        string? previousStatus = null;
        foreach (var audit in taskStatusAudits)
        {
            var status = audit.StatusAtEvent;
            if (string.IsNullOrWhiteSpace(status)) continue;
            if (previousStatus is null)
            {
                // Eski audit zincirlerinde ilk kayıt bazen "Assigned" yerine doğrudan yeni durumu
                // taşır; bu durumda normal görev akışı için Atandı -> ilk durum geçişini görünür kıl.
                if (task.AssignedAtUtc.HasValue
                    && !string.Equals(status, WorkflowTaskStatus.Assigned.ToString(), StringComparison.Ordinal)
                    && !string.Equals(status, WorkflowTaskStatus.Waiting.ToString(), StringComparison.Ordinal))
                {
                    statusTransitions.Add(new TaskStatusChangeHistoryResponse(
                        WorkflowTaskStatus.Assigned.ToString(),
                        status,
                        null,
                        null,
                        audit.EventTimeUtc));
                }

                // İlk durum = başlangıç, tekrar değişiklik olarak sayılmaz.
                previousStatus = status;
                continue;
            }
            if (!string.Equals(status, previousStatus, StringComparison.Ordinal))
            {
                statusTransitions.Add(new TaskStatusChangeHistoryResponse(previousStatus, status, null, null, audit.EventTimeUtc));
                previousStatus = status;
            }
        }
        statusTransitions.Reverse(); // en yeni üstte
        var statusChangeHistory = statusTransitions.ToArray();

        return new TaskDetailResponse(
            task.TaskId,
            task.TenantId,
            task.JobId,
            job?.Title,
            job is null ? null : job.RequestType.ToString(),
            job is null ? null : job.SourceType.ToString(),
            task.Title,
            ResolveTaskDescription(task.Description, job?.Description),
            task.Priority,
            task.CurrentStatus.ToString(),
            task.AssignedDepartmentId,
            task.AssignedUserId,
            task.StartDateUtc,
            task.DueDateUtc,
            task.CompletedAtUtc,
            task.CompletionPercentage,
            task.EstimatedHours,
            task.ActualHours,
            task.Notes,
            task.RevisionReason,
            createdByName,
            task.CreatedAtUtc,
            approvals
                .OrderBy(entity => entity.StepOrder)
                .Select(entity => new ApprovalStepResponse(
                    entity.ApprovalId,
                    entity.SubjectType.ToString(),
                    entity.SubjectId,
                    entity.ApproverUserId,
                    entity.StepOrder,
                    entity.Decision.ToString(),
                    entity.DecisionDateUtc,
                    entity.Comment))
                .ToArray(),
            assignmentHistory
                .OrderByDescending(entity => entity.ActionDateUtc)
                .Select(entity => new AssignmentHistoryResponse(
                    entity.AssignmentId,
                    entity.FromDepartmentId,
                    entity.ToDepartmentId,
                    entity.FromUserId,
                    entity.ToUserId,
                    entity.ActionType,
                    entity.ActionDateUtc))
                .ToArray(),
            ownerDisplayName,
            attachments,
            assigningManagerDisplayName,
            assignedDepartmentName,
            assignedUserDisplayName,
            task.TaskNumber,
            task.TaskNumberYear,
            statusActorDisplayName,
            statusChangeHistory);
    }

    private static string ResolveTaskDescription(string? taskDescription, string? jobDescription)
    {
        if (!string.IsNullOrWhiteSpace(taskDescription))
        {
            return taskDescription;
        }

        return jobDescription ?? string.Empty;
    }
}
