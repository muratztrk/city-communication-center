using System.Text.Json;
using CityCommunicationCenter.Shared.Contracts;

namespace CityCommunicationCenter.Application.Features.Admin;

public sealed record GetSyslogSettingsQuery(Guid TenantId) : IQuery<SyslogSettingsResponse>;

public sealed class GetSyslogSettingsQueryHandler : IQueryHandler<GetSyslogSettingsQuery, SyslogSettingsResponse>
{
    private readonly IApplicationDbContext _dbContext;

    public GetSyslogSettingsQueryHandler(IApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async ValueTask<SyslogSettingsResponse> Handle(GetSyslogSettingsQuery request, CancellationToken cancellationToken)
    {
        var setting = await _dbContext.TenantSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.TenantId == request.TenantId, cancellationToken);

        if (setting?.SyslogSettingsJson is null)
        {
            return new SyslogSettingsResponse(false, null, 514, "Syslog", "UDP");
        }

        try
        {
            var payload = JsonSerializer.Deserialize<SyslogPayload>(setting.SyslogSettingsJson);
            return new SyslogSettingsResponse(
                payload?.IsEnabled ?? false,
                payload?.Host,
                payload?.Port ?? 514,
                payload?.Format ?? "Syslog",
                payload?.Transport ?? "UDP");
        }
        catch
        {
            return new SyslogSettingsResponse(false, null, 514, "Syslog", "UDP");
        }
    }

    internal sealed class SyslogPayload
    {
        public bool IsEnabled { get; set; }
        public string? Host { get; set; }
        public int Port { get; set; } = 514;
        public string Format { get; set; } = "Syslog";
        public string Transport { get; set; } = "UDP";
    }
}
