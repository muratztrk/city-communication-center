namespace CityCommunicationCenter.Shared.Contracts;

public sealed record SmsSettingsResponse(bool IsEnabled, string Provider, string? ApiUrl, string? Username, bool HasPassword, string? Originator);
public sealed record UpdateSmsSettingsRequest(bool IsEnabled, string Provider, string? ApiUrl, string? Username, string? Password, bool ClearPassword, string? Originator);
