
namespace CityCommunicationCenter.Application.Features.Social;

public sealed record SocialConnectionTestResult(bool IsValid, bool IsConfigured, SocialConnectionTestResponse Response);

public sealed record SocialSettingsDeleteResult(bool IsValidChannel, bool Exists, SocialSettingsSaveResponse? Response);