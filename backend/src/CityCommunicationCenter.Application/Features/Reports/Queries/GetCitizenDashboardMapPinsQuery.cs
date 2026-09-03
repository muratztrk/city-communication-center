using CityCommunicationCenter.Domain.Enums;
using CityCommunicationCenter.Shared.Contracts;
using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Application.Features.Reports;

/// <summary>
/// Vatandaş Talep Haritası — dönem içindeki tüm VT taleplerinin pin verisi (card #2572).
/// </summary>
public sealed record GetCitizenDashboardMapPinsQuery(
    DateTimeOffset? FromUtc,
    DateTimeOffset? ToUtc) : IQuery<CitizenDashboardMapPinsResponse>;

public sealed class GetCitizenDashboardMapPinsQueryHandler
    : IQueryHandler<GetCitizenDashboardMapPinsQuery, CitizenDashboardMapPinsResponse>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public GetCitizenDashboardMapPinsQueryHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<CitizenDashboardMapPinsResponse> Handle(
        GetCitizenDashboardMapPinsQuery request,
        CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        if (context.RoleCode is not ("Reporter" or "Manager" or "SystemAdmin" or "Operator"))
        {
            throw new ForbiddenAccessException("Bu haritaya yalnızca Üst Düzey Yönetici, Vatandaş Talep Operatörü veya Sistem Yöneticisi erişebilir.");
        }

        var now = DateTimeOffset.UtcNow;
        var rows = await _dbContext.Jobs.AsNoTracking()
            .Where(job => job.TenantId == tenantId
                && job.SourceType != JobSourceType.Routine
                && (!request.FromUtc.HasValue || job.CreatedAtUtc >= request.FromUtc.Value)
                && (!request.ToUtc.HasValue || job.CreatedAtUtc <= request.ToUtc.Value))
            .WhereHasCitizenRequestNumber(_dbContext)
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
                job.LocationMapsUrl,
                job.CreatedAtUtc,
                job.CompletedAtUtc,
                job.UpdatedAtUtc,
                job.Priority,
                job.CitizenName,
                job.CitizenPhone,
                DepartmentName = _dbContext.Departments
                    .Where(department => department.DepartmentId == job.OwnerDepartmentId)
                    .Select(department => department.Name)
                    .FirstOrDefault(),
                TargetDepartmentNames = _dbContext.JobDepartments
                    .Where(jobDepartment => jobDepartment.JobId == job.JobId
                        && jobDepartment.Role == JobDepartmentRole.Target)
                    .Select(jobDepartment => _dbContext.Departments
                        .Where(department => department.DepartmentId == jobDepartment.DepartmentId)
                        .Select(department => department.Name)
                        .FirstOrDefault())
                    .ToList(),
                Social = _dbContext.SocialMessages
                    .Where(message => message.JobId == job.JobId && message.CitizenRequestNumber != null)
                    .OrderByDescending(message => message.CitizenRequestNumberYear)
                    .ThenByDescending(message => message.CitizenRequestNumber)
                    .Select(message => new
                    {
                        message.Channel,
                        message.SocialMessageId,
                        ConversationCitizenName = message.CitizenConversation != null
                            ? message.CitizenConversation.CitizenName
                            : null,
                        ConversationCitizenPhone = message.CitizenConversation != null
                            ? message.CitizenConversation.CitizenPhone
                            : null,
                        message.CitizenRequestNumber,
                        message.CitizenRequestNumberYear,
                    })
                    .FirstOrDefault(),
                TaskCount = _dbContext.Tasks.Count(task => task.JobId == job.JobId
                    && task.CurrentStatus != WorkflowTaskStatus.Completed
                    && task.CurrentStatus != WorkflowTaskStatus.Cancelled
                    && task.CurrentStatus != WorkflowTaskStatus.Rejected),
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
                var social = row.Social;
                var destination = string.Join(", ", row.TargetDepartmentNames
                    .Where(name => !string.IsNullOrWhiteSpace(name))
                    .Distinct());
                return new CitizenDashboardMapPin(
                    row.JobId,
                    row.Title,
                    row.Neighborhood,
                    row.Street,
                    row.StreetNo,
                    row.OpenAddress ?? string.Empty,
                    row.Latitude,
                    row.Longitude,
                    social?.CitizenRequestNumber,
                    social?.CitizenRequestNumberYear,
                    ToDisplayStatus(pair.display),
                    row.CreatedAtUtc,
                    social?.Channel.ToString(),
                    row.DepartmentName,
                    row.Status.ToString(),
                    row.DueDateUtc,
                    row.CompletedAtUtc,
                    row.UpdatedAtUtc,
                    row.Priority,
                    string.IsNullOrWhiteSpace(row.CitizenName) ? social?.ConversationCitizenName : row.CitizenName,
                    string.IsNullOrWhiteSpace(row.CitizenPhone) ? social?.ConversationCitizenPhone : row.CitizenPhone,
                    social?.SocialMessageId,
                    null,
                    null,
                    row.DepartmentName,
                    string.IsNullOrWhiteSpace(destination) ? null : destination,
                    row.LocationMapsUrl);
            })
            .OrderByDescending(pin => pin.Title)
            .ToList();

        return new CitizenDashboardMapPinsResponse(pins);
    }

    private static string ToDisplayStatus(MapPinDisplayStatus status) => status switch
    {
        MapPinDisplayStatus.ProcessingReceived => "processingReceived",
        MapPinDisplayStatus.InProgress => "inProgress",
        MapPinDisplayStatus.Overdue => "overdue",
        MapPinDisplayStatus.Completed => "completed",
        MapPinDisplayStatus.Cancelled => "cancelled",
        _ => "processingReceived",
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

        if (status == JobStatus.Active && taskCount > 0)
        {
            if (dueDateUtc.HasValue && dueDateUtc.Value < now)
            {
                return MapPinDisplayStatus.Overdue;
            }

            return MapPinDisplayStatus.InProgress;
        }

        return MapPinDisplayStatus.ProcessingReceived;
    }

    private enum MapPinDisplayStatus
    {
        ProcessingReceived,
        InProgress,
        Overdue,
        Completed,
        Cancelled,
    }
}
