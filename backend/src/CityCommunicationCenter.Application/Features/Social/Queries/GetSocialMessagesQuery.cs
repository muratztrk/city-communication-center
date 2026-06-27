using System.Text.Json;
using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Application.Features.Users;
using CityCommunicationCenter.Domain.Enums;

namespace CityCommunicationCenter.Application.Features.Social;

public sealed record GetSocialMessagesQuery() : IQuery<IReadOnlyList<SocialMessageSummaryResponse>>;

public sealed class GetSocialMessagesQueryHandler : IQueryHandler<GetSocialMessagesQuery, IReadOnlyList<SocialMessageSummaryResponse>>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;
    private readonly ISlaCalculatorService _slaCalculator;

    public GetSocialMessagesQueryHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor,
        ISlaCalculatorService slaCalculator)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
        _slaCalculator = slaCalculator;
    }

    public async ValueTask<IReadOnlyList<SocialMessageSummaryResponse>> Handle(GetSocialMessagesQuery request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var actor = context.UserId.HasValue
            ? await _dbContext.Users.AsNoTracking().FirstOrDefaultAsync(
                user => user.UserId == context.UserId.Value && user.TenantId == tenantId && user.IsActive,
                cancellationToken)
            : null;

        IQueryable<SocialMessage> query = _dbContext.SocialMessages
            .AsNoTracking()
            .Where(entity => entity.TenantId == tenantId);

        if (actor is null)
        {
            query = query.Where(entity => false);
        }
        else if (actor.RoleCode is RoleCode.SystemAdmin or RoleCode.Operator)
        {
            // Citizen-request operators manage the full inbox, including converted requests.
        }
        else if (actor.RoleCode != RoleCode.SystemAdmin)
        {
            var visibleDepartmentIds = await GetVisibleDepartmentIdsAsync(actor, tenantId, context.ActiveDepartmentId, cancellationToken);
            query = query.Where(entity =>
                (entity.AssignedDepartmentId.HasValue && visibleDepartmentIds.Contains(entity.AssignedDepartmentId.Value))
                || (entity.JobId.HasValue && _dbContext.JobDepartments.Any(jobDepartment =>
                    jobDepartment.JobId == entity.JobId
                    && visibleDepartmentIds.Contains(jobDepartment.DepartmentId)))
                || (entity.JobId.HasValue && _dbContext.Tasks.Any(task =>
                    task.JobId == entity.JobId
                    && task.AssignedUserId == actor.UserId
                    && task.AssignedDepartmentId.HasValue
                    && visibleDepartmentIds.Contains(task.AssignedDepartmentId.Value))));
        }

        var rows = await query
            .OrderByDescending(entity => entity.ReceivedAtUtc)
            .Select(entity => new SocialMessageRow(
                entity.SocialMessageId,
                entity.Channel.ToString(),
                entity.CitizenHandle,
                entity.JobId == null
                    ? null
                    : _dbContext.Jobs
                        .AsNoTracking()
                        .Where(job => job.JobId == entity.JobId)
                        .Select(job => job.CitizenName)
                        .FirstOrDefault(),
                entity.JobId == null
                    ? null
                    : _dbContext.Jobs
                        .AsNoTracking()
                        .Where(job => job.JobId == entity.JobId)
                        .Select(job => job.CitizenPhone)
                        .FirstOrDefault(),
                entity.Content,
                entity.Category,
                entity.Status.ToString(),
                entity.JobId == null
                    ? entity.AssignedDepartmentId
                    : _dbContext.JobDepartments
                        .AsNoTracking()
                        .Where(jobDepartment => jobDepartment.JobId == entity.JobId
                            && jobDepartment.Role == JobDepartmentRole.Target)
                        .Select(jobDepartment => (Guid?)jobDepartment.DepartmentId)
                        .FirstOrDefault() ?? entity.AssignedDepartmentId,
                entity.JobId == null
                    ? _dbContext.Departments
                        .AsNoTracking()
                        .Where(department => department.DepartmentId == entity.AssignedDepartmentId)
                        .Select(department => (string?)department.Name)
                        .FirstOrDefault()
                    : _dbContext.JobDepartments
                        .AsNoTracking()
                        .Where(jobDepartment => jobDepartment.JobId == entity.JobId
                            && jobDepartment.Role == JobDepartmentRole.Target)
                        .Select(jobDepartment => _dbContext.Departments
                            .AsNoTracking()
                            .Where(department => department.DepartmentId == jobDepartment.DepartmentId)
                            .Select(department => (string?)department.Name)
                            .FirstOrDefault())
                        .FirstOrDefault()
                    ?? _dbContext.Departments
                        .AsNoTracking()
                        .Where(department => department.DepartmentId == entity.AssignedDepartmentId)
                        .Select(department => (string?)department.Name)
                        .FirstOrDefault(),
                entity.JobId,
                entity.CitizenRequestNumber,
                entity.CitizenRequestNumberYear,
                entity.ReceivedAtUtc,
                entity.UpdatedAtUtc,
                entity.JobId == null
                    ? null
                    : _dbContext.Jobs
                        .AsNoTracking()
                        .Where(job => job.JobId == entity.JobId)
                        .Select(job => job.DueDateUtc)
                        .FirstOrDefault(),
                entity.Latitude,
                entity.Longitude))
            .ToListAsync(cancellationToken);

        var settings = await _dbContext.TenantSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(setting => setting.TenantId == tenantId, cancellationToken);
        var defaultSlaHours = settings?.DefaultSlaHours ?? 0;

        var results = new List<SocialMessageSummaryResponse>(rows.Count);
        foreach (var row in rows)
        {
            var dueDateUtc = row.JobDueDateUtc;
            if (dueDateUtc is null && defaultSlaHours > 0)
            {
                dueDateUtc = await _slaCalculator.CalculateDueDateAsync(
                    row.ReceivedAtUtc,
                    defaultSlaHours,
                    tenantId,
                    row.AssignedDepartmentId,
                    cancellationToken);
            }

            results.Add(new SocialMessageSummaryResponse(
                row.SocialMessageId,
                row.Channel,
                row.CitizenHandle,
                row.CitizenName,
                row.CitizenPhone,
                row.Content,
                row.Category,
                row.Status,
                row.AssignedDepartmentId,
                row.AssignedDepartmentName,
                row.JobId,
                row.CitizenRequestNumber,
                row.CitizenRequestNumberYear,
                row.ReceivedAtUtc,
                row.UpdatedAtUtc,
                dueDateUtc,
                row.Latitude,
                row.Longitude));
        }

        return results;
    }

    private async Task<Guid[]> GetVisibleDepartmentIdsAsync(ApplicationUser actor, Guid tenantId, Guid? activeDepartmentId, CancellationToken cancellationToken)
    {
        var visibleDepartmentIds = (await UserDepartmentAccess.GetAccessibleDepartmentIdsAsync(
                _dbContext,
                tenantId,
                actor,
                cancellationToken))
            .ToHashSet();

        var departments = await _dbContext.Departments
            .AsNoTracking()
            .Where(department => department.TenantId == tenantId)
            .Select(department => new
            {
                department.DepartmentId,
                department.ManagerUserId,
                department.ResponsibleUserIdsJson
            })
            .ToListAsync(cancellationToken);

        foreach (var departmentId in departments
            .Where(department => department.ManagerUserId == actor.UserId
                || ParseResponsibleUserIds(department.ResponsibleUserIdsJson).Contains(actor.UserId))
            .Select(department => department.DepartmentId))
        {
            visibleDepartmentIds.Add(departmentId);
        }

        return activeDepartmentId.HasValue && visibleDepartmentIds.Contains(activeDepartmentId.Value)
            ? [activeDepartmentId.Value]
            : visibleDepartmentIds.ToArray();
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

    private sealed record SocialMessageRow(
        Guid SocialMessageId,
        string Channel,
        string CitizenHandle,
        string? CitizenName,
        string? CitizenPhone,
        string? Content,
        string? Category,
        string Status,
        Guid? AssignedDepartmentId,
        string? AssignedDepartmentName,
        Guid? JobId,
        int? CitizenRequestNumber,
        int? CitizenRequestNumberYear,
        DateTimeOffset ReceivedAtUtc,
        DateTimeOffset? UpdatedAtUtc,
        DateTimeOffset? JobDueDateUtc,
        double? Latitude,
        double? Longitude);
}
