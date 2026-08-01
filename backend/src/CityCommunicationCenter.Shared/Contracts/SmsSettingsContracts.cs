namespace CityCommunicationCenter.Shared.Contracts;

public sealed record SmsSettingsResponse(bool IsEnabled, string Provider, string? ApiUrl, string? Username, bool HasPassword, string? Originator, string? ChargedNumber);
public sealed record UpdateSmsSettingsRequest(bool IsEnabled, string Provider, string? ApiUrl, string? Username, string? Password, bool ClearPassword, string? Originator, string? ChargedNumber);

public sealed record TestSmsRequest(string PhoneNumber, string? Text);
public sealed record TestSmsResponse(bool Success, string Message);
