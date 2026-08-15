using System.Text.Json;
using CityCommunicationCenter.Shared.Contracts;

namespace CityCommunicationCenter.Application.Features.Me;

public sealed record GetDueDateConstraintsQuery() : IQuery<DueDateConstraintsResponse>;

public sealed class GetDueDateConstraintsQueryHandler : IQueryHandler<GetDueDateConstraintsQuery, DueDateConstraintsResponse>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;
    private readonly ITenantWorkingHoursService _workingHours;

    public GetDueDateConstraintsQueryHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor,
        ITenantWorkingHoursService workingHours)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
        _workingHours = workingHours;
    }

    public async ValueTask<DueDateConstraintsResponse> Handle(
        GetDueDateConstraintsQuery request,
        CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();
        var excludeWeekends = await ReadExcludeWeekendsAsync(tenantId, cancellationToken);
        if (!excludeWeekends)
            return new DueDateConstraintsResponse(false, null);

        var tz = ResolveTurkeyTimeZone();
        var localNow = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, tz);
        if (localNow.DayOfWeek is not DayOfWeek.Saturday and not DayOfWeek.Sunday)
            return new DueDateConstraintsResponse(true, null);

        var mondayStart = await ResolveMondayStartAsync(tenantId, cancellationToken);
        var daysUntilMonday = localNow.DayOfWeek == DayOfWeek.Saturday ? 2 : 1;
        var monday = localNow.Date.AddDays(daysUntilMonday);
        return new DueDateConstraintsResponse(true, $"{monday:yyyy-MM-dd}T{mondayStart}");
    }

    private async Task<bool> ReadExcludeWeekendsAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        var setting = await _dbContext.TenantSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.TenantId == tenantId, cancellationToken);

        if (setting?.SlaWeekendSettingsJson is null)
            return true;

        try
        {
            var payload = JsonSerializer.Deserialize<SlaWeekendPayload>(setting.SlaWeekendSettingsJson);
            return payload?.ExcludeWeekends ?? true;
        }
        catch
        {
            return true;
        }
    }

    private async Task<string> ResolveMondayStartAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        var hours = await _workingHours.GetSettingsAsync(tenantId, cancellationToken);
        var from = hours.Default.Schedule.FirstOrDefault(day => day.Day == 1)?.From;
        if (!string.IsNullOrWhiteSpace(from) && from.Length >= 5)
            return from[..5];
        return "08:30";
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

    private sealed class SlaWeekendPayload
    {
        public bool ExcludeWeekends { get; set; }
    }
}
