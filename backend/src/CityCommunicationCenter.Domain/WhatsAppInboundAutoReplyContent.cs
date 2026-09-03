namespace CityCommunicationCenter.Domain;

/// <summary>
/// Zamanlı WA şablon auto-reply için inbound metin seçimi (#3361).
/// </summary>
public static class WhatsAppInboundAutoReplyContent
{
    public static string PickFromBatch(IEnumerable<string> contents)
    {
        var ordered = contents as IReadOnlyList<string> ?? contents.ToArray();
        if (ordered.Count == 0)
            return string.Empty;

        for (var i = ordered.Count - 1; i >= 0; i--)
        {
            var candidate = ordered[i];
            if (IsMeaningfulText(candidate))
                return candidate;
        }

        return ordered[^1];
    }

    public static bool IsMeaningfulText(string? content)
    {
        if (string.IsNullOrWhiteSpace(content))
            return false;

        var trimmed = content.Trim();
        return !trimmed.StartsWith('[') || trimmed.Contains('\n', StringComparison.Ordinal);
    }
}
