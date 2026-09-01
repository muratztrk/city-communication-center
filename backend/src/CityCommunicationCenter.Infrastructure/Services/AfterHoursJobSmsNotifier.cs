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

    public async Task NotifyAsync(Job job, IReadOnlyCollection<Guid> departmentIds, CancellationToken cancellationToken = default)
    {
        try
        {
            await NotifyCoreAsync(job, departmentIds, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Mesai dışı SMS bildirimi başarısız oldu. JobId={JobId}", job.JobId);
        }
    }

    private async Task NotifyCoreAsync(Job job, IReadOnlyCollection<Guid> departmentIds, CancellationToken cancellationToken)
    {
        var settings = await _workingHoursService.GetSettingsAsync(job.TenantId, cancellationToken);
        var schedule = WorkingHoursEvaluator.ResolveSchedule(settings, job.OwnerDepartmentId);
        if (!WorkingHoursEvaluator.IsAfterHours(schedule, DateTimeOffset.UtcNow, TurkeyTimeZone))
        {
            return;
        }

        var raw = await _dbContext.TenantSettings
            .AsNoTracking()
            .Where(entity => entity.TenantId == job.TenantId)
            .Select(entity => entity.CitizenAutoReplyTemplatesJson)
            .FirstOrDefaultAsync(cancellationToken);
        var templates = CitizenAutoReplyTemplateJson.ParseOrDefault(raw);

        var distinctDepartmentIds = departmentIds
            .Where(id => id != Guid.Empty)
            .Distinct()
            .ToArray();

        var managerIds = await ResolveManagerRecipientIdsAsync(job, distinctDepartmentIds, cancellationToken);
        var staffIds = await ResolveStaffRecipientIdsAsync(job.TenantId, distinctDepartmentIds, managerIds, cancellationToken);

        await SendTemplateAsync(
            job,
            templates.ManagerSmsIsEnabled ? templates.AfterHoursManagerSms : null,
            managerIds,
            cancellationToken);
        await SendTemplateAsync(
            job,
            templates.StaffSmsIsEnabled ? templates.AfterHoursStaffSms : null,
            staffIds,
            cancellationToken);
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
                    department.DeputyManagerUserId,
                    department.ResponsibleUserIdsJson,
                })
                .ToListAsync(cancellationToken);

            foreach (var department in departments)
            {
                if (department.ManagerUserId is Guid managerId)
                {
                    recipientIds.Add(managerId);
                }

                if (department.DeputyManagerUserId is Guid deputyId)
                {
                    recipientIds.Add(deputyId);
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

    private async Task<HashSet<Guid>> ResolveStaffRecipientIdsAsync(
        Guid tenantId,
        Guid[] distinctDepartmentIds,
        HashSet<Guid> managerRecipientIds,
        CancellationToken cancellationToken)
    {
        if (distinctDepartmentIds.Length == 0)
        {
            return [];
        }

        var assignedStaffIds = await _dbContext.UserDepartmentAssignments
            .AsNoTracking()
            .Where(assignment => assignment.TenantId == tenantId && distinctDepartmentIds.Contains(assignment.DepartmentId))
            .Select(assignment => assignment.UserId)
            .ToListAsync(cancellationToken);

        var staffIds = await _dbContext.Users
            .AsNoTracking()
            .Where(user => user.TenantId == tenantId
                && user.IsActive
                && user.RoleCode == RoleCode.Staff
                && (distinctDepartmentIds.Contains(user.DepartmentId) || assignedStaffIds.Contains(user.UserId)))
            .Select(user => user.UserId)
            .ToListAsync(cancellationToken);

        return staffIds.Where(id => !managerRecipientIds.Contains(id)).ToHashSet();
    }

    private async Task SendTemplateAsync(
        Job job,
        string? template,
        HashSet<Guid> recipientIds,
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
