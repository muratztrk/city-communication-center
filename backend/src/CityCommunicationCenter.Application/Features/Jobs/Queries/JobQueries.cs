using CityCommunicationCenter.Application.Features.Users;

namespace CityCommunicationCenter.Application.Features.Jobs;

public sealed record GetJobsQuery(string? Scope, Guid? DepartmentId = null) : IQuery<IReadOnlyList<JobSummaryResponse>>;

public sealed class GetJobsQueryHandler : IQueryHandler<GetJobsQuery, IReadOnlyList<JobSummaryResponse>>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public GetJobsQueryHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<IReadOnlyList<JobSummaryResponse>> Handle(GetJobsQuery request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var userId = context.UserId;

        var scope = (request.Scope ?? "all").Trim().ToLowerInvariant();
        var actor = userId.HasValue
            ? await _dbContext.Users.AsNoTracking().FirstOrDefaultAsync(u => u.UserId == userId.Value, cancellationToken)
            : null;
        var allManagedDepartmentIds = actor is { RoleCode: RoleCode.Manager }
            ? await _dbContext.Departments
                .AsNoTracking()
                .Where(department => department.TenantId == tenantId && department.ManagerUserId == actor.UserId)
                .Select(department => department.DepartmentId)
                .ToArrayAsync(cancellationToken)
            : [];
        var managedDepartmentIds = context.ActiveDepartmentId.HasValue
            ? allManagedDepartmentIds.Contains(context.ActiveDepartmentId.Value)
                ? [context.ActiveDepartmentId.Value]
                : []
            : allManagedDepartmentIds;
        var accessibleDepartmentIds = actor is null
            ? []
            : await UserDepartmentAccess.GetScopedDepartmentIdsAsync(_dbContext, tenantId, actor, context.ActiveDepartmentId, cancellationToken);
        var visibleDepartmentIds = actor is null
            ? []
            : accessibleDepartmentIds;

        IQueryable<Job> q = _dbContext.Jobs
            .AsNoTracking()
            .Where(j => j.TenantId == tenantId && j.SourceType != JobSourceType.Routine);

        if (scope == "mine" && userId.HasValue)
        {
            // Taleplerim: kullanıcının oluşturduğu talepler. Reporter, ekranındaki departman
            // seçimiyle tüm departmanlar arasında gezebilir; diğer roller aktif departmana bağlıdır.
            q = q.Where(j => j.CreatedByUserId == userId);
            // Vatandaş Talepleri (VT-) kendi ekranında yönetilir; Operator/CRM Taleplerim yalnızca
            // birim içi ve birim dışı standart talepleri gösterir (card #1081).
            if (actor is not null && (actor.RoleCode == RoleCode.Operator || UserRoleAccess.IsCitizenRequestManager(actor)))
            {
                q = q.Where(j =>
                    j.RequestType != JobRequestType.Citizen
                    && j.SourceType != JobSourceType.SocialMessage
                    && j.SourceType != JobSourceType.CitizenRequest
                    && j.SourceType != JobSourceType.EDevlet);
            }
            if (actor?.RoleCode == RoleCode.Reporter)
            {
                if (request.DepartmentId.HasValue)
                {
                    q = q.Where(j => j.OwnerDepartmentId == request.DepartmentId.Value);
                }
            }
            else if (context.ActiveDepartmentId.HasValue)
            {
                var activeDepartmentId = context.ActiveDepartmentId.Value;
                q = q.Where(j => j.OwnerDepartmentId == activeDepartmentId);
            }
        }
        else if ((scope == "my-department" || scope == "department-pool") && actor is not null)
        {
            q = q.Where(j =>
                visibleDepartmentIds.Contains(j.OwnerDepartmentId) ||
                _dbContext.JobDepartments.Any(jd => jd.JobId == j.JobId && visibleDepartmentIds.Contains(jd.DepartmentId)));
        }
        else if (scope == "pending-approval")
        {
            q = q.Where(j => j.Status == JobStatus.PendingOwnerApproval || j.Status == JobStatus.PendingExternalApproval);
            if (actor is not null && actor.RoleCode == RoleCode.Manager)
            {
                q = q.Where(j =>
                    managedDepartmentIds.Contains(j.OwnerDepartmentId) ||
                    _dbContext.JobDepartments.Any(jd => jd.JobId == j.JobId
                        && managedDepartmentIds.Contains(jd.DepartmentId)
                        && jd.Role == JobDepartmentRole.Target));
            }
        }
        else if (scope == "outgoing-department")
        {
            q = actor is { RoleCode: RoleCode.Manager } && visibleDepartmentIds.Length > 0
                ? q.Where(j => j.RequestType == JobRequestType.ExternalUnit
                    && visibleDepartmentIds.Contains(j.OwnerDepartmentId))
                : q.Where(_ => false);
        }
        else if (scope == "active")
        {
            q = q.Where(j => j.Status == JobStatus.Active);
        }
        else if (scope == "rejected")
        {
            q = q.Where(j => j.Status == JobStatus.Rejected || j.Status == JobStatus.Cancelled);
        }

        var rows = await q
            .OrderByDescending(j => j.CreatedAtUtc)
            .Select(j => new
            {
                Job = j,
                OwnerName = _dbContext.Departments
                    .AsNoTracking()
                    .Where(d => d.DepartmentId == j.OwnerDepartmentId)
                    .Select(d => (string?)d.Name)
                    .FirstOrDefault(),
                CreatedByDisplayName = j.CreatedByUserId.HasValue
                    ? _dbContext.Users
                        .AsNoTracking()
                        .Where(u => u.UserId == j.CreatedByUserId.Value)
                        .Select(u => (string?)u.DisplayName)
                        .FirstOrDefault()
                    : null,
                CreatedByRoleCode = j.CreatedByUserId.HasValue
                    ? _dbContext.Users
                        .AsNoTracking()
                        .Where(u => u.UserId == j.CreatedByUserId.Value)
                        .Select(u => (string?)u.RoleCode.ToString())
                        .FirstOrDefault()
                    : null,
            })
            .ToListAsync(cancellationToken);

        var jobIds = rows.Select(r => r.Job.JobId).ToArray();
        var counts = await _dbContext.Tasks
            .AsNoTracking()
            .Where(t => jobIds.Contains(t.JobId))
            .GroupBy(t => t.JobId)
            .Select(g => new { JobId = g.Key, Count = g.Count() })
            .ToListAsync(cancellationToken);
        var countsMap = counts.ToDictionary(x => x.JobId, x => x.Count);
        // Birim içi taleplerde "Gittiği Yer" altında gösterilecek atanan personel ad(lar)ı.
        var assignedUsers = await _dbContext.Tasks
            .AsNoTracking()
            .Where(t => jobIds.Contains(t.JobId) && t.AssignedUserId != null)
            .Select(t => new
            {
                t.JobId,
                DisplayName = _dbContext.Users
                    .AsNoTracking()
                    .Where(u => u.UserId == t.AssignedUserId!.Value)
                    .Select(u => u.DisplayName)
                    .FirstOrDefault(),
            })
            .ToListAsync(cancellationToken);
        var assignedUsersMap = assignedUsers
            .Where(x => !string.IsNullOrWhiteSpace(x.DisplayName))
            .GroupBy(x => x.JobId)
            .ToDictionary(g => g.Key, g => (string?)string.Join(", ", g.Select(x => x.DisplayName!).Distinct()));
        var departments = await _dbContext.JobDepartments
            .AsNoTracking()
            .Where(jd => jobIds.Contains(jd.JobId))
            .Select(jd => new
            {
                jd.JobId,
                Department = new JobDepartmentResponse(
                    jd.JobDepartmentId,
                    jd.DepartmentId,
                    _dbContext.Departments
                        .AsNoTracking()
                        .Where(d => d.DepartmentId == jd.DepartmentId)
                        .Select(d => (string?)d.Name)
                        .FirstOrDefault(),
                    jd.Role.ToString(),
                    jd.ApprovalStatus.ToString(),
                    jd.RequestedByUserId,
                    jd.ApprovedByUserId,
                    jd.ApprovedByUserId.HasValue
                        ? _dbContext.Users
                            .AsNoTracking()
                            .Where(u => u.UserId == jd.ApprovedByUserId.Value)
                            .Select(u => (string?)u.DisplayName)
                            .FirstOrDefault()
                        : null,
                    jd.RequestedAtUtc,
                    jd.DecidedAtUtc,
                    jd.RejectReason,
                    jd.Notes)
            })
            .ToListAsync(cancellationToken);
        var departmentsMap = departments
            .GroupBy(x => x.JobId)
            .ToDictionary(x => x.Key, x => (IReadOnlyCollection<JobDepartmentResponse>)x.Select(d => d.Department).ToArray());

        // Vatandaş taleplerinin VT numarası linkli sosyal mesajda tutulur; gridlerde T- yerine VT-
        // gösterebilmek için job → CitizenRequestNumber eşlemesi (card #1077).
        var citizenNumbers = await _dbContext.SocialMessages
            .AsNoTracking()
            .Where(m => m.JobId.HasValue && jobIds.Contains(m.JobId.Value) && m.CitizenRequestNumber != null)
            .Select(m => new { JobId = m.JobId!.Value, m.CitizenRequestNumber, m.CitizenRequestNumberYear })
            .ToListAsync(cancellationToken);
        var citizenNumberMap = citizenNumbers
            .GroupBy(x => x.JobId)
            .ToDictionary(g => g.Key, g => g.First());

        // Talebin görevlerine bağlı ek süre (TaskRevision) onayları — talep gridlerindeki
        // "(Ek süre talebi)" işaretleri görev gridindeki ile aynı kurala göre üretilir (cards #1385/#1388).
        var extraTimeApprovals = await _dbContext.Approvals
            .AsNoTracking()
            .Where(a => a.SubjectType == ApprovalSubjectType.TaskRevision)
            .Join(
                _dbContext.Tasks.AsNoTracking().Where(t => jobIds.Contains(t.JobId)),
                a => a.SubjectId,
                t => t.TaskId,
                (a, t) => new { t.JobId, a.Decision, a.DecisionDateUtc })
            .ToListAsync(cancellationToken);
        var pendingExtraTimeJobIds = extraTimeApprovals
            .Where(x => x.Decision == ApprovalDecision.Pending)
            .Select(x => x.JobId)
            .ToHashSet();
        var lastExtraTimeDecisionMap = extraTimeApprovals
            .Where(x => x.Decision != ApprovalDecision.Pending)
            .GroupBy(x => x.JobId)
            .ToDictionary(
                g => g.Key,
                g => (string?)g.OrderByDescending(x => x.DecisionDateUtc).First().Decision.ToString());

        return rows.Select(r => new JobSummaryResponse(
            r.Job.JobId,
            r.Job.TenantId,
            r.Job.Title,
            r.Job.Status.ToString(),
            r.Job.Priority,
            r.Job.RequestType.ToString(),
            r.Job.IsProject,
            r.Job.IsProjectCreatorRequested,
            r.Job.IsProjectOwnerConfirmed,
            r.Job.CitizenName,
            r.Job.CitizenPhone,
            r.Job.OwnerDepartmentId,
            r.OwnerName,
            r.Job.StartDateUtc,
            r.Job.DueDateUtc,
            r.Job.CompletedAtUtc,
            r.Job.CompletionPercentage,
            r.Job.IsCoordinated,
            r.Job.SourceType.ToString(),
            countsMap.GetValueOrDefault(r.Job.JobId, 0),
            departmentsMap.GetValueOrDefault(r.Job.JobId, Array.Empty<JobDepartmentResponse>()),
            r.Job.CreatedAtUtc,
            r.Job.JobNumber,
            r.Job.JobNumberYear,
            r.CreatedByDisplayName,
            r.Job.UpdatedAtUtc,
            assignedUsersMap.GetValueOrDefault(r.Job.JobId),
            r.CreatedByRoleCode,
            citizenNumberMap.GetValueOrDefault(r.Job.JobId)?.CitizenRequestNumber,
            citizenNumberMap.GetValueOrDefault(r.Job.JobId)?.CitizenRequestNumberYear,
            pendingExtraTimeJobIds.Contains(r.Job.JobId),
            lastExtraTimeDecisionMap.GetValueOrDefault(r.Job.JobId))).ToArray();
    }
}

