using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Application.Abstractions.SocialMedia;
using CityCommunicationCenter.Application.Features.Admin;
using CityCommunicationCenter.Application.Features.Attachments;
using CityCommunicationCenter.Application.Features.Social;
using CityCommunicationCenter.Domain.Entities;
using CityCommunicationCenter.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace CityCommunicationCenter.Infrastructure.Services;

public sealed class CitizenJobStatusNotifier : ICitizenJobStatusNotifier
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantSmsSettingsService _smsSettingsService;
    private readonly ISmsGateway _smsGateway;
    private readonly INotificationPushService? _notificationPushService;
    private readonly ISocialMediaClientFactory _clientFactory;
    private readonly string _uploadRootPath;
    private readonly ILogger<CitizenJobStatusNotifier> _logger;

    public CitizenJobStatusNotifier(
        IApplicationDbContext dbContext,
        ITenantSmsSettingsService smsSettingsService,
        ISmsGateway smsGateway,
        ISocialMediaClientFactory clientFactory,
        IOptions<AttachmentStorageOptions> attachmentStorageOptions,
        ILogger<CitizenJobStatusNotifier> logger,
        INotificationPushService? notificationPushService = null)
    {
        _dbContext = dbContext;
        _smsSettingsService = smsSettingsService;
        _smsGateway = smsGateway;
        _clientFactory = clientFactory;
        _uploadRootPath = attachmentStorageOptions.Value.UploadRootPath;
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

    public async Task ReleaseTerminalMessagesAsync(
        Guid tenantId,
        Guid jobId,
        CancellationToken cancellationToken = default)
    {
        var job = await _dbContext.Jobs.FirstOrDefaultAsync(
            entity => entity.JobId == jobId && entity.TenantId == tenantId,
            cancellationToken);
        if (job is null)
        {
            return;
        }

        if (job.CitizenTerminalMessageReleasedAtUtc is not null)
        {
            // Idempotent: zaten serbest bırakılmış.
            return;
        }

        var utcNow = DateTimeOffset.UtcNow;
        var taskCount = await _dbContext.Tasks
            .AsNoTracking()
            .CountAsync(entity => entity.JobId == job.JobId && entity.TenantId == tenantId, cancellationToken);
        var statusLabel = CitizenJobStatusLabelHelper.GetDisplayStatus(job, taskCount, utcNow);
        if (!RequiresOperatorApproval(statusLabel))
        {
            job.CitizenTerminalMessageReleasedAtUtc = utcNow;
            await _dbContext.SaveChangesAsync(cancellationToken);
            return;
        }

        var message = await _dbContext.SocialMessages
            .Where(entity => entity.TenantId == tenantId
                && (entity.JobId == job.JobId
                    || (job.SourceRefId.HasValue && entity.SocialMessageId == job.SourceRefId.Value))
                && (entity.Channel == SocialChannel.WhatsApp || entity.Channel == SocialChannel.Phone))
            .OrderByDescending(entity => entity.ReceivedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);
        if (message is not null)
        {
            // Şablon yoksa BuildStatusMessage varsayılan metni kullanır; release yine Pending
            // kuyruğa düşmeli (card #2058 reopen — operatör WA ekranına iletilmeli).
            var template = await ResolveTemplateAsync(tenantId, job, taskCount, utcNow, cancellationToken);
            var targetDepartmentNames = await _dbContext.JobDepartments
                .AsNoTracking()
                .Where(link => link.TenantId == tenantId
                    && link.JobId == job.JobId
                    && link.Role == JobDepartmentRole.Target
                    && link.ApprovalStatus != JobApprovalStatus.Rejected)
                .OrderBy(link => link.Department.Name)
                .Select(link => link.Department.Name)
                .Distinct()
                .ToListAsync(cancellationToken);
            var content = CitizenJobStatusLabelHelper.BuildStatusMessage(
                message,
                job,
                taskCount,
                utcNow,
                template,
                string.Join(", ", targetDepartmentNames));

            if (message.Channel == SocialChannel.WhatsApp)
            {
                var statusContentPrefix = content.TrimEnd();
                var alreadyCreated = await _dbContext.ConversationEntries
                    .AsNoTracking()
                    .AnyAsync(
                        entry => entry.SocialMessageId == message.SocialMessageId
                            && entry.Direction == ConversationEntryDirection.Outbound
                            && (entry.Content == content
                                || entry.Content == statusContentPrefix
                                || entry.Content.StartsWith(statusContentPrefix + "\n\n"))
                            && entry.DeliveryStatus != ConversationDeliveryStatus.Failed,
                        cancellationToken);
                if (!alreadyCreated)
                {
                    await SendWhatsAppAsync(tenantId, message, job, content, statusLabel, utcNow, cancellationToken);
                }
                else
                {
                    // Durum mesajı zaten varsa not/ek follow-up yine kuyruğa alınsın.
                    var tenantName = await _dbContext.Tenants
                        .AsNoTracking()
                        .Where(t => t.TenantId == tenantId)
                        .Select(t => t.MunicipalityName)
                        .FirstOrDefaultAsync(cancellationToken) ?? "Belediye";
                    await EnqueueTerminalFollowUpsAsync(tenantId, message, job, statusLabel, tenantName, utcNow, cancellationToken);
                }
            }
            else
            {
                // SMS gitmediyse release işaretlenmez; aksi halde operatör bir daha
                // "Mesajı Gönder" diyemez ve vatandaş kapanış bilgisini hiç alamaz.
                var smsSent = await SendSmsAsync(tenantId, message, content, cancellationToken);
                if (!smsSent)
                {
                    return;
                }
            }
        }

        job.CitizenTerminalMessageReleasedAtUtc = DateTimeOffset.UtcNow;
        await _dbContext.SaveChangesAsync(cancellationToken);
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
        var statusLabelForDeferralCheck = CitizenJobStatusLabelHelper.GetDisplayStatus(job, taskCount, utcNow);
        if (RequiresOperatorApproval(statusLabelForDeferralCheck))
        {
            // Terminal (Tamamlanmış/İptal) otomatik mesajlar artık burada otomatik kuyruğa girmez;
            // Manager/CRM "Vatandaşa Gönderilecek Mesaj Onayı" ekranından `Mesajı Gönder` ile
            // ReleaseTerminalMessagesAsync çağırana kadar bekletilir (card #2039).
            _logger.LogInformation(
                "Deferring citizen terminal status message for Job {JobId} until Manager/CRM release ({StatusLabel})",
                job.JobId,
                statusLabelForDeferralCheck);
            return;
        }

        var template = await ResolveTemplateAsync(tenantId, job, taskCount, utcNow, cancellationToken);
        if (template is null)
        {
            return;
        }

        var targetDepartmentNames = await _dbContext.JobDepartments
            .AsNoTracking()
            .Where(link => link.TenantId == tenantId
                && link.JobId == job.JobId
                && link.Role == JobDepartmentRole.Target
                && link.ApprovalStatus != JobApprovalStatus.Rejected)
            .OrderBy(link => link.Department.Name)
            .Select(link => link.Department.Name)
            .Distinct()
            .ToListAsync(cancellationToken);
        var content = CitizenJobStatusLabelHelper.BuildStatusMessage(
            message,
            job,
            taskCount,
            utcNow,
            template,
            string.Join(", ", targetDepartmentNames));
        var statusLabel = CitizenJobStatusLabelHelper.GetDisplayStatus(job, taskCount, utcNow);

        if (message.Channel == SocialChannel.WhatsApp)
        {
            var statusContentPrefix = content.TrimEnd();
            var alreadyCreated = await _dbContext.ConversationEntries
                .AsNoTracking()
                .AnyAsync(
                    entry => entry.SocialMessageId == message.SocialMessageId
                        && entry.Direction == ConversationEntryDirection.Outbound
                        && (entry.Content == content
                            || entry.Content == statusContentPrefix
                            || entry.Content.StartsWith(statusContentPrefix + "\n\n"))
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
                job,
                content,
                statusLabel,
                utcNow,
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

    private static bool RequiresOperatorApproval(string statusLabel) =>
        statusLabel is "Tamamlanmış" or "Tamamlandı" or "İptal";

    private async Task SendWhatsAppAsync(
        Guid tenantId,
        SocialMessage message,
        Job job,
        string content,
        string statusLabel,
        DateTimeOffset utcNow,
        CancellationToken cancellationToken)
    {
        var tenantName = await _dbContext.Tenants
            .AsNoTracking()
            .Where(t => t.TenantId == tenantId)
            .Select(t => t.MunicipalityName)
            .FirstOrDefaultAsync(cancellationToken) ?? "Belediye";

        var requireApproval = RequiresOperatorApproval(statusLabel);
        SocialMediaResult? sendResult = null;

        // Terminal notu durum mesajının altına 1 boş satırla ekle (#2103) — ayrı balon yok.
        var messageContent = content;
        if (requireApproval)
        {
            var terminalNote = await ResolveTerminalNoteAsync(tenantId, job, statusLabel, cancellationToken);
            if (!string.IsNullOrWhiteSpace(terminalNote))
            {
                messageContent = $"{content.TrimEnd()}\n\n{terminalNote.Trim()}";
            }
        }

        if (!requireApproval)
        {
            var recipientPhone = await WhatsAppRecipientResolver.ResolveRecipientPhoneAsync(
                _dbContext,
                message,
                cancellationToken);
            var client = _clientFactory.GetClient(SocialChannel.WhatsApp, tenantId);
            if (string.IsNullOrWhiteSpace(recipientPhone) || client is null)
            {
                sendResult = SocialMediaResult.Fail(string.IsNullOrWhiteSpace(recipientPhone)
                    ? "WhatsApp alıcı telefonu bulunamadı."
                    : "WhatsApp kanalı yapılandırılmadı.");
            }
            else
            {
                sendResult = await client.SendMessageAsync(new SendMessageRequest
                {
                    RecipientId = recipientPhone,
                    Message = messageContent,
                }, cancellationToken);
            }
        }

        _dbContext.ConversationEntries.Add(new SocialConversationEntry
        {
            EntryId = Guid.NewGuid(),
            SocialMessageId = message.SocialMessageId,
            Direction = ConversationEntryDirection.Outbound,
            Content = messageContent,
            SentAt = utcNow,
            ExternalEntryId = sendResult?.MessageId,
            SenderLabel = tenantName,
            DeliveryStatus = requireApproval
                ? ConversationDeliveryStatus.Pending
                : sendResult is { Success: true }
                    ? ConversationDeliveryStatus.Sent
                    : ConversationDeliveryStatus.Failed,
            DeliveryError = requireApproval || sendResult is { Success: true } ? null : sendResult?.Error,
            DeliveryStatusUpdatedAtUtc = utcNow,
        });

        if (!requireApproval && sendResult is { Success: true })
        {
            message.ResponseContent = messageContent;
            message.RespondedAtUtc = utcNow;
            if (message.Status is SocialMessageStatus.New or SocialMessageStatus.Routed)
            {
                message.Status = SocialMessageStatus.Responded;
            }
        }
        else if (!requireApproval && sendResult is { Success: false })
        {
            _logger.LogWarning(
                "Automatic WhatsApp status message failed for SocialMessage {SocialMessageId}: {Error}",
                message.SocialMessageId,
                sendResult.Error);
        }

        if (requireApproval)
        {
            await EnqueueTerminalFollowUpsAsync(tenantId, message, job, statusLabel, tenantName, utcNow, cancellationToken);
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
                    messageContent,
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

    private async Task<string?> ResolveTerminalNoteAsync(
        Guid tenantId,
        Job job,
        string statusLabel,
        CancellationToken cancellationToken)
    {
        var isCancelled = statusLabel is "İptal";
        if (isCancelled)
        {
            return !string.IsNullOrWhiteSpace(job.CancelReason)
                ? job.CancelReason
                : await _dbContext.Tasks
                    .AsNoTracking()
                    .Where(t => t.TenantId == tenantId
                        && t.JobId == job.JobId
                        && t.CurrentStatus == Domain.Enums.TaskStatus.Cancelled)
                    .OrderByDescending(t => t.UpdatedAtUtc)
                    .Select(t => t.RevisionReason)
                    .FirstOrDefaultAsync(cancellationToken);
        }

        return await _dbContext.Tasks
                .AsNoTracking()
                .Where(t => t.TenantId == tenantId
                    && t.JobId == job.JobId
                    && (t.CompletedAtUtc != null || t.CurrentStatus == Domain.Enums.TaskStatus.Completed))
                .OrderByDescending(t => t.CompletedAtUtc ?? t.UpdatedAtUtc)
                .Select(t => t.Notes)
                .FirstOrDefaultAsync(cancellationToken)
            ?? await _dbContext.Tasks
                .AsNoTracking()
                .Where(t => t.TenantId == tenantId && t.JobId == job.JobId)
                .OrderByDescending(t => t.UpdatedAtUtc)
                .Select(t => t.Notes)
                .FirstOrDefaultAsync(cancellationToken);
    }

    private async Task EnqueueTerminalFollowUpsAsync(
        Guid tenantId,
        SocialMessage message,
        Job job,
        string statusLabel,
        string tenantName,
        DateTimeOffset utcNow,
        CancellationToken cancellationToken)
    {
        // Terminal not ayrı mesaj olarak eklenmez — durum mesajına gömülür (#2103).
        // Burada yalnız tamamlanma ekleri (medya) kuyruğa alınır.
        var isCancelled = statusLabel is "İptal";
        if (isCancelled)
        {
            return;
        }

        var completedTaskIds = await _dbContext.Tasks
            .AsNoTracking()
            .Where(t => t.TenantId == tenantId
                && t.JobId == job.JobId
                && t.CompletedAtUtc != null)
            .Select(t => t.TaskId)
            .ToListAsync(cancellationToken);

        var attachmentRows = completedTaskIds.Count > 0
            ? await _dbContext.Attachments
                .AsNoTracking()
                .Where(a => a.TenantId == tenantId
                    && a.EntityType == "Task"
                    && completedTaskIds.Contains(a.EntityId))
                .OrderBy(a => a.CreatedAtUtc)
                .Select(a => new { a.FileName, a.ContentType, a.RelativeUrl })
                .ToListAsync(cancellationToken)
            : [];

        for (var index = 0; index < attachmentRows.Count; index++)
        {
            var attachment = attachmentRows[index];
            var entryId = Guid.NewGuid();
            var localMediaId = ConversationLocalMediaStore.BuildLocalMediaId(tenantId, entryId, attachment.FileName);
            var sourceFullPath = ResolveAttachmentFullPath(attachment.RelativeUrl);
            if (sourceFullPath is null || !File.Exists(sourceFullPath))
            {
                _logger.LogWarning(
                    "Task attachment file missing for WhatsApp pending enqueue: {Url}",
                    attachment.RelativeUrl);
                continue;
            }

            await ConversationLocalMediaStore.SaveFromFileAsync(
                _uploadRootPath,
                localMediaId,
                sourceFullPath,
                cancellationToken);

            _dbContext.ConversationEntries.Add(new SocialConversationEntry
            {
                EntryId = entryId,
                SocialMessageId = message.SocialMessageId,
                Direction = ConversationEntryDirection.Outbound,
                Content = $"[Dosya eki: {attachment.FileName}]",
                SentAt = utcNow.AddMilliseconds(index + 1),
                SenderLabel = tenantName,
                MediaId = localMediaId,
                MediaMimeType = string.IsNullOrWhiteSpace(attachment.ContentType)
                    ? "application/octet-stream"
                    : attachment.ContentType,
                DeliveryStatus = ConversationDeliveryStatus.Pending,
                DeliveryStatusUpdatedAtUtc = utcNow,
            });
        }
    }

    private string? ResolveAttachmentFullPath(string relativeUrl)
    {
        if (string.IsNullOrWhiteSpace(relativeUrl))
        {
            return null;
        }

        var trimmed = relativeUrl.TrimStart('/');
        // RelativeUrl: /uploads/{tenant}/... ; UploadRootPath: .../uploads
        if (trimmed.StartsWith("uploads/", StringComparison.OrdinalIgnoreCase))
        {
            trimmed = trimmed["uploads/".Length..];
        }

        var candidate = Path.Combine(_uploadRootPath, trimmed.Replace('/', Path.DirectorySeparatorChar));
        if (File.Exists(candidate))
        {
            return candidate;
        }

        var contentRootSibling = Path.Combine(
            Path.GetDirectoryName(_uploadRootPath) ?? _uploadRootPath,
            relativeUrl.TrimStart('/').Replace('/', Path.DirectorySeparatorChar));
        return File.Exists(contentRootSibling) ? contentRootSibling : candidate;
    }

    /// <returns>SMS gerçekten gönderildiyse <c>true</c>.</returns>
    private async Task<bool> SendSmsAsync(
        Guid tenantId,
        SocialMessage message,
        string content,
        CancellationToken cancellationToken)
    {
        var smsSettings = await _smsSettingsService.GetSettingsAsync(tenantId, cancellationToken);
        if (!smsSettings.IsEnabled)
        {
            _logger.LogInformation(
                "SMS citizen status notification skipped (SMS disabled) for SocialMessage {SocialMessageId}",
                message.SocialMessageId);
            return false;
        }

        // WhatsApp ile aynı çözümleme sırası: vatandaş konuşmasındaki telefon → CitizenHandle.
        var recipientPhone = await WhatsAppRecipientResolver.ResolveRecipientPhoneAsync(
            _dbContext,
            message,
            cancellationToken);
        if (string.IsNullOrWhiteSpace(recipientPhone))
        {
            _logger.LogWarning(
                "SMS citizen status notification has no recipient phone for SocialMessage {SocialMessageId}",
                message.SocialMessageId);
            return false;
        }

        // Tekrar gönderimi ATOMİK olarak engelle: SMS ücretli ve vatandaşa gidiyor. Önce
        // koşullu UPDATE ile "bu metni ben gönderiyorum" hakkı alınır; iki eşzamanlı durum
        // bildiriminden yalnız biri satırı günceller, diğeri 0 satır görüp çıkar. (Oku-sonra-yaz
        // yapsaydık ikisi de kontrolü geçip iki SMS gönderebilirdi.)
        var utcNow = DateTimeOffset.UtcNow;
        var previousResponseContent = message.ResponseContent;
        var previousRespondedAtUtc = message.RespondedAtUtc;
        var claimed = await _dbContext.SocialMessages
            .Where(entity => entity.SocialMessageId == message.SocialMessageId
                && entity.TenantId == tenantId
                && entity.ResponseContent != content)
            .ExecuteUpdateAsync(
                setters => setters
                    .SetProperty(entity => entity.ResponseContent, content)
                    .SetProperty(entity => entity.RespondedAtUtc, utcNow),
                cancellationToken);

        if (claimed == 0)
        {
            _logger.LogInformation(
                "Skipping duplicate citizen status SMS for SocialMessage {SocialMessageId}",
                message.SocialMessageId);
            return false;
        }

        var result = await _smsGateway.SendAsync(tenantId, recipientPhone, content, cancellationToken);
        if (!result.Success)
        {
            // Hak geri verilir ki operatör/işleyiş tekrar deneyebilsin.
            await _dbContext.SocialMessages
                .Where(entity => entity.SocialMessageId == message.SocialMessageId && entity.TenantId == tenantId)
                .ExecuteUpdateAsync(
                    setters => setters
                        .SetProperty(entity => entity.ResponseContent, previousResponseContent)
                        .SetProperty(entity => entity.RespondedAtUtc, previousRespondedAtUtc),
                    cancellationToken);

            // Gönderim hatası iş akışını durdurmaz; talep/görev akışı SMS'e bağlı değil.
            _logger.LogWarning(
                "SMS citizen status notification failed for SocialMessage {SocialMessageId}: {Message}",
                message.SocialMessageId,
                result.Message);
            return false;
        }

        message.ResponseContent = content;
        message.RespondedAtUtc = utcNow;
        if (message.Status is SocialMessageStatus.New or SocialMessageStatus.Routed)
        {
            message.Status = SocialMessageStatus.Responded;
            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        _logger.LogInformation(
            "SMS citizen status notification sent for SocialMessage {SocialMessageId} via {Provider} ({Code})",
            message.SocialMessageId,
            smsSettings.Provider,
            result.ProviderCode);
        return true;
    }

}
