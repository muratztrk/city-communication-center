using CityCommunicationCenter.Application.Abstractions.SocialMedia;
using CityCommunicationCenter.Domain.Enums;

namespace CityCommunicationCenter.Application.Features.Social;

public sealed record TestSocialConnectionCommand(string Channel) : ICommand<SocialConnectionTestResult>;

public sealed class TestSocialConnectionCommandHandler : IRequestHandler<TestSocialConnectionCommand, SocialConnectionTestResult>
{
    private readonly ISocialMediaClientFactory _clientFactory;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public TestSocialConnectionCommandHandler(ISocialMediaClientFactory clientFactory, ITenantContextAccessor tenantContextAccessor)
    {
        _clientFactory = clientFactory;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async Task<SocialConnectionTestResult> Handle(TestSocialConnectionCommand request, CancellationToken cancellationToken)
    {
        if (!Enum.TryParse<SocialChannel>(request.Channel, true, out var socialChannel))
        {
            return new SocialConnectionTestResult(false, false, new SocialConnectionTestResponse(request.Channel, false, "Gecersiz kanal"));
        }

        var tenantId = _tenantContextAccessor.GetCurrent().TenantId!.Value;
        var client = _clientFactory.GetClient(socialChannel, tenantId);
        if (client is null)
        {
            return new SocialConnectionTestResult(true, false, new SocialConnectionTestResponse(request.Channel, false, $"{request.Channel} yapilandirilmamis"));
        }

        var isConnected = await client.ValidateConnectionAsync(cancellationToken);
        return new SocialConnectionTestResult(
            true,
            true,
            new SocialConnectionTestResponse(request.Channel, isConnected, isConnected ? "Baglanti basarili" : "Baglanti basarisiz"));
    }
}