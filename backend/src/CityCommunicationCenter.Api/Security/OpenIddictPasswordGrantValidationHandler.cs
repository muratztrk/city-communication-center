using OpenIddict.Server;
using static OpenIddict.Abstractions.OpenIddictConstants;

namespace CityCommunicationCenter.Api.Security;

internal sealed class OpenIddictPasswordGrantValidationHandler : IOpenIddictServerHandler<OpenIddictServerEvents.ValidateTokenRequestContext>
{
    public static OpenIddictServerHandlerDescriptor Descriptor { get; }
        = OpenIddictServerHandlerDescriptor.CreateBuilder<OpenIddictServerEvents.ValidateTokenRequestContext>()
            .UseSingletonHandler<OpenIddictPasswordGrantValidationHandler>()
            .SetOrder(int.MinValue + 200_000)
            .SetType(OpenIddictServerHandlerType.Custom)
            .Build();

    public ValueTask HandleAsync(OpenIddictServerEvents.ValidateTokenRequestContext context)
    {
        ArgumentNullException.ThrowIfNull(context);

        if (!context.Request.IsPasswordGrantType())
        {
            context.Reject(
                error: Errors.UnsupportedGrantType,
                description: "Sadece password grant desteklenmektedir.");
        }

        return ValueTask.CompletedTask;
    }
}