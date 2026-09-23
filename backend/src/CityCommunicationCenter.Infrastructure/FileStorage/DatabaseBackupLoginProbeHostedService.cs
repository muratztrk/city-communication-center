using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.Hosting;

namespace CityCommunicationCenter.Infrastructure.FileStorage;

/// <summary>
/// Geçici: API süreci kayıtlı yedek parolasıyla SMB girişini açılışta bir kez dener.
/// </summary>
internal sealed class DatabaseBackupLoginProbeHostedService(
    IServiceScopeFactory scopeFactory,
    ILogger<DatabaseBackupLoginProbeHostedService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await Task.Delay(TimeSpan.FromSeconds(2), stoppingToken);
            await using var scope = scopeFactory.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();
            var protector = scope.ServiceProvider.GetRequiredService<IDataProtectionProvider>()
                .CreateProtector("CityCommunicationCenter.TenantDatabaseBackupSettings.v1");
            var raw = await db.TenantSettings
                .IgnoreQueryFilters()
                .Where(entity => entity.DatabaseBackupSettingsJson != null && entity.DatabaseBackupSettingsJson != "")
                .Select(entity => entity.DatabaseBackupSettingsJson)
                .FirstOrDefaultAsync(stoppingToken);
            if (string.IsNullOrWhiteSpace(raw))
            {
                logger.LogWarning("backup-probe settings-missing");
                return;
            }

            var json = protector.Unprotect(raw);
            var payload = JsonSerializer.Deserialize<ProbePayload>(json, new JsonSerializerOptions(JsonSerializerDefaults.Web));
            var password = payload?.NasPassword ?? "";
            logger.LogWarning(
                "backup-probe user={User} host={Host} share={Share} pass-len={PassLen} machine={Machine} osuser={OsUser}",
                payload?.NasUsername,
                payload?.NasHost,
                payload?.NasShareName,
                password.Length,
                Environment.MachineName,
                Environment.UserName);

            if (string.IsNullOrWhiteSpace(payload?.NasHost)
                || string.IsNullOrWhiteSpace(payload.NasShareName)
                || string.IsNullOrWhiteSpace(payload.NasUsername)
                || string.IsNullOrWhiteSpace(password))
            {
                logger.LogWarning("backup-probe incomplete");
                return;
            }

            SmbNasSessionSupport.ExecuteWithAuthenticatedFileStore(
                payload.NasHost,
                payload.NasShareName,
                payload.NasUsername,
                password,
                _ => { });
            logger.LogWarning("backup-probe login=ok");
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "backup-probe failed");
        }
    }

    private sealed class ProbePayload
    {
        public string? NasHost { get; set; }
        public string? NasShareName { get; set; }
        public string? NasUsername { get; set; }
        public string? NasPassword { get; set; }
    }
}
