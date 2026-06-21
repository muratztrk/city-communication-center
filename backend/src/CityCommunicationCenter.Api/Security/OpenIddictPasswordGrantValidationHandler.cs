using OpenIddict.Server;
using static OpenIddict.Abstractions.OpenIddictConstants;

namespace CityCommunicationCenter.Api.Security;

internal sealed class OpenIddictPasswordGrantValidationHandler : IOpenIddictServerHandler<OpenIddictServerEvents.ValidateTokenRequestContext>
{
    private readonly IConfiguration _configuration;

    public OpenIddictPasswordGrantValidationHandler(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public static OpenIddictServerHandlerDescriptor Descriptor { get; }
        = OpenIddictServerHandlerDescriptor.CreateBuilder<OpenIddictServerEvents.ValidateTokenRequestContext>()
            .UseSingletonHandler<OpenIddictPasswordGrantValidationHandler>()
            .SetOrder(int.MinValue + 200_000)
            .SetType(OpenIddictServerHandlerType.Custom)
            .Build();

    public ValueTask HandleAsync(OpenIddictServerEvents.ValidateTokenRequestContext context)
    {
        ArgumentNullException.ThrowIfNull(context);

        if (context.Request.IsAuthorizationCodeGrantType())
        {
            var mobileClient = MobileOidcClientConfiguration.FromConfiguration(_configuration);
            if (!string.Equals(context.Request.ClientId, mobileClient.ClientId, StringComparison.Ordinal))
            {
                context.Reject(
                    error: Errors.InvalidClient,
                    description: "Bu istemci için yetkilendirme kodu kullanılamaz.");
            }

            return ValueTask.CompletedTask;
        }

        if (!context.Request.IsPasswordGrantType())
        {
            context.Reject(
                error: Errors.UnsupportedGrantType,
                description: "Desteklenmeyen token grant türü.");
        }

        return ValueTask.CompletedTask;
    }
}
