using System.Text.Json;

namespace CityCommunicationCenter.Application.Features.Admin;

public sealed record GetMailNotificationSettingsQuery(Guid TenantId) : IQuery<MailNotificationSettingsResponse>;

public sealed class GetMailNotificationSettingsQueryHandler : IQueryHandler<GetMailNotificationSettingsQuery, MailNotificationSettingsResponse>
{
    private readonly IApplicationDbContext _dbContext;

    public GetMailNotificationSettingsQueryHandler(IApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async ValueTask<MailNotificationSettingsResponse> Handle(GetMailNotificationSettingsQuery request, CancellationToken cancellationToken)
    {
        var setting = await _dbContext.TenantSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.TenantId == request.TenantId, cancellationToken);

        if (setting?.MailNotificationSettingsJson is null)
        {
            return Empty();
        }

        try
        {
            var payload = JsonSerializer.Deserialize<MailNotificationPayload>(setting.MailNotificationSettingsJson);
            return new MailNotificationSettingsResponse(
                payload?.IsEnabled ?? false,
                payload?.SmtpHostSpecified ?? false,
                payload?.SmtpHost,
                payload?.PortSpecified ?? false,
                payload?.Port > 0 ? payload.Port : 25,
                payload?.AuthenticationEnabled ?? false,
                payload?.Username,
                !string.IsNullOrEmpty(payload?.Password),
                string.IsNullOrWhiteSpace(payload?.SecurityMode) ? "None" : payload.SecurityMode,
                payload?.DefaultReplyTo);
        }
        catch
        {
            return Empty();
        }
    }

    private static MailNotificationSettingsResponse Empty() =>
        new(false, false, null, false, 25, false, null, false, "None", null);

    internal sealed class MailNotificationPayload
    {
        public bool IsEnabled { get; set; }
        public bool SmtpHostSpecified { get; set; }
        public string? SmtpHost { get; set; }
        public bool PortSpecified { get; set; }
        public int Port { get; set; } = 25;
        public bool AuthenticationEnabled { get; set; }
        public string? Username { get; set; }
        public string? Password { get; set; }
        public string SecurityMode { get; set; } = "None";
        public string? DefaultReplyTo { get; set; }
    }
}
