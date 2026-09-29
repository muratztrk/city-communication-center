namespace CityCommunicationCenter.Shared.Contracts;

public sealed record MailNotificationSettingsResponse(
    bool IsEnabled,
    bool SmtpHostSpecified,
    string? SmtpHost,
    bool PortSpecified,
    int Port,
    bool AuthenticationEnabled,
    string? Username,
    bool HasPassword,
    string SecurityMode,
    string? DefaultReplyTo);

public sealed record UpdateMailNotificationSettingsRequest(
    bool IsEnabled,
    bool SmtpHostSpecified,
    string? SmtpHost,
    bool PortSpecified,
    int Port,
    bool AuthenticationEnabled,
    string? Username,
    string? Password,
    bool ClearPassword,
    string SecurityMode,
    string? DefaultReplyTo);

public sealed record TestMailRequest(
    string? SmtpHost,
    int Port,
    bool AuthenticationEnabled,
    string? Username,
    string? Password,
    string SecurityMode,
    string? DefaultReplyTo,
    string? RecipientEmail);

public sealed record TestMailResponse(bool Success, string Message);
