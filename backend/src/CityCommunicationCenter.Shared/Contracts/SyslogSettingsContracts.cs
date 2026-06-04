namespace CityCommunicationCenter.Shared.Contracts;

public sealed record SyslogSettingsResponse(bool IsEnabled, string? Host, int Port, string Format, string Transport);
public sealed record UpdateSyslogSettingsRequest(bool IsEnabled, string? Host, int Port, string Format, string Transport);