public sealed record GetJobByIdQuery(Guid JobId) : IQuery<JobDetailResponse?>;

public sealed class GetJobByIdQueryHandler : IQueryHandler<GetJobByIdQuery, JobDetailResponse?>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public GetJobByIdQueryHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<JobDetailResponse?> Handle(GetJobByIdQuery request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var job = await _dbContext.Jobs
            .AsNoTracking()
            .FirstOrDefaultAsync(j => j.JobId == request.JobId && j.TenantId == tenantId, cancellationToken);
        if (job is null) return null;

        var ownerName = await _dbContext.Departments.AsNoTracking()
            .Where(d => d.DepartmentId == job.OwnerDepartmentId)
            .Select(d => d.Name)
            .FirstOrDefaultAsync(cancellationToken);

        var createdByName = job.CreatedByUserId.HasValue
            ? await _dbContext.Users.AsNoTracking()
                .Where(u => u.UserId == job.CreatedByUserId.Value)
                .Select(u => u.DisplayName)
                .FirstOrDefaultAsync(cancellationToken)
            : null;

        var createdByRoleCode = job.CreatedByUserId.HasValue
            ? await _dbContext.Users.AsNoTracking()
                .Where(u => u.UserId == job.CreatedByUserId.Value)
                .Select(u => (string?)u.RoleCode.ToString())
                .FirstOrDefaultAsync(cancellationToken)
            : null;

        var depts = await _dbContext.JobDepartments
            .AsNoTracking()
            .Where(jd => jd.JobId == job.JobId)
            .Select(jd => new JobDepartmentResponse(
                jd.JobDepartmentId,
                jd.DepartmentId,
                _dbContext.Departments
                    .AsNoTracking()
                    .Where(d => d.DepartmentId == jd.DepartmentId)
                    .Select(d => (string?)d.Name)
                    .FirstOrDefault(),
                jd.Role.ToString(),
                jd.ApprovalStatus.ToString(),
                jd.RequestedByUserId,
                jd.ApprovedByUserId,
                jd.ApprovedByUserId.HasValue
                    ? _dbContext.Users
                        .AsNoTracking()
                        .Where(u => u.UserId == jd.ApprovedByUserId.Value)
                        .Select(u => (string?)u.DisplayName)
                        .FirstOrDefault()
                    : null,
                jd.RequestedAtUtc,
                jd.DecidedAtUtc,
                jd.RejectReason,
                jd.Notes))
            .ToListAsync(cancellationToken);

        var tasks = await _dbContext.Tasks
            .AsNoTracking()
            .Where(t => t.JobId == job.JobId)
            .Select(t => new TaskSummaryResponse(
                t.TaskId,
                t.TenantId,
                t.JobId,
                job.Title,
                job.RequestType.ToString(),
                job.SourceType.ToString(),
                job.JobNumber,
                job.JobNumberYear,
                t.Title,
                t.Priority,
                t.CurrentStatus.ToString(),
                t.AssignedDepartmentId,
                _dbContext.Departments
                    .AsNoTracking()
                    .Where(dep => dep.DepartmentId == t.AssignedDepartmentId)
                    .Select(dep => (string?)dep.Name)
                    .FirstOrDefault(),
                t.AssignedUserId,
                _dbContext.Users
                    .AsNoTracking()
                    .Where(u => u.UserId == t.AssignedUserId)
                    .Select(u => (string?)u.DisplayName)
                    .FirstOrDefault(),
                t.DueDateUtc,
                t.CompletionPercentage,
                t.EstimatedHours,
                t.ActualHours,
                _dbContext.Users
                    .AsNoTracking()
                    .Where(u => u.UserId == t.CreatedByUserId)
                    .Select(u => (string?)u.DisplayName)
                    .FirstOrDefault(),
                t.CreatedAtUtc,
                _dbContext.Users
                    .AsNoTracking()
                    .Where(u => u.UserId == t.OwnerUserId)
                    .Select(u => (string?)u.DisplayName)
                    .FirstOrDefault(),
                t.TaskNumber,
                t.TaskNumberYear,
                _dbContext.Departments
                    .AsNoTracking()
                    .Where(dep => dep.DepartmentId == job.OwnerDepartmentId)
                    .Select(dep => (string?)dep.Name)
                    .FirstOrDefault(),
                t.CompletedAtUtc,
                t.UpdatedAtUtc,
                null,
                t.OwnerUserId,
                t.AssignedAtUtc,
                (DateTimeOffset?)null,
                // Yöneticide bekleyen ek süre talebi — talep detayı "Görev Detayları" kartındaki
                // "(Ek süre talebi)" işareti için (card #1385, GetTasksQuery ile aynı desen).
                _dbContext.Approvals.Any(approval =>
                    approval.SubjectType == ApprovalSubjectType.TaskRevision
                    && approval.SubjectId == t.TaskId
                    && approval.Decision == ApprovalDecision.Pending),
                // Sonuçlanmış en güncel ek süre talebinin kararı.
                _dbContext.Approvals
                    .Where(approval => approval.SubjectType == ApprovalSubjectType.TaskRevision
                        && approval.SubjectId == t.TaskId
                        && approval.Decision != ApprovalDecision.Pending)
                    .OrderByDescending(approval => approval.DecisionDateUtc)
                    .Select(approval => (string?)approval.Decision.ToString())
                    .FirstOrDefault(),
                // Görevi atayan yöneticinin adı (card #709). Dikkat: eski kod bu subquery'yi bir
                // pozisyon önce (LastExtraTimeRequestDecision slotunda) geçiriyordu — card #1385
                // incelemesinde düzeltildi.
                _dbContext.Users
                    .AsNoTracking()
                    .Where(u => u.UserId == t.AssigningManagerId)
                    .Select(u => (string?)u.DisplayName)
                    .FirstOrDefault()))
            .ToListAsync(cancellationToken);

        var taskIds = tasks.Select(task => task.TaskId).ToList();
        if (taskIds.Count > 0)
        {
            var taskDescriptions = await _dbContext.Tasks
                .AsNoTracking()
                .Where(task => taskIds.Contains(task.TaskId))
                .Select(task => new
                {
                    task.TaskId,
                    task.Description,
                    // Notes alanı görev ilerleme/durum değişikliği geçmişinde de yazılıyor (genel bir
                    // "son not" alanı) — sadece tamamlanmış görevlerde "Görev Tamamlama Notu" olarak
                    // anlamlı olduğundan, gereksiz veri sızıntısını önlemek için diğer durumlarda null
                    // gönderilir (card #1402 review notu).
                    Notes = task.CurrentStatus.ToString() == "Completed" ? task.Notes : null,
                    // İptal/red notu yalnızca terminal görevlerde "Görev İptal Notu" kartına gider (card #1530).
                    RevisionReason = task.CurrentStatus.ToString() == "Cancelled"
                        || task.CurrentStatus.ToString() == "Rejected"
                        ? task.RevisionReason
                        : null,
                })
                .ToDictionaryAsync(task => task.TaskId, task => task, cancellationToken);

            var taskAttachmentRows = await _dbContext.Attachments
                .AsNoTracking()
                .Where(attachment => attachment.TenantId == tenantId
                    && attachment.EntityType == "Task"
                    && taskIds.Contains(attachment.EntityId))
                .OrderBy(attachment => attachment.CreatedAtUtc)
                .Select(attachment => new
                {
                    attachment.EntityId,
                    Response = new AttachmentResponse(
                        attachment.AttachmentId,
                        attachment.FileName,
                        attachment.ContentType,
                        attachment.FileSizeBytes,
                        attachment.RelativeUrl,
                        attachment.CreatedAtUtc),
                })
                .ToListAsync(cancellationToken);

            var attachmentsByTask = taskAttachmentRows
                .GroupBy(row => row.EntityId)
                .ToDictionary(
                    group => group.Key,
                    group => (IReadOnlyCollection<AttachmentResponse>)group.Select(row => row.Response).ToList());

            // Görevlerin "Durum Değiştir" geçmişi — talep detayı "Görev Bilgileri" kartında
            // Görevlerim ile aynı gösterim için (card #1541). GetTaskByIdQuery'deki mantıkla
            // aynı, ama tüm görevler için tek sorguda toplu çekilir (N+1 önlenir).
            var taskIdStrings = taskIds.Select(id => id.ToString()).ToList();
            var taskStatusAuditRows = await _dbContext.AuditLogs.AsNoTracking()
                .Where(a => a.TenantId == tenantId
                    && a.EntityType == nameof(WorkTask)
                    && taskIdStrings.Contains(a.EntityId)
                    && a.Action == "TaskStatusChanged"
                    && a.StatusAtEvent != null)
                .OrderBy(a => a.EventTimeUtc)
                .Select(a => new { a.EntityId, a.StatusAtEvent, a.Details, a.Notes, a.ActorDisplayName, a.EventTimeUtc })
                .ToListAsync(cancellationToken);
            var statusHistoryByTask = taskStatusAuditRows
                .GroupBy(row => row.EntityId)
                .ToDictionary(
                    group => Guid.Parse(group.Key),
                    group =>
                    {
                        var transitions = group
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
                        transitions.Reverse();
                        return (IReadOnlyCollection<TaskStatusChangeHistoryResponse>)transitions;
                    });

            tasks = tasks
                .Select(task => task with
                {
                    Description = taskDescriptions.GetValueOrDefault(task.TaskId)?.Description,
                    // Görevin kendi tamamlama/durum değişikliği notu — "Görev Tamamlama Notu" kartı için (card #1402).
                    Notes = taskDescriptions.GetValueOrDefault(task.TaskId)?.Notes,
                    // İptal/red nedeni — "Görev İptal Notu" kartı için (card #1530).
                    RevisionReason = taskDescriptions.GetValueOrDefault(task.TaskId)?.RevisionReason,
                    Attachments = attachmentsByTask.GetValueOrDefault(task.TaskId) ?? Array.Empty<AttachmentResponse>(),
                    StatusChangeHistory = statusHistoryByTask.GetValueOrDefault(task.TaskId),
                })
                .ToList();
        }

        var approvals = await _dbContext.Approvals.AsNoTracking()
            .Where(a => a.SubjectType == ApprovalSubjectType.Job && a.SubjectId == job.JobId)
            .OrderBy(a => a.StepOrder)
            .Select(a => new ApprovalStepResponse(
                a.ApprovalId, a.SubjectType.ToString(), a.SubjectId,
                a.ApproverUserId, a.StepOrder, a.Decision.ToString(),
                a.DecisionDateUtc, a.Comment))
            .ToListAsync(cancellationToken);

        var attachments = await _dbContext.Attachments
            .AsNoTracking()
            .Where(a => a.TenantId == tenantId && a.EntityType == "Job" && a.EntityId == request.JobId)
            .OrderBy(a => a.CreatedAtUtc)
            .Select(a => new AttachmentResponse(a.AttachmentId, a.FileName, a.ContentType, a.FileSizeBytes, a.RelativeUrl, a.CreatedAtUtc))
            .ToListAsync(cancellationToken);

        // Durumu belirleyen kullanıcı + tamamlama notu, denetim kaydı/görevlerden türetilir (card 643).
        var jobStatusStr = job.Status.ToString();
        string? jobStatusActorDisplayName = null;
        string? jobCompletionNote = null;
        if (jobStatusStr is "Cancelled" or "Rejected")
        {
            jobStatusActorDisplayName = await _dbContext.AuditLogs.AsNoTracking()
                .Where(a => a.TenantId == tenantId && a.EntityId == request.JobId.ToString()
                    && (a.Action == "JobCancelled" || a.Action == "JobOwnerRejected"))
                .OrderByDescending(a => a.EventTimeUtc)
                .Select(a => a.ActorDisplayName)
                .FirstOrDefaultAsync(cancellationToken);
        }
        else if (jobStatusStr == "Completed")
        {
            var completedTask = await _dbContext.Tasks.AsNoTracking()
                .Where(t => t.TenantId == tenantId && t.JobId == job.JobId && t.CompletedAtUtc != null)
                .OrderByDescending(t => t.CompletedAtUtc)
                .Select(t => new { t.TaskId, t.Notes })
                .FirstOrDefaultAsync(cancellationToken);
            jobCompletionNote = completedTask?.Notes;
            if (completedTask != null)
            {
                var completedTaskId = completedTask.TaskId.ToString();
                jobStatusActorDisplayName = await _dbContext.AuditLogs.AsNoTracking()
                    .Where(a => a.TenantId == tenantId && a.EntityId == completedTaskId && a.Action == "TaskCompleted")
                    .OrderByDescending(a => a.EventTimeUtc)
                    .Select(a => a.ActorDisplayName)
                    .FirstOrDefaultAsync(cancellationToken);
            }
        }
        else if (jobStatusStr == "PendingOwnerApproval")
        {
            var managerUserId = await _dbContext.Departments.AsNoTracking()
                .Where(d => d.DepartmentId == job.OwnerDepartmentId)
                .Select(d => d.ManagerUserId)
                .FirstOrDefaultAsync(cancellationToken);
            if (managerUserId.HasValue)
            {
                jobStatusActorDisplayName = await _dbContext.Users.AsNoTracking()
                    .Where(u => u.UserId == managerUserId.Value)
                    .Select(u => u.DisplayName)
                    .FirstOrDefaultAsync(cancellationToken);
            }
        }

        return new JobDetailResponse(
            job.JobId, job.TenantId, job.Title, job.Description,
            job.Status.ToString(), job.Priority,
            job.RequestType.ToString(), job.IsProject, job.IsProjectCreatorRequested, job.IsProjectOwnerConfirmed, job.CitizenName, job.CitizenPhone,
            job.OwnerDepartmentId, ownerName,
            job.StartDateUtc, job.DueDateUtc, job.CompletedAtUtc,
            job.CompletionPercentage, job.IsCoordinated,
            job.SourceType.ToString(), job.SourceRefId, job.CancelReason,
            job.Latitude, job.Longitude,
            job.Neighborhood, job.Street, job.OpenAddress,
            createdByName, job.CreatedAtUtc,
            job.JobNumber, job.JobNumberYear,
            job.ManagerNote,
            depts, tasks, approvals, attachments,
            jobStatusActorDisplayName, jobCompletionNote, job.UpdatedAtUtc, createdByRoleCode);
    }
}
