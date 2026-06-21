using CityCommunicationCenter.Api.Security;
using Microsoft.Extensions.Configuration;

namespace CityCommunicationCenter.Application.Tests.Security;

public sealed class MobileOidcClientConfigurationTests
{
    [Fact]
    public void Defaults_RegisterTheMobilePkceClientAndRedirectUri()
    {
        var configuration = new ConfigurationBuilder().Build();

        var client = MobileOidcClientConfiguration.FromConfiguration(configuration);

        Assert.True(client.Matches("ccc-mobile", "ccc.mobile:/oauth2redirect"));
        Assert.False(client.Matches("ccc-mobile", "https://untrusted.example/callback"));
    }

    [Fact]
    public void Configuration_UsesDeploymentSpecificClientRegistration()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Authentication:MobileOidc:ClientId"] = "ccc-mobile-production",
                ["Authentication:MobileOidc:RedirectUri"] = "ccc.mobile:/oauth2redirect"
            })
            .Build();

        var client = MobileOidcClientConfiguration.FromConfiguration(configuration);

        Assert.True(client.Matches("ccc-mobile-production", "ccc.mobile:/oauth2redirect"));
        Assert.False(client.Matches("ccc-mobile", "ccc.mobile:/oauth2redirect"));
    }
}
