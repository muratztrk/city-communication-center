using System.Text.Json;
using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Application.Features.Admin;
using CityCommunicationCenter.Application.Features.Attachments;
using CityCommunicationCenter.Application.Features.Jobs;
using CityCommunicationCenter.Application.Features.Users;
using CityCommunicationCenter.Domain.Entities;
using CityCommunicationCenter.Domain.Enums;

namespace CityCommunicationCenter.Infrastructure.Services;

internal sealed class JobMailNotifier : IJobMailNotifier
{
    private readonly IApplicationDbContext _dbContext;
    private readonly IMailNotificationSender _mailNotificationSender;
    private readonly ILogger<JobMailNotifier> _logger;

    public JobMailNotifier(
        IApplicationDbContext dbContext,
        IMailNotificationSender mailNotificationSender,
        ILogger<JobMailNotifier> logger)
    {
        _dbContext = dbContext;
        _mailNotificationSender = mailNotificationSender;
        _logger = logger;
    }

    public async Task NotifyIncomingAsync(
        Job job,
        IReadOnlyCollection<Guid> departmentIds,
        Guid? actorUserId = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var settings = await LoadSettingsAsync(job.TenantId, cancellationToken);
            if (!CanSend(settings) || !settings.IncomingMailEnabled)
            {
                return;
            }

            var targetDepartmentIds = await ResolveTargetDepartmentIdsAsync(job, departmentIds, cancellationToken);
            var recipientIds = await ResolveManagerRecipientIdsAsync(job, targetDepartmentIds, cancellationToken);
            ApplyExclusions(settings, recipientIds, actorUserId);
            await SendToUsersAsync(
                job,
                recipientIds,
                settings.IncomingSubjectTemplate,
                settings.IncomingBodyTemplate,
                cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Talep mail bildirimi başarısız oldu. JobId={JobId}", job.JobId);
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
            if (actorUserId.HasValue && actorUserId.Value == assigneeUserId)
            {
                return;
            }

            var settings = await LoadSettingsAsync(job.TenantId, cancellationToken);
            if (!CanSend(settings))
            {
                return;
            }

            var departmentId = assignedDepartmentId ?? job.OwnerDepartmentId;
            if (!await IsDepartmentLeaderAsync(job, actorUserId, departmentId, cancellationToken))
            {
                return;
            }

            var recipientIds = new HashSet<Guid> { assigneeUserId };
            ApplyExclusions(settings, recipientIds, actorUserId);
            await SendToUsersAsync(
                job,
                recipientIds,
                settings.IncomingSubjectTemplate,
                settings.IncomingBodyTemplate,
                cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "Görev atama mail bildirimi başarısız oldu. JobId={JobId} AssigneeUserId={AssigneeUserId}",
                job.JobId,
                assigneeUserId);
        }
    }

