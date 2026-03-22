namespace CityCommunicationCenter.Application.Common.Tenancy;

internal static class TenantDomainNormalizer
{
    public static string? Normalize(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var candidate = value.Trim();
        if (Uri.TryCreate(candidate, UriKind.Absolute, out var absoluteUri))
        {
            return NormalizeHost(absoluteUri.Host);
        }

        if (!candidate.Contains("://", StringComparison.Ordinal)
            && Uri.TryCreate($"https://{candidate}", UriKind.Absolute, out var inferredUri))
        {
            return NormalizeHost(inferredUri.Host);
        }

        return NormalizeHost(candidate);
    }

    private static string? NormalizeHost(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var candidate = value.Trim().TrimEnd('.').ToLowerInvariant();
        if (candidate.StartsWith("[", StringComparison.Ordinal) && candidate.Contains(']'))
        {
            var closingBracketIndex = candidate.IndexOf(']');
            candidate = candidate.Substring(1, closingBracketIndex - 1);
        }
        else if (candidate.Count(character => character == ':') == 1)
        {
            candidate = candidate[..candidate.LastIndexOf(':')];
        }

        return string.IsNullOrWhiteSpace(candidate) ? null : candidate;
    }
}