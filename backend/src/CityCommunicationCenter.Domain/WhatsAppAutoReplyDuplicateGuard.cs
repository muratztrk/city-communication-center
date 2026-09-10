using CityCommunicationCenter.Domain.Entities;

namespace CityCommunicationCenter.Domain;

public static class WhatsAppAutoReplyDuplicateGuard
{
    public static (DateTimeOffset DayStartUtc, DateTimeOffset DayEndUtc) GetLocalDayUtcBounds(
        DateTimeOffset utcInstant,
        TimeZoneInfo timeZone)
    {
        var local = TimeZoneInfo.ConvertTime(utcInstant, timeZone);
        var startOfDayLocal = new DateTime(local.Year, local.Month, local.Day, 0, 0, 0, DateTimeKind.Unspecified);
        var dayStartUtc = TimeZoneInfo.ConvertTimeToUtc(startOfDayLocal, timeZone);
        var dayEndUtc = TimeZoneInfo.ConvertTimeToUtc(startOfDayLocal.AddDays(1), timeZone);
        return (new DateTimeOffset(dayStartUtc, TimeSpan.Zero), new DateTimeOffset(dayEndUtc, TimeSpan.Zero));
    }

    /// <summary>
    /// Zaman ayarlı şablonun aktif başlama/bitiş penceresi (UTC). Gece yarısını aşan aralıklar desteklenir (#3500).
    /// </summary>
    public static (DateTimeOffset PeriodStartUtc, DateTimeOffset PeriodEndUtc)? TryGetTimedReplyPeriodUtcBounds(
        WhatsAppMessageTemplate template,
        DateTimeOffset utcInstant,
        TimeZoneInfo timeZone)
    {
        if (!template.TimedReplyEnabled)
        {
            return null;
        }

        if (!TryParseTime(template.TimedReplyStartTime, out var start)
            || !TryParseTime(template.TimedReplyEndTime, out var end)
            || start == end)
        {
            return null;
        }

        var local = TimeZoneInfo.ConvertTime(utcInstant, timeZone);
        var localDate = DateOnly.FromDateTime(local.DateTime);
        var localTime = TimeOnly.FromDateTime(local.DateTime);

        DateTime periodStartLocal;
        DateTime periodEndLocal;

        if (start < end)
        {
            if (localTime < start || localTime > end)
            {
                return null;
            }

            periodStartLocal = localDate.ToDateTime(start);
            periodEndLocal = localDate.ToDateTime(end);
        }
        else
        {
            if (localTime >= start)
            {
                periodStartLocal = localDate.ToDateTime(start);
                periodEndLocal = localDate.AddDays(1).ToDateTime(end);
            }
            else if (localTime <= end)
            {
                periodStartLocal = localDate.AddDays(-1).ToDateTime(start);
                periodEndLocal = localDate.ToDateTime(end);
            }
            else
            {
                return null;
            }
        }

        var periodStartUtc = TimeZoneInfo.ConvertTimeToUtc(
            DateTime.SpecifyKind(periodStartLocal, DateTimeKind.Unspecified),
            timeZone);
        var periodEndUtc = TimeZoneInfo.ConvertTimeToUtc(
            DateTime.SpecifyKind(periodEndLocal, DateTimeKind.Unspecified),
            timeZone);
        return (new DateTimeOffset(periodStartUtc, TimeSpan.Zero), new DateTimeOffset(periodEndUtc, TimeSpan.Zero));
    }

    public static (DateTimeOffset WindowStartUtc, DateTimeOffset WindowEndUtc) GetDuplicateCheckWindow(
        WhatsAppMessageTemplate template,
        DateTimeOffset utcInstant,
        TimeZoneInfo timeZone)
    {
        return TryGetTimedReplyPeriodUtcBounds(template, utcInstant, timeZone)
            ?? GetLocalDayUtcBounds(utcInstant, timeZone);
    }

    public static bool WasTemplateSentInWindow(
        IEnumerable<(DateTimeOffset SentAtUtc, string Content)> outboundEntries,
        string templateContent,
        string outboundContent,
        DateTimeOffset windowStartUtc,
        DateTimeOffset windowEndUtc)
    {
        return outboundEntries.Any(entry =>
            (entry.Content == templateContent || entry.Content == outboundContent)
            && entry.SentAtUtc >= windowStartUtc
            && entry.SentAtUtc <= windowEndUtc);
    }

    public static bool WasTemplateSentOnLocalDay(
        IEnumerable<(DateTimeOffset SentAtUtc, string Content)> outboundEntries,
        string templateContent,
        DateTimeOffset receivedAtUtc,
        TimeZoneInfo timeZone)
    {
        var (dayStartUtc, dayEndUtc) = GetLocalDayUtcBounds(receivedAtUtc, timeZone);
        return WasTemplateSentInWindow(outboundEntries, templateContent, templateContent, dayStartUtc, dayEndUtc);
    }

    private static bool TryParseTime(string? value, out TimeOnly time)
    {
        time = default;
        if (string.IsNullOrWhiteSpace(value))
        {
            return false;
        }

        var trimmed = value.Trim();
        if (trimmed.Contains('T', StringComparison.Ordinal))
        {
            var parts = trimmed.Split('T', StringSplitOptions.RemoveEmptyEntries);
            trimmed = parts[^1];
        }

        return TimeOnly.TryParse(trimmed, out time);
    }
}
