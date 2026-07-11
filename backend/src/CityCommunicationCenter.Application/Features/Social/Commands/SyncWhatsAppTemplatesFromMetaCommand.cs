using FluentValidation;
using FluentValidation.Results;

namespace CityCommunicationCenter.Application.Features.Social;

public sealed record SyncWhatsAppTemplatesFromMetaCommand(Guid ActorUserId)
    : ICommand<WhatsAppTemplatesSyncFromMetaResult>;

public sealed class SyncWhatsAppTemplatesFromMetaCommandHandler
    : ICommandHandler<SyncWhatsAppTemplatesFromMetaCommand, WhatsAppTemplatesSyncFromMetaResult>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;
    private readonly ISocialMediaClientFactory _clientFactory;

    public SyncWhatsAppTemplatesFromMetaCommandHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor,
        ISocialMediaClientFactory clientFactory)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
        _clientFactory = clientFactory;
    }

    public async ValueTask<WhatsAppTemplatesSyncFromMetaResult> Handle(
        SyncWhatsAppTemplatesFromMetaCommand request,
        CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();
        var client = _clientFactory.GetWhatsAppTemplateClient(tenantId);
        if (client is null)
        {
            throw new ValidationException([
                new ValidationFailure(
                    "WhatsApp",
                    "WhatsApp Business Account ID ve Access Token ayarlanmadan Meta şablonları senkronize edilemez.")
            ]);
        }

        IReadOnlyList<WhatsAppMetaTemplateInfo> remoteTemplates;
        try
        {
            remoteTemplates = await client.ListApprovedMessageTemplatesAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            throw new ValidationException([
                new ValidationFailure("WhatsApp", $"Meta şablon listesi alınamadı: {ex.Message}")
            ]);
        }

        var existingMeta = await _dbContext.WhatsAppTemplates
            .Where(t => t.TenantId == tenantId && t.Channel == WhatsAppMetaTemplateConstants.Channel)
            .ToListAsync(cancellationToken);

        var imported = 0;
        var updated = 0;
        var seenKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var remote in remoteTemplates)
        {
            var name = remote.Name.Trim();
            if (string.IsNullOrWhiteSpace(name))
            {
                continue;
            }

            var language = string.IsNullOrWhiteSpace(remote.LanguageCode)
                ? "tr"
                : remote.LanguageCode.Trim();
            var key = $"{name}::{language}";
            if (!seenKeys.Add(key))
            {
                continue;
            }

            var match = existingMeta.FirstOrDefault(t =>
                string.Equals(t.Name, name, StringComparison.OrdinalIgnoreCase)
                && string.Equals(t.MetaLanguageCode ?? "tr", language, StringComparison.OrdinalIgnoreCase));

            // Plan: isme göre upsert — dil yoksa ada düş.
            match ??= existingMeta.FirstOrDefault(t =>
                string.Equals(t.Name, name, StringComparison.OrdinalIgnoreCase)
                && string.IsNullOrWhiteSpace(t.MetaLanguageCode));

            if (match is null)
            {
                var created = new WhatsAppMessageTemplate
                {
                    TemplateId = Guid.NewGuid(),
                    TenantId = tenantId,
                    Name = name,
                    Content = remote.BodyText?.Trim() ?? string.Empty,
                    IsActive = true,
                    Channel = WhatsAppMetaTemplateConstants.Channel,
                    IsGeneral = true,
                    AutoReply = false,
                    ReplyDelaySecs = 30,
                    HasKeyword = false,
                    QueryType = "(LIKE) İçerikte Geçsin",
                    KeywordsJson = "[]",
                    TimedReplyEnabled = false,
                    ActiveDaysJson = "[\"monday\",\"tuesday\",\"wednesday\",\"thursday\",\"friday\",\"saturday\",\"sunday\"]",
                    MetaLanguageCode = language,
                    MetaExternalId = remote.ExternalId,
                    MetaStatus = remote.Status,
                    CreatedByUserId = request.ActorUserId,
                };
                _dbContext.WhatsAppTemplates.Add(created);
                existingMeta.Add(created);
                imported++;
            }
            else
            {
                match.Name = name;
                match.Content = remote.BodyText?.Trim() ?? string.Empty;
                match.IsActive = true;
                match.Channel = WhatsAppMetaTemplateConstants.Channel;
                match.MetaLanguageCode = language;
                match.MetaExternalId = remote.ExternalId;
                match.MetaStatus = remote.Status;
                match.UpdatedByUserId = request.ActorUserId;
                updated++;
            }
        }

        var deactivated = 0;
        foreach (var local in existingMeta)
        {
            var language = string.IsNullOrWhiteSpace(local.MetaLanguageCode) ? "tr" : local.MetaLanguageCode;
            var key = $"{local.Name}::{language}";
            if (seenKeys.Contains(key))
            {
                continue;
            }

            if (local.IsActive)
            {
                local.IsActive = false;
                local.MetaStatus = local.MetaStatus is null ? "INACTIVE" : local.MetaStatus;
                local.UpdatedByUserId = request.ActorUserId;
                deactivated++;
            }
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return new WhatsAppTemplatesSyncFromMetaResult(imported, updated, deactivated);
    }
}
