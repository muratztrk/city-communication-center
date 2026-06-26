using System.Text.Json;
using CityCommunicationCenter.Domain.Entities;

namespace CityCommunicationCenter.Domain;

public static class WhatsAppTemplateAutoReply
{
    public static bool IsEligible(
        WhatsAppMessageTemplate template,
        string inboundContent,
        DateTimeOffset utcNow,
        TimeZoneInfo timeZone)
    {
        if (!template.IsActive || !template.AutoReply || !template.TimedReplyEnabled)
            return false;

        if (template.ReplyDelaySecs <= 0)
            return false;

        if (template.Channel is not ("Genel" or "WhatsApp"))
            return false;

        if (!WhatsAppTimedReplySchedule.IsActive(template, utcNow, timeZone))
            return false;

        if (template.HasKeyword && !MatchesKeyword(template, inboundContent))
            return false;

        return true;
    }

    public static bool MatchesKeyword(WhatsAppMessageTemplate template, string inboundContent)
    {
        var keywords = ParseKeywords(template.KeywordsJson);
        if (keywords.Count == 0)
            return false;

        var normalizedContent = inboundContent.Trim();
        if (string.IsNullOrWhiteSpace(normalizedContent))
            return false;

        var comparison = StringComparison.OrdinalIgnoreCase;
        foreach (var keyword in keywords)
        {
            if (string.IsNullOrWhiteSpace(keyword))
                continue;

            if (template.QueryType.Contains("LIKE", StringComparison.OrdinalIgnoreCase))
            {
                if (normalizedContent.Contains(keyword.Trim(), comparison))
                    return true;
            }
            else if (string.Equals(normalizedContent, keyword.Trim(), comparison))
            {
                return true;
            }
        }

        return false;
    }

    private static IReadOnlyList<string> ParseKeywords(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<string[]>(json) ?? [];
        }
        catch
        {
            return [];
        }
    }
}
