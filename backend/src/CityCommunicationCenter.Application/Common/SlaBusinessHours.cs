namespace CityCommunicationCenter.Application.Common;

/// <summary>
/// Hafta sonu ve resmi tatil SLA: Türkiye takviminde sayılmayan saatler ilerletilmez (#3281, #3382).
/// </summary>
public static class SlaBusinessHours
{
    public static TimeZoneInfo TurkeyTimeZone { get; } = ResolveTurkeyTimeZone();

    public static DateTimeOffset AddExcludingWeekends(DateTimeOffset startUtc, int hours)
        => AddExcludingNonWorkingDays(startUtc, hours, excludeWeekends: true, excludePublicHolidays: false);

    public static DateTimeOffset AddExcludingWeekends(DateTimeOffset startUtc, int hours, TimeZoneInfo timeZone)
        => AddExcludingNonWorkingDays(startUtc, hours, excludeWeekends: true, excludePublicHolidays: false, timeZone);

    public static DateTimeOffset AddExcludingNonWorkingDays(
        DateTimeOffset startUtc,
        int hours,
        bool excludeWeekends,
        bool excludePublicHolidays,
        TimeZoneInfo? timeZone = null)
    {
        timeZone ??= TurkeyTimeZone;
        if (hours <= 0) return startUtc;

        var current = SkipNonWorkingDayKeepingLocalClock(startUtc, excludeWeekends, excludePublicHolidays, timeZone);
        var remaining = hours;
        while (remaining > 0)
        {
            current = current.AddHours(1);
            var local = TimeZoneInfo.ConvertTime(current, timeZone);
            if (!IsNonWorkingDay(local, excludeWeekends, excludePublicHolidays))
                remaining--;
        }

        return current;
    }

    public static bool IsNonWorkingDay(DateTimeOffset localTime, bool excludeWeekends, bool excludePublicHolidays)
    {
        var local = localTime.DateTime;
        return IsNonWorkingDay(local, excludeWeekends, excludePublicHolidays);
    }

    public static bool IsNonWorkingDay(DateTime localDateTime, bool excludeWeekends, bool excludePublicHolidays)
    {
        if (excludeWeekends && localDateTime.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday)
            return true;

        return excludePublicHolidays && TurkishPublicHolidayCalendar.IsPublicHoliday(localDateTime);
    }

    internal static DateTimeOffset SkipNonWorkingDayKeepingLocalClock(
        DateTimeOffset utc,
        bool excludeWeekends,
        bool excludePublicHolidays,
        TimeZoneInfo timeZone)
    {
        var local = TimeZoneInfo.ConvertTime(utc, timeZone);
        var cursor = local;
        while (IsNonWorkingDay(cursor.DateTime, excludeWeekends, excludePublicHolidays))
        {
            cursor = cursor.AddDays(1);
        }

        if (cursor == local) return utc;

        var localNext = new DateTime(
            cursor.Year, cursor.Month, cursor.Day,
            local.Hour, local.Minute, local.Second, local.Millisecond,
            DateTimeKind.Unspecified);
        var offset = timeZone.GetUtcOffset(localNext);
        return new DateTimeOffset(DateTime.SpecifyKind(localNext, DateTimeKind.Unspecified), offset);
    }

    internal static DateTimeOffset SkipWeekendKeepingLocalClock(DateTimeOffset utc, TimeZoneInfo timeZone)
        => SkipNonWorkingDayKeepingLocalClock(utc, excludeWeekends: true, excludePublicHolidays: false, timeZone);

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
