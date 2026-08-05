using System.Text;
using System.Text.Json.Serialization;
using CityCommunicationCenter.Infrastructure.Options;
using Microsoft.Extensions.Options;
using Org.BouncyCastle.Crypto.Parameters;
using Org.BouncyCastle.Crypto.Signers;

namespace CityCommunicationCenter.Infrastructure.Licensing;

public sealed record VerifiedLicenseToken(
    string BundleId,
    bool Blocked,
    string Status,
    DateTimeOffset? ValidUntil,
    string? Message,
    DateTimeOffset ExpiresAt);

public interface ILicenseTokenVerifier
{
    VerifiedLicenseToken? Verify(string token, string expectedBundleId);
}

internal sealed class LicenseTokenVerifier : ILicenseTokenVerifier
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    private readonly LicensingOptions _options;

    public LicenseTokenVerifier(IOptions<LicensingOptions> options)
    {
        _options = options.Value;
    }

    public VerifiedLicenseToken? Verify(string token, string expectedBundleId)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            return null;
        }

        var payload = VerifyAndParse(token.Trim(), expectedBundleId);
        if (payload is null)
        {
            return null;
        }

        var expiresAt = payload.Exp is > 0
            ? DateTimeOffset.FromUnixTimeSeconds(payload.Exp.Value)
            : DateTimeOffset.UtcNow;

        return new VerifiedLicenseToken(
            payload.BundleId,
            payload.Blocked,
            payload.Status,
            payload.ValidUntil,
            payload.Message,
            expiresAt);
    }

    private LicenseTokenPayload? VerifyAndParse(string token, string expectedBundleId)
    {
        var parts = token.Split('.');
        if (parts.Length != 3)
        {
            return null;
        }

        var (headerB64, payloadB64, signatureB64) = (parts[0], parts[1], parts[2]);

        LicenseTokenHeader? header;
        try
        {
            header = JsonSerializer.Deserialize<LicenseTokenHeader>(Base64UrlDecode(headerB64), JsonOptions);
        }
        catch (JsonException)
        {
            return null;
        }

        var publicKeyHex = _options.PublicKeys.FirstOrDefault(key => key.Kid == header?.Kid)?.PublicKeyHex;
        if (string.IsNullOrEmpty(publicKeyHex))
        {
            return null;
        }

        byte[] publicKeyBytes;
        byte[] signatureBytes;
        try
        {
            publicKeyBytes = Convert.FromHexString(publicKeyHex);
            signatureBytes = Base64UrlDecode(signatureB64);
        }
        catch (FormatException)
        {
            return null;
        }

        var signingInput = Encoding.UTF8.GetBytes($"{headerB64}.{payloadB64}");
        var verifier = new Ed25519Signer();
        verifier.Init(false, new Ed25519PublicKeyParameters(publicKeyBytes, 0));
        verifier.BlockUpdate(signingInput, 0, signingInput.Length);

        if (!verifier.VerifySignature(signatureBytes))
        {
            return null;
        }

        LicenseTokenPayload? payload;
        try
        {
            payload = JsonSerializer.Deserialize<LicenseTokenPayload>(Base64UrlDecode(payloadB64), JsonOptions);
        }
        catch (JsonException)
        {
            return null;
        }

        if (payload is null || !string.Equals(payload.BundleId, expectedBundleId, StringComparison.Ordinal))
        {
            return null;
        }

        return payload;
    }

    private static byte[] Base64UrlDecode(string input)
    {
        var padded = input.Replace('-', '+').Replace('_', '/');
        padded = padded.PadRight(padded.Length + ((4 - (padded.Length % 4)) % 4), '=');
        return Convert.FromBase64String(padded);
    }

    private sealed record LicenseTokenHeader([property: JsonPropertyName("kid")] string? Kid);

    private sealed record LicenseTokenPayload(
        [property: JsonPropertyName("bundleId")] string BundleId,
        [property: JsonPropertyName("status")] string Status,
        [property: JsonPropertyName("blocked")] bool Blocked,
        [property: JsonPropertyName("validUntil")] DateTimeOffset? ValidUntil,
        [property: JsonPropertyName("message")] string? Message,
        [property: JsonPropertyName("exp")] long? Exp);
}