    public async Task ProcessOverdueMailsAsync(CancellationToken cancellationToken = default)
    {
        try
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
                var settings = await LoadSettingsAsync(tenantId, cancellationToken);
                if (!CanSend(settings) || (!settings.OverdueMailEnabled && !settings.OverdueTaskMailEnabled))
                {
                    continue;
                }

                if (settings.OverdueMailEnabled)
                {
                    var overdueJobs = await _dbContext.Jobs
                        .IgnoreQueryFilters()
                        .Where(job => job.TenantId == tenantId
                            && job.OverdueMailSentAtUtc == null
                            && job.DueDateUtc != null
                            && job.DueDateUtc <= now
                            && job.Status != JobStatus.Completed
                            && job.Status != JobStatus.Cancelled
                            && job.Status != JobStatus.Rejected)
                        .ToListAsync(cancellationToken);

                    foreach (var job in overdueJobs)
                    {
                        await SendOverdueMailForJobAsync(job, settings, cancellationToken);
                    }
                }

                if (settings.OverdueTaskMailEnabled)
                {
                    var overdueTasks = await _dbContext.Tasks
                        .IgnoreQueryFilters()
                        .Where(task => task.TenantId == tenantId
                            && task.OverdueMailSentAtUtc == null
                            && task.AssignedUserId != null
                            && task.AssigningManagerId != null
                            && task.AssignedUserId != task.AssigningManagerId
                            && task.DueDateUtc != null
                            && task.DueDateUtc <= now
                            && task.CurrentStatus != Domain.Enums.TaskStatus.Completed
                            && task.CurrentStatus != Domain.Enums.TaskStatus.Cancelled
                            && task.CurrentStatus != Domain.Enums.TaskStatus.Rejected)
                        .ToListAsync(cancellationToken);

                    foreach (var task in overdueTasks)
                    {
                        await SendOverdueMailForTaskAsync(task, settings, cancellationToken);
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Geciken talep mail taraması başarısız oldu.");
        }
    }

    private async Task SendOverdueMailForJobAsync(
        Job job,
        MailNotificationSettingsPayload settings,
        CancellationToken cancellationToken)
    {
        try
        {
            var departmentIds = await ResolveTargetDepartmentIdsAsync(job, [], cancellationToken);
            var recipientIds = await ResolveManagerRecipientIdsAsync(job, departmentIds, cancellationToken);
            ApplyExclusions(settings, recipientIds, actorUserId: null);
            var sent = await SendToUsersAsync(
                job,
                recipientIds,
                settings.OverdueSubjectTemplate,
                settings.OverdueBodyTemplate,
                cancellationToken);
            if (sent)
            {
                job.OverdueMailSentAtUtc = DateTimeOffset.UtcNow;
                await _dbContext.SaveChangesAsync(cancellationToken);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Geciken talep mail bildirimi başarısız oldu. JobId={JobId}", job.JobId);
        }
    }

    private async Task SendOverdueMailForTaskAsync(
        WorkTask task,
        MailNotificationSettingsPayload settings,
        CancellationToken cancellationToken)
    {
        try
        {
            if (task.AssignedUserId is not Guid assigneeId || task.AssigningManagerId is not Guid actorId)
            {
                return;
            }

            var job = await _dbContext.Jobs
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(
                    entity => entity.TenantId == task.TenantId && entity.JobId == task.JobId,
                    cancellationToken);
            if (job is null)
            {
                return;
            }

            var departmentId = task.AssignedDepartmentId ?? job.OwnerDepartmentId;
            if (!await IsDepartmentLeaderAsync(job, actorId, departmentId, cancellationToken))
            {
                return;
            }

            var recipientIds = new HashSet<Guid> { assigneeId };
            ApplyExclusions(settings, recipientIds, actorId);
            var sent = await SendToUsersAsync(
                job,
                recipientIds,
                settings.OverdueTaskSubjectTemplate,
                settings.OverdueTaskBodyTemplate,
                cancellationToken);
            if (sent)
            {
                task.OverdueMailSentAtUtc = DateTimeOffset.UtcNow;
                await _dbContext.SaveChangesAsync(cancellationToken);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Geciken görev mail bildirimi başarısız oldu. TaskId={TaskId}", task.TaskId);
        }
    }

    private static bool CanSend(MailNotificationSettingsPayload settings) =>
        settings.IsEnabled && !string.IsNullOrWhiteSpace(settings.SmtpHost);

    private async Task<MailNotificationSettingsPayload> LoadSettingsAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        var json = await _dbContext.TenantSettings
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(entity => entity.TenantId == tenantId)
            .Select(entity => entity.MailNotificationSettingsJson)
            .FirstOrDefaultAsync(cancellationToken);
        return MailNotificationSettingsPayload.ParseOrEmpty(json);
    }

    private async Task<Guid[]> ResolveTargetDepartmentIdsAsync(
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

        if (JobCitizenRequestHelper.IsCitizenRequest(job))
        {
            var targetDepartmentIds = distinctDepartmentIds.Length > 0
                ? distinctDepartmentIds.ToList()
                : [job.OwnerDepartmentId];
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

        return recipientIds;
    }

    private async Task<bool> IsDepartmentLeaderAsync(
        Job job,
        Guid? actorUserId,
        Guid departmentId,
        CancellationToken cancellationToken)
    {
        if (!actorUserId.HasValue)
        {
            return false;
        }

        var department = await _dbContext.Departments
            .AsNoTracking()
            .Where(entity => entity.TenantId == job.TenantId && entity.DepartmentId == departmentId)
            .Select(entity => new { entity.ManagerUserId, entity.ResponsibleUserIdsJson })
            .FirstOrDefaultAsync(cancellationToken);
        if (department is null)
        {
            return false;
        }

        if (department.ManagerUserId == actorUserId.Value)
        {
            return true;
        }

        if (ParseResponsibleUserIds(department.ResponsibleUserIdsJson).Contains(actorUserId.Value))
        {
            return true;
        }

        var actor = await _dbContext.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(
                user => user.TenantId == job.TenantId && user.UserId == actorUserId.Value,
                cancellationToken);
        if (actor is null)
        {
            return false;
        }

        return await UserRoleAccess.IsCitizenRequestManagerInDepartmentAsync(
            _dbContext,
            job.TenantId,
            actor,
            departmentId,
            cancellationToken);
    }

    private static void ApplyExclusions(
        MailNotificationSettingsPayload settings,
        HashSet<Guid> recipientIds,
        Guid? actorUserId)
    {
        if (actorUserId.HasValue)
        {
            recipientIds.Remove(actorUserId.Value);
        }

        if (settings.ExcludedUsersEnabled)
        {
            foreach (var excludedId in settings.ExcludedUserIds ?? [])
            {
                recipientIds.Remove(excludedId);
            }
        }
    }

    private async Task<bool> SendToUsersAsync(
        Job job,
        IReadOnlyCollection<Guid> recipientIds,
        string? subjectTemplate,
        string? bodyTemplate,
        CancellationToken cancellationToken)
    {
        if (recipientIds.Count == 0)
        {
            return false;
        }

        var recipients = await _dbContext.Users
            .AsNoTracking()
            .Where(user => user.TenantId == job.TenantId && user.IsActive && recipientIds.Contains(user.UserId))
            .Select(user => new { user.UserId, user.Email })
            .ToListAsync(cancellationToken);

        var requestNumber = await FormatJobRequestNumberAsync(job, cancellationToken);
        var subject = MailNotificationSettingsPayload.Render(subjectTemplate, requestNumber);
        var body = MailNotificationSettingsPayload.Render(bodyTemplate, requestNumber);

        var sent = false;
        foreach (var recipient in recipients
            .Where(item => !string.IsNullOrWhiteSpace(item.Email))
            .GroupBy(item => item.Email!.Trim(), StringComparer.OrdinalIgnoreCase)
            .Select(group => group.First()))
        {
            var result = await _mailNotificationSender.SendAsync(
                job.TenantId,
                recipient.Email!,
                subject,
                body,
                cancellationToken);
            if (result.Success)
            {
                sent = true;
            }
            else
            {
                _logger.LogWarning(
                    "Talep maili gönderilemedi. JobId={JobId} UserId={UserId} Message={Message}",
                    job.JobId,
                    recipient.UserId,
                    result.Message);
            }
        }

        return sent;
    }

    private async Task<string> FormatJobRequestNumberAsync(Job job, CancellationToken cancellationToken)
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

        int? citizenRequestNumber = linked?.CitizenRequestNumber;
        int? citizenRequestNumberYear = linked?.CitizenRequestNumberYear;
        if (linked is null
            && job.SourceType == JobSourceType.SocialMessage
            && job.SourceRefId is Guid sourceMessageId)
        {
            var bySource = await _dbContext.SocialMessages
                .AsNoTracking()
                .Where(message => message.TenantId == job.TenantId
                    && message.SocialMessageId == sourceMessageId
                    && message.CitizenRequestNumber != null)
                .Select(message => new { message.CitizenRequestNumber, message.CitizenRequestNumberYear })
                .FirstOrDefaultAsync(cancellationToken);
            citizenRequestNumber = bySource?.CitizenRequestNumber;
            citizenRequestNumberYear = bySource?.CitizenRequestNumberYear;
        }

        return JobRequestNumberFormatter.Format(
            job.RequestType,
            job.SourceType,
            job.JobNumber,
            job.JobNumberYear,
            citizenRequestNumber,
            citizenRequestNumberYear,
            job.CreatedAtUtc);
    }

    private static Guid[] DistinctDepartmentIds(IEnumerable<Guid> departmentIds) =>
        departmentIds
            .Where(id => id != Guid.Empty)
            .Distinct()
            .ToArray();

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
}
