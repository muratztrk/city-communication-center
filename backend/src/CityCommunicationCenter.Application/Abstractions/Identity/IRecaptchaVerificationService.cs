using System.Net;

namespace CityCommunicationCenter.Application.Abstractions.Identity;

public interface IRecaptchaVerificationService
{
    bool IsConfigured { get; }

    string? SiteKey { get; }

    bool IsRequired(bool isTrustedNetwork);

    Task<bool> VerifyAsync(string token, IPAddress? clientIp, CancellationToken cancellationToken = default);
}
