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
    string? DefaultReplyTo,
    string IncomingSubjectTemplate = "{TalepNo}",
    string IncomingBodyTemplate = "{TalepNo}",
    bool ExcludedUsersEnabled = false,
    IReadOnlyList<Guid>? ExcludedUserIds = null,
    bool OverdueMailEnabled = false,
    string OverdueSubjectTemplate = "{TalepNo}",
    string OverdueBodyTemplate = "{TalepNo}");

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
    string? DefaultReplyTo,
    string? IncomingSubjectTemplate = null,
    string? IncomingBodyTemplate = null,
    bool? ExcludedUsersEnabled = null,
    IReadOnlyList<Guid>? ExcludedUserIds = null,
    bool? OverdueMailEnabled = null,
    string? OverdueSubjectTemplate = null,
    string? OverdueBodyTemplate = null);

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
