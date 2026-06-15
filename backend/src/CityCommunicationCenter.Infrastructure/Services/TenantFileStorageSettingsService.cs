using System.Security.Cryptography;
using Microsoft.AspNetCore.DataProtection;

namespace CityCommunicationCenter.Infrastructure.Services;

internal sealed class TenantFileStorageSettingsService : ITenantFileStorageSettingsService
{
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web);
    private readonly IApplicationDbContext _dbContext;
    private readonly IDataProtector _dataProtector;

    public TenantFileStorageSettingsService(
        IApplicationDbContext dbContext,
        IDataProtectionProvider dataProtectionProvider)
    {
        _dbContext = dbContext;
        _dataProtector = dataProtectionProvider.CreateProtector(
            "CityCommunicationCenter.TenantFileStorageSettings.v1");
    }

    public async Task<TenantFileStorageSettingsDescriptor> GetSettingsAsync(
        Guid tenantId,
        CancellationToken cancellationToken = default)
    {
        var payload = await GetPayloadAsync(tenantId, cancellationToken);
        return new TenantFileStorageSettingsDescriptor(
            payload.NasHost,
            payload.NasShareName,
            payload.NasProtocol,
            payload.NasUsername,
            !string.IsNullOrWhiteSpace(payload.NasPassword),
            payload.FtpHost,
            payload.FtpPort,
            payload.FtpPath,
            payload.FtpProtocol,
            payload.FtpUsername,
            !string.IsNullOrWhiteSpace(payload.FtpPassword));
    }

    public async Task SaveSettingsAsync(
        Guid tenantId,
        TenantFileStorageSettingsUpdate settings,
        Guid? actorUserId,
        CancellationToken cancellationToken = default)
    {
        var current = await GetPayloadAsync(tenantId, cancellationToken);
        var payload = new TenantFileStorageSettingsPayload
        {
            NasHost = Normalize(settings.NasHost),
            NasShareName = Normalize(settings.NasShareName),
            NasProtocol = settings.NasProtocol,
            NasUsername = Normalize(settings.NasUsername),
            NasPassword = ResolvePassword(
                current.NasPassword, settings.NasPassword, settings.ClearNasPassword),
            FtpHost = Normalize(settings.FtpHost),
            FtpPort = settings.FtpPort,
            FtpPath = Normalize(settings.FtpPath),
            FtpProtocol = settings.FtpProtocol,
            FtpUsername = Normalize(settings.FtpUsername),
            FtpPassword = ResolvePassword(
                current.FtpPassword, settings.FtpPassword, settings.ClearFtpPassword),
        };

        var serializedPayload = _dataProtector.Protect(
            JsonSerializer.Serialize(payload, SerializerOptions));
        var tenantSetting = await _dbContext.TenantSettings
            .IgnoreQueryFilters()
            .SingleOrDefaultAsync(entity => entity.TenantId == tenantId, cancellationToken);

        if (tenantSetting is null)
        {
            _dbContext.TenantSettings.Add(new TenantSetting
            {
                TenantSettingId = Guid.NewGuid(),
                TenantId = tenantId,
                DisplayName = string.Empty,
                DefaultSlaHours = 48,
                AutoRoutingEnabled = false,
                FileStorageSettingsJson = serializedPayload,
                CreatedByUserId = actorUserId,
            });
        }
        else
        {
            tenantSetting.FileStorageSettingsJson = serializedPayload;
            tenantSetting.UpdatedAtUtc = DateTimeOffset.UtcNow;
            tenantSetting.UpdatedByUserId = actorUserId;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task<TenantFileStorageSettingsPayload> GetPayloadAsync(
        Guid tenantId,
        CancellationToken cancellationToken)
    {
        var raw = await _dbContext.TenantSettings
            .IgnoreQueryFilters()
            .Where(entity => entity.TenantId == tenantId)
            .Select(entity => entity.FileStorageSettingsJson)
            .SingleOrDefaultAsync(cancellationToken);
        if (string.IsNullOrWhiteSpace(raw))
        {
            return new TenantFileStorageSettingsPayload();
        }

        try
        {
            raw = _dataProtector.Unprotect(raw);
        }
        catch (CryptographicException)
        {
            // Backward compatibility if a plaintext payload is ever seeded.
        }

        return JsonSerializer.Deserialize<TenantFileStorageSettingsPayload>(raw, SerializerOptions)
            ?? new TenantFileStorageSettingsPayload();
    }

    private static string? ResolvePassword(
        string? currentPassword,
        string? newPassword,
        bool clearPassword) =>
        clearPassword
            ? null
            : string.IsNullOrWhiteSpace(newPassword)
                ? currentPassword
                : newPassword;

    private static string? Normalize(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private sealed class TenantFileStorageSettingsPayload
    {
        public string? NasHost { get; set; }
        public string? NasShareName { get; set; }
        public string NasProtocol { get; set; } = "SMB/CIFS";
        public string? NasUsername { get; set; }
        public string? NasPassword { get; set; }
        public string? FtpHost { get; set; }
        public int FtpPort { get; set; } = 21;
        public string? FtpPath { get; set; }
        public string FtpProtocol { get; set; } = "FTP";
        public string? FtpUsername { get; set; }
        public string? FtpPassword { get; set; }
    }
}
