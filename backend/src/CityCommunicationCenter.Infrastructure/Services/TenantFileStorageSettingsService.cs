using System.Security.Cryptography;
using CityCommunicationCenter.Infrastructure.FileStorage;
using CityCommunicationCenter.Shared.FileStorage;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.Logging;

namespace CityCommunicationCenter.Infrastructure.Services;

internal sealed class TenantFileStorageSettingsService : ITenantFileStorageSettingsService
{
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web);
    private static readonly TimeZoneInfo TurkeyTimeZone = ResolveTurkeyTimeZone();
    private readonly IApplicationDbContext _dbContext;
    private readonly IConfiguration _configuration;
    private readonly ILogger<TenantFileStorageSettingsService> _logger;
    private readonly IDataProtector _dataProtector;
    private readonly IDataProtector _backupDataProtector;

    public TenantFileStorageSettingsService(
        IApplicationDbContext dbContext,
        IConfiguration configuration,
        IDataProtectionProvider dataProtectionProvider,
        ILogger<TenantFileStorageSettingsService> logger)
    {
        _dbContext = dbContext;
        _configuration = configuration;
        _logger = logger;
        _dataProtector = dataProtectionProvider.CreateProtector(
            "CityCommunicationCenter.TenantFileStorageSettings.v1");
        _backupDataProtector = dataProtectionProvider.CreateProtector(
            "CityCommunicationCenter.TenantDatabaseBackupSettings.v1");
    }

    public async Task<TenantFileStorageSettingsDescriptor> GetSettingsAsync(
        Guid tenantId,
        CancellationToken cancellationToken = default)
    {
        var payload = await GetPayloadAsync(tenantId, cancellationToken);
        return new TenantFileStorageSettingsDescriptor(
            payload.NasHost,
            payload.NasShareName,
            payload.NasRootFolder,
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

    public async Task<NasAttachmentStorageCredentials?> GetNasAttachmentCredentialsAsync(
        Guid tenantId,
        CancellationToken cancellationToken = default)
    {
        var payload = await GetPayloadAsync(tenantId, cancellationToken);
        if (!string.Equals(payload.NasProtocol, "SMB/CIFS", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        var host = NormalizeNasHost(payload.NasHost);
        var shareName = NormalizeNasShareName(payload.NasShareName);
        var username = Normalize(payload.NasUsername);
        var password = payload.NasPassword;

        if (string.IsNullOrWhiteSpace(host)
            || string.IsNullOrWhiteSpace(shareName)
            || string.IsNullOrWhiteSpace(username)
            || string.IsNullOrWhiteSpace(password))
        {
            return null;
        }

        return new NasAttachmentStorageCredentials(
            host,
            shareName,
            username,
            password,
            NormalizeNasRootFolder(payload.NasRootFolder));
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
            NasHost = NormalizeNasHost(settings.NasHost),
            NasShareName = NormalizeNasShareName(settings.NasShareName),
            NasRootFolder = ResolveNasRootFolder(settings.NasHost, settings.NasShareName, settings.NasRootFolder),
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

    public async Task<TenantDatabaseBackupSettingsDescriptor> GetDatabaseBackupSettingsAsync(
        Guid tenantId,
        CancellationToken cancellationToken = default)
    {
        var payload = await GetBackupPayloadAsync(tenantId, cancellationToken);
        return new TenantDatabaseBackupSettingsDescriptor(
            payload.NasHost,
            payload.NasShareName,
            payload.NasRootFolder,
            payload.NasProtocol,
            payload.NasUsername,
            !string.IsNullOrWhiteSpace(payload.NasPassword),
            payload.ScheduledEnabled,
            payload.ScheduledTime,
            payload.ScheduledDays ?? []);
    }

    public async Task SaveDatabaseBackupSettingsAsync(
        Guid tenantId,
        TenantDatabaseBackupSettingsUpdate settings,
        Guid? actorUserId,
        CancellationToken cancellationToken = default)
    {
        var current = await GetBackupPayloadAsync(tenantId, cancellationToken);
        var payload = new TenantDatabaseBackupSettingsPayload
        {
            NasHost = NormalizeNasHost(settings.NasHost),
            NasShareName = NormalizeNasShareName(settings.NasShareName),
            NasRootFolder = ResolveNasRootFolder(settings.NasHost, settings.NasShareName, settings.NasRootFolder),
            NasProtocol = string.IsNullOrWhiteSpace(settings.NasProtocol) ? "SMB/CIFS" : settings.NasProtocol.Trim(),
            NasUsername = Normalize(settings.NasUsername),
            NasPassword = ResolvePassword(
                current.NasPassword, settings.NasPassword, settings.ClearNasPassword),
            ScheduledEnabled = current.ScheduledEnabled,
            ScheduledTime = current.ScheduledTime,
            ScheduledDays = current.ScheduledDays ?? [],
            LastScheduledBackupLocalDate = current.LastScheduledBackupLocalDate,
            LastScheduledBackupAttemptUtc = current.LastScheduledBackupAttemptUtc,
        };

        var serializedPayload = _backupDataProtector.Protect(
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
                DatabaseBackupSettingsJson = serializedPayload,
                CreatedByUserId = actorUserId,
            });
        }
        else
        {
            tenantSetting.DatabaseBackupSettingsJson = serializedPayload;
            tenantSetting.UpdatedAtUtc = DateTimeOffset.UtcNow;
            tenantSetting.UpdatedByUserId = actorUserId;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        await PublishDatabaseBackupAsync(payload, cancellationToken);
    }

    public async Task SaveDatabaseBackupScheduleAsync(
        Guid tenantId,
        bool enabled,
        string? time,
        IReadOnlyList<int> days,
        Guid? actorUserId,
        CancellationToken cancellationToken = default)
    {
        var normalizedDays = (days ?? [])
            .Where(day => day is >= 0 and <= 6)
            .Distinct()
            .Order()
            .ToArray();
        var normalizedTime = string.IsNullOrWhiteSpace(time) ? null : time.Trim();
        if (enabled)
        {
            if (!TryParseScheduleTime(normalizedTime, out _))
            {
                throw new FluentValidation.ValidationException("Zamanlı yedek için başlangıç saati HH:mm olmalıdır.");
            }

            if (normalizedDays.Length == 0)
            {
                throw new FluentValidation.ValidationException("Zamanlı yedek için en az bir gün seçilmelidir.");
            }
        }

        var current = await GetBackupPayloadAsync(tenantId, cancellationToken);
        current.ScheduledEnabled = enabled;
        current.ScheduledTime = normalizedTime;
        current.ScheduledDays = normalizedDays;
        StampScheduleCursor(current);
        await StoreBackupPayloadAsync(tenantId, current, actorUserId, cancellationToken);
    }

    public async Task ProcessScheduledDatabaseBackupsAsync(CancellationToken cancellationToken = default)
    {
        var rows = await _dbContext.TenantSettings
            .IgnoreQueryFilters()
            .Where(entity => entity.DatabaseBackupSettingsJson != null)
            .Select(entity => new { entity.TenantId, entity.DatabaseBackupSettingsJson })
            .ToListAsync(cancellationToken);

        var now = DateTimeOffset.UtcNow;
        foreach (var row in rows)
        {
            TenantDatabaseBackupSettingsPayload payload;
            try
            {
                payload = UnprotectBackupPayload(row.DatabaseBackupSettingsJson);
            }
            catch (JsonException ex)
            {
                _logger.LogWarning(ex, "Zamanlı veritabanı yedeği ayarı okunamadı. TenantId={TenantId}", row.TenantId);
                continue;
            }

            if (!IsScheduleDue(payload, now))
            {
                continue;
            }

            payload.LastScheduledBackupAttemptUtc = now;
            await StoreBackupPayloadAsync(row.TenantId, payload, null, cancellationToken);

            try
            {
                await PublishDatabaseBackupAsync(payload, cancellationToken);
                var local = TimeZoneInfo.ConvertTime(now, TurkeyTimeZone);
                payload.LastScheduledBackupLocalDate = local.ToString("yyyy-MM-dd");
                await StoreBackupPayloadAsync(row.TenantId, payload, null, cancellationToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogWarning(ex, "Zamanlı veritabanı yedeği yazılamadı. TenantId={TenantId}", row.TenantId);
            }
        }
    }

    private async Task StoreBackupPayloadAsync(
        Guid tenantId,
        TenantDatabaseBackupSettingsPayload payload,
        Guid? actorUserId,
        CancellationToken cancellationToken)
    {
        var serializedPayload = _backupDataProtector.Protect(
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
                DatabaseBackupSettingsJson = serializedPayload,
                CreatedByUserId = actorUserId,
            });
        }
        else
        {
            tenantSetting.DatabaseBackupSettingsJson = serializedPayload;
            tenantSetting.UpdatedAtUtc = DateTimeOffset.UtcNow;
            tenantSetting.UpdatedByUserId = actorUserId;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private static void StampScheduleCursor(TenantDatabaseBackupSettingsPayload payload)
    {
        if (!payload.ScheduledEnabled || !TryParseScheduleTime(payload.ScheduledTime, out var start))
        {
            return;
        }

        var local = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, TurkeyTimeZone);
        var today = local.ToString("yyyy-MM-dd");
        var selectedToday = (payload.ScheduledDays ?? []).Contains((int)local.DayOfWeek);
        if (!selectedToday)
        {
            return;
        }

        if (local.TimeOfDay >= start.ToTimeSpan())
        {
            payload.LastScheduledBackupLocalDate = today;
            return;
        }

        if (string.Equals(payload.LastScheduledBackupLocalDate, today, StringComparison.Ordinal))
        {
            payload.LastScheduledBackupLocalDate = null;
        }
    }

    private static bool IsScheduleDue(TenantDatabaseBackupSettingsPayload payload, DateTimeOffset utcNow)
    {
        if (!payload.ScheduledEnabled || !TryParseScheduleTime(payload.ScheduledTime, out var start))
        {
            return false;
        }

        var local = TimeZoneInfo.ConvertTime(utcNow, TurkeyTimeZone);
        if (!(payload.ScheduledDays ?? []).Contains((int)local.DayOfWeek))
        {
            return false;
        }

        if (local.TimeOfDay < start.ToTimeSpan())
        {
            return false;
        }

        var today = local.ToString("yyyy-MM-dd");
        if (string.Equals(payload.LastScheduledBackupLocalDate, today, StringComparison.Ordinal))
        {
            return false;
        }

        return payload.LastScheduledBackupAttemptUtc is not DateTimeOffset attempt
            || utcNow - attempt >= TimeSpan.FromMinutes(15);
    }

    private static bool TryParseScheduleTime(string? value, out TimeOnly time)
    {
        time = default;
        if (string.IsNullOrWhiteSpace(value))
        {
            return false;
        }

        return TimeOnly.TryParseExact(value.Trim(), "HH:mm", out time)
            || TimeOnly.TryParseExact(value.Trim(), "H:mm", out time);
    }

    private static TimeZoneInfo ResolveTurkeyTimeZone()
    {
        foreach (var id in new[] { "Europe/Istanbul", "Turkey Standard Time" })
        {
            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById(id);
            }
            catch (TimeZoneNotFoundException)
            {
            }
            catch (InvalidTimeZoneException)
            {
            }
        }

        return TimeZoneInfo.Utc;
    }

    private async Task PublishDatabaseBackupAsync(
        TenantDatabaseBackupSettingsPayload payload,
        CancellationToken cancellationToken)
    {
        var hasDestination = !string.IsNullOrWhiteSpace(payload.NasHost)
            || !string.IsNullOrWhiteSpace(payload.NasShareName)
            || !string.IsNullOrWhiteSpace(payload.NasUsername)
            || !string.IsNullOrWhiteSpace(payload.NasPassword);
        if (!hasDestination)
        {
            return;
        }

        if (string.IsNullOrWhiteSpace(payload.NasHost)
            || string.IsNullOrWhiteSpace(payload.NasShareName)
            || string.IsNullOrWhiteSpace(payload.NasUsername)
            || string.IsNullOrWhiteSpace(payload.NasPassword))
        {
            throw new FluentValidation.ValidationException(
                "Yedek klasörü için IP adresi, paylaşım adı, kullanıcı adı ve parola gerekir.");
        }

        if (!string.Equals(payload.NasProtocol, "SMB/CIFS", StringComparison.OrdinalIgnoreCase))
        {
            throw new FluentValidation.ValidationException(
                "Veritabanı yedeği klasörü SMB/CIFS paylaşımında oluşturulur.");
        }

        var connectionString = _configuration.GetConnectionString("CityCommunicationCenter");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new FluentValidation.ValidationException("Veritabanı bağlantı dizesi bulunamadı.");
        }

        try
        {
            await DatabaseBackupNasPublisher.PublishAsync(
                connectionString,
                payload.NasHost,
                payload.NasShareName,
                payload.NasRootFolder,
                payload.NasUsername,
                payload.NasPassword,
                cancellationToken);
        }
        catch (SmbNasSessionException ex)
        {
            throw new FluentValidation.ValidationException(ex.Message);
        }
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

    private async Task<TenantDatabaseBackupSettingsPayload> GetBackupPayloadAsync(
        Guid tenantId,
        CancellationToken cancellationToken)
    {
        var raw = await _dbContext.TenantSettings
            .IgnoreQueryFilters()
            .Where(entity => entity.TenantId == tenantId)
            .Select(entity => entity.DatabaseBackupSettingsJson)
            .SingleOrDefaultAsync(cancellationToken);
        return UnprotectBackupPayload(raw);
    }

    private TenantDatabaseBackupSettingsPayload UnprotectBackupPayload(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return new TenantDatabaseBackupSettingsPayload();
        }

        try
        {
            raw = _backupDataProtector.Unprotect(raw);
        }
        catch (CryptographicException)
        {
        }

        return JsonSerializer.Deserialize<TenantDatabaseBackupSettingsPayload>(raw, SerializerOptions)
            ?? new TenantDatabaseBackupSettingsPayload();
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

    private static string? NormalizeNasHost(string? value) =>
        NasPathNormalizer.NormalizeHost(Normalize(value));

    private static string? NormalizeNasShareName(string? value) =>
        NasPathNormalizer.NormalizeShareName(Normalize(value));

    private static string? NormalizeNasRootFolder(string? value) =>
        NasPathNormalizer.NormalizeRootFolder(Normalize(value));

    private static string? ResolveNasRootFolder(string? nasHost, string? nasShareName, string? nasRootFolder)
    {
        var explicitRoot = NormalizeNasRootFolder(nasRootFolder);
        if (!string.IsNullOrWhiteSpace(explicitRoot))
        {
            return explicitRoot;
        }

        if (NasPathNormalizer.TryParseUnc(Normalize(nasHost), out _, out _, out var hostRoot)
            && !string.IsNullOrWhiteSpace(hostRoot))
        {
            return hostRoot;
        }

        if (NasPathNormalizer.TryParseUnc(Normalize(nasShareName), out _, out _, out var shareRoot)
            && !string.IsNullOrWhiteSpace(shareRoot))
        {
            return shareRoot;
        }

        return null;
    }

    private sealed class TenantFileStorageSettingsPayload
    {
        public string? NasHost { get; set; }
        public string? NasShareName { get; set; }
        public string? NasRootFolder { get; set; }
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

    private sealed class TenantDatabaseBackupSettingsPayload
    {
        public string? NasHost { get; set; }
        public string? NasShareName { get; set; }
        public string? NasRootFolder { get; set; }
        public string NasProtocol { get; set; } = "SMB/CIFS";
        public string? NasUsername { get; set; }
        public string? NasPassword { get; set; }
        public bool ScheduledEnabled { get; set; }
        public string? ScheduledTime { get; set; }
        public int[] ScheduledDays { get; set; } = [];
        public string? LastScheduledBackupLocalDate { get; set; }
        public DateTimeOffset? LastScheduledBackupAttemptUtc { get; set; }
    }
}
