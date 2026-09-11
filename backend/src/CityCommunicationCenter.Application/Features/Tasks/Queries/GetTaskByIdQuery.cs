using CityCommunicationCenter.Application.Features.CitizenMessageApprovals;
using CityCommunicationCenter.Domain.Enums;
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

        var jobEntity = await _dbContext.Jobs
            .AsNoTracking()
            .FirstOrDefaultAsync(entity => entity.JobId == task.JobId && entity.TenantId == tenantId, cancellationToken);

        string? citizenMessageApproverDisplayName = null;
        string? citizenApprovalReleasedNote = null;
        string? citizenOutboundMessage = null;
        if (jobEntity?.RequestType == JobRequestType.Citizen)
        {
            citizenApprovalReleasedNote = await CitizenMessageApprovalNoteResolver.ResolveReleasedApprovalNoteAsync(
                _dbContext, tenantId, task.JobId, cancellationToken);
            citizenMessageApproverDisplayName = await CitizenMessageApprovalNoteResolver.ResolveMessageApproverDisplayNameAsync(
                _dbContext, tenantId, task.JobId, cancellationToken, jobEntity.CitizenTerminalMessageReleasedAtUtc);

            var citizenRequestCandidates = await _dbContext.SocialMessages.AsNoTracking()
                .Where(m => m.TenantId == tenantId
                    && m.CitizenRequestNumber != null
                    && (m.JobId == jobEntity.JobId
                        || (jobEntity.SourceRefId.HasValue && m.SocialMessageId == jobEntity.SourceRefId.Value)))
                .Select(m => new
                {
                    m.CitizenRequestNumber,
                    m.CitizenRequestNumberYear,
                    m.Channel,
                    m.SocialMessageId,
                    m.JobId,
                })
                .ToListAsync(cancellationToken);
            var citizenRequest = citizenRequestCandidates
                .OrderByDescending(m => m.JobId == jobEntity.JobId)
                .ThenByDescending(m => m.CitizenRequestNumberYear)
                .ThenByDescending(m => m.CitizenRequestNumber)
                .FirstOrDefault();
            var hasCitizenWaPhoneLink = citizenRequest is not null
                && (citizenRequest.Channel == SocialChannel.WhatsApp
                    || citizenRequest.Channel == SocialChannel.Phone);
            var isTerminalTask = task.CurrentStatus is WorkflowTaskStatus.Cancelled
                or WorkflowTaskStatus.Rejected
                or WorkflowTaskStatus.Completed;
            var shouldResolveOutbound = citizenRequest is not null
                && (hasCitizenWaPhoneLink
                    || jobEntity.CitizenTerminalMessageReleasedAtUtc.HasValue
                    || jobEntity.Status is JobStatus.Cancelled or JobStatus.Rejected or JobStatus.Completed
                    || isTerminalTask);
            if (shouldResolveOutbound)
            {
                var citizenVt = citizenRequest!;
                var linkedMessages = await _dbContext.SocialMessages.AsNoTracking()
                    .Where(m => m.TenantId == tenantId
                        && m.CitizenRequestNumber != null
                        && (m.Channel == SocialChannel.WhatsApp || m.Channel == SocialChannel.Phone)
                        && (m.JobId == jobEntity.JobId
                            || (jobEntity.SourceRefId.HasValue && m.SocialMessageId == jobEntity.SourceRefId.Value)
                            || (m.CitizenRequestNumber == citizenVt.CitizenRequestNumber
                                && m.CitizenRequestNumberYear == citizenVt.CitizenRequestNumberYear)))
                    .Select(m => new
                    {
                        m.Channel,
                        m.SocialMessageId,
                        m.RespondedAtUtc,
                        m.ResponseContent,
                        m.ReceivedAtUtc,
                    })
                    .ToListAsync(cancellationToken);
                foreach (var linkedMessage in linkedMessages
                    .OrderByDescending(m => jobEntity.SourceRefId.HasValue && m.SocialMessageId == jobEntity.SourceRefId.Value)
                    .ThenByDescending(m => m.SocialMessageId == citizenVt.SocialMessageId)
                    .ThenByDescending(m => m.ReceivedAtUtc))
                {
                    var smsResponse = linkedMessage.Channel == SocialChannel.Phone
                        && linkedMessage.RespondedAtUtc.HasValue
                        ? linkedMessage.ResponseContent
                        : null;
                    var note = await CitizenMessageApprovalNoteResolver.ResolveOutboundDisplayNoteAsync(
                        _dbContext,
                        tenantId,
                        jobEntity,
                        linkedMessage.Channel,
                        linkedMessage.SocialMessageId,
                        smsResponse,
                        cancellationToken);
                    if (!string.IsNullOrWhiteSpace(note))
                    {
                        citizenOutboundMessage = note;
                        break;
                    }
                }
            }
        }

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
        var hasPendingExtraTimeRequest = approvals.Any(entity =>
            entity.SubjectType == ApprovalSubjectType.TaskRevision
            && entity.Decision == ApprovalDecision.Pending);
        var lastExtraTimeRequestDecision = approvals
            .Where(entity => entity.SubjectType == ApprovalSubjectType.TaskRevision
                && entity.Decision != ApprovalDecision.Pending)
            .OrderByDescending(entity => entity.DecisionDateUtc)
            .Select(entity => (string?)entity.Decision.ToString())
            .FirstOrDefault();
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
        // İptalde Süreç "İptal Tarihi": CancelTask → TaskCancelled audit zamanı; StatusChangeHistory
        // yalnız ChangeTaskStatus geçişlerini taşır, bu yüzden oradan gelmez (card #1795).
        DateTimeOffset? updatedAtUtc = task.UpdatedAtUtc;
        if (taskStatusStr is "Cancelled" or "Completed" or "Rejected")
        {
            var statusAction = taskStatusStr == "Completed" ? "TaskCompleted" : "TaskCancelled";
            var terminalAudit = await _dbContext.AuditLogs.AsNoTracking()
                .Where(a => a.TenantId == tenantId && a.EntityId == request.TaskId.ToString() && a.Action == statusAction)
                .OrderByDescending(a => a.EventTimeUtc)
                .Select(a => new { a.ActorDisplayName, a.EventTimeUtc })
                .FirstOrDefaultAsync(cancellationToken);
            statusActorDisplayName = terminalAudit?.ActorDisplayName;
            if (taskStatusStr is "Cancelled" or "Rejected"
                && terminalAudit is not null
                && terminalAudit.EventTimeUtc.Year > 2000)
            {
                updatedAtUtc = terminalAudit.EventTimeUtc;
            }
        }

        // Görevin durum değişiklikleri geçmişi: yalnızca "Durum Değiştir" (ChangeTaskStatusCommand) ile
        // yapılan değişiklikler — normal görev akışı (Atandı→Yapılmakta vb.) burada gösterilmez (card #1097
        // tersine çevrildi).
        var taskStatusAudits = await _dbContext.AuditLogs.AsNoTracking()
            .Where(a => a.TenantId == tenantId
                && a.EntityType == nameof(WorkTask)
                && a.EntityId == request.TaskId.ToString()
                && a.Action == "TaskStatusChanged"
                && a.StatusAtEvent != null)
            .OrderBy(a => a.EventTimeUtc)
            .Select(a => new { a.StatusAtEvent, a.Details, a.Notes, a.ActorDisplayName, a.EventTimeUtc })
            .ToListAsync(cancellationToken);
        // Her "Durum Değiştir" denetim kaydı zaten kendi geçişini taşır (Details = "Önceki->Yeni",
        // ChangeTaskStatusCommand'da yazılır) — önceki kayda bakmaya gerek yok, tek kullanımda bile
        // doğru geçiş üretilir.
        var statusTransitions = taskStatusAudits
            .Select(audit =>
            {
                var parts = audit.Details?.Split("->", 2);
                var fromStatus = parts?.Length == 2 ? parts[0] : null;
                return new TaskStatusChangeHistoryResponse(
                    fromStatus,
                    audit.StatusAtEvent!,
                    audit.Notes,
                    audit.ActorDisplayName,
                    audit.EventTimeUtc);
            })
            .ToList();
        statusTransitions.Reverse(); // en yeni üstte
        var statusChangeHistory = statusTransitions.ToArray();

        return new TaskDetailResponse(
            task.TaskId,
            task.TenantId,
            task.JobId,
            jobEntity?.Title,
            jobEntity is null ? null : jobEntity.RequestType.ToString(),
            jobEntity is null ? null : jobEntity.SourceType.ToString(),
            task.Title,
            ResolveTaskDescription(task.Description, jobEntity?.Description),
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
            updatedAtUtc,
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
            hasPendingExtraTimeRequest,
            lastExtraTimeRequestDecision,
            statusActorDisplayName,
            statusChangeHistory,
            citizenMessageApproverDisplayName,
            citizenApprovalReleasedNote,
            citizenOutboundMessage,
            JobCancelReason: jobEntity?.CancelReason);
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
