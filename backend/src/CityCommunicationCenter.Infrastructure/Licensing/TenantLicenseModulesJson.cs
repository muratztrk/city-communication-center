using System.Text.Json;
using System.Text.Json.Serialization;

namespace CityCommunicationCenter.Infrastructure.Licensing;

internal sealed class TenantLicenseModulesDocument
{
    [JsonPropertyName("citizen")]
    public TenantLicenseModuleEntry? Citizen { get; set; }

    [JsonPropertyName("internal")]
    public TenantLicenseModuleEntry? Internal { get; set; }
}

internal sealed class TenantLicenseModuleEntry
{
    [JsonPropertyName("token")]
    public string Token { get; set; } = string.Empty;

    [JsonPropertyName("updatedAtUtc")]
    public DateTimeOffset UpdatedAtUtc { get; set; }
}

internal static class TenantLicenseModulesJson
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public static string? GetToken(string? json, string moduleKey)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return null;
        }

        try
        {
            var document = JsonSerializer.Deserialize<TenantLicenseModulesDocument>(json, JsonOptions);
            var entry = moduleKey switch
            {
                "citizen" => document?.Citizen,
                "internal" => document?.Internal,
                _ => null,
            };

            return string.IsNullOrWhiteSpace(entry?.Token) ? null : entry.Token.Trim();
        }
        catch (JsonException)
        {
            return null;
        }
    }

    public static string SetToken(string? json, string moduleKey, string token)
    {
        TenantLicenseModulesDocument document;
        try
        {
            document = string.IsNullOrWhiteSpace(json)
                ? new TenantLicenseModulesDocument()
                : JsonSerializer.Deserialize<TenantLicenseModulesDocument>(json, JsonOptions) ?? new TenantLicenseModulesDocument();
        }
        catch (JsonException)
        {
            document = new TenantLicenseModulesDocument();
        }

        var entry = new TenantLicenseModuleEntry
        {
            Token = token.Trim(),
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        };

        switch (moduleKey)
        {
            case "citizen":
                document.Citizen = entry;
                break;
            case "internal":
                document.Internal = entry;
                break;
            default:
                throw new ArgumentOutOfRangeException(nameof(moduleKey), moduleKey, "Geçersiz lisans modülü.");
        }

        return JsonSerializer.Serialize(document, JsonOptions);
    }
}
