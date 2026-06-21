using OpenIddict.Server;
using static OpenIddict.Abstractions.OpenIddictConstants;

namespace CityCommunicationCenter.Api.Security;

/// <summary>
/// Validates the registered native client when OpenIddict runs without a
/// persisted application store in degraded mode.
/// </summary>
internal sealed class OpenIddictAuthorizationRequestValidationHandler
    : IOpenIddictServerHandler<OpenIddictServerEvents.ValidateAuthorizationRequestContext>
{
    private static readonly HashSet<string> AllowedScopes = new(StringComparer.Ordinal)
    {
        Scopes.OpenId,
        Scopes.Profile,
        Scopes.Email,
        "ccc_api",
    };

    private readonly IConfiguration _configuration;

    public OpenIddictAuthorizationRequestValidationHandler(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public static OpenIddictServerHandlerDescriptor Descriptor { get; }
        = OpenIddictServerHandlerDescriptor.CreateBuilder<OpenIddictServerEvents.ValidateAuthorizationRequestContext>()
            .UseSingletonHandler<OpenIddictAuthorizationRequestValidationHandler>()
            .SetOrder(int.MinValue + 200_000)
            .SetType(OpenIddictServerHandlerType.Custom)
            .Build();

    public ValueTask HandleAsync(OpenIddictServerEvents.ValidateAuthorizationRequestContext context)
    {
        ArgumentNullException.ThrowIfNull(context);

        var mobileClient = MobileOidcClientConfiguration.FromConfiguration(_configuration);
        if (!mobileClient.Matches(context.ClientId, context.RedirectUri))
        {
            context.Reject(
                error: Errors.InvalidRequest,
                description: "Geçersiz mobil istemci veya yönlendirme adresi.");
            return ValueTask.CompletedTask;
        }

        if (!string.Equals(context.Request.ResponseType, ResponseTypes.Code, StringComparison.Ordinal))
        {
            context.Reject(
                error: Errors.UnsupportedResponseType,
                description: "Mobil istemci yalnızca authorization code yanıt türünü kullanabilir.");
            return ValueTask.CompletedTask;
        }

        if (context.Request.GetScopes().Any(scope => !AllowedScopes.Contains(scope)))
        {
            context.Reject(
                error: Errors.InvalidScope,
                description: "Geçersiz mobil erişim kapsamı istendi.");
        }

        return ValueTask.CompletedTask;
    }
}
