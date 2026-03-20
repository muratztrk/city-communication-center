using System.Security.Cryptography;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace CityCommunicationCenter.Api.Services;

internal static class AuthenticationKeyFactory
{
    public static SymmetricSecurityKey CreateSigningKey(string configuredKey)
    {
        if (string.IsNullOrWhiteSpace(configuredKey))
        {
            throw new InvalidOperationException("Authentication signing key configuration is missing.");
        }

        if (TryDecodeBase64Key(configuredKey, out var base64Bytes))
        {
            return new SymmetricSecurityKey(base64Bytes);
        }

        var utf8Bytes = Encoding.UTF8.GetBytes(configuredKey);
        if (utf8Bytes.Length == 32)
        {
            return new SymmetricSecurityKey(utf8Bytes);
        }

        return new SymmetricSecurityKey(SHA256.HashData(utf8Bytes));
    }

    private static bool TryDecodeBase64Key(string configuredKey, out byte[] keyBytes)
    {
        try
        {
            keyBytes = Convert.FromBase64String(configuredKey);
            return keyBytes.Length == 32;
        }
        catch (FormatException)
        {
            keyBytes = Array.Empty<byte>();
            return false;
        }
    }
}