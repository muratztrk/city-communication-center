using CityCommunicationCenter.Domain.Enums;

namespace CityCommunicationCenter.Application.Features.Reports;

/// <summary>
/// Üst Düzey Yönetici panosundaki pie chart dilimlerine tıklanınca açılan detay popup'ının
/// gridview verisini üretir (card #1343). "Taleplerim" grafiği hariçtir; o grafik yönlendirme yapar.
/// </summary>
public sealed record GetDashboardChartDrilldownQuery(
    string ChartKey,
    string SliceKey,
    DateTimeOffset? FromUtc,
    DateTimeOffset? ToUtc) : IQuery<DashboardChartDrilldownResponse>;

public sealed class GetDashboardChartDrilldownQueryHandler
    : IQueryHandler<GetDashboardChartDrilldownQuery, DashboardChartDrilldownResponse>
{
    private const int MaxRows = 200;

    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public GetDashboardChartDrilldownQueryHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<DashboardChartDrilldownResponse> Handle(
        GetDashboardChartDrilldownQuery request,
        CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        if (context.RoleCode is not ("Reporter" or "Operator" or "SystemAdmin"))
        {
            throw new ForbiddenAccessException("Bu rapor detayına yalnızca Üst Düzey Yönetici veya Vatandaş Talep Operatörü erişebilir.");
        }

        var chartKey = request.ChartKey.Replace("dashboard.charts.", string.Empty, StringComparison.Ordinal);
        return chartKey switch
        {
            "externalRequestCreators" => await BuildOwnerDepartmentRowsAsync(tenantId, request, cancellationToken),
            "externalRequestPending" => await BuildTargetDepartmentRowsAsync(
                tenantId,
                request,
                [JobStatus.PendingOwnerApproval, JobStatus.PendingExternalApproval],
                cancellationToken),
            "externalRequestFulfillers" => await BuildTargetDepartmentRowsAsync(tenantId, request, [JobStatus.Completed], cancellationToken),
            "neighborhoodCompletedRequests" => await BuildNeighborhoodRowsAsync(tenantId, request, JobStatus.Completed, cancellationToken),
            "neighborhoodInProgressRequests" => await BuildNeighborhoodRowsAsync(tenantId, request, JobStatus.Active, cancellationToken),
            "neighborhoodProcessingRequests" => await BuildNeighborhoodProcessingRowsAsync(tenantId, request, cancellationToken),
            "citizenRequests" => await BuildCitizenRowsAsync(tenantId, request, cancellationToken),
            _ => new DashboardChartDrilldownResponse([]),
        };
    }

    private static Guid? ParseSliceDepartmentId(string sliceKey)
    {
        var pipeIndex = sliceKey.IndexOf('|');
        var idPart = pipeIndex > 0 ? sliceKey[..pipeIndex] : sliceKey;
        return Guid.TryParse(idPart, out var id) ? id : null;
    }

    private async Task<DashboardChartDrilldownResponse> BuildOwnerDepartmentRowsAsync(
        Guid tenantId,
        GetDashboardChartDrilldownQuery request,
        CancellationToken cancellationToken)
    {
        if (ParseSliceDepartmentId(request.SliceKey) is not Guid departmentId)
        {
            return new DashboardChartDrilldownResponse([]);
        }

        var rows = await _dbContext.Jobs.AsNoTracking()
            .Where(job => job.TenantId == tenantId
                && job.RequestType == JobRequestType.ExternalUnit
                && job.OwnerDepartmentId == departmentId
                && (!request.FromUtc.HasValue || job.CreatedAtUtc >= request.FromUtc.Value)
                && (!request.ToUtc.HasValue || job.CreatedAtUtc <= request.ToUtc.Value))
            .OrderByDescending(job => job.CreatedAtUtc)
            .Take(MaxRows)
            .Select(job => new
            {
                job.JobId,
                job.JobNumber,
                job.JobNumberYear,
                job.Title,
                job.CreatedAtUtc,
                job.Status,
                job.DueDateUtc,
                job.CompletedAtUtc,
                job.UpdatedAtUtc,
                job.Neighborhood,
            })
            .ToListAsync(cancellationToken);

        var departmentName = await _dbContext.Departments.AsNoTracking()
            .Where(department => department.TenantId == tenantId && department.DepartmentId == departmentId)
            .Select(department => department.Name)
            .FirstOrDefaultAsync(cancellationToken);

        return new DashboardChartDrilldownResponse(rows
            .Select(row => new DashboardChartDrilldownRow(
                row.JobId, row.JobNumber, row.JobNumberYear, row.Title, row.CreatedAtUtc,
                row.Status.ToString(), departmentName, row.Neighborhood,
                ResolveTerminalDate(row.Status, row.CompletedAtUtc, row.UpdatedAtUtc), row.DueDateUtc, null, null))
            .ToList());
    }

    private async Task<DashboardChartDrilldownResponse> BuildTargetDepartmentRowsAsync(
        Guid tenantId,
        GetDashboardChartDrilldownQuery request,
        IReadOnlyCollection<JobStatus> statuses,
        CancellationToken cancellationToken)
    {
        if (ParseSliceDepartmentId(request.SliceKey) is not Guid departmentId)
        {
            return new DashboardChartDrilldownResponse([]);
        }

        var rows = await _dbContext.JobDepartments.AsNoTracking()
            .Where(link => link.Role == JobDepartmentRole.Target
                && link.DepartmentId == departmentId
                && link.Job.TenantId == tenantId
                && link.Job.RequestType == JobRequestType.ExternalUnit
                && statuses.Contains(link.Job.Status)
                && (!request.FromUtc.HasValue || link.Job.CreatedAtUtc >= request.FromUtc.Value)
                && (!request.ToUtc.HasValue || link.Job.CreatedAtUtc <= request.ToUtc.Value))
            .OrderByDescending(link => link.Job.CreatedAtUtc)
            .Take(MaxRows)
            .Select(link => new
            {
                link.Job.JobId,
                link.Job.JobNumber,
                link.Job.JobNumberYear,
                link.Job.Title,
                link.Job.CreatedAtUtc,
                link.Job.Status,
                link.Job.DueDateUtc,
                link.Job.CompletedAtUtc,
                link.Job.UpdatedAtUtc,
                link.Job.Neighborhood,
            })
            .ToListAsync(cancellationToken);

        var departmentName = await _dbContext.Departments.AsNoTracking()
            .Where(department => department.TenantId == tenantId && department.DepartmentId == departmentId)
            .Select(department => department.Name)
            .FirstOrDefaultAsync(cancellationToken);

        return new DashboardChartDrilldownResponse(rows
            .Select(row => new DashboardChartDrilldownRow(
                row.JobId, row.JobNumber, row.JobNumberYear, row.Title, row.CreatedAtUtc,
                row.Status.ToString(), departmentName, row.Neighborhood,
                ResolveTerminalDate(row.Status, row.CompletedAtUtc, row.UpdatedAtUtc), row.DueDateUtc, null, null))
            .ToList());
    }

    private async Task<DashboardChartDrilldownResponse> BuildNeighborhoodRowsAsync(
        Guid tenantId,
        GetDashboardChartDrilldownQuery request,
        JobStatus status,
        CancellationToken cancellationToken)
    {
        var neighborhood = request.SliceKey.Trim();
        if (neighborhood.Length == 0)
        {
            return new DashboardChartDrilldownResponse([]);
        }

        var rows = await _dbContext.Jobs.AsNoTracking()
            .Where(job => job.TenantId == tenantId
                && job.Status == status
                && job.SourceType != JobSourceType.Routine
                && job.Neighborhood == neighborhood
                && (!request.FromUtc.HasValue || job.CreatedAtUtc >= request.FromUtc.Value)
                && (!request.ToUtc.HasValue || job.CreatedAtUtc <= request.ToUtc.Value))
            // Mahalle drilldown'ı yalnız VT (Vatandaş Talebi) job'larını gösterir (card #1845).
            .WhereHasCitizenRequestNumber(_dbContext)
            .OrderByDescending(job => job.CreatedAtUtc)
            .Take(MaxRows)
            .Select(job => new
            {
                job.JobId,
                job.JobNumber,
                job.JobNumberYear,
                job.Title,
                job.CreatedAtUtc,
                job.Status,
                job.DueDateUtc,
                job.CompletedAtUtc,
                job.UpdatedAtUtc,
                job.Neighborhood,
                OwnerDepartmentName = _dbContext.Departments
                    .Where(department => department.DepartmentId == job.OwnerDepartmentId)
                    .Select(department => (string?)department.Name)
                    .FirstOrDefault(),
                CitizenRequestNumber = _dbContext.SocialMessages
                    .Where(message => message.JobId == job.JobId)
                    .Select(message => message.CitizenRequestNumber)
                    .FirstOrDefault(),
                CitizenRequestNumberYear = _dbContext.SocialMessages
                    .Where(message => message.JobId == job.JobId)
                    .Select(message => message.CitizenRequestNumberYear)
                    .FirstOrDefault(),
                SourceChannel = _dbContext.SocialMessages
                    .Where(message => message.JobId == job.JobId)
                    .Select(message => (string?)message.Channel.ToString())
                    .FirstOrDefault(),
            })
            .ToListAsync(cancellationToken);

        return new DashboardChartDrilldownResponse(rows
            .Select(row => new DashboardChartDrilldownRow(
                row.JobId, row.JobNumber, row.JobNumberYear, row.Title, row.CreatedAtUtc,
                row.Status.ToString(), row.OwnerDepartmentName, row.Neighborhood,
                ResolveTerminalDate(row.Status, row.CompletedAtUtc, row.UpdatedAtUtc), row.DueDateUtc,
                row.CitizenRequestNumber, row.CitizenRequestNumberYear, row.SourceChannel))
            .ToList());
    }

    private async Task<DashboardChartDrilldownResponse> BuildNeighborhoodProcessingRowsAsync(
        Guid tenantId,
        GetDashboardChartDrilldownQuery request,
        CancellationToken cancellationToken)
    {
        var neighborhood = request.SliceKey.Trim();
        if (neighborhood.Length == 0)
        {
            return new DashboardChartDrilldownResponse([]);
        }

        var now = DateTimeOffset.UtcNow;
        var candidates = await _dbContext.Jobs.AsNoTracking()
            .Where(job => job.TenantId == tenantId
                && job.SourceType != JobSourceType.Routine
                && job.Neighborhood == neighborhood
                && job.Status != JobStatus.Completed
                && job.Status != JobStatus.Cancelled
                && job.Status != JobStatus.Rejected
                && job.Status != JobStatus.RevisionRequested
                && (!request.FromUtc.HasValue || job.CreatedAtUtc >= request.FromUtc.Value)
                && (!request.ToUtc.HasValue || job.CreatedAtUtc <= request.ToUtc.Value))
            // Mahalle drilldown'ı yalnız VT (Vatandaş Talebi) job'larını gösterir (card #1845).
            .WhereHasCitizenRequestNumber(_dbContext)
            .OrderByDescending(job => job.CreatedAtUtc)
            .Select(job => new
            {
                job.JobId,
                job.JobNumber,
                job.JobNumberYear,
                job.Title,
                job.CreatedAtUtc,
                job.Status,
                job.DueDateUtc,
                job.CompletedAtUtc,
                job.UpdatedAtUtc,
                job.Neighborhood,
                TaskCount = _dbContext.Tasks.Count(task => task.JobId == job.JobId),
                OwnerDepartmentName = _dbContext.Departments
                    .Where(department => department.DepartmentId == job.OwnerDepartmentId)
                    .Select(department => (string?)department.Name)
                    .FirstOrDefault(),
                CitizenRequestNumber = _dbContext.SocialMessages
                    .Where(message => message.JobId == job.JobId)
                    .Select(message => message.CitizenRequestNumber)
                    .FirstOrDefault(),
                CitizenRequestNumberYear = _dbContext.SocialMessages
                    .Where(message => message.JobId == job.JobId)
                    .Select(message => message.CitizenRequestNumberYear)
                    .FirstOrDefault(),
                SourceChannel = _dbContext.SocialMessages
                    .Where(message => message.JobId == job.JobId)
                    .Select(message => (string?)message.Channel.ToString())
                    .FirstOrDefault(),
            })
            .Take(MaxRows * 3)
            .ToListAsync(cancellationToken);

        var rows = candidates
            .Where(job =>
            {
                if (job.DueDateUtc.HasValue && job.DueDateUtc.Value.Date < now.Date)
                {
                    return false;
                }

                if (job.Status == JobStatus.Active && job.TaskCount > 0)
                {
                    return false;
                }

                return true;
            })
            .Take(MaxRows)
            .ToList();

        return new DashboardChartDrilldownResponse(rows
            .Select(row => new DashboardChartDrilldownRow(
                row.JobId, row.JobNumber, row.JobNumberYear, row.Title, row.CreatedAtUtc,
                row.Status.ToString(), row.OwnerDepartmentName, row.Neighborhood,
                ResolveTerminalDate(row.Status, row.CompletedAtUtc, row.UpdatedAtUtc), row.DueDateUtc,
                row.CitizenRequestNumber, row.CitizenRequestNumberYear, row.SourceChannel))
            .ToList());
    }

    private async Task<DashboardChartDrilldownResponse> BuildCitizenRowsAsync(
        Guid tenantId,
        GetDashboardChartDrilldownQuery request,
        CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var candidates = await _dbContext.Jobs.AsNoTracking()
            .Where(job => job.TenantId == tenantId
                && job.RequestType == JobRequestType.Citizen
                && (!request.FromUtc.HasValue || job.CreatedAtUtc >= request.FromUtc.Value)
                && (!request.ToUtc.HasValue || job.CreatedAtUtc <= request.ToUtc.Value))
            // Vatandaş Talepleri drilldown'ı yalnız VT (Vatandaş Talebi) job'larını gösterir (card #1845).
            .WhereHasCitizenRequestNumber(_dbContext)
            .OrderByDescending(job => job.CreatedAtUtc)
            .Select(job => new
            {
                job.JobId,
                job.JobNumber,
                job.JobNumberYear,
                job.Title,
                job.CreatedAtUtc,
                job.Status,
                job.DueDateUtc,
                job.CompletedAtUtc,
                job.UpdatedAtUtc,
                job.Neighborhood,
                TaskCount = _dbContext.Tasks.Count(task => task.JobId == job.JobId),
                TargetDepartmentName = _dbContext.JobDepartments
                    .Where(link => link.JobId == job.JobId && link.Role == JobDepartmentRole.Target)
                    .Join(_dbContext.Departments,
                        link => link.DepartmentId,
                        department => department.DepartmentId,
                        (link, department) => (string?)department.Name)
                    .FirstOrDefault(),
                CitizenRequestNumber = _dbContext.SocialMessages
                    .Where(message => message.JobId == job.JobId)
                    .Select(message => message.CitizenRequestNumber)
                    .FirstOrDefault(),
                CitizenRequestNumberYear = _dbContext.SocialMessages
                    .Where(message => message.JobId == job.JobId)
                    .Select(message => message.CitizenRequestNumberYear)
                    .FirstOrDefault(),
                SourceChannel = _dbContext.SocialMessages
                    .Where(message => message.JobId == job.JobId)
                    .Select(message => (string?)message.Channel.ToString())
                    .FirstOrDefault(),
            })
            .ToListAsync(cancellationToken);

        // Dilim eşleşmesi grafikteki sınıflandırmayla birebir aynıdır (BuildCitizenRequestsChart).
        var filtered = candidates.Where(job => request.SliceKey switch
        {
            "dashboard.chart.completed" => job.Status == JobStatus.Completed,
            "dashboard.chart.cancelled" => job.Status is JobStatus.Cancelled or JobStatus.Rejected or JobStatus.RevisionRequested,
            "dashboard.chart.overdue" => job.Status is not (JobStatus.Completed or JobStatus.Cancelled or JobStatus.Rejected or JobStatus.RevisionRequested)
                && job.DueDateUtc.HasValue && job.DueDateUtc.Value < now,
            "dashboard.chart.inProgress" => job.Status == JobStatus.Active
                && job.TaskCount > 0
                && !(job.DueDateUtc.HasValue && job.DueDateUtc.Value < now),
            "dashboard.chart.citizenProcessingReceived" => job.Status is not (JobStatus.Completed or JobStatus.Cancelled or JobStatus.Rejected or JobStatus.RevisionRequested)
                && !(job.DueDateUtc.HasValue && job.DueDateUtc.Value < now)
                && !(job.Status == JobStatus.Active && job.TaskCount > 0),
            _ => false,
        })
        .Take(MaxRows)
        .Select(row => new DashboardChartDrilldownRow(
            row.JobId, row.JobNumber, row.JobNumberYear, row.Title, row.CreatedAtUtc,
            row.Status.ToString(), row.TargetDepartmentName, row.Neighborhood,
            ResolveTerminalDate(row.Status, row.CompletedAtUtc, row.UpdatedAtUtc), row.DueDateUtc,
            row.CitizenRequestNumber, row.CitizenRequestNumberYear, row.SourceChannel))
        .ToList();

        return new DashboardChartDrilldownResponse(filtered);
    }

    private static DateTimeOffset? ResolveTerminalDate(
        JobStatus status,
        DateTimeOffset? completedAtUtc,
        DateTimeOffset? updatedAtUtc)
    {
        return status switch
        {
            JobStatus.Completed => completedAtUtc,
            JobStatus.Cancelled or JobStatus.Rejected or JobStatus.RevisionRequested => updatedAtUtc,
            _ => null,
        };
    }
}
