using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Application.Abstractions.SocialMedia;
using CityCommunicationCenter.Application.Features.Social;
using CityCommunicationCenter.Domain.Entities;
using CityCommunicationCenter.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CityCommunicationCenter.Infrastructure.Services;

public sealed class CitizenJobStatusNotifier : ICitizenJobStatusNotifier
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ISocialMediaClientFactory _clientFactory;
    private readonly ITenantSmsSettingsService _smsSettingsService;
    private readonly ILogger<CitizenJobStatusNotifier> _logger;

    public CitizenJobStatusNotifier(
        IApplicationDbContext dbContext,
        ISocialMediaClientFactory clientFactory,
        ITenantSmsSettingsService smsSettingsService,
        ILogger<CitizenJobStatusNotifier> logger)
    {
        _dbContext = dbContext;
        _clientFactory = clientFactory;
        _smsSettingsService = smsSettingsService;
        _logger = logger;
    }

    public async Task NotifyCreatedAsync(
        Guid tenantId,
        SocialMessage message,
        Job job,
        int taskCount,
        CancellationToken cancellationToken = default)
    {
        if (job.RequestType != JobRequestType.Citizen && job.SourceType != JobSourceType.SocialMessage)
        {
            return;
        }

        if (message.Channel is not (SocialChannel.WhatsApp or SocialChannel.Phone))
        {
            return;
        }

        var utcNow = DateTimeOffset.UtcNow;
        var content = CitizenJobStatusLabelHelper.BuildStatusMessage(message, job, taskCount, utcNow);

        if (message.Channel == SocialChannel.WhatsApp)
        {
            await SendWhatsAppAsync(tenantId, message, content, utcNow, cancellationToken);
            return;
        }

        await SendSmsAsync(tenantId, message, content, cancellationToken);
    }

    private async Task SendWhatsAppAsync(
        Guid tenantId,
        SocialMessage message,
        string content,
        DateTimeOffset utcNow,
        CancellationToken cancellationToken)
    {
        var client = _clientFactory.GetClient(SocialChannel.WhatsApp, tenantId);
        if (client is null)
        {
            _logger.LogWarning(
                "WhatsApp client unavailable for tenant {TenantId} citizen status notification on SocialMessage {SocialMessageId}",
                tenantId,
                message.SocialMessageId);
            return;
        }

        var recipientPhone = await WhatsAppRecipientResolver.ResolveRecipientPhoneAsync(
            _dbContext,
            message,
            cancellationToken);

        if (string.IsNullOrWhiteSpace(recipientPhone))
        {
            _logger.LogWarning(
                "WhatsApp recipient phone not found for SocialMessage {SocialMessageId}",
                message.SocialMessageId);
            return;
        }

        var sendResult = await client.SendMessageAsync(new SendMessageRequest
        {
            RecipientId = recipientPhone,
            Message = content,
        }, cancellationToken);

        if (!sendResult.Success)
        {
            _logger.LogWarning(
                "WhatsApp citizen status notification failed for SocialMessage {SocialMessageId}: {Error}",
                message.SocialMessageId,
                sendResult.Error);
            return;
        }

        var tenantName = await _dbContext.Tenants
            .AsNoTracking()
            .Where(t => t.TenantId == tenantId)
            .Select(t => t.MunicipalityName)
            .FirstOrDefaultAsync(cancellationToken) ?? "Belediye";

        _dbContext.ConversationEntries.Add(new SocialConversationEntry
        {
            EntryId = Guid.NewGuid(),
            SocialMessageId = message.SocialMessageId,
            Direction = ConversationEntryDirection.Outbound,
            Content = content,
            SentAt = utcNow,
            ExternalEntryId = sendResult.MessageId,
            SenderLabel = tenantName,
            DeliveryStatus = ConversationDeliveryStatus.Sent,
            DeliveryStatusUpdatedAtUtc = utcNow,
        });

        message.ResponseContent = content;
        message.RespondedAtUtc = utcNow;
        if (message.Status is SocialMessageStatus.New or SocialMessageStatus.Routed)
        {
            message.Status = SocialMessageStatus.Responded;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task SendSmsAsync(
        Guid tenantId,
        SocialMessage message,
        string content,
        CancellationToken cancellationToken)
    {
        var smsSettings = await _smsSettingsService.GetSettingsAsync(tenantId, cancellationToken);
        if (!smsSettings.IsEnabled)
        {
            _logger.LogInformation(
                "SMS citizen status notification skipped (SMS disabled) for SocialMessage {SocialMessageId}: {Content}",
                message.SocialMessageId,
                content);
            return;
        }

        // SMS API entegrasyonu tenant ayarları tamamlandığında burada gönderilecek (card #992).
        _logger.LogInformation(
            "SMS citizen status notification queued for SocialMessage {SocialMessageId} via {Provider}: {Content}",
            message.SocialMessageId,
            smsSettings.Provider,
            content);
    }
}
