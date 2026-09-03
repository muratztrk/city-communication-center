using System.Text.Json;
using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Application.Common;
using CityCommunicationCenter.Application.Features.Admin;
using CityCommunicationCenter.Application.Features.Users;
using CityCommunicationCenter.Domain.Entities;
using CityCommunicationCenter.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CityCommunicationCenter.Infrastructure.Services;

internal sealed class AfterHoursJobSmsNotifier : IAfterHoursJobSmsNotifier
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

    public async Task NotifyJobCreatedAsync(Job job, IReadOnlyCollection<Guid> departmentIds, CancellationToken cancellationToken = default)
    {
        try
        {
            await NotifyJobCreatedCoreAsync(job, departmentIds, cancellationToken);
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
        CancellationToken cancellationToken = default)
    {
        try
        {
            await NotifyTaskAssignedCoreAsync(job, assigneeUserId, assignedDepartmentId, cancellationToken);
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

    private async Task NotifyJobCreatedCoreAsync(Job job, IReadOnlyCollection<Guid> departmentIds, CancellationToken cancellationToken)
    {
        if (!await IsAfterHoursAsync(job.TenantId, job.OwnerDepartmentId, cancellationToken))
        {
            return;
        }

        var templates = await LoadTemplatesAsync(job.TenantId, cancellationToken);
        if (!templates.ManagerSmsIsEnabled)
        {
            return;
        }

        var distinctDepartmentIds = DistinctDepartmentIds(departmentIds);
        var managerIds = await ResolveManagerRecipientIdsAsync(job, distinctDepartmentIds, cancellationToken);
        await SendTemplateAsync(job, templates.AfterHoursManagerSms, managerIds, cancellationToken);
    }

    private async Task NotifyTaskAssignedCoreAsync(
        Job job,
        Guid assigneeUserId,
        Guid? assignedDepartmentId,
        CancellationToken cancellationToken)
    {
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
        if (managerIds.Contains(assigneeUserId))
        {
            return;
        }

        await SendTemplateAsync(job, templates.AfterHoursStaffSms, [assigneeUserId], cancellationToken);
    }

    private async Task<bool> IsAfterHoursAsync(Guid tenantId, Guid? departmentId, CancellationToken cancellationToken)
    {
        var settings = await _workingHoursService.GetSettingsAsync(tenantId, cancellationToken);
        var schedule = WorkingHoursEvaluator.ResolveSchedule(settings, departmentId);
        return WorkingHoursEvaluator.IsAfterHours(schedule, DateTimeOffset.UtcNow, TurkeyTimeZone);
    }

    private async Task<CitizenAutoReplyTemplateModel> LoadTemplatesAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        var raw = await _dbContext.TenantSettings
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

        if (job.RequestType == JobRequestType.Citizen
            || job.SourceType is JobSourceType.SocialMessage or JobSourceType.CitizenRequest or JobSourceType.EDevlet)
        {
            var managers = await _dbContext.Users
                .AsNoTracking()
                .Where(user => user.TenantId == job.TenantId && user.IsActive)
                .Select(user => new { user.UserId, user.RoleCode, user.AdditionalRoleCodesJson })
                .ToListAsync(cancellationToken);

            foreach (var user in managers)
            {
                if (user.RoleCode == RoleCode.CitizenRequestManager
                    || UserRoleAccess.ParseAdditionalRoleCodes(user.AdditionalRoleCodesJson).Contains(RoleCode.CitizenRequestManager))
                {
                    recipientIds.Add(user.UserId);
                }
            }
        }

        return recipientIds;
    }

    private async Task SendTemplateAsync(
        Job job,
        string? template,
        IReadOnlyCollection<Guid> recipientIds,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(template) || recipientIds.Count == 0)
        {
            return;
        }

        var phones = await _dbContext.Users
            .AsNoTracking()
            .Where(user => user.TenantId == job.TenantId && user.IsActive && recipientIds.Contains(user.UserId))
            .Select(user => user.MobilePhone)
            .ToListAsync(cancellationToken);

        var distinctPhones = phones
            .Where(phone => !string.IsNullOrWhiteSpace(phone))
            .Select(phone => phone!.Trim())
            .Distinct(StringComparer.Ordinal)
            .ToArray();

        foreach (var phone in distinctPhones)
        {
            var result = await _smsGateway.SendAsync(job.TenantId, phone, template, cancellationToken);
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
}
