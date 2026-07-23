using CityCommunicationCenter.Domain.Enums;
using CityCommunicationCenter.Shared.Contracts;

namespace CityCommunicationCenter.Application.Features.Reports;

/// <summary>
/// Kontrol Paneli Vatandaş — İşleme Alındı / Yapılmakta olan, açık adresi olan
/// vatandaş taleplerinin Tire haritası pinleri (card #1834).
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
        if (context.RoleCode is not ("Reporter" or "Operator" or "SystemAdmin"))
        {
            throw new ForbiddenAccessException("Bu haritaya yalnızca Üst Düzey Yönetici veya Vatandaş Talep Operatörü erişebilir.");
        }

        var now = DateTimeOffset.UtcNow;
        var rows = await _dbContext.Jobs.AsNoTracking()
            .Where(job => job.TenantId == tenantId
                && job.RequestType == JobRequestType.Citizen
                && job.SourceType != JobSourceType.Routine
                && job.OpenAddress != null
                && job.OpenAddress != ""
                && job.Status != JobStatus.Completed
                && job.Status != JobStatus.Cancelled
                && job.Status != JobStatus.Rejected
                && job.Status != JobStatus.RevisionRequested
                && (!request.FromUtc.HasValue || job.CreatedAtUtc >= request.FromUtc.Value)
                && (!request.ToUtc.HasValue || job.CreatedAtUtc <= request.ToUtc.Value))
            // Harita pinleri yalnız VT (Vatandaş Talebi) job'larını gösterir (card #1845).
            .WhereHasCitizenRequestNumber(_dbContext)
            .Select(job => new
            {
                job.JobId,
                job.Title,
                job.Status,
                job.DueDateUtc,
                job.Neighborhood,
                job.Street,
                job.OpenAddress,
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
                // WhatsApp konum paylaşımı job'a aktarılmamışsa SocialMessage üzerinden yedekle.
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
            .Where(row =>
            {
                var display = Classify(row.Status, row.DueDateUtc, row.TaskCount, now);
                return display is MapPinDisplayStatus.ProcessingReceived or MapPinDisplayStatus.InProgress;
            })
            .Select(row => new CitizenDashboardMapPin(
                row.JobId,
                row.Title,
                row.Neighborhood,
                row.Street,
                row.OpenAddress!,
                row.Latitude ?? row.MessageLatitude,
                row.Longitude ?? row.MessageLongitude,
                row.CitizenRequestNumber,
                row.CitizenRequestNumberYear,
                Classify(row.Status, row.DueDateUtc, row.TaskCount, now) == MapPinDisplayStatus.InProgress
                    ? "inProgress"
                    : "processingReceived"))
            .OrderByDescending(pin => pin.Title)
            .ToList();

        return new CitizenDashboardMapPinsResponse(pins);
    }

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
