using System.Text.Json;
using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Application.Common;
using CityCommunicationCenter.Application.Features.Attachments;
using CityCommunicationCenter.Application.Features.Admin;
using CityCommunicationCenter.Application.Features.Jobs;
using CityCommunicationCenter.Application.Features.Users;
using CityCommunicationCenter.Domain.Entities;
using CityCommunicationCenter.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CityCommunicationCenter.Infrastructure.Services;

internal sealed class AfterHoursJobSmsNotifier : IAfterHoursJobSmsNotifier, IOverdueJobSmsNotifier
{
    private static readonly TimeZoneInfo TurkeyTimeZone = ResolveTurkeyTimeZone();

    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantWorkingHoursService _workingHoursService;
    private readonly ISmsGateway _smsGateway;
    private readonly ILogger<AfterHoursJobSmsNotifier> _logger;

    public AfterHoursJobSmsNotifier(
        IApplicationDbContext dbContext,
        ITenantWorkingHoursService workingHoursService,
        ISmsGateway smsGateway,
        ILogger<AfterHoursJobSmsNotifier> logger)
    {
        _dbContext = dbContext;
        _workingHoursService = workingHoursService;
        _smsGateway = smsGateway;
        _logger = logger;
    }

    public async Task NotifyJobCreatedAsync(
        Job job,
        IReadOnlyCollection<Guid> departmentIds,
        Guid? actorUserId = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            await NotifyJobCreatedCoreAsync(job, departmentIds, actorUserId, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Mesai dışı yönetici SMS bildirimi başarısız oldu. JobId={JobId}", job.JobId);
        }
    }

