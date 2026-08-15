using CityCommunicationCenter.Application.Features.Users;
using CityCommunicationCenter.Domain.Entities;
using CityCommunicationCenter.Domain.Enums;
using CityCommunicationCenter.Shared.Contracts;

namespace CityCommunicationCenter.Application.Features.Reports;

/// <summary>
/// Birim Talep Haritası — birimin Birimdeki Görevler’de atanmış, vatandaş-olmayan talepleri (#2610/#2611).
/// Reporter/SystemAdmin tüm birimleri görür (#2641).
/// </summary>
public sealed record GetDepartmentDashboardMapPinsQuery(
    DateTimeOffset? FromUtc,
    DateTimeOffset? ToUtc) : IQuery<CitizenDashboardMapPinsResponse>;

public sealed class GetDepartmentDashboardMapPinsQueryHandler
    : IQueryHandler<GetDepartmentDashboardMapPinsQuery, CitizenDashboardMapPinsResponse>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public GetDepartmentDashboardMapPinsQueryHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<CitizenDashboardMapPinsResponse> Handle(
        GetDepartmentDashboardMapPinsQuery request,
        CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var actor = await ResolveActorAsync(tenantId, context.UserId, cancellationToken);
        if (actor is null)
        {
            throw new ForbiddenAccessException("Bu haritaya erişim için oturum gereklidir.");
        }

        var seeAllDepartments = actor.RoleCode is RoleCode.Reporter or RoleCode.SystemAdmin
            || UserRoleAccess.ParseAdditionalRoleCodes(actor.AdditionalRoleCodesJson)
                .Any(role => role is RoleCode.Reporter or RoleCode.SystemAdmin);

        var accessibleDepartmentIds = seeAllDepartments
            ? []
            : await UserDepartmentAccess.GetScopedDepartmentIdsAsync(
                _dbContext,
                tenantId,
                actor,
                context.ActiveDepartmentId,
                cancellationToken);
        if (!seeAllDepartments && accessibleDepartmentIds.Length == 0)
        {
            return new CitizenDashboardMapPinsResponse([]);
        }

        var now = DateTimeOffset.UtcNow;
        var rows = await _dbContext.Jobs.AsNoTracking()
            .Where(job => job.TenantId == tenantId
                && job.RequestType != JobRequestType.Citizen
                && job.SourceType != JobSourceType.Routine
                && job.SourceType != JobSourceType.SocialMessage
                && job.SourceType != JobSourceType.CitizenRequest
                && job.SourceType != JobSourceType.EDevlet
                && (!request.FromUtc.HasValue || job.CreatedAtUtc >= request.FromUtc.Value)
                && (!request.ToUtc.HasValue || job.CreatedAtUtc <= request.ToUtc.Value)
                && (
                    (job.Neighborhood != null && job.Neighborhood != "")
                    || (job.Street != null && job.Street != ""))
                && _dbContext.Tasks.Any(task =>
                    task.JobId == job.JobId
                    && (
                        (task.AssignedDepartmentId.HasValue
                            && (seeAllDepartments || accessibleDepartmentIds.Contains(task.AssignedDepartmentId.Value)))
                        || task.AssignedUserId == actor.UserId)))
            .Select(job => new
            {
                job.JobId,
                job.Title,
                job.Status,
                job.DueDateUtc,
                Neighborhood = job.Neighborhood,
                Street = job.Street,
                StreetNo = job.StreetNo,
                OpenAddress = job.OpenAddress,
                job.Latitude,
                job.Longitude,
                job.CreatedAtUtc,
                job.CompletedAtUtc,
                job.UpdatedAtUtc,
                job.Priority,
                DepartmentName = _dbContext.Tasks
                    .Where(task => task.JobId == job.JobId
                        && task.AssignedDepartmentId.HasValue
                        && (seeAllDepartments || accessibleDepartmentIds.Contains(task.AssignedDepartmentId.Value)))
                    .Select(task => _dbContext.Departments
                        .Where(department => department.DepartmentId == task.AssignedDepartmentId)
                        .Select(department => department.Name)
                        .FirstOrDefault())
                    .FirstOrDefault(),
                TaskCount = _dbContext.Tasks.Count(task => task.JobId == job.JobId),
            })
            .ToListAsync(cancellationToken);

        var pins = rows
            .Select(row =>
            {
                var display = Classify(row.Status, row.DueDateUtc, row.TaskCount, now);
                return (row, display);
            })
            .Where(pair => pair.display != MapPinDisplayStatus.Cancelled)
            .Select(pair =>
            {
                var row = pair.row;
                return new CitizenDashboardMapPin(
                    row.JobId,
                    row.Title,
                    row.Neighborhood,
                    row.Street,
                    row.StreetNo,
                    row.OpenAddress ?? string.Empty,
                    row.Latitude,
                    row.Longitude,
                    null,
                    null,
                    ToDisplayStatus(pair.display),
                    row.CreatedAtUtc,
                    null,
                    row.DepartmentName,
                    row.Status.ToString(),
                    row.DueDateUtc,
                    row.CompletedAtUtc,
                    row.UpdatedAtUtc,
                    row.Priority,
                    null,
                    null,
                    null);
            })
            .OrderByDescending(pin => pin.Title)
            .ToList();

        return new CitizenDashboardMapPinsResponse(pins);
    }

    private async Task<ApplicationUser?> ResolveActorAsync(
        Guid tenantId,
        Guid? actorUserId,
        CancellationToken cancellationToken)
    {
        if (!actorUserId.HasValue)
        {
            return null;
        }

        return await _dbContext.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(
                entity => entity.UserId == actorUserId.Value && entity.TenantId == tenantId && entity.IsActive,
                cancellationToken);
    }

    private static string ToDisplayStatus(MapPinDisplayStatus status) => status switch
    {
        MapPinDisplayStatus.PendingApproval => "pendingApproval",
        MapPinDisplayStatus.InProgress => "inProgress",
        MapPinDisplayStatus.Overdue => "overdue",
        MapPinDisplayStatus.Completed => "completed",
        MapPinDisplayStatus.Cancelled => "cancelled",
        _ => "pendingApproval",
    };

    private static MapPinDisplayStatus Classify(
        JobStatus status,
        DateTimeOffset? dueDateUtc,
        int taskCount,
        DateTimeOffset now)
    {
        if (status == JobStatus.Completed)
        {
            return MapPinDisplayStatus.Completed;
        }

        if (status is JobStatus.Cancelled or JobStatus.Rejected or JobStatus.RevisionRequested)
        {
            return MapPinDisplayStatus.Cancelled;
        }

        if (dueDateUtc.HasValue && dueDateUtc.Value < now)
        {
            return MapPinDisplayStatus.Overdue;
        }

        if (status == JobStatus.Active && taskCount > 0)
        {
            return MapPinDisplayStatus.InProgress;
        }

        return MapPinDisplayStatus.PendingApproval;
    }

    private enum MapPinDisplayStatus
    {
        PendingApproval,
        InProgress,
        Overdue,
        Completed,
        Cancelled,
    }
}
