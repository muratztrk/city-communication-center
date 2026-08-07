using System.Net;
using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Domain.Entities;
using CityCommunicationCenter.Infrastructure.Licensing;
using CityCommunicationCenter.Infrastructure.Options;
using CityCommunicationCenter.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace CityCommunicationCenter.Application.Tests.Domain;

public class LicenseModuleStatusServiceTests
{
    private const string RealSignedToken =
        "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCIsImtpZCI6ImsxIn0." +
        "eyJidW5kbGVJZCI6ImNvbS5sdW1lc3BlYy5jY2MudGlyZWJlbGVkaXllc2kuY2l0aXplbiIsInRlbmFudCI6ImNtc2RjZnNsNTAwYjdyeDBtZHhlN3pyY2siLCJuYW1lIjoiVGlyZSBCZWxlZGl5ZXNpIENpdGl6ZW4iLCJzdGF0dXMiOiJhY3RpdmUiLCJibG9ja2VkIjpmYWxzZSwidmFsaWRVbnRpbCI6IjIwMjYtMTItMzFUMjM6NTk6NTkuMDAwWiIsImdyYWNlVW50aWwiOiIyMDI3LTAxLTE0VDIzOjU5OjU5LjAwMFoiLCJ3YXJuRnJvbSI6IjIwMjYtMTItMjRUMjM6NTk6NTkuMDAwWiIsImVuZm9yY2VtZW50IjoiR1JBRFVBVEVEIiwibWVzc2FnZSI6bnVsbCwibG9jYWxlIjoidHIiLCJpYXQiOjE3ODU3Njg2MzMsImV4cCI6MTc4Njk3ODIzM30." +
        "T_Y7178DuBDtmLh4sO_Q2q4vaNlalq_-Hqc1eIqErnZ26er9jksLUYCauBaDqc6LLwJpjwhwDdTiLGBVo_wBAA";

    private const string RealPublicKeyHex = "f4436b9e8322ce53a6f205498d88e37aec5394c438f021b5eee5837558780095";

    private static readonly Guid TenantId = Guid.Parse("b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e");

    private sealed class StubRemoteClient : IRemoteLicenseTokenClient
    {
        private readonly RemoteLicenseFetchResult _result;

        public StubRemoteClient(RemoteLicenseFetchResult result) => _result = result;

        public Task<RemoteLicenseFetchResult> FetchTokenAsync(string fullBundleId, CancellationToken cancellationToken) =>
            Task.FromResult(_result);
    }

    private sealed class CountingRemoteClient : IRemoteLicenseTokenClient
    {
        public int CallCount { get; private set; }
        private readonly RemoteLicenseFetchResult _result;

        public CountingRemoteClient(RemoteLicenseFetchResult result) => _result = result;

        public Task<RemoteLicenseFetchResult> FetchTokenAsync(string fullBundleId, CancellationToken cancellationToken)
        {
            CallCount++;
            return Task.FromResult(_result);
        }
    }

    private static LicenseModuleStatusService CreateService(
        CityCommunicationCenterDbContext dbContext,
        RemoteLicenseFetchResult remoteResult,
        LicensingPublicKeyOptions[] publicKeys,
        IRemoteLicenseTokenClient? remoteClient = null)
    {
        var options = Options.Create(new LicensingOptions
        {
            BaseUrl = "https://lisans.example.invalid",
            BundleIdPrefix = "com.lumespec.ccc",
            PublicKeys = [.. publicKeys],
            CacheMinutes = 1,
        });

        return new LicenseModuleStatusService(
            dbContext,
            new LicenseTokenVerifier(options),
            remoteClient ?? new StubRemoteClient(remoteResult),
            new MemoryCache(new MemoryCacheOptions()),
            options,
            NullLogger<LicenseModuleStatusService>.Instance);
    }

    private static async Task<CityCommunicationCenterDbContext> CreateDbContextAsync()
    {
        var dbContext = new CityCommunicationCenterDbContext(
            new DbContextOptionsBuilder<CityCommunicationCenterDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options);

        dbContext.Tenants.Add(new Tenant
        {
            TenantId = TenantId,
            MunicipalityName = "Tire Belediyesi",
            DisplayName = "Tire Belediyesi",
            IsActive = true,
        });
        await dbContext.SaveChangesAsync();
        return dbContext;
    }

