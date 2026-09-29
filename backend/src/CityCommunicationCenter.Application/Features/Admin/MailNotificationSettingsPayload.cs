using System.Text.Json;

namespace CityCommunicationCenter.Application.Features.Admin;

public sealed class MailNotificationSettingsPayload
{
    public const string RequestNoToken = "{TalepNo}";
    public const string RequestTitleToken = "{TalepBaşlığı}";
    public const string BodyRequestToken = "{TalepNo} no'lu {TalepBaşlığı}";

    public bool IsEnabled { get; set; }
    public bool SmtpHostSpecified { get; set; }
    public string? SmtpHost { get; set; }
    public bool PortSpecified { get; set; }
    public int Port { get; set; } = 25;
    public bool AuthenticationEnabled { get; set; }
    public string? Username { get; set; }
    public string? Password { get; set; }
    public string SecurityMode { get; set; } = "None";
    public string? DefaultReplyTo { get; set; }
    public bool IncomingMailEnabled { get; set; }
    public string IncomingSubjectTemplate { get; set; } = RequestNoToken;
    public string IncomingBodyTemplate { get; set; } = BodyRequestToken;
    public bool ExcludedUsersEnabled { get; set; }
    public Guid[] ExcludedUserIds { get; set; } = [];
    public bool OverdueMailEnabled { get; set; }
    public string OverdueSubjectTemplate { get; set; } = RequestNoToken;
    public string OverdueBodyTemplate { get; set; } = BodyRequestToken;
    public bool OverdueTaskMailEnabled { get; set; }
    public string OverdueTaskSubjectTemplate { get; set; } = RequestNoToken;
    public string OverdueTaskBodyTemplate { get; set; } = BodyRequestToken;
    public DateTimeOffset? OverdueMailCursorUtc { get; set; }
    public DateTimeOffset? OverdueTaskMailCursorUtc { get; set; }

    public static MailNotificationSettingsPayload Empty() => new();

    public static MailNotificationSettingsPayload ParseOrEmpty(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return Empty();
        }

        try
        {
            return JsonSerializer.Deserialize<MailNotificationSettingsPayload>(json) ?? Empty();
        }
        catch (JsonException)
        {
            return Empty();
        }
    }

    public static string Combine(string? before, string? after) =>
        $"{before ?? string.Empty}{RequestNoToken}{after ?? string.Empty}";

    public static string CombineBody(string? before, string? after) =>
        $"{before ?? string.Empty}{BodyRequestToken}{after ?? string.Empty}";

    public static (string Before, string After) Split(string? template)
    {
        var value = template ?? string.Empty;
        var index = value.IndexOf(RequestNoToken, StringComparison.Ordinal);
        if (index < 0)
        {
            return (value, string.Empty);
        }

        return (value[..index], value[(index + RequestNoToken.Length)..]);
    }

    public static (string Before, string After) SplitBody(string? template)
    {
        var value = template ?? string.Empty;
        var bodyIndex = value.IndexOf(BodyRequestToken, StringComparison.Ordinal);
        if (bodyIndex >= 0)
        {
            return (value[..bodyIndex], value[(bodyIndex + BodyRequestToken.Length)..]);
        }

        return Split(value);
    }

    public static string Render(string? template, string requestNumber, string? jobTitle = null)
    {
        var value = string.IsNullOrWhiteSpace(template) ? RequestNoToken : template;
        var title = jobTitle?.Trim() ?? string.Empty;
        var rendered = value
            .Replace(RequestNoToken, requestNumber, StringComparison.Ordinal)
            .Replace(RequestTitleToken, title, StringComparison.Ordinal);
        if (!rendered.Contains(requestNumber, StringComparison.Ordinal))
        {
            rendered = $"{rendered.TrimEnd()} {requestNumber}";
        }

        return rendered.Trim();
    }
}
