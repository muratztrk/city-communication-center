using System.Globalization;

namespace CityCommunicationCenter.Application.Features.Users;

public static class LdapDailySyncSchedule
{
    public static bool ShouldRun(
        DateTimeOffset utcNow,
        TimeZoneInfo timeZone,
        bool enabled,
        string? time,
        string? lastRunDate)
    {
        if (!enabled || string.IsNullOrWhiteSpace(time))
        {
            return false;
        }

        if (!TimeOnly.TryParse(time.Trim(), CultureInfo.InvariantCulture, DateTimeStyles.None, out var scheduled))
        {
            return false;
        }

        var local = TimeZoneInfo.ConvertTime(utcNow, timeZone);
        if (TimeOnly.FromDateTime(local.DateTime) < scheduled)
        {
            return false;
        }

        var today = DateOnly.FromDateTime(local.DateTime).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        return !string.Equals(lastRunDate, today, StringComparison.Ordinal);
    }

    public static string TurkeyDate(DateTimeOffset utcNow, TimeZoneInfo timeZone)
    {
        var local = TimeZoneInfo.ConvertTime(utcNow, timeZone);
        return DateOnly.FromDateTime(local.DateTime).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
    }
}
