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

    public static bool WasTemplateSentOnLocalDay(
        IEnumerable<(DateTimeOffset SentAtUtc, string Content)> outboundEntries,
        string templateContent,
        DateTimeOffset receivedAtUtc,
        TimeZoneInfo timeZone)
    {
        var (dayStartUtc, dayEndUtc) = GetLocalDayUtcBounds(receivedAtUtc, timeZone);
        return outboundEntries.Any(entry =>
            entry.Content == templateContent
            && entry.SentAtUtc >= dayStartUtc
            && entry.SentAtUtc < dayEndUtc);
    }
}
