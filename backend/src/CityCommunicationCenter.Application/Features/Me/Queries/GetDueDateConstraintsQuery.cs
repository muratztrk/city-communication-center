using System.Text.Json;
using CityCommunicationCenter.Application.Common;
using CityCommunicationCenter.Shared.Contracts;

namespace CityCommunicationCenter.Application.Features.Me;

public sealed record GetDueDateConstraintsQuery() : IQuery<DueDateConstraintsResponse>;

public sealed class GetDueDateConstraintsQueryHandler : IQueryHandler<GetDueDateConstraintsQuery, DueDateConstraintsResponse>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;
    private readonly ITenantWorkingHoursService _workingHours;
    private readonly ISlaCalculatorService _slaCalculator;

    public GetDueDateConstraintsQueryHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor,
        ITenantWorkingHoursService workingHours,
        ISlaCalculatorService slaCalculator)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
        _workingHours = workingHours;
        _slaCalculator = slaCalculator;
    }

    public async ValueTask<DueDateConstraintsResponse> Handle(
        GetDueDateConstraintsQuery request,
        CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();
        var setting = await _dbContext.TenantSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.TenantId == tenantId, cancellationToken);
        var excludeWeekends = ReadExcludeWeekends(setting);
        if (!excludeWeekends)
            return new DueDateConstraintsResponse(false, null);

        var tz = ResolveTurkeyTimeZone();
        var localNow = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, tz);
        if (!SlaBusinessHours.IsNonWorkingDay(localNow.DateTime, excludeWeekends: true, excludePublicHolidays: true))
            return new DueDateConstraintsResponse(true, null);

        var nextWorkingDate = localNow.Date;
        while (SlaBusinessHours.IsNonWorkingDay(nextWorkingDate, excludeWeekends: true, excludePublicHolidays: true))
        {
            nextWorkingDate = nextWorkingDate.AddDays(1);
        }

        var workingDayStartHm = await ResolveWorkingDayStartAsync(tenantId, cancellationToken);
        var workingDayLocal = CombineLocalDateAndTime(nextWorkingDate, workingDayStartHm);
        var workingDayStart = new DateTimeOffset(workingDayLocal, tz.GetUtcOffset(workingDayLocal));
        var slaHours = setting is { DefaultSlaHours: > 0 } ? setting.DefaultSlaHours : 48;
        var dueUtc = await _slaCalculator.CalculateDueDateAsync(
            workingDayStart.ToUniversalTime(), slaHours, tenantId, departmentId: null, cancellationToken);
        var dueLocal = TimeZoneInfo.ConvertTime(dueUtc, tz);
        return new DueDateConstraintsResponse(true, $"{dueLocal:yyyy-MM-ddTHH:mm}");
    }

    private static bool ReadExcludeWeekends(Domain.Entities.TenantSetting? setting)
    {
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

    private static DateTime CombineLocalDateAndTime(DateTime date, string hm)
    {
        var hour = 8;
        var minute = 30;
        if (hm.Length >= 5
            && int.TryParse(hm.AsSpan(0, 2), out var parsedHour)
            && int.TryParse(hm.AsSpan(3, 2), out var parsedMinute))
        {
            hour = parsedHour;
            minute = parsedMinute;
        }

        return new DateTime(date.Year, date.Month, date.Day, hour, minute, 0, DateTimeKind.Unspecified);
    }

    private async Task<string> ResolveWorkingDayStartAsync(Guid tenantId, CancellationToken cancellationToken)
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

        return TimeZoneInfo.CreateCustomTimeZone("TRT", TimeSpan.FromHours(3), "Türkiye", "Türkiye");
    }

    private sealed class SlaWeekendPayload
    {
        public bool ExcludeWeekends { get; set; }
    }
}
