namespace CityCommunicationCenter.Api.Security;

public sealed record MobileOidcClientConfiguration(string ClientId, string RedirectUri)
{
    public const string DefaultClientId = "ccc-mobile";
    public const string DefaultRedirectUri = "ccc.mobile:/oauth2redirect";

    public static MobileOidcClientConfiguration FromConfiguration(IConfiguration configuration) => new(
        configuration["Authentication:MobileOidc:ClientId"] ?? DefaultClientId,
        configuration["Authentication:MobileOidc:RedirectUri"] ?? DefaultRedirectUri);

    public bool Matches(string? clientId, string? redirectUri) =>
        string.Equals(ClientId, clientId, StringComparison.Ordinal)
        && string.Equals(RedirectUri, redirectUri, StringComparison.Ordinal);
}
