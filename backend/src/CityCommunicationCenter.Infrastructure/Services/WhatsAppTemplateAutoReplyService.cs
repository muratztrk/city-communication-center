using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Application.Abstractions.SocialMedia;
using CityCommunicationCenter.Domain;
using CityCommunicationCenter.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

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

                var template = templates.FirstOrDefault(t =>
                    WhatsAppTemplateAutoReply.IsEligible(t, inboundContent, receivedAtUtc, IstanbulTimeZone));

                if (template is null)
                    return;

                var alreadySent = await dbContext.ConversationEntries
                    .AsNoTracking()
                    .AnyAsync(
                        e => e.SocialMessageId == socialMessageId
                             && e.Direction == ConversationEntryDirection.Outbound
                             && e.Content == template.Content,
                        CancellationToken.None);

                if (alreadySent)
                    return;

                if (template.ReplyDelaySecs > 0)
                    await Task.Delay(TimeSpan.FromSeconds(template.ReplyDelaySecs), CancellationToken.None);

                var client = clientFactory.GetClient(SocialChannel.WhatsApp, tenantId);
                if (client is null)
                    return;

                var sendResult = await client.SendMessageAsync(new SendMessageRequest
                {
                    RecipientId = citizenHandle,
                    Message = template.Content,
                }, CancellationToken.None);

                var entry = new SocialConversationEntry
                {
                    EntryId = Guid.NewGuid(),
                    SocialMessageId = socialMessageId,
                    Direction = ConversationEntryDirection.Outbound,
                    Content = template.Content,
                    SentAt = DateTimeOffset.UtcNow,
                    ExternalEntryId = sendResult.Success ? sendResult.MessageId : null,
                };

                dbContext.ConversationEntries.Add(entry);

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
