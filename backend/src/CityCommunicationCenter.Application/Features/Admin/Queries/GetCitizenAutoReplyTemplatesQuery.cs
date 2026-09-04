using CityCommunicationCenter.Application.Common;

namespace CityCommunicationCenter.Application.Features.Admin;

public sealed record GetCitizenAutoReplyTemplatesQuery(Guid TenantId) : IQuery<CitizenAutoReplyTemplatesResponse?>;

public sealed class GetCitizenAutoReplyTemplatesQueryHandler : IQueryHandler<GetCitizenAutoReplyTemplatesQuery, CitizenAutoReplyTemplatesResponse?>
{
    private readonly IApplicationDbContext _dbContext;

    public GetCitizenAutoReplyTemplatesQueryHandler(IApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async ValueTask<CitizenAutoReplyTemplatesResponse?> Handle(GetCitizenAutoReplyTemplatesQuery request, CancellationToken cancellationToken)
    {
        var tenantExists = await _dbContext.Tenants.AnyAsync(entity => entity.TenantId == request.TenantId, cancellationToken);
        if (!tenantExists)
        {
            return null;
        }

        var raw = await _dbContext.TenantSettings
            .Where(entity => entity.TenantId == request.TenantId)
            .Select(entity => entity.CitizenAutoReplyTemplatesJson)
            .FirstOrDefaultAsync(cancellationToken);
        var templates = CitizenAutoReplyTemplateJson.ParseOrDefault(raw);
        return new CitizenAutoReplyTemplatesResponse(
            templates.ProcessingReceived,
            templates.InProgress,
            templates.Completed,
            templates.Cancelled,
            CitizenOutboundGreeting.NormalizeLine(templates.Greeting),
            templates.AfterHoursManagerSms,
            new CitizenAutoReplyGreetingsContract(
                templates.GreetingFor("İşleme Alındı"),
                templates.GreetingFor("Yapılmakta"),
                templates.GreetingFor("Tamamlandı"),
                templates.GreetingFor("İptal"),
                templates.Greetings?.SmsProcessingReceived ?? templates.GreetingFor("İşleme Alındı", Domain.Enums.SocialChannel.Phone)),
            templates.AfterHoursStaffSms,
            templates.ManagerSmsIsEnabled,
            templates.StaffSmsIsEnabled,
            templates.SmsProcessingReceived ?? templates.ProcessingReceived,
            templates.SmsProcessingReceivedIsEnabled);
    }
}
