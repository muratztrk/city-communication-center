using CityCommunicationCenter.Application.Common;
using CityCommunicationCenter.Application.Features.Users;
using CityCommunicationCenter.Domain.Enums;
using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Application.Features.Reports;

/// <summary>Builds the manager dashboard's status-based task and request summaries.</summary>
public enum TaskDashboardFilter { All, Assigned, Routine }
public enum RequestTagDashboardFilter { All, InProgress, Completed }

public sealed record GetDashboardStatusChartsQuery(
    DateTimeOffset? FromUtc,
    DateTimeOffset? ToUtc,
    TaskDashboardFilter StaffTaskType = TaskDashboardFilter.All,
    TaskDashboardFilter DepartmentTaskType = TaskDashboardFilter.All,
    TaskDashboardFilter MyTaskType = TaskDashboardFilter.All,
    RequestTagDashboardFilter RequestTagStatus = RequestTagDashboardFilter.All)
    : IQuery<DashboardStatusChartsResponse>;

public sealed class GetDashboardStatusChartsQueryHandler
    : IQueryHandler<GetDashboardStatusChartsQuery, DashboardStatusChartsResponse>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public GetDashboardStatusChartsQueryHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<DashboardStatusChartsResponse> Handle(
        GetDashboardStatusChartsQuery request,
        CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        if (!context.UserId.HasValue)
        {
            return new DashboardStatusChartsResponse([]);
        }

        if (context.RoleCode is not ("Manager" or "SystemAdmin"))
        {
            return await BuildStandardUserChartsAsync(
                tenantId,
                context.UserId.Value,
                context.RoleCode,
                context.ActiveDepartmentId,
                request,
                cancellationToken);
        }

        var actor = await _dbContext.Users.AsNoTracking().FirstOrDefaultAsync(
            user => user.TenantId == tenantId && user.UserId == context.UserId.Value && user.IsActive,
            cancellationToken);
        var departmentIds = actor is null
            ? []
            : await UserDepartmentAccess.GetScopedDepartmentIdsAsync(
                _dbContext, tenantId, actor, context.ActiveDepartmentId, cancellationToken);
        if (departmentIds.Length == 0)
        {
            return new DashboardStatusChartsResponse([]);
        }

        var now = DateTimeOffset.UtcNow;
        var taskQuery = _dbContext.Tasks.AsNoTracking()
            .Where(task => task.TenantId == tenantId
                && task.AssignedDepartmentId.HasValue
                && departmentIds.Contains(task.AssignedDepartmentId.Value)
                && (!request.FromUtc.HasValue || task.CreatedAtUtc >= request.FromUtc.Value)
                && (!request.ToUtc.HasValue || task.CreatedAtUtc <= request.ToUtc.Value));
        var tasks = await ProjectTaskStatusItems(taskQuery, tenantId).ToListAsync(cancellationToken);

        var outgoingJobs = await ProjectJobs(_dbContext.Jobs.AsNoTracking().Where(job =>
            job.TenantId == tenantId
            && job.RequestType == JobRequestType.ExternalUnit
            && departmentIds.Contains(job.OwnerDepartmentId)
            && (!request.FromUtc.HasValue || job.CreatedAtUtc >= request.FromUtc.Value)
                && (!request.ToUtc.HasValue || job.CreatedAtUtc <= request.ToUtc.Value)), cancellationToken);
        var incomingJobs = await ProjectJobs(_dbContext.Jobs.AsNoTracking().Where(job =>
            job.TenantId == tenantId
            && (departmentIds.Contains(job.OwnerDepartmentId)
                || _dbContext.JobDepartments.Any(department => department.JobId == job.JobId
                    && department.Role == JobDepartmentRole.Target
                    && departmentIds.Contains(department.DepartmentId)))
            && (!request.FromUtc.HasValue || job.CreatedAtUtc >= request.FromUtc.Value)
                && (!request.ToUtc.HasValue || job.CreatedAtUtc <= request.ToUtc.Value)), cancellationToken);
        // Görevlerim pie/kutucuk = GET /tasks?scope=mine (yalnızca AssignedUserId); birimdeki
        // görev kümesiyle sınırlamak kart 65 / grid 66 sapmasına yol açıyordu (#2817 reopen).
        var myAssignedTasks = await ProjectTaskStatusItems(
            _dbContext.Tasks.AsNoTracking()
                .Where(task => task.TenantId == tenantId
                    && task.AssignedUserId == context.UserId.Value
                    && (!request.FromUtc.HasValue || task.CreatedAtUtc >= request.FromUtc.Value)
                    && (!request.ToUtc.HasValue || task.CreatedAtUtc <= request.ToUtc.Value)),
            tenantId).ToListAsync(cancellationToken);

        // Taleplerim pie/kutucuk = GET /jobs?scope=mine (Routine hariç, aktif birim OwnerDepartmentId).
        var myRequestsQuery = _dbContext.Jobs.AsNoTracking().Where(job =>
            job.TenantId == tenantId
            && job.CreatedByUserId == context.UserId.Value
            && job.SourceType != JobSourceType.Routine
            && (!request.FromUtc.HasValue || job.CreatedAtUtc >= request.FromUtc.Value)
            && (!request.ToUtc.HasValue || job.CreatedAtUtc <= request.ToUtc.Value));
        if (context.ActiveDepartmentId.HasValue)
        {
            myRequestsQuery = myRequestsQuery.Where(job => job.OwnerDepartmentId == context.ActiveDepartmentId.Value);
        }

        var myRequestsJobs = await ProjectJobs(myRequestsQuery, cancellationToken);

        var staffUserIds = await UserDepartmentAccess.GetStaffUserIdsForDepartmentsAsync(
            _dbContext,
            tenantId,
            departmentIds,
            cancellationToken);
        var staffTasks = FilterTasks(tasks, request.StaffTaskType)
            .Where(task => task.AssignedUserId.HasValue && staffUserIds.Contains(task.AssignedUserId.Value));
        var staffTasksChart = await BuildStaffTasksChartAsync(
            staffTasks,
            tenantId,
            staffUserIds,
            cancellationToken);
        var staffOverdueTasks = staffTasks.Where(task =>
            IsOpenOverdueTask(task.Status, task.DueDateUtc, now));
        var staffOverdueTasksChart = await BuildStaffTasksChartAsync(
            staffOverdueTasks,
            tenantId,
            staffUserIds,
            cancellationToken,
            "dashboard.charts.staffOverdueTasks");
        var staffResolutionTimeChart = context.RoleCode == "Manager"
            ? await BuildStaffResolutionTimeChartAsync(
                tenantId,
                departmentIds,
                staffUserIds.ToArray(),
                request,
                cancellationToken)
            : null;
        // Sadece personele (yöneticinin kendisi hariç) atanmış görevlerin öncelik dağılımı — birim
        // yöneticisi panosunda gösterilir (card #1516/#1487, "sadece personelin" ile düzeltildi).
        // Yönetici pie sırası: Personelimin Görevleri → Çözme Süresi (#r507).
        // Birimdeki Görevler + Talep Önceliği pie'ları kaldırıldı (card #2521).
        var charts = new List<DashboardChartResponse>
        {
            staffTasksChart,
            staffOverdueTasksChart,
        };
        if (staffResolutionTimeChart is not null)
        {
            charts.Add(staffResolutionTimeChart);
        }
        charts.AddRange(
        [
            BuildTaskChart("dashboard.charts.myTasks", FilterTasks(myAssignedTasks, request.MyTaskType), now),
            BuildJobChart("dashboard.charts.outgoingRequests", outgoingJobs, "dashboard.chart.pending", now, true),
            BuildJobChart("dashboard.charts.incomingRequests", incomingJobs, "dashboard.chart.pendingApproval", now, true),
            BuildJobChart("dashboard.charts.myRequests", myRequestsJobs, "dashboard.chart.externalPendingApproval", now, true),
        ]);

        return new DashboardStatusChartsResponse(charts);

    }

    private async Task<List<CitizenJobStatusItem>> ProjectCitizenJobs(IQueryable<Job> jobs, CancellationToken cancellationToken)
    {
        return await jobs
            .Select(job => new CitizenJobStatusItem(
                job.Status,
                job.DueDateUtc,
                _dbContext.Tasks.Count(task => task.JobId == job.JobId
                    && task.CurrentStatus != WorkflowTaskStatus.Completed
                    && task.CurrentStatus != WorkflowTaskStatus.Cancelled
                    && task.CurrentStatus != WorkflowTaskStatus.Rejected)))
            .ToListAsync(cancellationToken);
    }

    private static DashboardChartResponse BuildCitizenRequestsChart(
        IEnumerable<CitizenJobStatusItem> jobs,
        DateTimeOffset now)
    {
        var values = jobs.ToList();
        var processingReceived = 0;
        var overdue = 0;
        var inProgress = 0;
        var completed = 0;
        var cancelled = 0;

        foreach (var job in values)
        {
            switch (ClassifyCitizenRequestsPieStatus(job, now))
            {
                case CitizenJobDisplayStatus.Completed:
                    completed++;
                    break;
                case CitizenJobDisplayStatus.Cancelled:
                    cancelled++;
                    break;
                case CitizenJobDisplayStatus.Overdue:
                    overdue++;
                    break;
                case CitizenJobDisplayStatus.InProgress:
                    inProgress++;
                    break;
                default:
                    processingReceived++;
                    break;
            }
        }

        return new DashboardChartResponse("dashboard.charts.citizenRequests",
        [
            new DashboardChartSlice("dashboard.chart.citizenProcessingReceived", processingReceived, "info"),
            new DashboardChartSlice("dashboard.chart.overdue", overdue, "orange"),
            new DashboardChartSlice("dashboard.chart.inProgress", inProgress, "success"),
            new DashboardChartSlice("dashboard.chart.completed", completed, "primary"),
            new DashboardChartSlice("dashboard.chart.cancelled", cancelled, "danger"),
        ]);
    }

    private static CitizenJobDisplayStatus ClassifyCitizenRequestsPieStatus(CitizenJobStatusItem job, DateTimeOffset now)
    {
        var display = CitizenVtDashboardClassification.ClassifyCitizenRequestsPie(
            new CitizenVtDashboardClassification.JobSlice(job.Status, job.DueDateUtc, job.TaskCount),
            now);
        return MapCitizenDisplayStatus(display);
    }

    private static CitizenJobDisplayStatus ClassifyCitizenJobStatus(CitizenJobStatusItem job, DateTimeOffset now)
    {
        var display = CitizenVtDashboardClassification.Classify(
            new CitizenVtDashboardClassification.JobSlice(job.Status, job.DueDateUtc, job.TaskCount),
            now);
        return MapCitizenDisplayStatus(display);
    }

    private static CitizenJobDisplayStatus MapCitizenDisplayStatus(CitizenVtDashboardClassification.DisplayStatus display) =>
        display switch
        {
            CitizenVtDashboardClassification.DisplayStatus.ProcessingReceived => CitizenJobDisplayStatus.ProcessingReceived,
            CitizenVtDashboardClassification.DisplayStatus.InProgress => CitizenJobDisplayStatus.InProgress,
            CitizenVtDashboardClassification.DisplayStatus.Overdue => CitizenJobDisplayStatus.Overdue,
            CitizenVtDashboardClassification.DisplayStatus.Completed => CitizenJobDisplayStatus.Completed,
            CitizenVtDashboardClassification.DisplayStatus.Cancelled => CitizenJobDisplayStatus.Cancelled,
            _ => CitizenJobDisplayStatus.ProcessingReceived,
        };

    private async Task<List<JobStatusItem>> ProjectJobs(IQueryable<Job> jobs, CancellationToken cancellationToken)
    {
        return await jobs
            .Select(job => new JobStatusItem(
                job.Status,
                job.DueDateUtc,
                _dbContext.Tasks.Any(task => task.JobId == job.JobId
                    && task.CurrentStatus != WorkflowTaskStatus.Completed
                    && task.CurrentStatus != WorkflowTaskStatus.Cancelled
                    && task.CurrentStatus != WorkflowTaskStatus.Rejected),
                _dbContext.Tasks.Count(task => task.JobId == job.JobId)))
            .ToListAsync(cancellationToken);
    }

    private async Task<DashboardStatusChartsResponse> BuildStandardUserChartsAsync(
        Guid tenantId,
        Guid userId,
        string? roleCode,
        Guid? activeDepartmentId,
        GetDashboardStatusChartsQuery request,
        CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var taskQuery = _dbContext.Tasks.AsNoTracking()
            .Where(task => task.TenantId == tenantId
                && task.AssignedUserId == userId
                && (!request.FromUtc.HasValue || task.CreatedAtUtc >= request.FromUtc.Value)
                && (!request.ToUtc.HasValue || task.CreatedAtUtc <= request.ToUtc.Value));
        var tasks = await ProjectTaskStatusItems(taskQuery, tenantId).ToListAsync(cancellationToken);
        var actor = await _dbContext.Users.AsNoTracking().FirstOrDefaultAsync(
            user => user.TenantId == tenantId && user.UserId == userId && user.IsActive,
            cancellationToken);
        // Taleplerim pie = GET /jobs?scope=mine ile aynı aday küme (JobQueries): Routine yok,
        // VT/Citizen yok; Operator/CRM'de SocialMessage/CitizenRequest/EDevlet yok; Reporter
        // dışındaki roller aktif birim (OwnerDepartmentId) ile sınırlı. Aksi halde pie sayısı
        // Taleplerim gridinden sapıyordu (ör. Operator overdue 63 vs liste 1).
        var myRequestsQuery = _dbContext.Jobs.AsNoTracking().Where(job =>
            job.TenantId == tenantId
            && job.CreatedByUserId == userId
            && job.SourceType != JobSourceType.Routine
            && (!request.FromUtc.HasValue || job.CreatedAtUtc >= request.FromUtc.Value)
            && (!request.ToUtc.HasValue || job.CreatedAtUtc <= request.ToUtc.Value))
            .WhereIsNotCitizenSourced(_dbContext);
        if (actor is not null && (actor.RoleCode == RoleCode.Operator || UserRoleAccess.IsCitizenRequestManager(actor)))
        {
            myRequestsQuery = myRequestsQuery.Where(job =>
                job.SourceType != JobSourceType.SocialMessage
                && job.SourceType != JobSourceType.CitizenRequest
                && job.SourceType != JobSourceType.EDevlet);
        }

        if (roleCode == "Reporter")
        {
            // Reporter Taleplerim tüm oluşturduğu (VT hariç) talepleri görür; aktif birim filtresi yok.
        }
        else if (activeDepartmentId.HasValue)
        {
            myRequestsQuery = myRequestsQuery.Where(job => job.OwnerDepartmentId == activeDepartmentId.Value);
        }

        var jobs = await ProjectJobs(myRequestsQuery, cancellationToken);

        var charts = new List<DashboardChartResponse>
        {
            // "Görevlerim" grafiği görev tipine göre filtrelenir (card 762).
            BuildTaskChart("dashboard.charts.myTasks", FilterTasks(tasks, request.MyTaskType), now),
            BuildJobChart("dashboard.charts.myRequests", jobs, "dashboard.chart.pending", now, false),
        };

        if (roleCode is "Reporter" or "Operator")
        {
            var citizenJobs = await ProjectCitizenJobs(_dbContext.Jobs.AsNoTracking().Where(job =>
                job.TenantId == tenantId
                && (!request.FromUtc.HasValue || job.CreatedAtUtc >= request.FromUtc.Value)
                && (!request.ToUtc.HasValue || job.CreatedAtUtc <= request.ToUtc.Value))
                // VT numarası kaynağıdır; RequestType=Citizen şartı etiket/kanal grafikleriyle
                // uyumsuz sıfır dilim üretiyordu (#r546 / Vatandaş Talepleri pie).
                .WhereHasCitizenRequestNumber(_dbContext), cancellationToken);
            charts.Add(BuildCitizenRequestsChart(citizenJobs, now));
            charts.Add(await BuildRequestTagChartAsync(tenantId, request, cancellationToken));
        }

        // Üst Düzey Yönetici + Vatandaş Operatörü mahalle kırılımlarını görür (cards #1833/#1810).
        if (roleCode is "Reporter" or "Operator")
        {
            charts.Add(await BuildNeighborhoodCompletedRequestsChartAsync(tenantId, request, cancellationToken));
            charts.Add(await BuildNeighborhoodInProgressRequestsChartAsync(tenantId, request, cancellationToken));
            charts.Add(await BuildNeighborhoodProcessingRequestsChartAsync(tenantId, request, cancellationToken));
        }

        // Üst Düzey Yönetici / Vatandaş Talep Operatörü Anasayfa-Vatandaş: birim bazlı VT durum
        // pie'ları (#6a6cdec6, Operator'e genişletildi card #2245).
        if (roleCode is "Reporter" or "Operator")
        {
            charts.AddRange(await BuildCitizenDepartmentStatusChartsAsync(tenantId, request, cancellationToken));
        }

        // Üst Düzey Yönetici (Reporter) tenant genelinde birim-dışı talep dağılımını görür (card #835, #763).
        if (roleCode is "Reporter")
        {
            charts.AddRange(await BuildExternalUnitDepartmentChartsAsync(tenantId, request, cancellationToken));
        }

        return new DashboardStatusChartsResponse(charts);
    }

    private async Task<DashboardChartResponse> BuildRequestTagChartAsync(
        Guid tenantId,
        GetDashboardStatusChartsQuery request,
        CancellationToken cancellationToken)
    {
        var jobs = _dbContext.Jobs.AsNoTracking()
            .Where(job => job.TenantId == tenantId
                && (!request.FromUtc.HasValue || job.CreatedAtUtc >= request.FromUtc.Value)
                && (!request.ToUtc.HasValue || job.CreatedAtUtc <= request.ToUtc.Value));
        jobs = request.RequestTagStatus switch
        {
            RequestTagDashboardFilter.InProgress => jobs.Where(job => job.Status == JobStatus.Active),
            RequestTagDashboardFilter.Completed => jobs.Where(job => job.Status == JobStatus.Completed),
            _ => jobs,
        };

        var taggedRows = await _dbContext.SocialMessages
            .AsNoTracking()
            // Talep Etiketi pie'ı yalnız VT (Vatandaş Talebi) mesajlarını sayar (card #1845).
            .Where(message => message.TenantId == tenantId && message.JobId.HasValue && message.CitizenRequestNumber != null)
            .Join(
                jobs,
                message => message.JobId!.Value,
                job => job.JobId,
                (message, job) => new
                {
                    job.JobId,
                    message.Category,
                    ConversationLabel = message.CitizenConversationId.HasValue
                        ? _dbContext.CitizenConversations
                            .AsNoTracking()
                            .Where(conversation => conversation.CitizenConversationId == message.CitizenConversationId.Value)
                            .Select(conversation => conversation.Label)
                            .FirstOrDefault()
                        : null,
                })
            .ToListAsync(cancellationToken);

        var tagsByJob = taggedRows
            .Select(row => new
            {
                row.JobId,
                Tag = string.IsNullOrWhiteSpace(row.Category) ? row.ConversationLabel : row.Category,
            })
            .Where(row => !string.IsNullOrWhiteSpace(row.Tag))
            .GroupBy(row => row.JobId)
            .Select(group => group.Select(row => row.Tag!.Trim()).First())
            .ToList();
        var configuredTags = await _dbContext.RequestTags
            .AsNoTracking()
            .Where(tag => tag.TenantId == tenantId && tag.Name != "")
            .OrderBy(tag => tag.Name)
            .Select(tag => tag.Name)
            .ToListAsync(cancellationToken);
        var countsByTag = tagsByJob
            .GroupBy(tag => tag, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.Count(), StringComparer.OrdinalIgnoreCase);
        var labels = configuredTags
            .Select(tag => tag.Trim())
            .Concat(tagsByJob)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        var colorHints = new[] { "primary", "info", "violet", "warning", "orange", "danger", "neutral", "rose" };
        var slices = labels
            .Select(label => (
                Label: label,
                Count: countsByTag.GetValueOrDefault(label)))
            .OrderByDescending(item => item.Count)
            .ThenBy(item => item.Label, StringComparer.CurrentCultureIgnoreCase)
            .Select((item, index) => new DashboardChartSlice(
                item.Label,
                item.Count,
                colorHints[index % colorHints.Length]))
            .ToArray();

        return new DashboardChartResponse("dashboard.charts.requestTags", slices);
    }

    /// <summary>
    /// Üst Düzey Yönetici Anasayfa-Vatandaş: hedef birime göre VT durum pie'ları (#6a6cdec6).
    /// İşleme Alınan / Yapılmakta / Tamamlanan — ClassifyCitizenJobStatus ile aynı dilimler.
    /// </summary>
    private async Task<List<DashboardChartResponse>> BuildCitizenDepartmentStatusChartsAsync(
        Guid tenantId,
        GetDashboardStatusChartsQuery request,
        CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var rows = await _dbContext.Jobs.AsNoTracking()
            .Where(job => job.TenantId == tenantId
                && job.SourceType != JobSourceType.Routine
                && (!request.FromUtc.HasValue || job.CreatedAtUtc >= request.FromUtc.Value)
                && (!request.ToUtc.HasValue || job.CreatedAtUtc <= request.ToUtc.Value))
            .WhereHasCitizenRequestNumber(_dbContext)
            .Select(job => new
            {
                job.Status,
                job.DueDateUtc,
                TaskCount = _dbContext.Tasks.Count(task => task.JobId == job.JobId
                    && task.CurrentStatus != WorkflowTaskStatus.Completed
                    && task.CurrentStatus != WorkflowTaskStatus.Cancelled
                    && task.CurrentStatus != WorkflowTaskStatus.Rejected),
                TargetDepartmentId = _dbContext.JobDepartments
                    .Where(link => link.JobId == job.JobId
                        && link.TenantId == tenantId
                        && link.Role == JobDepartmentRole.Target
                        && link.ApprovalStatus != JobApprovalStatus.Rejected)
                    .Select(link => (Guid?)link.DepartmentId)
                    .FirstOrDefault(),
            })
            .ToListAsync(cancellationToken);

        var processing = new Dictionary<Guid, int>();
        var inProgress = new Dictionary<Guid, int>();
        var completed = new Dictionary<Guid, int>();

        foreach (var row in rows)
        {
            if (row.TargetDepartmentId is not Guid departmentId)
            {
                continue;
            }

            var display = ClassifyCitizenJobStatus(
                new CitizenJobStatusItem(row.Status, row.DueDateUtc, row.TaskCount),
                now);
            var bucket = display switch
            {
                CitizenJobDisplayStatus.ProcessingReceived => processing,
                CitizenJobDisplayStatus.InProgress or CitizenJobDisplayStatus.Overdue => inProgress,
                CitizenJobDisplayStatus.Completed => completed,
                _ => null,
            };
            if (bucket is null)
            {
                continue;
            }

            bucket[departmentId] = bucket.GetValueOrDefault(departmentId) + 1;
        }

        var departmentIds = processing.Keys
            .Concat(inProgress.Keys)
            .Concat(completed.Keys)
            .Distinct()
            .ToArray();
        var departmentNames = departmentIds.Length == 0
            ? new Dictionary<Guid, string>()
            : await _dbContext.Departments.AsNoTracking()
                .Where(department => department.TenantId == tenantId && departmentIds.Contains(department.DepartmentId))
                .ToDictionaryAsync(department => department.DepartmentId, department => department.Name, cancellationToken);

        static IEnumerable<(Guid DepartmentId, int Count)> ToEntries(IReadOnlyDictionary<Guid, int> counts) =>
            counts.Select(pair => (pair.Key, pair.Value));

        return
        [
            BuildDepartmentChart("dashboard.charts.citizenDepartmentProcessingRequests", ToEntries(processing), departmentNames),
            BuildDepartmentChart("dashboard.charts.citizenDepartmentInProgressRequests", ToEntries(inProgress), departmentNames),
            BuildDepartmentChart("dashboard.charts.citizenDepartmentCompletedRequests", ToEntries(completed), departmentNames),
        ];
    }

    /// <summary>
    /// Üst Düzey Yönetici panosu için birim-dışı (ExternalUnit) taleplerin birime göre dağılımını üretir.
    /// Tüm birimleri kapsar (Reporter'ın kendi birimiyle sınırlı değildir).
    /// </summary>
    private async Task<List<DashboardChartResponse>> BuildExternalUnitDepartmentChartsAsync(
        Guid tenantId,
        GetDashboardStatusChartsQuery request,
        CancellationToken cancellationToken)
    {
        // #835 "Talep Oluşturan Birimler" — birim-dışı talebi oluşturan (sahip) birime göre.
        var creators = (await _dbContext.Jobs.AsNoTracking()
            .Where(job => job.TenantId == tenantId
                && job.RequestType == JobRequestType.ExternalUnit
                && (!request.FromUtc.HasValue || job.CreatedAtUtc >= request.FromUtc.Value)
                && (!request.ToUtc.HasValue || job.CreatedAtUtc <= request.ToUtc.Value))
            .WhereIsNotCitizenSourced(_dbContext)
            .GroupBy(job => job.OwnerDepartmentId)
            .Select(group => new { DepartmentId = group.Key, Count = group.Count() })
            .ToListAsync(cancellationToken))
            .Select(item => (item.DepartmentId, item.Count));

        // #763 "Birimde Bekleyen Talepler" — dış birimden gelip Onay Bekleyen taleplerin hedef birime göre.
        var pending = (await _dbContext.JobDepartments.AsNoTracking()
            .Where(link => link.Role == JobDepartmentRole.Target
                && link.Job.TenantId == tenantId
                && link.Job.RequestType == JobRequestType.ExternalUnit
                && (link.Job.Status == JobStatus.PendingOwnerApproval
                    || link.Job.Status == JobStatus.PendingExternalApproval)
                && (!request.FromUtc.HasValue || link.Job.CreatedAtUtc >= request.FromUtc.Value)
                && (!request.ToUtc.HasValue || link.Job.CreatedAtUtc <= request.ToUtc.Value))
            .WhereJobIsNotCitizenSourced(_dbContext)
            .GroupBy(link => link.DepartmentId)
            .Select(group => new { DepartmentId = group.Key, Count = group.Count() })
            .ToListAsync(cancellationToken))
            .Select(item => (item.DepartmentId, item.Count));

        // Yapılmakta Olan Talepler — vatandaş kaynaklı job yok (#2570): RequestType + kaynak + VT no.
        var inProgress = (await _dbContext.JobDepartments.AsNoTracking()
            .Where(link => link.Role == JobDepartmentRole.Target
                && link.Job.TenantId == tenantId
                && link.Job.Status == JobStatus.Active
                && (!request.FromUtc.HasValue || link.Job.CreatedAtUtc >= request.FromUtc.Value)
                && (!request.ToUtc.HasValue || link.Job.CreatedAtUtc <= request.ToUtc.Value))
            .WhereJobIsNotCitizenSourced(_dbContext)
            .GroupBy(link => link.DepartmentId)
            .Select(group => new { DepartmentId = group.Key, Count = group.Count() })
            .ToListAsync(cancellationToken))
            .Select(item => (item.DepartmentId, item.Count));

        // #763 "Talebi Tamamlayan Birimler" — dış birimden gelip Tamamlanmış taleplerin hedef birime göre.
        var fulfillers = (await _dbContext.JobDepartments.AsNoTracking()
            .Where(link => link.Role == JobDepartmentRole.Target
                && link.Job.TenantId == tenantId
                && link.Job.RequestType == JobRequestType.ExternalUnit
                && link.Job.Status == JobStatus.Completed
                && (!request.FromUtc.HasValue || link.Job.CreatedAtUtc >= request.FromUtc.Value)
                && (!request.ToUtc.HasValue || link.Job.CreatedAtUtc <= request.ToUtc.Value))
            .WhereJobIsNotCitizenSourced(_dbContext)
            .GroupBy(link => link.DepartmentId)
            .Select(group => new { DepartmentId = group.Key, Count = group.Count() })
            .ToListAsync(cancellationToken))
            .Select(item => (item.DepartmentId, item.Count));

        // Proje pie: Birim İçi (Owner birim) + Üst Düzey Yönetici'nin oluşturduğu dış birim projeleri (#2618).
        // Birim içi taleplerin JobDepartment Target satırı yoktur — Target ile sayılırsa T-2026-589 gibi kayıtlar kaybolur.
        var reporterUserIds = await _dbContext.Users.AsNoTracking()
            .Where(user => user.TenantId == tenantId && user.RoleCode == RoleCode.Reporter)
            .Select(user => user.UserId)
            .ToListAsync(cancellationToken);

        var projectsInProgress = await CountProjectDepartmentsAsync(
            tenantId, JobStatus.Active, reporterUserIds, request, cancellationToken);
        var projectsCompleted = await CountProjectDepartmentsAsync(
            tenantId, JobStatus.Completed, reporterUserIds, request, cancellationToken);

        var counts = new[] { creators, pending, inProgress, fulfillers, projectsInProgress, projectsCompleted };
        var departmentIds = counts.SelectMany(entries => entries.Select(entry => entry.DepartmentId))
            .Distinct()
            .ToArray();
        var departmentNames = departmentIds.Length == 0
            ? new Dictionary<Guid, string>()
            : await _dbContext.Departments.AsNoTracking()
                .Where(department => department.TenantId == tenantId && departmentIds.Contains(department.DepartmentId))
                .ToDictionaryAsync(department => department.DepartmentId, department => department.Name, cancellationToken);

        return
        [
            BuildDepartmentChart("dashboard.charts.externalRequestCreators", creators, departmentNames),
            BuildDepartmentChart("dashboard.charts.externalRequestPending", pending, departmentNames),
            BuildDepartmentChart("dashboard.charts.externalRequestInProgress", inProgress, departmentNames),
            BuildDepartmentChart("dashboard.charts.externalRequestFulfillers", fulfillers, departmentNames),
            BuildDepartmentChart("dashboard.charts.externalProjectsInProgress", projectsInProgress, departmentNames),
            BuildDepartmentChart("dashboard.charts.externalProjectsCompleted", projectsCompleted, departmentNames),
        ];
    }

    private async Task<IReadOnlyList<(Guid DepartmentId, int Count)>> CountProjectDepartmentsAsync(
        Guid tenantId,
        JobStatus status,
        List<Guid> reporterUserIds,
        GetDashboardStatusChartsQuery request,
        CancellationToken cancellationToken)
    {
        var internalCounts = await _dbContext.Jobs.AsNoTracking()
            .Where(job => job.TenantId == tenantId
                && job.IsProject
                && job.Status == status
                && job.RequestType == JobRequestType.InternalUnit
                && (!request.FromUtc.HasValue || job.CreatedAtUtc >= request.FromUtc.Value)
                && (!request.ToUtc.HasValue || job.CreatedAtUtc <= request.ToUtc.Value))
            .WhereIsNotCitizenSourced(_dbContext)
            .GroupBy(job => job.OwnerDepartmentId)
            .Select(group => new { DepartmentId = group.Key, Count = group.Count() })
            .ToListAsync(cancellationToken);

        var reporterCounts = await _dbContext.JobDepartments.AsNoTracking()
            .Where(link => link.Role == JobDepartmentRole.Target
                && link.Job.TenantId == tenantId
                && link.Job.IsProject
                && link.Job.Status == status
                && link.Job.RequestType != JobRequestType.InternalUnit
                && link.Job.CreatedByUserId.HasValue
                && reporterUserIds.Contains(link.Job.CreatedByUserId.Value)
                && (!request.FromUtc.HasValue || link.Job.CreatedAtUtc >= request.FromUtc.Value)
                && (!request.ToUtc.HasValue || link.Job.CreatedAtUtc <= request.ToUtc.Value))
            .WhereJobIsNotCitizenSourced(_dbContext)
            .GroupBy(link => link.DepartmentId)
            .Select(group => new { DepartmentId = group.Key, Count = group.Count() })
            .ToListAsync(cancellationToken);

        return internalCounts.Concat(reporterCounts)
            .GroupBy(item => item.DepartmentId)
            .Select(group => (group.Key, group.Sum(item => item.Count)))
            .ToList();
    }

    /// <summary>
    /// Üst Düzey Yönetici panosu için "Mahallelerde Tamamlanan Talepler" — tamamlanmış taleplerin
    /// (mahalle bilgisi girilmiş olanların) mahalleye göre dağılımı, tüm talep tiplerini kapsar.
    /// </summary>
    private async Task<DashboardChartResponse> BuildNeighborhoodCompletedRequestsChartAsync(
        Guid tenantId,
        GetDashboardStatusChartsQuery request,
        CancellationToken cancellationToken)
    {
        var counts = await _dbContext.Jobs.AsNoTracking()
            .Where(job => job.TenantId == tenantId
                && job.Status == JobStatus.Completed
                && job.SourceType != JobSourceType.Routine
                && job.Neighborhood != null
                && job.Neighborhood != ""
                && (!request.FromUtc.HasValue || job.CreatedAtUtc >= request.FromUtc.Value)
                && (!request.ToUtc.HasValue || job.CreatedAtUtc <= request.ToUtc.Value))
            // Mahalle grafikleri yalnız VT (Vatandaş Talebi) job'larını sayar (card #1845).
            .WhereHasCitizenRequestNumber(_dbContext)
            .GroupBy(job => job.Neighborhood)
            .Select(group => new { Neighborhood = group.Key!, Count = group.Count() })
            .ToListAsync(cancellationToken);

        return BuildNeighborhoodChartWithZeros(
            "dashboard.charts.neighborhoodCompletedRequests",
            counts.ToDictionary(item => item.Neighborhood, item => item.Count, StringComparer.OrdinalIgnoreCase));
    }

    /// <summary>
    /// "Mahallelerde Yapılmakta Olan Talepler" — Yapılmakta + Yapılmakta (Son Tarihi Geçmiş);
    /// İşleme Alınan dilimleri dahil edilmez (#2605).
    /// </summary>
    private async Task<DashboardChartResponse> BuildNeighborhoodInProgressRequestsChartAsync(
        Guid tenantId,
        GetDashboardStatusChartsQuery request,
        CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var rows = await _dbContext.Jobs.AsNoTracking()
            .Where(job => job.TenantId == tenantId
                && job.SourceType != JobSourceType.Routine
                && job.Neighborhood != null
                && job.Neighborhood != ""
                && job.Status != JobStatus.Completed
                && job.Status != JobStatus.Cancelled
                && job.Status != JobStatus.Rejected
                && job.Status != JobStatus.RevisionRequested
                && (!request.FromUtc.HasValue || job.CreatedAtUtc >= request.FromUtc.Value)
                && (!request.ToUtc.HasValue || job.CreatedAtUtc <= request.ToUtc.Value))
            .WhereHasCitizenRequestNumber(_dbContext)
            .Select(job => new
            {
                Neighborhood = job.Neighborhood!,
                job.Status,
                job.DueDateUtc,
                TaskCount = _dbContext.Tasks.Count(task => task.JobId == job.JobId
                    && task.CurrentStatus != WorkflowTaskStatus.Completed
                    && task.CurrentStatus != WorkflowTaskStatus.Cancelled
                    && task.CurrentStatus != WorkflowTaskStatus.Rejected),
            })
            .ToListAsync(cancellationToken);

        var counts = rows
            .Where(row =>
            {
                var display = ClassifyCitizenJobStatus(
                    new CitizenJobStatusItem(row.Status, row.DueDateUtc, row.TaskCount), now);
                return display is CitizenJobDisplayStatus.InProgress or CitizenJobDisplayStatus.Overdue;
            })
            .GroupBy(row => row.Neighborhood)
            .Select(group => new { Neighborhood = group.Key, Count = group.Count() })
            .ToList();

        return BuildNeighborhoodChartWithZeros(
            "dashboard.charts.neighborhoodInProgressRequests",
            counts.ToDictionary(item => item.Neighborhood, item => item.Count, StringComparer.OrdinalIgnoreCase));
    }

    /// <summary>
    /// "Mahallelerde İşleme Alınan Talepler" — İşleme Alındı + İşleme Alındı (Geciken);
    /// Yapılmakta geciken bu grafikte yok (#2890).
    /// </summary>
    private async Task<DashboardChartResponse> BuildNeighborhoodProcessingRequestsChartAsync(
        Guid tenantId,
        GetDashboardStatusChartsQuery request,
        CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var rows = await _dbContext.Jobs.AsNoTracking()
            .Where(job => job.TenantId == tenantId
                && job.SourceType != JobSourceType.Routine
                && job.Neighborhood != null
                && job.Neighborhood != ""
                && job.Status != JobStatus.Completed
                && job.Status != JobStatus.Cancelled
                && job.Status != JobStatus.Rejected
                && job.Status != JobStatus.RevisionRequested
                && (!request.FromUtc.HasValue || job.CreatedAtUtc >= request.FromUtc.Value)
                && (!request.ToUtc.HasValue || job.CreatedAtUtc <= request.ToUtc.Value))
            // Mahalle grafikleri yalnız VT (Vatandaş Talebi) job'larını sayar (card #1845).
            .WhereHasCitizenRequestNumber(_dbContext)
            .Select(job => new
            {
                Neighborhood = job.Neighborhood!,
                job.Status,
                job.DueDateUtc,
                TaskCount = _dbContext.Tasks.Count(task => task.JobId == job.JobId
                    && task.CurrentStatus != WorkflowTaskStatus.Completed
                    && task.CurrentStatus != WorkflowTaskStatus.Cancelled
                    && task.CurrentStatus != WorkflowTaskStatus.Rejected),
            })
            .ToListAsync(cancellationToken);

        var counts = rows
            .Where(row => ClassifyCitizenJobStatus(
                new CitizenJobStatusItem(row.Status, row.DueDateUtc, row.TaskCount), now)
                == CitizenJobDisplayStatus.ProcessingReceived)
            .GroupBy(row => row.Neighborhood)
            .Select(group => new { Neighborhood = group.Key, Count = group.Count() })
            .ToList();

        return BuildNeighborhoodChartWithZeros(
            "dashboard.charts.neighborhoodProcessingRequests",
            counts.ToDictionary(item => item.Neighborhood, item => item.Count, StringComparer.OrdinalIgnoreCase));
    }

    /// <summary>
    /// Tire mahalle kataloğundaki tüm isimleri 0 sayıyla doldurur; geçmişte kullanılmış ama
    /// katalogda olmayan mahalle adları kaybolmaz (Talep Etiketi pie ile aynı desen, R548).
    /// </summary>
    private static DashboardChartResponse BuildNeighborhoodChartWithZeros(
        string titleKey,
        IReadOnlyDictionary<string, int> countsByNeighborhood)
    {
        var labels = TireNeighborhoodCatalog.Names
            .Select(name => name.Trim())
            .Concat(countsByNeighborhood.Keys.Select(name => name.Trim()))
            .Where(name => name.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Select(label => new
            {
                Label = label,
                Count = countsByNeighborhood.TryGetValue(label, out var count) ? count : 0,
            })
            .OrderByDescending(item => item.Count)
            .ThenBy(item => item.Label, StringComparer.CurrentCultureIgnoreCase)
            .ToList();

        return new DashboardChartResponse(titleKey,
            labels.Select((item, index) => new DashboardChartSlice(
                item.Label,
                item.Count,
                StaffChartColors[index % StaffChartColors.Length]))
                .ToList());
    }

    private static DashboardChartResponse BuildDepartmentChart(
        string titleKey,
        IEnumerable<(Guid DepartmentId, int Count)> entries,
        IReadOnlyDictionary<Guid, string> departmentNames)
    {
        var ordered = entries.OrderByDescending(entry => entry.Count).ToList();
        return new DashboardChartResponse(titleKey,
            ordered.Select((entry, index) => new DashboardChartSlice(
                $"{entry.DepartmentId}|{departmentNames.GetValueOrDefault(entry.DepartmentId, "—")}",
                entry.Count,
                StaffChartColors[index % StaffChartColors.Length]))
                .ToList());
    }

    private async Task<DashboardChartResponse> BuildStaffTasksChartAsync(
        IEnumerable<TaskStatusItem> tasks,
        Guid tenantId,
        IReadOnlyCollection<Guid> staffUserIds,
        CancellationToken cancellationToken,
        string titleKey = "dashboard.charts.staffTasks")
    {
        var countsByUser = tasks
            .Where(task => task.AssignedUserId.HasValue
                && task.Status is not (WorkflowTaskStatus.Cancelled or WorkflowTaskStatus.Rejected))
            .GroupBy(task => task.AssignedUserId!.Value)
            .ToDictionary(group => group.Key, group => group.Count());

        // Personelimin Görevleri: birimdeki tüm aktif personel dilimde kalır (0 olsa bile, R548).
        var staffIds = staffUserIds.Distinct().ToArray();
        var userNames = staffIds.Length == 0
            ? new Dictionary<Guid, string>()
            : await _dbContext.Users.AsNoTracking()
                .Where(user => user.TenantId == tenantId && staffIds.Contains(user.UserId))
                .ToDictionaryAsync(user => user.UserId, user => user.DisplayName, cancellationToken);

        var ordered = staffIds
            .Where(userId => userNames.ContainsKey(userId))
            .Select(userId => new
            {
                UserId = userId,
                Count = countsByUser.GetValueOrDefault(userId),
                Name = userNames[userId],
            })
            .OrderByDescending(item => item.Count)
            .ThenBy(item => item.Name, StringComparer.CurrentCultureIgnoreCase)
            .ToList();

        return new DashboardChartResponse(titleKey,
            ordered.Select((item, index) => new DashboardChartSlice(
                $"{item.UserId}|{item.Name}",
                item.Count,
                StaffChartColors[index % StaffChartColors.Length]))
                .ToList());
    }

    private async Task<DashboardChartResponse> BuildStaffResolutionTimeChartAsync(
        Guid tenantId,
        Guid[] departmentIds,
        Guid[] staffUserIds,
        GetDashboardStatusChartsQuery request,
        CancellationToken cancellationToken)
    {
        var terminalTasks = await (
            from task in _dbContext.Tasks.AsNoTracking()
            join job in _dbContext.Jobs.AsNoTracking().Where(job => job.TenantId == tenantId)
                on task.JobId equals job.JobId
            where task.TenantId == tenantId
                && task.AssignedDepartmentId.HasValue
                && departmentIds.Contains(task.AssignedDepartmentId.Value)
                && task.AssignedUserId.HasValue
                && staffUserIds.Contains(task.AssignedUserId.Value)
                && job.SourceType != JobSourceType.Routine
                && (task.CurrentStatus == WorkflowTaskStatus.Completed
                    || task.CurrentStatus == WorkflowTaskStatus.Cancelled)
                && (!request.FromUtc.HasValue || task.CreatedAtUtc >= request.FromUtc.Value)
                && (!request.ToUtc.HasValue || task.CreatedAtUtc <= request.ToUtc.Value)
            select new
            {
                task.TaskId,
                AssignedUserId = task.AssignedUserId!.Value,
                task.CreatedAtUtc,
                task.CompletedAtUtc,
                task.CurrentStatus,
            }).ToListAsync(cancellationToken);

        var cancelledEntityIds = terminalTasks
            .Where(task => task.CurrentStatus == WorkflowTaskStatus.Cancelled)
            .Select(task => task.TaskId.ToString())
            .ToArray();
        var cancelledAtByTaskId = cancelledEntityIds.Length == 0
            ? new Dictionary<string, DateTimeOffset>()
            : await _dbContext.AuditLogs.AsNoTracking()
                .Where(log => log.TenantId == tenantId
                    && log.EntityType == nameof(WorkTask)
                    && log.Action == "TaskCancelled"
                    && cancelledEntityIds.Contains(log.EntityId))
                .GroupBy(log => log.EntityId)
                .Select(group => new { EntityId = group.Key, CancelledAtUtc = group.Max(log => log.EventTimeUtc) })
                .ToDictionaryAsync(item => item.EntityId, item => item.CancelledAtUtc, cancellationToken);

        var averages = terminalTasks
            .Select(task => new
            {
                task.AssignedUserId,
                task.CreatedAtUtc,
                TerminalAtUtc = task.CurrentStatus == WorkflowTaskStatus.Completed
                    ? task.CompletedAtUtc
                    : cancelledAtByTaskId.GetValueOrDefault(task.TaskId.ToString()),
            })
            .Where(task => task.TerminalAtUtc.HasValue && task.TerminalAtUtc.Value >= task.CreatedAtUtc)
            .GroupBy(task => task.AssignedUserId)
            .Select(group => new
            {
                UserId = group.Key,
                AverageHours = Math.Round(
                    group.Average(task => (task.TerminalAtUtc!.Value - task.CreatedAtUtc).TotalHours),
                    1),
            })
            // 0 olmayan en küçük süreden itibaren artan sıra; 0'lar sonda (R549 / #2038).
            .OrderBy(item => item.AverageHours <= 0 ? 1 : 0)
            .ThenBy(item => item.AverageHours)
            .ToList();

        var userIds = averages.Select(item => item.UserId).ToArray();
        var userNames = userIds.Length == 0
            ? new Dictionary<Guid, string>()
            : await _dbContext.Users.AsNoTracking()
                .Where(user => user.TenantId == tenantId && userIds.Contains(user.UserId))
                .ToDictionaryAsync(user => user.UserId, user => user.DisplayName, cancellationToken);

        return new DashboardChartResponse(
            "dashboard.charts.staffResolutionTime",
            averages.Select((item, index) => new DashboardChartSlice(
                $"{item.UserId}|{userNames.GetValueOrDefault(item.UserId, "—")}",
                item.AverageHours,
                StaffChartColors[index % StaffChartColors.Length]))
                .ToList());
    }

    private static DashboardChartResponse BuildTaskChart(
        string titleKey,
        IEnumerable<TaskStatusItem> tasks,
        DateTimeOffset now)
    {
        var values = tasks.ToList();
        var overdue = values.Count(task => IsActionableOpen(task.Status) && IsPastDue(task.DueDateUtc, now));
        var pending = values.Count(task => IsActionableOpen(task.Status) && !IsPastDue(task.DueDateUtc, now));
        return new DashboardChartResponse(titleKey,
        [
            new DashboardChartSlice("dashboard.chart.pending", pending, "warning"),
            new DashboardChartSlice("dashboard.chart.overdue", overdue, "orange"),
            new DashboardChartSlice("dashboard.chart.completed", values.Count(task => task.Status == WorkflowTaskStatus.Completed), "primary"),
            new DashboardChartSlice("dashboard.chart.cancelled", values.Count(task => task.Status is WorkflowTaskStatus.Cancelled or WorkflowTaskStatus.Rejected), "danger"),
        ]);
    }

    private static DashboardChartResponse BuildJobChart(
        string titleKey,
        IEnumerable<JobStatusItem> jobs,
        string pendingLabel,
        DateTimeOffset now,
        bool includeInProgress)
    {
        var values = jobs.ToList();
        var pending = pendingLabel == "dashboard.chart.externalPendingApproval"
            ? values.Count(job => MatchesExternalPendingView(job, now))
            : values.Count(job => MatchesJobPendingSlice(job.Status, pendingLabel) && !IsPastDue(job.DueDateUtc, now));
        // Son tarihi geçmiş kayıtlar yalnızca DueDateUtc ile belirlenir (card #1181).
        var overdue = values.Count(job => IsOpen(job.Status) && IsPastDue(job.DueDateUtc, now));
        var activeNotOverdue = values.Where(job =>
            job.Status == JobStatus.Active
            && !IsPastDue(job.DueDateUtc, now)).ToList();
        var slices = new List<DashboardChartSlice>
        {
            new(pendingLabel, pending, "warning"),
            new("dashboard.chart.overdue", overdue, "orange"),
            new("dashboard.chart.approved", includeInProgress ? activeNotOverdue.Count(job => !job.HasOpenTasks) : activeNotOverdue.Count, "info"),
        };
        if (includeInProgress)
        {
            slices.Add(new DashboardChartSlice("dashboard.chart.inProgress", activeNotOverdue.Count(job => job.HasOpenTasks), "success"));
        }
        slices.Add(new DashboardChartSlice("dashboard.chart.completed", values.Count(job => job.Status == JobStatus.Completed), "primary"));
        slices.Add(new DashboardChartSlice("dashboard.chart.cancelled", values.Count(job => job.Status is JobStatus.Cancelled or JobStatus.Rejected), "danger"));
        return new DashboardChartResponse(titleKey, slices);
    }

    private static bool MatchesJobPendingSlice(JobStatus status, string pendingLabel) => pendingLabel switch
    {
        "dashboard.chart.pendingApproval" or "dashboard.chart.externalPendingApproval" or "dashboard.chart.pending"
            => status is JobStatus.PendingOwnerApproval or JobStatus.PendingExternalApproval,
        _ => status is JobStatus.Draft or JobStatus.PendingOwnerApproval or JobStatus.PendingExternalApproval or JobStatus.RevisionRequested,
    };

    // Taleplerim `view=external-pending` ile aynı: PendingExternalApproval veya Active + hiç görev yok; geciken hariç.
    private static bool MatchesExternalPendingView(JobStatusItem job, DateTimeOffset now) =>
        !IsPastDue(job.DueDateUtc, now)
        && (job.Status == JobStatus.PendingExternalApproval
            || (job.Status == JobStatus.Active && job.TotalTaskCount == 0));

    private static bool IsPastDue(DateTimeOffset? dueDateUtc, DateTimeOffset now) =>
        dueDateUtc.HasValue && dueDateUtc.Value < now;

    private static bool MatchesCreatedPeriod(DateTimeOffset createdAtUtc, DateTimeOffset? fromUtc, DateTimeOffset? toUtc) =>
        (!fromUtc.HasValue || createdAtUtc >= fromUtc.Value)
        && (!toUtc.HasValue || createdAtUtc <= toUtc.Value);

    private static bool IsOpenOverdueJob(JobStatus status, DateTimeOffset? dueDateUtc, DateTimeOffset now) =>
        IsOpen(status) && IsPastDue(dueDateUtc, now);

    private static bool IsOpenOverdueTask(WorkflowTaskStatus status, DateTimeOffset? dueDateUtc, DateTimeOffset now) =>
        IsActionableOpen(status) && IsPastDue(dueDateUtc, now);

    private static bool IsActionableOpen(WorkflowTaskStatus status) => status is not (
        WorkflowTaskStatus.Completed
        or WorkflowTaskStatus.Cancelled
        or WorkflowTaskStatus.Rejected
        or WorkflowTaskStatus.PendingCloseApproval);

    private static bool IsOpen(JobStatus status) => status is not (JobStatus.Completed or JobStatus.Cancelled or JobStatus.Rejected);

    private static IEnumerable<TaskStatusItem> FilterTasks(IEnumerable<TaskStatusItem> tasks, TaskDashboardFilter filter) => filter switch
    {
        TaskDashboardFilter.Assigned => tasks.Where(task => task.SourceType != JobSourceType.Routine),
        TaskDashboardFilter.Routine => tasks.Where(task => task.SourceType == JobSourceType.Routine),
        _ => tasks,
    };

    private IQueryable<TaskStatusItem> ProjectTaskStatusItems(IQueryable<WorkTask> tasks, Guid tenantId)
    {
        return from task in tasks
               join job in _dbContext.Jobs.AsNoTracking().Where(job => job.TenantId == tenantId)
                   on task.JobId equals job.JobId
               select new TaskStatusItem(
                   task.AssignedUserId,
                   task.CurrentStatus,
                   task.DueDateUtc,
                   job.SourceType,
                   task.Priority);
    }

    private sealed record TaskStatusItem(Guid? AssignedUserId, WorkflowTaskStatus Status, DateTimeOffset? DueDateUtc, JobSourceType SourceType, string Priority);
    private sealed record JobStatusItem(JobStatus Status, DateTimeOffset? DueDateUtc, bool HasOpenTasks, int TotalTaskCount);
    private sealed record CitizenJobStatusItem(JobStatus Status, DateTimeOffset? DueDateUtc, int TaskCount);

    private enum CitizenJobDisplayStatus
    {
        ProcessingReceived,
        Overdue,
        InProgress,
        Completed,
        Cancelled,
    }

    private static readonly string[] StaffChartColors = ["primary", "info", "violet", "warning", "rose", "neutral"];
}