    public async Task NotifyTaskAssignedAsync(
        Job job,
        Guid assigneeUserId,
        Guid? assignedDepartmentId,
        Guid? actorUserId = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            await NotifyTaskAssignedCoreAsync(job, assigneeUserId, assignedDepartmentId, actorUserId, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "Mesai dışı personel SMS bildirimi başarısız oldu. JobId={JobId} AssigneeUserId={AssigneeUserId}",
                job.JobId,
                assigneeUserId);
        }
    }

    public async Task NotifyFirstAssignmentAsync(
        Job job,
        Guid assigneeUserId,
        Guid? assignedDepartmentId,
        Guid? actorUserId = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            await NotifyFirstAssignmentCoreAsync(job, assigneeUserId, assignedDepartmentId, actorUserId, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "Mesai dışı ilk atama yönetici SMS bildirimi başarısız oldu. JobId={JobId} AssigneeUserId={AssigneeUserId}",
                job.JobId,
                assigneeUserId);
        }
    }

    private async Task NotifyJobCreatedCoreAsync(
        Job job,
        IReadOnlyCollection<Guid> departmentIds,
        Guid? actorUserId,
        CancellationToken cancellationToken)
    {
        var distinctDepartmentIds = await ResolveManagerSmsDepartmentIdsAsync(job, departmentIds, cancellationToken);
        var additionalExclusions = BuildActorExclusions(actorUserId);
        await SendManagerSmsAsync(job, distinctDepartmentIds, additionalExclusions, cancellationToken);
    }

    private async Task NotifyFirstAssignmentCoreAsync(
        Job job,
        Guid assigneeUserId,
        Guid? assignedDepartmentId,
        Guid? actorUserId,
        CancellationToken cancellationToken)
    {
        if (IsSelfAssignment(actorUserId, assigneeUserId))
        {
            return;
        }

        if (await HasOtherAssignedTasksAsync(job, assigneeUserId, cancellationToken))
        {
            return;
        }

        var distinctDepartmentIds = await ResolveManagerSmsDepartmentIdsAsync(job, [], cancellationToken);

        // Talep mesai dışında oluşturulduysa yönetici SMS'i zaten gitti (#3741).
        if (await IsAfterHoursForAnyDepartmentAtUtcAsync(job.TenantId, distinctDepartmentIds, job.CreatedAtUtc, cancellationToken))
        {
            return;
        }

        HashSet<Guid>? additionalExclusions = BuildActorExclusions(actorUserId);
        if (await IsAfterHoursManagerSmsRecipientAsync(job, assigneeUserId, distinctDepartmentIds, cancellationToken))
        {
            additionalExclusions ??= [];
            additionalExclusions.Add(assigneeUserId);
        }

        await SendManagerSmsAsync(job, distinctDepartmentIds, additionalExclusions, cancellationToken);
    }

    private async Task SendManagerSmsAsync(
        Job job,
        Guid[] distinctDepartmentIds,
        HashSet<Guid>? additionalExclusions,
        CancellationToken cancellationToken)
    {
        if (!await IsAfterHoursForAnyDepartmentAsync(job.TenantId, distinctDepartmentIds, cancellationToken))
        {
            return;
        }

        var templates = await LoadTemplatesAsync(job.TenantId, cancellationToken);
        if (!templates.ManagerSmsIsEnabled)
        {
            return;
        }

        var managerIds = await ResolveManagerRecipientIdsAsync(job, distinctDepartmentIds, cancellationToken);
        foreach (var selfAssignedId in await ResolveSelfAssignedManagerSmsExclusionIdsAsync(
                     job, distinctDepartmentIds, cancellationToken))
        {
            managerIds.Remove(selfAssignedId);
        }

        if (additionalExclusions is not null)
        {
            foreach (var excludedId in additionalExclusions)
            {
                managerIds.Remove(excludedId);
            }
        }

        await SendTemplateAsync(
            job,
            templates.AfterHoursManagerSms,
            managerIds,
            SmsOutboundKind.AfterHoursManager,
            cancellationToken);
    }

    private async Task NotifyTaskAssignedCoreAsync(
        Job job,
        Guid assigneeUserId,
        Guid? assignedDepartmentId,
        Guid? actorUserId,
        CancellationToken cancellationToken)
    {
        if (IsSelfAssignment(actorUserId, assigneeUserId))
        {
            return;
        }

        var scheduleDepartmentId = assignedDepartmentId ?? job.OwnerDepartmentId;
        if (!await IsAfterHoursAsync(job.TenantId, scheduleDepartmentId, cancellationToken))
        {
            return;
        }

        var templates = await LoadTemplatesAsync(job.TenantId, cancellationToken);
        if (!templates.StaffSmsIsEnabled || string.IsNullOrWhiteSpace(templates.AfterHoursStaffSms))
        {
            return;
        }

        var notifyDepartmentIds = await ResolveJobNotifyDepartmentIdsAsync(job, cancellationToken);
        var managerIds = await ResolveManagerRecipientIdsAsync(job, notifyDepartmentIds, cancellationToken);
        var isSelfAssigned = await IsUserAssignedToJobTaskAsync(job, assigneeUserId, cancellationToken);
        if (managerIds.Contains(assigneeUserId)
            && !isSelfAssigned
            && !await AllowsSecondAfterHoursAssignmentSmsAsync(
                job, assigneeUserId, notifyDepartmentIds, cancellationToken))
        {
            return;
        }

        await SendTemplateAsync(
            job,
            templates.AfterHoursStaffSms,
            [assigneeUserId],
            SmsOutboundKind.AfterHoursStaff,
            cancellationToken);
    }

    private async Task<bool> IsAfterHoursAsync(Guid tenantId, Guid? departmentId, CancellationToken cancellationToken) =>
        await IsAfterHoursAtUtcAsync(tenantId, departmentId, DateTimeOffset.UtcNow, cancellationToken);

    private async Task<bool> IsAfterHoursAtUtcAsync(
        Guid tenantId,
        Guid? departmentId,
        DateTimeOffset utcAt,
        CancellationToken cancellationToken)
    {
        var settings = await _workingHoursService.GetSettingsAsync(tenantId, cancellationToken);
        var schedule = WorkingHoursEvaluator.ResolveSchedule(settings, departmentId);
        return WorkingHoursEvaluator.IsAfterHours(schedule, utcAt, TurkeyTimeZone);
    }

    /// <summary>
    /// Sahip birim 7/24 açık olsa bile hedef birim mesai dışındaysa talep SMS'i gider (#3602).
    /// </summary>
    private async Task<bool> IsAfterHoursForAnyDepartmentAsync(
        Guid tenantId,
        Guid[] departmentIds,
        CancellationToken cancellationToken) =>
        await IsAfterHoursForAnyDepartmentAtUtcAsync(tenantId, departmentIds, DateTimeOffset.UtcNow, cancellationToken);

    private async Task<bool> IsAfterHoursForAnyDepartmentAtUtcAsync(
        Guid tenantId,
        Guid[] departmentIds,
        DateTimeOffset utcAt,
        CancellationToken cancellationToken)
    {
        foreach (var departmentId in departmentIds)
        {
            if (await IsAfterHoursAtUtcAsync(tenantId, departmentId, utcAt, cancellationToken))
            {
                return true;
            }
        }

        return false;
    }

    /// <summary>
    /// Yönetici SMS yalnız talebin hedef birim(ler)ine gider; operatör/sahip birim dahil değil (#3741).
    /// </summary>
    private async Task<Guid[]> ResolveManagerSmsDepartmentIdsAsync(
        Job job,
        IReadOnlyCollection<Guid> departmentIds,
        CancellationToken cancellationToken)
    {
        var targetIds = await _dbContext.JobDepartments
            .AsNoTracking()
            .Where(link => link.JobId == job.JobId && link.Role == JobDepartmentRole.Target)
            .Select(link => link.DepartmentId)
            .ToListAsync(cancellationToken);

        if (targetIds.Count > 0)
        {
            return DistinctDepartmentIds(targetIds);
        }

        var nonOwnerIds = DistinctDepartmentIds(departmentIds.Where(id => id != job.OwnerDepartmentId));
        if (nonOwnerIds.Length > 0)
        {
            return nonOwnerIds;
        }

        return DistinctDepartmentIds([job.OwnerDepartmentId]);
    }

    private async Task<CitizenAutoReplyTemplateModel> LoadTemplatesAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        var raw = await _dbContext.TenantSettings
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(entity => entity.TenantId == tenantId)
            .Select(entity => entity.CitizenAutoReplyTemplatesJson)
            .FirstOrDefaultAsync(cancellationToken);
        return CitizenAutoReplyTemplateJson.ParseOrDefault(raw);
    }

    private async Task<Guid[]> ResolveJobNotifyDepartmentIdsAsync(Job job, CancellationToken cancellationToken)
    {
        var targetIds = await _dbContext.JobDepartments
            .AsNoTracking()
            .Where(link => link.JobId == job.JobId && link.Role == JobDepartmentRole.Target)
            .Select(link => link.DepartmentId)
            .ToListAsync(cancellationToken);

        var ids = new List<Guid> { job.OwnerDepartmentId };
        ids.AddRange(targetIds);
        return DistinctDepartmentIds(ids);
    }

    private async Task<HashSet<Guid>> ResolveManagerRecipientIdsAsync(
        Job job,
        Guid[] distinctDepartmentIds,
        CancellationToken cancellationToken)
    {
        var recipientIds = new HashSet<Guid>();

        if (distinctDepartmentIds.Length > 0)
        {
            var departments = await _dbContext.Departments
                .AsNoTracking()
                .Where(department => department.TenantId == job.TenantId && distinctDepartmentIds.Contains(department.DepartmentId))
                .Select(department => new
                {
                    department.ManagerUserId,
                    department.ResponsibleUserIdsJson,
                })
                .ToListAsync(cancellationToken);

            foreach (var department in departments)
            {
                if (department.ManagerUserId is Guid managerId)
                {
                    recipientIds.Add(managerId);
                }

                foreach (var responsibleId in ParseResponsibleUserIds(department.ResponsibleUserIdsJson))
                {
                    recipientIds.Add(responsibleId);
                }
            }
        }

        await AddScopedCitizenRequestManagerRecipientsAsync(job, recipientIds, cancellationToken);

        return recipientIds;
    }

    private static bool IsSelfAssignment(Guid? actorUserId, Guid assigneeUserId) =>
        actorUserId.HasValue && actorUserId.Value == assigneeUserId;

    private static HashSet<Guid>? BuildActorExclusions(Guid? actorUserId) =>
        actorUserId.HasValue ? [actorUserId.Value] : null;

    /// <summary>
    /// Müdür/sorumlu/VTY görevi kendine atadığında SMS gitmez (#3620 reopen).
    /// </summary>
    private async Task<HashSet<Guid>> ResolveSelfAssignedManagerSmsExclusionIdsAsync(
        Job job,
        Guid[] distinctDepartmentIds,
        CancellationToken cancellationToken)
    {
        var assigneeIds = await _dbContext.Tasks
            .AsNoTracking()
            .Where(task => task.TenantId == job.TenantId
                && task.JobId == job.JobId
                && task.AssignedUserId != null)
            .Select(task => task.AssignedUserId!.Value)
            .Distinct()
            .ToListAsync(cancellationToken);
        if (assigneeIds.Count == 0)
        {
            return [];
        }

        var exclusions = new HashSet<Guid>();
        foreach (var assigneeId in assigneeIds)
        {
            if (await IsAfterHoursManagerSmsRecipientAsync(
                    job, assigneeId, distinctDepartmentIds, cancellationToken))
            {
                exclusions.Add(assigneeId);
            }
        }

        return exclusions;
    }

    private Task<bool> IsUserAssignedToJobTaskAsync(
        Job job,
        Guid userId,
        CancellationToken cancellationToken) =>
        _dbContext.Tasks
            .AsNoTracking()
            .AnyAsync(
                task => task.TenantId == job.TenantId
                    && task.JobId == job.JobId
                    && task.AssignedUserId == userId,
                cancellationToken);

    private async Task<bool> IsAfterHoursManagerSmsRecipientAsync(
        Job job,
        Guid userId,
        Guid[] distinctDepartmentIds,
        CancellationToken cancellationToken)
    {
        if (distinctDepartmentIds.Length > 0)
        {
            var isManager = await _dbContext.Departments
                .AsNoTracking()
                .AnyAsync(
                    department => department.TenantId == job.TenantId
                        && distinctDepartmentIds.Contains(department.DepartmentId)
                        && department.ManagerUserId == userId,
                    cancellationToken);
            if (isManager)
            {
                return true;
            }
        }

        return await AllowsSecondAfterHoursAssignmentSmsAsync(
            job, userId, distinctDepartmentIds, cancellationToken);
    }

    /// <summary>
    /// Talep SMS'ini almış kümede olsa da atanan VTY veya birim sorumlusu ikinci
    /// (görev) SMS'i alır. Salt müdür atlanır; standart personel yolu değişmez.
    /// </summary>
    private async Task<bool> AllowsSecondAfterHoursAssignmentSmsAsync(
        Job job,
        Guid assigneeUserId,
        Guid[] distinctDepartmentIds,
        CancellationToken cancellationToken)
    {
        var user = await _dbContext.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(
                entity => entity.TenantId == job.TenantId && entity.UserId == assigneeUserId,
                cancellationToken);
        if (user is null)
        {
            return false;
        }

        if (UserRoleAccess.IsCitizenRequestManager(user))
        {
            return true;
        }

        if (distinctDepartmentIds.Length == 0)
        {
            return false;
        }

        var responsibleJsons = await _dbContext.Departments
            .AsNoTracking()
            .Where(department => department.TenantId == job.TenantId && distinctDepartmentIds.Contains(department.DepartmentId))
            .Select(department => department.ResponsibleUserIdsJson)
            .ToListAsync(cancellationToken);

        return responsibleJsons.Any(json => ParseResponsibleUserIds(json).Contains(assigneeUserId));
    }

    /// <summary>
    /// Vatandaş kaynağında (Citizen / SocialMessage / e-Devlet) VTY mesai dışı SMS
    /// yalnız hedef birimde çalışabilen VTY'lere gider. Gerçek birim-dışı (Manual
    /// ExternalUnit) taleplerde VTY yok; tenant'taki tüm VTY asla yayınlanmaz.
    /// </summary>
    private async Task AddScopedCitizenRequestManagerRecipientsAsync(
        Job job,
        HashSet<Guid> recipientIds,
        CancellationToken cancellationToken)
    {
        if (!JobCitizenRequestHelper.IsCitizenRequest(job))
        {
            return;
        }

        var targetDepartmentIds = await _dbContext.JobDepartments
            .AsNoTracking()
            .Where(link => link.JobId == job.JobId && link.Role == JobDepartmentRole.Target)
            .Select(link => link.DepartmentId)
            .Distinct()
            .ToListAsync(cancellationToken);

        if (targetDepartmentIds.Count == 0)
        {
            targetDepartmentIds.Add(job.OwnerDepartmentId);
        }

        var candidates = await _dbContext.Users
            .AsNoTracking()
            .Where(user => user.TenantId == job.TenantId && user.IsActive)
            .ToListAsync(cancellationToken);

        foreach (var user in candidates)
        {
            if (!UserRoleAccess.IsCitizenRequestManager(user))
            {
                continue;
            }

            foreach (var departmentId in targetDepartmentIds)
            {
                if (await UserRoleAccess.IsCitizenRequestManagerInDepartmentAsync(
                        _dbContext,
                        job.TenantId,
                        user,
                        departmentId,
                        cancellationToken))
                {
                    recipientIds.Add(user.UserId);
                    break;
                }
            }
        }
    }

    private async Task SendTemplateAsync(
        Job job,
        string? template,
        IReadOnlyCollection<Guid> recipientIds,
        SmsOutboundKind kind,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(template) || recipientIds.Count == 0)
        {
            return;
        }

        var recipients = await _dbContext.Users
            .AsNoTracking()
            .Where(user => user.TenantId == job.TenantId && user.IsActive && recipientIds.Contains(user.UserId))
            .Select(user => new { user.UserId, user.MobilePhone })
            .ToListAsync(cancellationToken);

        var citizenNumbers = await ResolveCitizenRequestNumbersAsync(job, cancellationToken);

        var requestNumber = JobRequestNumberFormatter.Format(
            job.RequestType,
            job.SourceType,
            job.JobNumber,
            job.JobNumberYear,
            citizenNumbers?.CitizenRequestNumber,
            citizenNumbers?.CitizenRequestNumberYear,
            job.CreatedAtUtc);

        var outboundText = AfterHoursSmsTemplateRenderer.Render(template, requestNumber, job.Title);

        var distinctRecipients = recipients
            .Where(recipient => !string.IsNullOrWhiteSpace(recipient.MobilePhone))
            .GroupBy(recipient => recipient.MobilePhone!.Trim(), StringComparer.Ordinal)
            .Select(group => group.First())
            .ToArray();

        var context = new SmsSendContext(
            kind,
            JobId: job.JobId,
            RequestNumber: requestNumber);

        foreach (var recipient in distinctRecipients)
        {
            var sendContext = context with { RecipientUserId = recipient.UserId };
            var result = await _smsGateway.SendAsync(
                job.TenantId,
                recipient.MobilePhone!,
                outboundText,
                sendContext,
                cancellationToken);
            if (!result.Success)
            {
                _logger.LogWarning(
                    "Mesai dışı SMS gönderilemedi. JobId={JobId} Code={Code} Message={Message}",
                    job.JobId,
                    result.ProviderCode,
                    result.Message);
            }
        }
    }

    /// <summary>
    /// CreateJob SMS'i, ConvertSocialMessageToJob JobId bağlamadan önce çalışır — SourceRefId ile VT no bulunur (#3751).
    /// </summary>
    private async Task<(int? CitizenRequestNumber, int? CitizenRequestNumberYear)?> ResolveCitizenRequestNumbersAsync(
        Job job,
        CancellationToken cancellationToken)
    {
        var linked = await _dbContext.SocialMessages
            .AsNoTracking()
            .Where(message => message.TenantId == job.TenantId
                && message.CitizenRequestNumber != null
                && message.JobId == job.JobId)
            .OrderByDescending(message => message.CitizenRequestNumberYear)
            .ThenByDescending(message => message.CitizenRequestNumber)
            .Select(message => new { message.CitizenRequestNumber, message.CitizenRequestNumberYear })
            .FirstOrDefaultAsync(cancellationToken);
        if (linked is not null)
        {
            return (linked.CitizenRequestNumber, linked.CitizenRequestNumberYear);
        }

        if (job.SourceType == JobSourceType.SocialMessage && job.SourceRefId is Guid sourceMessageId)
        {
            var bySource = await _dbContext.SocialMessages
                .AsNoTracking()
                .Where(message => message.TenantId == job.TenantId
                    && message.SocialMessageId == sourceMessageId
                    && message.CitizenRequestNumber != null)
                .Select(message => new { message.CitizenRequestNumber, message.CitizenRequestNumberYear })
                .FirstOrDefaultAsync(cancellationToken);
            if (bySource is not null)
            {
                return (bySource.CitizenRequestNumber, bySource.CitizenRequestNumberYear);
            }
        }

        return null;
    }

    private static Guid[] DistinctDepartmentIds(IEnumerable<Guid> departmentIds) =>
        departmentIds
            .Where(id => id != Guid.Empty)
            .Distinct()
            .ToArray();

    private Task<bool> HasOtherAssignedTasksAsync(
        Job job,
        Guid assigneeUserId,
        CancellationToken cancellationToken) =>
        _dbContext.Tasks
            .AsNoTracking()
            .AnyAsync(
                task => task.TenantId == job.TenantId
                    && task.JobId == job.JobId
                    && task.AssignedUserId != null
                    && task.AssignedUserId != assigneeUserId,
                cancellationToken);

    private static IReadOnlyCollection<Guid> ParseResponsibleUserIds(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return [];
        }

        try
        {
            return JsonSerializer.Deserialize<Guid[]>(json) ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
    }

    private static TimeZoneInfo ResolveTurkeyTimeZone()
    {
        foreach (var id in new[] { "Europe/Istanbul", "Turkey Standard Time" })
        {
            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById(id);
            }
            catch (TimeZoneNotFoundException)
            {
            }
            catch (InvalidTimeZoneException)
            {
            }
        }

        return TimeZoneInfo.Utc;
    }

    public async Task ProcessOverdueJobsAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            await ProcessOverdueJobsCoreAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Geciken talep yönetici SMS taraması başarısız oldu.");
        }
    }

    private async Task ProcessOverdueJobsCoreAsync(CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var tenantIds = await _dbContext.TenantSettings
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Select(entity => entity.TenantId)
            .Distinct()
            .ToListAsync(cancellationToken);

        foreach (var tenantId in tenantIds)
        {
            var templates = await LoadTemplatesAsync(tenantId, cancellationToken);
            var managerEnabled = templates.OverdueManagerSmsIsEnabled
                && !string.IsNullOrWhiteSpace(templates.OverdueManagerSms);
            var staffEnabled = templates.OverdueStaffSmsIsEnabled
                && !string.IsNullOrWhiteSpace(templates.OverdueStaffSms);
            if (!managerEnabled && !staffEnabled)
            {
                continue;
            }

            var overdueJobs = await _dbContext.Jobs
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(job => job.TenantId == tenantId
                    && job.DueDateUtc != null
                    && job.DueDateUtc < now
                    && job.Status != JobStatus.Completed
                    && job.Status != JobStatus.Cancelled
                    && job.Status != JobStatus.Rejected)
                .ToListAsync(cancellationToken);

            foreach (var job in overdueJobs)
            {
                if (!JobCitizenRequestHelper.IsCitizenRequest(job))
                {
                    continue;
                }

                if (managerEnabled
                    && !await HasSuccessfulOverdueSmsAsync(tenantId, job.JobId, SmsOutboundKind.OverdueManager, cancellationToken))
                {
                    var departmentIds = await ResolveManagerSmsDepartmentIdsAsync(job, [], cancellationToken);
                    await SendOverdueManagerSmsAsync(job, departmentIds, templates.OverdueManagerSms!, cancellationToken);
                }

                if (staffEnabled)
                {
                    await SendOverdueStaffSmsAsync(job, templates.OverdueStaffSms!, cancellationToken);
                }
            }
        }
    }

    private Task<bool> HasSuccessfulOverdueSmsAsync(
        Guid tenantId,
        Guid jobId,
        SmsOutboundKind kind,
        CancellationToken cancellationToken) =>
        _dbContext.SmsOutboundLogs
            .IgnoreQueryFilters()
            .AsNoTracking()
            .AnyAsync(
                log => log.TenantId == tenantId
                    && log.JobId == jobId
                    && log.Kind == kind
                    && log.Success,
                cancellationToken);

    private async Task SendOverdueManagerSmsAsync(
        Job job,
        Guid[] distinctDepartmentIds,
        string template,
        CancellationToken cancellationToken)
    {
        var managerIds = await ResolveManagerRecipientIdsAsync(job, distinctDepartmentIds, cancellationToken);
        await SendTemplateAsync(
            job,
            template,
            managerIds,
            SmsOutboundKind.OverdueManager,
            cancellationToken);
    }

    private async Task SendOverdueStaffSmsAsync(
        Job job,
        string template,
        CancellationToken cancellationToken)
    {
        var staffIds = await ResolveOverdueStaffRecipientIdsAsync(job, cancellationToken);
        if (staffIds.Count == 0)
        {
            return;
        }

        var pendingRecipientIds = new HashSet<Guid>();
        foreach (var staffId in staffIds)
        {
            var alreadySent = await _dbContext.SmsOutboundLogs
                .IgnoreQueryFilters()
                .AsNoTracking()
                .AnyAsync(
                    log => log.TenantId == job.TenantId
                        && log.JobId == job.JobId
                        && log.Kind == SmsOutboundKind.OverdueStaff
                        && log.RecipientUserId == staffId
                        && log.Success,
                    cancellationToken);
            if (!alreadySent)
            {
                pendingRecipientIds.Add(staffId);
            }
        }

        await SendTemplateAsync(
            job,
            template,
            pendingRecipientIds,
            SmsOutboundKind.OverdueStaff,
            cancellationToken);
    }

    /// <summary>Geciken talepte açık görevi olan Personel (Staff) atananlara SMS.</summary>
    private async Task<HashSet<Guid>> ResolveOverdueStaffRecipientIdsAsync(
        Job job,
        CancellationToken cancellationToken)
    {
        var assigneeIds = await _dbContext.Tasks
            .AsNoTracking()
            .Where(task => task.TenantId == job.TenantId
                && task.JobId == job.JobId
                && task.AssignedUserId != null
                && task.CurrentStatus != Domain.Enums.TaskStatus.Completed
                && task.CurrentStatus != Domain.Enums.TaskStatus.Cancelled
                && task.CurrentStatus != Domain.Enums.TaskStatus.Rejected
                && task.CurrentStatus != Domain.Enums.TaskStatus.PendingCloseApproval)
            .Select(task => task.AssignedUserId!.Value)
            .Distinct()
            .ToListAsync(cancellationToken);
        if (assigneeIds.Count == 0)
        {
            return [];
        }

        var staffIds = await _dbContext.Users
            .AsNoTracking()
            .Where(user => user.TenantId == job.TenantId
                && user.IsActive
                && assigneeIds.Contains(user.UserId)
                && user.RoleCode == RoleCode.Staff)
            .Select(user => user.UserId)
            .ToListAsync(cancellationToken);

        return staffIds.ToHashSet();
    }
}
