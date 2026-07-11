using System.Text.Json;

namespace CityCommunicationCenter.Application.Features.Social;

public sealed record GetWhatsAppTemplatesQuery : IQuery<IReadOnlyList<WhatsAppMessageTemplateDto>>;

public sealed class GetWhatsAppTemplatesQueryHandler
    : IQueryHandler<GetWhatsAppTemplatesQuery, IReadOnlyList<WhatsAppMessageTemplateDto>>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public GetWhatsAppTemplatesQueryHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<IReadOnlyList<WhatsAppMessageTemplateDto>> Handle(
        GetWhatsAppTemplatesQuery request,
        CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();

        // Meta onaylı şablonlar listede ilk sırada gösterilir (card #1433).
        var templates = await _dbContext.WhatsAppTemplates
            .AsNoTracking()
            .Where(t => t.TenantId == tenantId)
            .OrderByDescending(t => t.Channel == "WhatsApp Meta")
            .ThenBy(t => t.Name)
            .ToListAsync(cancellationToken);

        return templates
            .Select(t => new WhatsAppMessageTemplateDto(
                t.TemplateId,
                t.Name,
                t.Content,
                t.IsActive,
                t.Channel,
                t.IsGeneral,
                t.AutoReply,
                t.ReplyDelaySecs,
                t.HasKeyword,
                t.QueryType,
                ParseKeywords(t.KeywordsJson),
                t.TimedReplyEnabled,
                t.TimedReplyStartDate,
                t.TimedReplyEndDate,
                t.TimedReplyStartTime,
                t.TimedReplyEndTime,
                ParseKeywords(t.ActiveDaysJson),
                t.TimedReplyWeekendAllHours,
                t.MetaLanguageCode,
                t.MetaExternalId,
                t.MetaStatus))
            .ToList();
    }

    private static IReadOnlyList<string> ParseKeywords(string json)
    {
        try { return JsonSerializer.Deserialize<string[]>(json) ?? []; }
        catch { return []; }
    }
}
