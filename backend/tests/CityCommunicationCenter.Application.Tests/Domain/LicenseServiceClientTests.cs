using System.Net;
using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Infrastructure.Licensing;
using CityCommunicationCenter.Infrastructure.Options;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Http;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace CityCommunicationCenter.Application.Tests.Domain;

public class LicenseServiceClientTests
{
    // lisans.lumespec.com'un canlı ortamından (Tire Belediyesi Citizen, com.lumespec.ccc.tirebelediyesi.citizen)
    // gerçekten alınmış, Ed25519 ile imzalanmış bir yanıt — imza doğrulamasının gerçek anahtarla
    // uçtan uca çalıştığını kanıtlar (2026-08-03'te alındı, exp içinde geçerli).
    private const string RealSignedToken =
        "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCIsImtpZCI6ImsxIn0." +
        "eyJidW5kbGVJZCI6ImNvbS5sdW1lc3BlYy5jY2MudGlyZWJlbGVkaXllc2kuY2l0aXplbiIsInRlbmFudCI6ImNtc2RjZnNsNTAwYjdyeDBtZHhlN3pyY2siLCJuYW1lIjoiVGlyZSBCZWxlZGl5ZXNpIENpdGl6ZW4iLCJzdGF0dXMiOiJhY3RpdmUiLCJibG9ja2VkIjpmYWxzZSwidmFsaWRVbnRpbCI6IjIwMjYtMTItMzFUMjM6NTk6NTkuMDAwWiIsImdyYWNlVW50aWwiOiIyMDI3LTAxLTE0VDIzOjU5OjU5LjAwMFoiLCJ3YXJuRnJvbSI6IjIwMjYtMTItMjRUMjM6NTk6NTkuMDAwWiIsImVuZm9yY2VtZW50IjoiR1JBRFVBVEVEIiwibWVzc2FnZSI6bnVsbCwibG9jYWxlIjoidHIiLCJpYXQiOjE3ODU3Njg2MzMsImV4cCI6MTc4Njk3ODIzM30." +
        "T_Y7178DuBDtmLh4sO_Q2q4vaNlalq_-Hqc1eIqErnZ26er9jksLUYCauBaDqc6LLwJpjwhwDdTiLGBVo_wBAA";

    private const string RealPublicKeyHex = "f4436b9e8322ce53a6f205498d88e37aec5394c438f021b5eee5837558780095";

    private sealed class StubHandler : DelegatingHandler
    {
        private readonly HttpStatusCode _statusCode;
        private readonly string _body;

        public StubHandler(string body, HttpStatusCode statusCode = HttpStatusCode.OK)
        {
            _body = body;
            _statusCode = statusCode;
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            Task.FromResult(new HttpResponseMessage(_statusCode) { Content = new StringContent(_body) });
    }

    private sealed class StubHttpClientFactory : IHttpClientFactory
    {
        private readonly HttpMessageHandler _handler;
        public StubHttpClientFactory(HttpMessageHandler handler) => _handler = handler;
        public HttpClient CreateClient(string name) => new(_handler);
    }

    private static LicenseServiceClient CreateClient(string responseBody, LicensingPublicKeyOptions[] publicKeys, HttpStatusCode statusCode = HttpStatusCode.OK)
    {
        var options = new LicensingOptions
        {
            BaseUrl = "https://lisans.example.invalid",
            BundleIdPrefix = "com.lumespec.ccc",
            PublicKeys = [.. publicKeys],
        };
        return new LicenseServiceClient(
            new StubHttpClientFactory(new StubHandler(responseBody, statusCode)),
            new MemoryCache(new MemoryCacheOptions()),
            Options.Create(options),
            NullLogger<LicenseServiceClient>.Instance);
    }

    [Fact]
    public async Task GetModuleStatusAsync_verifies_real_signed_token_and_reports_usable()
    {
        var client = CreateClient(RealSignedToken, [new LicensingPublicKeyOptions { Kid = "k1", PublicKeyHex = RealPublicKeyHex }]);

        var status = await client.GetModuleStatusAsync("tirebelediyesi", LicenseModule.Citizen, CancellationToken.None);

        Assert.True(status.Usable);
        Assert.Equal("active", status.Status);
    }

    [Fact]
    public async Task GetModuleStatusAsync_fails_open_when_public_key_not_configured()
    {
        var client = CreateClient(RealSignedToken, []);

        var status = await client.GetModuleStatusAsync("tirebelediyesi", LicenseModule.Citizen, CancellationToken.None);

        Assert.True(status.Usable);
    }

    [Fact]
    public async Task GetModuleStatusAsync_fails_open_when_token_is_tampered()
    {
        // Payload gövdesinin ortasındaki bir karakteri bozarak imza doğrulamasının reddetmesi sağlanır.
        var midpoint = RealSignedToken.Length / 2;
        var flipped = RealSignedToken[midpoint] == 'A' ? 'B' : 'A';
        var tampered = RealSignedToken[..midpoint] + flipped + RealSignedToken[(midpoint + 1)..];
        var client = CreateClient(tampered, [new LicensingPublicKeyOptions { Kid = "k1", PublicKeyHex = RealPublicKeyHex }]);

        var status = await client.GetModuleStatusAsync("tirebelediyesi", LicenseModule.Citizen, CancellationToken.None);

        Assert.True(status.Usable);
        Assert.Equal("unreachable", status.Status);
    }

    [Fact]
    public async Task GetModuleStatusAsync_fails_open_on_http_error()
    {
        var client = CreateClient(string.Empty, [new LicensingPublicKeyOptions { Kid = "k1", PublicKeyHex = RealPublicKeyHex }], HttpStatusCode.InternalServerError);

        var status = await client.GetModuleStatusAsync("tirebelediyesi", LicenseModule.Citizen, CancellationToken.None);

        Assert.True(status.Usable);
    }
}
