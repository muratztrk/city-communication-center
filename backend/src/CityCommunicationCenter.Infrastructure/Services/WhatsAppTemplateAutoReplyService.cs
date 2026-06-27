using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Application.Abstractions.SocialMedia;
using CityCommunicationCenter.Domain;
using CityCommunicationCenter.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

using CityCommunicationCenter.Application.Features.Social;

namespace CityCommunicationCenter.Infrastructure.Services;

public sealed class WhatsAppTemplateAutoReplyService : IWhatsAppTemplateAutoReplyService
{
    private static readonly TimeZoneInfo IstanbulTimeZone = TimeZoneInfo.FindSystemTimeZoneById(
        OperatingSystem.IsWindows() ? "Turkey Standard Time" : "Europe/Istanbul");

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<WhatsAppTemplateAutoReplyService> _logger;

    public WhatsAppTemplateAutoReplyService(
        IServiceScopeFactory scopeFactory,
        ILogger<WhatsAppTemplateAutoReplyService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    public Task ScheduleForInboundMessageAsync(
        Guid tenantId,
        Guid socialMessageId,
        string citizenHandle,
        string inboundContent,
        DateTimeOffset receivedAtUtc,
        CancellationToken cancellationToken = default)
    {
        _ = Task.Run(async () =>
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var dbContext = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();
                var clientFactory = scope.ServiceProvider.GetRequiredService<ISocialMediaClientFactory>();

                var templates = await dbContext.WhatsAppTemplates
                    .AsNoTracking()
                    .Where(t => t.TenantId == tenantId && t.IsActive)
                    .OrderByDescending(t => t.IsGeneral)
                    .ThenBy(t => t.Name)
                    .ToListAsync(CancellationToken.None);

                var selectedTemplates = WhatsAppTemplateAutoReply.SelectTemplatesForInbound(
                    templates,
                    inboundContent,
                    receivedAtUtc,
                    IstanbulTimeZone);

                if (selectedTemplates.Count == 0)
                {
                    _logger.LogDebug(
                        "No eligible WhatsApp auto-reply template for SocialMessage {SocialMessageId}",
                        socialMessageId);
                    return;
                }

                var client = clientFactory.GetClient(SocialChannel.WhatsApp, tenantId);
                if (client is null)
                {
                    _logger.LogWarning(
                        "WhatsApp client unavailable for tenant {TenantId} auto-reply on SocialMessage {SocialMessageId}",
                        tenantId,
                        socialMessageId);
                    return;
                }

                foreach (var template in selectedTemplates)
                {
                    var alreadySent = await dbContext.ConversationEntries
                        .AsNoTracking()
                        .AnyAsync(
                            e => e.SocialMessageId == socialMessageId
                                 && e.Direction == ConversationEntryDirection.Outbound
                                 && e.Content == template.Content,
                            CancellationToken.None);

                    if (alreadySent)
                        continue;

                    if (template.ReplyDelaySecs > 0)
                        await Task.Delay(TimeSpan.FromSeconds(template.ReplyDelaySecs), CancellationToken.None);

                    var sendResult = await client.SendMessageAsync(new SendMessageRequest
                    {
                        RecipientId = citizenHandle,
                        Message = template.Content,
                    }, CancellationToken.None);

                    if (!sendResult.Success)
                    {
                        _logger.LogWarning(
                            "WhatsApp auto-reply send failed for template {TemplateName} on SocialMessage {SocialMessageId}: {Error}",
                            template.Name,
                            socialMessageId,
                            sendResult.Error);
                        continue;
                    }

                    var tenantName = await dbContext.Tenants
                        .AsNoTracking()
                        .Where(t => t.TenantId == tenantId)
                        .Select(t => t.MunicipalityName)
                        .FirstOrDefaultAsync(CancellationToken.None) ?? "Belediye";

                    dbContext.ConversationEntries.Add(new SocialConversationEntry
                    {
                        EntryId = Guid.NewGuid(),
                        SocialMessageId = socialMessageId,
                        Direction = ConversationEntryDirection.Outbound,
                        Content = template.Content,
                        SentAt = DateTimeOffset.UtcNow,
                        ExternalEntryId = sendResult.MessageId,
                        SenderLabel = tenantName,
                    });

                    var message = await dbContext.SocialMessages
                        .FirstOrDefaultAsync(m => m.SocialMessageId == socialMessageId, CancellationToken.None);

                    if (message is not null)
                    {
                        message.ResponseContent = template.Content;
                        message.RespondedAtUtc = DateTimeOffset.UtcNow;
                        if (message.Status is SocialMessageStatus.New or SocialMessageStatus.Routed)
                            message.Status = SocialMessageStatus.Responded;
                    }

                    await dbContext.SaveChangesAsync(CancellationToken.None);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "WhatsApp template auto-reply failed for SocialMessage {SocialMessageId}",
                    socialMessageId);
            }
        }, cancellationToken);

        return Task.CompletedTask;
    }
}
