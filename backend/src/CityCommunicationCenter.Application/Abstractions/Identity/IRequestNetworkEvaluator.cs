using System.Net;

namespace CityCommunicationCenter.Application.Abstractions.Identity;

public sealed record RequestNetworkEvaluation(IPAddress? ClientIp, bool IsTrustedNetwork);

public interface IRequestNetworkEvaluator
{
    Task<RequestNetworkEvaluation> EvaluateAsync(Guid tenantId, CancellationToken cancellationToken = default);
}
