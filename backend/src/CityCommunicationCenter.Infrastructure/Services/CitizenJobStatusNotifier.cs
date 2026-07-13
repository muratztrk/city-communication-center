using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Application.Abstractions.SocialMedia;
using CityCommunicationCenter.Application.Features.Admin;
using CityCommunicationCenter.Application.Features.Social;
using CityCommunicationCenter.Domain.Entities;
using CityCommunicationCenter.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CityCommunicationCenter.Infrastructure.Services;

public sealed class CitizenJobStatusNotifier : ICitizenJobStatusNotifier
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantSmsSettingsService _smsSettingsService;
    private readonly INotificationPushService? _notificationPushService;
    private readonly ISocialMediaClientFactory _clientFactory;
    private readonly ILogger<CitizenJobStatusNotifier> _logger;

    public CitizenJobStatusNotifier(
        IApplicationDbContext dbContext,
        ITenantSmsSettingsService smsSettingsService,
        ISocialMediaClientFactory clientFactory,
        ILogger<CitizenJobStatusNotifier> logger,
        INotificationPushService? notificationPushService = null)
    {
        _dbContext = dbContext;
        _smsSettingsService = smsSettingsService;
        _clientFactory = clientFactory;
        _notificationPushService = notificationPushService;
        _logger = logger;
    }

    public async Task NotifyCreatedAsync(
        Guid tenantId,
        SocialMessage message,
        Job job,
        int taskCount,
        CancellationToken cancellationToken = default)
    {
        await NotifyCurrentStatusAsync(tenantId, message, job, taskCount, cancellationToken);
    }

    public async Task NotifyStatusChangedAsync(
        Guid tenantId,
        Guid jobId,
        string previousDisplayStatus,
        CancellationToken cancellationToken = default)
    {
        var job = await _dbContext.Jobs.FirstOrDefaultAsync(
            entity => entity.JobId == jobId && entity.TenantId == tenantId,
            cancellationToken);
        if (job is null)
        {
            return;
        }

        var taskCount = await _dbContext.Tasks
            .AsNoTracking()
            .CountAsync(entity => entity.JobId == job.JobId && entity.TenantId == tenantId, cancellationToken);

        var utcNow = DateTimeOffset.UtcNow;
        var currentDisplayStatus = CitizenJobStatusLabelHelper.GetDisplayStatus(job, taskCount, utcNow);
        if (string.Equals(currentDisplayStatus, previousDisplayStatus, StringComparison.Ordinal))
        {
            return;
        }

        if (!IsSupportedAutoReplyStatus(currentDisplayStatus))
        {
            return;
        }

        var message = await _dbContext.SocialMessages.FirstOrDefaultAsync(
            entity => entity.TenantId == tenantId
                && (entity.JobId == job.JobId
                    || (job.SourceRefId.HasValue && entity.SocialMessageId == job.SourceRefId.Value)),
            cancellationToken);
        if (message is null)
        {
            return;
        }

        await NotifyCurrentStatusAsync(tenantId, message, job, taskCount, cancellationToken);
    }

    private async Task NotifyCurrentStatusAsync(
        Guid tenantId,
        SocialMessage message,
        Job job,
        int taskCount,
        CancellationToken cancellationToken)
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
        var template = await ResolveTemplateAsync(tenantId, job, taskCount, utcNow, cancellationToken);
        if (template is null)
        {
            return;
        }

        var content = CitizenJobStatusLabelHelper.BuildStatusMessage(
            message,
            job,
            taskCount,
            utcNow,
            template);
        var statusLabel = CitizenJobStatusLabelHelper.GetDisplayStatus(job, taskCount, utcNow);

        if (message.Channel == SocialChannel.WhatsApp)
        {
            // Aynı vatandaş talebi + aynı durum için oluşturulan metin ikinci kez kuyruğa
            // girmesin/gönderilmesin. Failed kayıt yeniden denemeyi engellemez.
            var alreadyCreated = await _dbContext.ConversationEntries
                .AsNoTracking()
                .AnyAsync(
                    entry => entry.SocialMessageId == message.SocialMessageId
                        && entry.Direction == ConversationEntryDirection.Outbound
                        && entry.Content == content
                        && entry.DeliveryStatus != ConversationDeliveryStatus.Failed,
                    cancellationToken);
            if (alreadyCreated)
            {
                _logger.LogInformation(
                    "Skipping duplicate automatic WhatsApp status message for SocialMessage {SocialMessageId}, status {StatusLabel}",
                    message.SocialMessageId,
                    statusLabel);
                return;
            }

            await SendWhatsAppAsync(
                tenantId,
                message,
                content,
                utcNow,
                requiresOperatorApproval: IsTerminalStatus(statusLabel),
                cancellationToken);
            return;
        }

        await SendSmsAsync(tenantId, message, content, cancellationToken);
    }

    private async Task<string?> ResolveTemplateAsync(
        Guid tenantId,
        Job job,
        int taskCount,
        DateTimeOffset utcNow,
        CancellationToken cancellationToken)
    {
        var raw = await _dbContext.TenantSettings
            .AsNoTracking()
            .Where(setting => setting.TenantId == tenantId)
            .Select(setting => setting.CitizenAutoReplyTemplatesJson)
            .FirstOrDefaultAsync(cancellationToken);
        var templates = CitizenAutoReplyTemplateJson.ParseOrDefault(raw);
        var statusLabel = CitizenJobStatusLabelHelper.GetDisplayStatus(job, taskCount, utcNow);
        return statusLabel switch
        {
            "İşleme Alındı" => templates.ProcessingReceived,
            "Yapılmakta" => templates.InProgress,
            "Tamamlanmış" or "Tamamlandı" => templates.Completed,
            "İptal" => templates.Cancelled,
            _ => null,
        };
    }

    private static bool IsSupportedAutoReplyStatus(string statusLabel) =>
        statusLabel is "İşleme Alındı" or "Yapılmakta" or "Tamamlanmış" or "Tamamlandı" or "İptal";

    private static bool IsTerminalStatus(string statusLabel) =>
        statusLabel is "Tamamlanmış" or "Tamamlandı" or "İptal" or "İptal Edildi";

    private async Task SendWhatsAppAsync(
        Guid tenantId,
        SocialMessage message,
        string content,
        DateTimeOffset utcNow,
        bool requiresOperatorApproval,
        CancellationToken cancellationToken)
    {
        var tenantName = await _dbContext.Tenants
            .AsNoTracking()
            .Where(t => t.TenantId == tenantId)
            .Select(t => t.MunicipalityName)
            .FirstOrDefaultAsync(cancellationToken) ?? "Belediye";

        SocialMediaResult? sendResult = null;
        if (!requiresOperatorApproval)
        {
            var recipientPhone = await WhatsAppRecipientResolver.ResolveRecipientPhoneAsync(
                _dbContext,
                message,
                cancellationToken);
            var client = _clientFactory.GetClient(SocialChannel.WhatsApp, tenantId);
            sendResult = string.IsNullOrWhiteSpace(recipientPhone) || client is null
                ? SocialMediaResult.Fail(string.IsNullOrWhiteSpace(recipientPhone)
                    ? "WhatsApp alıcı telefonu bulunamadı."
                    : "WhatsApp kanalı yapılandırılmadı.")
                : await client.SendMessageAsync(new SendMessageRequest
                {
                    RecipientId = recipientPhone,
                    Message = content,
                }, cancellationToken);
        }

        _dbContext.ConversationEntries.Add(new SocialConversationEntry
        {
            EntryId = Guid.NewGuid(),
            SocialMessageId = message.SocialMessageId,
            Direction = ConversationEntryDirection.Outbound,
            Content = content,
            SentAt = utcNow,
            ExternalEntryId = sendResult?.MessageId,
            SenderLabel = tenantName,
            DeliveryStatus = requiresOperatorApproval
                ? ConversationDeliveryStatus.Pending
                : sendResult!.Success
                    ? ConversationDeliveryStatus.Sent
                    : ConversationDeliveryStatus.Failed,
            DeliveryError = requiresOperatorApproval || sendResult!.Success ? null : sendResult.Error,
            DeliveryStatusUpdatedAtUtc = utcNow,
        });

        if (sendResult?.Success == true)
        {
            message.ResponseContent = content;
            message.RespondedAtUtc = utcNow;
            if (message.Status is SocialMessageStatus.New or SocialMessageStatus.Routed)
            {
                message.Status = SocialMessageStatus.Responded;
            }
        }
        else if (!requiresOperatorApproval)
        {
            _logger.LogWarning(
                "Automatic WhatsApp status message failed for SocialMessage {SocialMessageId}: {Error}",
                message.SocialMessageId,
                sendResult!.Error);
        }

        WhatsAppMessagePayload? pendingPush = null;
        if (message.CitizenConversationId is Guid conversationId)
        {
            var conversation = await _dbContext.CitizenConversations
                .FirstOrDefaultAsync(
                    entity => entity.CitizenConversationId == conversationId && entity.TenantId == tenantId,
                    cancellationToken);
            if (conversation is not null)
            {
                if (utcNow > conversation.LastMessageAt)
                {
                    conversation.LastMessageAt = utcNow;
                }

                conversation.UnreadCount += 1;
                pendingPush = new WhatsAppMessagePayload(
                    conversation.CitizenConversationId,
                    conversation.CitizenPhone,
                    conversation.CitizenName,
                    content,
                    conversation.UnreadCount,
                    conversation.LastMessageAt);
            }
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        if (_notificationPushService is not null && pendingPush is not null)
        {
            await _notificationPushService.SendWhatsAppMessageToTenantAsync(
                tenantId,
                pendingPush,
                cancellationToken);
        }
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
