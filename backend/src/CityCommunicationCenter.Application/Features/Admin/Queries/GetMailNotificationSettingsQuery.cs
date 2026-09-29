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

        var payload = MailNotificationSettingsPayload.ParseOrEmpty(setting?.MailNotificationSettingsJson);
        return new MailNotificationSettingsResponse(
            payload.IsEnabled,
            payload.SmtpHostSpecified,
            payload.SmtpHost,
            payload.PortSpecified,
            payload.Port > 0 ? payload.Port : 25,
            payload.AuthenticationEnabled,
            payload.Username,
            !string.IsNullOrEmpty(payload.Password),
            string.IsNullOrWhiteSpace(payload.SecurityMode) ? "None" : payload.SecurityMode,
            payload.DefaultReplyTo,
            payload.IncomingMailEnabled,
            string.IsNullOrWhiteSpace(payload.IncomingSubjectTemplate)
                ? MailNotificationSettingsPayload.RequestNoToken
                : payload.IncomingSubjectTemplate,
            string.IsNullOrWhiteSpace(payload.IncomingBodyTemplate)
                ? MailNotificationSettingsPayload.BodyRequestToken
                : payload.IncomingBodyTemplate,
            payload.ExcludedUsersEnabled,
            payload.ExcludedUserIds,
            payload.OverdueMailEnabled,
            string.IsNullOrWhiteSpace(payload.OverdueSubjectTemplate)
                ? MailNotificationSettingsPayload.RequestNoToken
                : payload.OverdueSubjectTemplate,
            string.IsNullOrWhiteSpace(payload.OverdueBodyTemplate)
                ? MailNotificationSettingsPayload.BodyRequestToken
                : payload.OverdueBodyTemplate,
            payload.OverdueTaskMailEnabled,
            MailNotificationSettingsPayload.ToTaskTemplate(payload.OverdueTaskSubjectTemplate),
            MailNotificationSettingsPayload.ToTaskTemplate(payload.OverdueTaskBodyTemplate, withTitleToken: true),
            payload.AssignmentMailEnabled,
            MailNotificationSettingsPayload.ToTaskTemplate(payload.AssignmentSubjectTemplate),
            MailNotificationSettingsPayload.ToTaskTemplate(payload.AssignmentBodyTemplate, withTitleToken: true));
    }
}
