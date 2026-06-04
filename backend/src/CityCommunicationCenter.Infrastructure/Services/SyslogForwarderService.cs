using System.Net.Sockets;
using System.Text;
using System.Text.Json;
using CityCommunicationCenter.Domain.Entities;

namespace CityCommunicationCenter.Infrastructure.Services;

public interface ISyslogForwarderService
{
    Task ForwardAuditLogAsync(AuditLog auditLog, CancellationToken cancellationToken = default);
}

public sealed class SyslogForwarderService : ISyslogForwarderService
{
    private readonly IApplicationDbContext _dbContext;

    public SyslogForwarderService(IApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task ForwardAuditLogAsync(AuditLog auditLog, CancellationToken cancellationToken = default)
    {
        try
        {
            var setting = await _dbContext.TenantSettings
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.TenantId == auditLog.TenantId, cancellationToken);

            if (setting?.SyslogSettingsJson is null) return;

            var payload = JsonSerializer.Deserialize<SyslogPayload>(setting.SyslogSettingsJson);
            if (payload is null || !payload.IsEnabled || string.IsNullOrWhiteSpace(payload.Host)) return;

            var severity = MapSeverity(auditLog.Action);
            var message = BuildSyslogMessage(severity, auditLog);

            await SendUdpAsync(payload.Host, payload.Port, message, cancellationToken);
        }
        catch
        {
            // Syslog forwarding is best-effort; never fail the main operation
        }
    }

    private static int MapSeverity(string? action)
    {
        // RFC 3164 severity: 0=Emergency, 1=Alert, 2=Critical, 3=Error, 4=Warning, 5=Notice, 6=Info, 7=Debug
        return action switch
        {
            { } a when a.Contains("Reject") || a.Contains("Cancel") || a.Contains("Delete") => 4, // Warning
            { } a when a.Contains("Error") || a.Contains("Failed") => 3,                         // Error
            { } a when a.Contains("Login") || a.Contains("Auth") => 5,                           // Notice
            _ => 6,                                                                               // Info
        };
    }

    private static string BuildSyslogMessage(int severity, AuditLog log)
    {
        // RFC 3164 format: <priority>timestamp hostname app: message
        const int facility = 16; // local0
        var priority = (facility * 8) + severity;
        var timestamp = DateTimeOffset.UtcNow.ToString("MMM dd HH:mm:ss");
        var actor = log.ActorDisplayName ?? "system";
        var details = string.IsNullOrEmpty(log.Details) ? string.Empty : $" Details={log.Details}";
        return $"<{priority}>{timestamp} city-communication-center[{log.EntityType}]: Action={log.Action} Entity={log.EntityId} Actor={actor}{details}";
    }

    private static async Task SendUdpAsync(string host, int port, string message, CancellationToken cancellationToken)
    {
        using var udpClient = new UdpClient();
        var bytes = Encoding.UTF8.GetBytes(message);
        await udpClient.SendAsync(bytes, bytes.Length, host, port);
        await Task.CompletedTask;
    }

    private sealed class SyslogPayload
    {
        public bool IsEnabled { get; set; }
        public string? Host { get; set; }
        public int Port { get; set; } = 514;
        public string Format { get; set; } = "Syslog";
        public string Transport { get; set; } = "UDP";
    }
}
