using System.Security.Cryptography;
using Microsoft.AspNetCore.DataProtection;

namespace CityCommunicationCenter.Infrastructure.Services;

internal sealed class TenantAuthenticationPolicyService : ITenantAuthenticationPolicyService
{
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web);
    private readonly IApplicationDbContext _dbContext;
    private readonly IDataProtector _dataProtector;

    public TenantAuthenticationPolicyService(IApplicationDbContext dbContext, IDataProtectionProvider dataProtectionProvider)
    {
        _dbContext = dbContext;
        _dataProtector = dataProtectionProvider.CreateProtector("CityCommunicationCenter.TenantAuthenticationPolicy.v1");
    }

    public async Task<TenantAuthenticationPolicyDescriptor> GetSettingsAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        var settings = await GetRuntimeSettingsAsync(tenantId, cancellationToken);

        return new TenantAuthenticationPolicyDescriptor(
            settings.AutomaticSignInEnabled,
            settings.AutomaticSignInMode.ToString(),
            settings.TrustedNetworkCidrs,
            settings.TrustedProxyCidrs,
            settings.IdentityHeaderName,
            settings.RequireSecondFactorOutsideTrustedNetwork,
            settings.SecondFactorProvider.ToString(),
            settings.CodeLength,
            settings.CodeTtlSeconds,
            settings.AllowMockCodePreview,
            settings.WebhookUrl,
            settings.CanAttemptAutomaticSignIn,
            settings.CanIssueSecondFactor);
    }

    public async Task<TenantAuthenticationPolicyRuntimeSettings> GetRuntimeSettingsAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        var payload = await GetPayloadAsync(tenantId, cancellationToken);
        return BuildRuntimeSettings(payload);
    }

    public async Task SaveSettingsAsync(Guid tenantId, TenantAuthenticationPolicyUpdate settings, Guid? actorUserId, CancellationToken cancellationToken = default)
    {
        var payload = new TenantAuthenticationPolicyPayload
        {
            AutomaticSignInEnabled = settings.AutomaticSignInEnabled,
            AutomaticSignInMode = ParseAutomaticSignInMode(settings.AutomaticSignInMode).ToString(),
            TrustedNetworkCidrs = NormalizeList(settings.TrustedNetworkCidrs).ToList(),
            TrustedProxyCidrs = NormalizeList(settings.TrustedProxyCidrs).ToList(),
            IdentityHeaderName = Normalize(settings.IdentityHeaderName),
            RequireSecondFactorOutsideTrustedNetwork = settings.RequireSecondFactorOutsideTrustedNetwork,
            SecondFactorProvider = ParseSecondFactorProvider(settings.SecondFactorProvider).ToString(),
            CodeLength = Math.Clamp(settings.CodeLength, 4, 8),
            CodeTtlSeconds = Math.Clamp(settings.CodeTtlSeconds, 60, 900),
            AllowMockCodePreview = settings.AllowMockCodePreview,
            WebhookUrl = Normalize(settings.WebhookUrl),
        };

        var serializedPayload = _dataProtector.Protect(JsonSerializer.Serialize(payload, SerializerOptions));
        var tenantSetting = await _dbContext.TenantSettings
            .IgnoreQueryFilters()
            .SingleOrDefaultAsync(entity => entity.TenantId == tenantId, cancellationToken);

        if (tenantSetting is null)
        {
            _dbContext.TenantSettings.Add(new TenantSetting
            {
                TenantSettingId = Guid.NewGuid(),
                TenantId = tenantId,
                DisplayName = string.Empty,
                DefaultSlaHours = 48,
                AutoRoutingEnabled = false,
                AuthPolicyJson = serializedPayload,
                CreatedByUserId = actorUserId,
            });
        }
        else
        {
            tenantSetting.AuthPolicyJson = serializedPayload;
            tenantSetting.UpdatedAtUtc = DateTimeOffset.UtcNow;
            tenantSetting.UpdatedByUserId = actorUserId;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task<TenantAuthenticationPolicyPayload> GetPayloadAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        var payload = await _dbContext.TenantSettings
            .IgnoreQueryFilters()
            .Where(entity => entity.TenantId == tenantId)
            .Select(entity => entity.AuthPolicyJson)
            .SingleOrDefaultAsync(cancellationToken);

        if (string.IsNullOrWhiteSpace(payload))
        {
            return new TenantAuthenticationPolicyPayload();
        }

        try
        {
            payload = _dataProtector.Unprotect(payload);
        }
        catch (CryptographicException)
        {
        }

        return JsonSerializer.Deserialize<TenantAuthenticationPolicyPayload>(payload, SerializerOptions)
            ?? new TenantAuthenticationPolicyPayload();
    }

    private static TenantAuthenticationPolicyRuntimeSettings BuildRuntimeSettings(TenantAuthenticationPolicyPayload payload)
    {
        var automaticSignInMode = ParseAutomaticSignInMode(payload.AutomaticSignInMode);
        var secondFactorProvider = ParseSecondFactorProvider(payload.SecondFactorProvider);
        var trustedNetworks = NormalizeList(payload.TrustedNetworkCidrs);
        var trustedProxies = NormalizeList(payload.TrustedProxyCidrs);
        var identityHeaderName = Normalize(payload.IdentityHeaderName);
        var webhookUrl = Normalize(payload.WebhookUrl);
        var automaticSignInEnabled = payload.AutomaticSignInEnabled && automaticSignInMode != AutomaticSignInMode.Disabled;
        var canAttemptAutomaticSignIn = automaticSignInEnabled
            && trustedNetworks.Count > 0
            && (automaticSignInMode != AutomaticSignInMode.TrustedHeader || !string.IsNullOrWhiteSpace(identityHeaderName));
        var requireSecondFactorOutsideTrustedNetwork = payload.RequireSecondFactorOutsideTrustedNetwork;
        var canIssueSecondFactor = requireSecondFactorOutsideTrustedNetwork
            && (secondFactorProvider == SecondFactorProviderType.Mock || (secondFactorProvider == SecondFactorProviderType.Webhook && !string.IsNullOrWhiteSpace(webhookUrl)));

        return new TenantAuthenticationPolicyRuntimeSettings(
            automaticSignInEnabled,
            automaticSignInMode,
            trustedNetworks,
            trustedProxies,
            identityHeaderName,
            requireSecondFactorOutsideTrustedNetwork,
            secondFactorProvider,
            Math.Clamp(payload.CodeLength, 4, 8),
            Math.Clamp(payload.CodeTtlSeconds, 60, 900),
            payload.AllowMockCodePreview && secondFactorProvider == SecondFactorProviderType.Mock,
            webhookUrl,
            canAttemptAutomaticSignIn,
            canIssueSecondFactor);
    }

    private static AutomaticSignInMode ParseAutomaticSignInMode(string? value)
    {
        return Enum.TryParse<AutomaticSignInMode>(value, true, out var parsed)
            ? parsed
            : AutomaticSignInMode.Disabled;
    }

    private static SecondFactorProviderType ParseSecondFactorProvider(string? value)
    {
        return Enum.TryParse<SecondFactorProviderType>(value, true, out var parsed)
            ? parsed
            : SecondFactorProviderType.Disabled;
    }

    private static string? Normalize(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }

    private static IReadOnlyList<string> NormalizeList(IEnumerable<string>? values)
    {
        return (values ?? [])
            .Select(value => value.Trim())
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
    }

    private sealed class TenantAuthenticationPolicyPayload
    {
        public bool AutomaticSignInEnabled { get; set; }

        public string AutomaticSignInMode { get; set; } = CityCommunicationCenter.Domain.Enums.AutomaticSignInMode.Disabled.ToString();

        public List<string> TrustedNetworkCidrs { get; set; } = [];

        public List<string> TrustedProxyCidrs { get; set; } = [];

        public string? IdentityHeaderName { get; set; }

        public bool RequireSecondFactorOutsideTrustedNetwork { get; set; }

        public string SecondFactorProvider { get; set; } = CityCommunicationCenter.Domain.Enums.SecondFactorProviderType.Disabled.ToString();

        public int CodeLength { get; set; } = 6;

        public int CodeTtlSeconds { get; set; } = 300;

        public bool AllowMockCodePreview { get; set; }

        public string? WebhookUrl { get; set; }
    }
}