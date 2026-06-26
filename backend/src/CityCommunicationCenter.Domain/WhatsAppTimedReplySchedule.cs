using System.Text.Json;
using CityCommunicationCenter.Domain.Entities;

namespace CityCommunicationCenter.Domain;

public static class WhatsAppTimedReplySchedule
{
    public static bool IsActive(WhatsAppMessageTemplate template, DateTimeOffset utcNow, TimeZoneInfo timeZone)
    {
        if (!template.TimedReplyEnabled)
            return true;

        var local = TimeZoneInfo.ConvertTime(utcNow, timeZone);
        var localDate = DateOnly.FromDateTime(local.DateTime);
        var localTime = TimeOnly.FromDateTime(local.DateTime);

        if (!IsWithinDateRange(localDate, template.TimedReplyStartDate, template.TimedReplyEndDate))
            return false;

        var dayId = ToDayId(local.DayOfWeek);
        var isWeekend = dayId is "saturday" or "sunday";

        if (template.TimedReplyWeekendAllHours && isWeekend)
            return true;

        var activeDays = ParseActiveDays(template.ActiveDaysJson);
        if (activeDays.Count > 0 && !activeDays.Contains(dayId))
            return false;

        return IsWithinTimeWindow(localTime, template.TimedReplyStartTime, template.TimedReplyEndTime);
    }

    private static bool IsWithinDateRange(DateOnly localDate, string? startDate, string? endDate)
    {
        if (!string.IsNullOrWhiteSpace(startDate)
            && DateOnly.TryParse(startDate, out var parsedStart)
            && localDate < parsedStart)
        {
            return false;
        }

        if (!string.IsNullOrWhiteSpace(endDate)
            && DateOnly.TryParse(endDate, out var parsedEnd)
            && localDate > parsedEnd)
        {
            return false;
        }

        return true;
    }

    private static bool IsWithinTimeWindow(TimeOnly localTime, string? startTime, string? endTime)
    {
        if (!TryParseTime(startTime, out var start) || !TryParseTime(endTime, out var end))
            return true;

        if (start == end)
            return true;

        if (start < end)
            return localTime >= start && localTime <= end;

        return localTime >= start || localTime <= end;
    }

    private static bool TryParseTime(string? value, out TimeOnly time)
    {
        time = default;
        if (string.IsNullOrWhiteSpace(value))
            return false;

        var trimmed = value.Trim();
        if (trimmed.Contains('T', StringComparison.Ordinal))
        {
            var parts = trimmed.Split('T', StringSplitOptions.RemoveEmptyEntries);
            trimmed = parts[^1];
        }

        return TimeOnly.TryParse(trimmed, out time);
    }

    private static string ToDayId(DayOfWeek dayOfWeek) =>
        dayOfWeek switch
        {
            DayOfWeek.Monday => "monday",
            DayOfWeek.Tuesday => "tuesday",
            DayOfWeek.Wednesday => "wednesday",
            DayOfWeek.Thursday => "thursday",
            DayOfWeek.Friday => "friday",
            DayOfWeek.Saturday => "saturday",
            _ => "sunday",
        };

    private static HashSet<string> ParseActiveDays(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<string[]>(json)?.ToHashSet(StringComparer.OrdinalIgnoreCase)
                   ?? [];
        }
        catch
        {
            return [];
        }
    }
}
