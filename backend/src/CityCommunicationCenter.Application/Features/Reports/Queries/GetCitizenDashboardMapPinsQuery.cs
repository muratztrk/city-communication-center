using CityCommunicationCenter.Domain.Enums;
using CityCommunicationCenter.Shared.Contracts;

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
        if (context.RoleCode is not ("Reporter" or "Manager" or "SystemAdmin"))
        {
            throw new ForbiddenAccessException("Bu haritaya yalnızca Üst Düzey Yönetici veya Sistem Yöneticisi erişebilir.");
        }

        var now = DateTimeOffset.UtcNow;
        var rows = await _dbContext.Jobs.AsNoTracking()
            .Where(job => job.TenantId == tenantId
                && job.RequestType == JobRequestType.Citizen
                && job.SourceType != JobSourceType.Routine
                && (!request.FromUtc.HasValue || job.CreatedAtUtc >= request.FromUtc.Value)
                && (!request.ToUtc.HasValue || job.CreatedAtUtc <= request.ToUtc.Value)
                && (
                    (job.Neighborhood != null && job.Neighborhood != "")
                    || (job.Street != null && job.Street != "")
                    || (job.OpenAddress != null && job.OpenAddress != "")
                    || job.Latitude != null
                    || _dbContext.SocialMessages.Any(message =>
                        message.JobId == job.JobId
                        && message.CitizenConversation != null
                        && (
                            (message.CitizenConversation.Neighborhood != null && message.CitizenConversation.Neighborhood != "")
                            || (message.CitizenConversation.Street != null && message.CitizenConversation.Street != "")
                            || (message.CitizenConversation.OpenAddress != null && message.CitizenConversation.OpenAddress != "")
                            || message.Latitude != null))))
            .WhereHasCitizenRequestNumber(_dbContext)
            .Select(job => new
            {
                job.JobId,
                job.Title,
                job.Status,
                job.DueDateUtc,
                Neighborhood = (job.Neighborhood != null && job.Neighborhood != "")
                    ? job.Neighborhood
                    : _dbContext.SocialMessages
                        .Where(message => message.JobId == job.JobId
                            && message.CitizenConversation != null
                            && message.CitizenConversation.Neighborhood != null
                            && message.CitizenConversation.Neighborhood != "")
                        .Select(message => message.CitizenConversation!.Neighborhood)
                        .FirstOrDefault(),
                Street = (job.Street != null && job.Street != "")
                    ? job.Street
                    : _dbContext.SocialMessages
                        .Where(message => message.JobId == job.JobId
                            && message.CitizenConversation != null
                            && message.CitizenConversation.Street != null
                            && message.CitizenConversation.Street != "")
                        .Select(message => message.CitizenConversation!.Street)
                        .FirstOrDefault(),
                StreetNo = (job.StreetNo != null && job.StreetNo != "")
                    ? job.StreetNo
                    : _dbContext.SocialMessages
                        .Where(message => message.JobId == job.JobId
                            && message.CitizenConversation != null
                            && message.CitizenConversation.StreetNo != null
                            && message.CitizenConversation.StreetNo != "")
                        .Select(message => message.CitizenConversation!.StreetNo)
                        .FirstOrDefault(),
                OpenAddress = (job.OpenAddress != null && job.OpenAddress != "")
                    ? job.OpenAddress
                    : _dbContext.SocialMessages
                        .Where(message => message.JobId == job.JobId
                            && message.CitizenConversation != null
                            && message.CitizenConversation.OpenAddress != null
                            && message.CitizenConversation.OpenAddress != "")
                        .Select(message => message.CitizenConversation!.OpenAddress)
                        .FirstOrDefault(),
                job.Latitude,
                job.Longitude,
                TaskCount = _dbContext.Tasks.Count(task => task.JobId == job.JobId),
                CitizenRequestNumber = _dbContext.SocialMessages
                    .Where(message => message.JobId == job.JobId)
                    .Select(message => message.CitizenRequestNumber)
                    .FirstOrDefault(),
                CitizenRequestNumberYear = _dbContext.SocialMessages
                    .Where(message => message.JobId == job.JobId)
                    .Select(message => message.CitizenRequestNumberYear)
                    .FirstOrDefault(),
                MessageLatitude = _dbContext.SocialMessages
                    .Where(message => message.JobId == job.JobId && message.Latitude != null)
                    .Select(message => message.Latitude)
                    .FirstOrDefault(),
                MessageLongitude = _dbContext.SocialMessages
                    .Where(message => message.JobId == job.JobId && message.Longitude != null)
                    .Select(message => message.Longitude)
                    .FirstOrDefault(),
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
                    row.Latitude ?? row.MessageLatitude,
                    row.Longitude ?? row.MessageLongitude,
                    row.CitizenRequestNumber,
                    row.CitizenRequestNumberYear,
                    ToDisplayStatus(pair.display));
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

        if (dueDateUtc.HasValue && dueDateUtc.Value < now)
        {
            return MapPinDisplayStatus.Overdue;
        }

        if (status == JobStatus.Active && taskCount > 0)
        {
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
