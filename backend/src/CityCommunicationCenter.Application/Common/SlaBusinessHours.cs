namespace CityCommunicationCenter.Application.Common;

/// <summary>
/// Hafta sonu SLA: Türkiye takviminde Cmt/Paz sayılmaz.
/// Hafta sonunda başlarsa aynı yerel saat Pazartesi’ye kayar — UTC gece yarısı kesimi yok (#3281).
/// </summary>
public static class SlaBusinessHours
{
    public static TimeZoneInfo TurkeyTimeZone { get; } = ResolveTurkeyTimeZone();

    public static DateTimeOffset AddExcludingWeekends(DateTimeOffset startUtc, int hours)
        => AddExcludingWeekends(startUtc, hours, TurkeyTimeZone);

    public static DateTimeOffset AddExcludingWeekends(DateTimeOffset startUtc, int hours, TimeZoneInfo timeZone)
    {
        if (hours <= 0) return startUtc;

        var current = SkipWeekendKeepingLocalClock(startUtc, timeZone);
        var remaining = hours;
        while (remaining > 0)
        {
            current = current.AddHours(1);
            var local = TimeZoneInfo.ConvertTime(current, timeZone);
            if (local.DayOfWeek is not DayOfWeek.Saturday and not DayOfWeek.Sunday)
                remaining--;
        }

        return current;
    }

    internal static DateTimeOffset SkipWeekendKeepingLocalClock(DateTimeOffset utc, TimeZoneInfo timeZone)
    {
        var local = TimeZoneInfo.ConvertTime(utc, timeZone);
        var days = local.DayOfWeek switch
        {
            DayOfWeek.Saturday => 2,
            DayOfWeek.Sunday => 1,
            _ => 0,
        };
        if (days == 0) return utc;

        var nextDate = local.Date.AddDays(days);
        var localNext = new DateTime(
            nextDate.Year, nextDate.Month, nextDate.Day,
            local.Hour, local.Minute, local.Second, local.Millisecond,
            DateTimeKind.Unspecified);
        var offset = timeZone.GetUtcOffset(localNext);
        return new DateTimeOffset(DateTime.SpecifyKind(localNext, DateTimeKind.Unspecified), offset);
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
}