    [Fact]
    public async Task GetModuleStatusAsync_uses_stored_token_when_remote_unreachable()
    {
        await using var dbContext = await CreateDbContextAsync();
        dbContext.TenantSettings.Add(new TenantSetting
        {
            TenantSettingId = Guid.NewGuid(),
            TenantId = TenantId,
            LicenseModulesJson = TenantLicenseModulesJson.SetToken(null, "citizen", RealSignedToken),
        });
        await dbContext.SaveChangesAsync();

        var service = CreateService(
            dbContext,
            new RemoteLicenseFetchResult(RemoteLicenseFetchOutcome.Unreachable, null),
            [new LicensingPublicKeyOptions { Kid = "k1", PublicKeyHex = RealPublicKeyHex }]);

        var status = await service.GetModuleStatusAsync(TenantId, "tirebelediyesi", LicenseModule.Citizen, CancellationToken.None);

        Assert.True(status.Usable);
        Assert.Equal("active", status.Status);
        Assert.Equal("stored", status.Source);
        Assert.True(status.HasStoredToken);
    }

    [Fact]
    public async Task GetModuleStatusAsync_fails_closed_when_remote_denied_even_with_stored_token()
    {
        await using var dbContext = await CreateDbContextAsync();
        dbContext.TenantSettings.Add(new TenantSetting
        {
            TenantSettingId = Guid.NewGuid(),
            TenantId = TenantId,
            LicenseModulesJson = TenantLicenseModulesJson.SetToken(null, "citizen", RealSignedToken),
        });
        await dbContext.SaveChangesAsync();

        var service = CreateService(
            dbContext,
            new RemoteLicenseFetchResult(RemoteLicenseFetchOutcome.Denied, null),
            [new LicensingPublicKeyOptions { Kid = "k1", PublicKeyHex = RealPublicKeyHex }]);

        var status = await service.GetModuleStatusAsync(TenantId, "tirebelediyesi", LicenseModule.Citizen, CancellationToken.None);

        Assert.False(status.Usable);
        Assert.Equal("suspended", status.Status);
        Assert.Equal("remote-denied", status.Source);
    }

    [Fact]
    public async Task GetModuleStatusAsync_fails_closed_when_no_stored_token_and_remote_denied()
    {
        await using var dbContext = await CreateDbContextAsync();
        var service = CreateService(
            dbContext,
            new RemoteLicenseFetchResult(RemoteLicenseFetchOutcome.Denied, null),
            [new LicensingPublicKeyOptions { Kid = "k1", PublicKeyHex = RealPublicKeyHex }]);

        var status = await service.GetModuleStatusAsync(TenantId, "tirebelediyesi", LicenseModule.Citizen, CancellationToken.None);

        Assert.False(status.Usable);
        Assert.Equal("suspended", status.Status);
    }

    [Fact]
    public async Task GetModuleStatusAsync_persists_remote_token_when_online()
    {
        await using var dbContext = await CreateDbContextAsync();
        var service = CreateService(
            dbContext,
            new RemoteLicenseFetchResult(RemoteLicenseFetchOutcome.Success, RealSignedToken),
            [new LicensingPublicKeyOptions { Kid = "k1", PublicKeyHex = RealPublicKeyHex }]);

        var status = await service.GetModuleStatusAsync(TenantId, "tirebelediyesi", LicenseModule.Citizen, CancellationToken.None);

        Assert.True(status.Usable);
        Assert.Equal("remote", status.Source);

        var settings = await dbContext.TenantSettings.FirstAsync(entity => entity.TenantId == TenantId);
        Assert.Contains(RealSignedToken[..20], settings.LicenseModulesJson);
    }

    [Fact]
    public async Task GetModuleStatusAsync_skips_remote_fetch_when_cached()
    {
        await using var dbContext = await CreateDbContextAsync();
        var remoteClient = new CountingRemoteClient(
            new RemoteLicenseFetchResult(RemoteLicenseFetchOutcome.Success, RealSignedToken));
        var service = CreateService(
            dbContext,
            new RemoteLicenseFetchResult(RemoteLicenseFetchOutcome.Success, RealSignedToken),
            [new LicensingPublicKeyOptions { Kid = "k1", PublicKeyHex = RealPublicKeyHex }],
            remoteClient);

        await service.GetModuleStatusAsync(TenantId, "tirebelediyesi", LicenseModule.Citizen, CancellationToken.None);
        await service.GetModuleStatusAsync(TenantId, "tirebelediyesi", LicenseModule.Citizen, CancellationToken.None);

        Assert.Equal(1, remoteClient.CallCount);
    }

    [Fact]
    public async Task SaveStoredTokenAsync_rejects_invalid_token()
    {
        await using var dbContext = await CreateDbContextAsync();
        var service = CreateService(
            dbContext,
            new RemoteLicenseFetchResult(RemoteLicenseFetchOutcome.Unreachable, null),
            [new LicensingPublicKeyOptions { Kid = "k1", PublicKeyHex = RealPublicKeyHex }]);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.SaveStoredTokenAsync(TenantId, LicenseModule.Citizen, "tirebelediyesi", "not-a-jwt", CancellationToken.None));
    }
}
