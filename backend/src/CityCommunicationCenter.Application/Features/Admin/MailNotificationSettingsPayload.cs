using System.Text.Json;

namespace CityCommunicationCenter.Application.Features.Admin;

public sealed class MailNotificationSettingsPayload
{
    public const string RequestNoToken = "{TalepNo}";

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
    public string IncomingBodyTemplate { get; set; } = RequestNoToken;
    public bool ExcludedUsersEnabled { get; set; }
    public Guid[] ExcludedUserIds { get; set; } = [];
    public bool OverdueMailEnabled { get; set; }
    public string OverdueSubjectTemplate { get; set; } = RequestNoToken;
    public string OverdueBodyTemplate { get; set; } = RequestNoToken;
    public bool OverdueTaskMailEnabled { get; set; }
    public string OverdueTaskSubjectTemplate { get; set; } = RequestNoToken;
    public string OverdueTaskBodyTemplate { get; set; } = RequestNoToken;

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

    public static string Render(string? template, string requestNumber)
    {
        var value = string.IsNullOrWhiteSpace(template) ? RequestNoToken : template;
        var rendered = value.Replace(RequestNoToken, requestNumber, StringComparison.Ordinal);
        if (!rendered.Contains(requestNumber, StringComparison.Ordinal))
        {
            rendered = $"{rendered.TrimEnd()} {requestNumber}";
        }

        return rendered.Trim();
    }
}
