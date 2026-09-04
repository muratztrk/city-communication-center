using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Domain.Enums;
using CityCommunicationCenter.Infrastructure.Options;
using CityCommunicationCenter.Infrastructure.Sms;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace CityCommunicationCenter.Application.Tests.Infrastructure;

public sealed class SmsGatewayLiveSendGuardTests
{
    [Fact]
    public async Task SendAsync_skips_provider_when_environment_live_send_disabled()
    {
        var settings = new StubSmsSettingsService(new TenantSmsCredentials(
            IsEnabled: true,
            LiveSendEnabled: true,
            Provider: SmsProvider.JettMesaj,
            ApiUrl: "http://api.jettmesaj.com/",
            Username: "user",
            Password: "pass",
            Originator: "TIREBLD",
            ChargedNumber: null));

        var sender = new RecordingSmsProviderSender();
        var gateway = new SmsGateway(
            settings,
            [sender],
            new NoOpSmsOutboundLogWriter(),
            Options.Create(new SmsOptions { LiveSendEnabled = false }),
            NullLogger<SmsGateway>.Instance);

        var result = await gateway.SendAsync(
            Guid.NewGuid(),
            "05551234567",
            "Test metni",
            new SmsSendContext(SmsOutboundKind.Test));

        Assert.True(result.Success);
        Assert.Equal("SIMULATION", result.ProviderCode);
        Assert.Contains("Simülasyon", result.Message, StringComparison.Ordinal);
        Assert.Equal(0, sender.SendCount);
    }

    private sealed class StubSmsSettingsService(TenantSmsCredentials credentials) : ITenantSmsSettingsService
    {
        public Task<TenantSmsSettingsDescriptor> GetSettingsAsync(Guid tenantId, CancellationToken cancellationToken = default) =>
            Task.FromResult(new TenantSmsSettingsDescriptor(
                credentials.IsEnabled,
                credentials.LiveSendEnabled,
                credentials.Provider,
                credentials.ApiUrl,
                credentials.Username,
                !string.IsNullOrWhiteSpace(credentials.Password),
                credentials.Originator,
                credentials.ChargedNumber));

        public Task SaveSettingsAsync(Guid tenantId, TenantSmsSettingsUpdate settings, Guid? actorUserId, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;

        public Task<TenantSmsCredentials> GetCredentialsAsync(Guid tenantId, CancellationToken cancellationToken = default) =>
            Task.FromResult(credentials);
    }

    private sealed class RecordingSmsProviderSender : ISmsProviderSender
    {
        public int SendCount { get; private set; }

        public SmsProvider Provider => SmsProvider.JettMesaj;

        public Task<SmsSendResult> SendAsync(
            TenantSmsCredentials credentials,
            string normalizedPhone,
            string text,
            CancellationToken cancellationToken)
        {
            SendCount++;
            return Task.FromResult(SmsSendResult.Ok("100"));
        }
    }

    private sealed class NoOpSmsOutboundLogWriter : ISmsOutboundLogWriter
    {
        public Task WriteAsync(SmsOutboundLogEntry entry, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;
    }
}
