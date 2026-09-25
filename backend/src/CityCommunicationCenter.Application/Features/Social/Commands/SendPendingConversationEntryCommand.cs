using CityCommunicationCenter.Application.Features.Attachments;
using CityCommunicationCenter.Application.Features.Users;
using Microsoft.Extensions.Options;

namespace CityCommunicationCenter.Application.Features.Social;

// Beklemede (kuyruğa alınmış) bir WhatsApp yanıtını vatandaşa iletir. Yalnızca Vatandaş
// Operatörü veya Sistem Yöneticisi gönderebilir (card #1091).
public sealed record SendPendingConversationEntryCommand(
    Guid SocialMessageId,
    Guid EntryId,
    Guid? ActorUserId) : ICommand<SendPendingConversationEntryResult>;

public sealed record SendPendingConversationEntryResult(bool Found, bool Sent);

public sealed class SendPendingConversationEntryCommandHandler
    : ICommandHandler<SendPendingConversationEntryCommand, SendPendingConversationEntryResult>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;
    private readonly ISocialMediaClientFactory _clientFactory;
    private readonly string _uploadRootPath;

    public SendPendingConversationEntryCommandHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor,
        ISocialMediaClientFactory clientFactory,
        IOptions<AttachmentStorageOptions> attachmentStorageOptions)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
        _clientFactory = clientFactory;
        _uploadRootPath = attachmentStorageOptions.Value.UploadRootPath;
    }

    public async ValueTask<SendPendingConversationEntryResult> Handle(SendPendingConversationEntryCommand request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();
        var actor = await ActorAuthorization.RequireActiveActorAsync(_dbContext, request.ActorUserId, tenantId, cancellationToken);

        if (actor.RoleCode != RoleCode.Operator && actor.RoleCode != RoleCode.SystemAdmin)
        {
            throw new ForbiddenAccessException("Bekleyen mesajı yalnızca Vatandaş Talep Operatörü veya Sistem Yöneticisi gönderebilir.");
        }

        var message = await _dbContext.SocialMessages.FirstOrDefaultAsync(
            m => m.SocialMessageId == request.SocialMessageId && m.TenantId == tenantId, cancellationToken);
        if (message is null) return new SendPendingConversationEntryResult(false, false);

        var entry = await _dbContext.ConversationEntries.FirstOrDefaultAsync(
            e => e.EntryId == request.EntryId && e.SocialMessageId == request.SocialMessageId, cancellationToken);
        if (entry is null) return new SendPendingConversationEntryResult(false, false);

        var utcNow = DateTimeOffset.UtcNow;
        var windowOpen = message.Channel == SocialChannel.WhatsApp
            && WhatsAppServiceWindow.IsWindowOpen(
                await WhatsAppServiceWindow.GetLastInboundAtUtcAsync(_dbContext, tenantId, message, cancellationToken),
                utcNow);

        if (WhatsAppServiceWindow.IsReEngagementFailure(entry))
        {
            throw new ValidationException([
                new FluentValidation.Results.ValidationFailure(
                    nameof(request.EntryId),
                    WhatsAppServiceWindow.ReEngagementOperatorMessage)
            ]);
        }

        // Pencere kapalıyken serbest metin WhatsApp'a gitmez; kimlik yazılıp Failed'e düşmesin.
        if (message.Channel == SocialChannel.WhatsApp
            && !windowOpen
            && string.IsNullOrWhiteSpace(entry.WhatsAppTemplateName))
        {
            throw new ValidationException([
                new FluentValidation.Results.ValidationFailure(
                    nameof(request.EntryId),
                    WhatsAppServiceWindow.ReEngagementOperatorMessage)
            ]);
        }

        if (!WhatsAppServiceWindow.IsRetryableOutboundEntry(entry, windowOpen))
        {
            throw new ValidationException([
                new FluentValidation.Results.ValidationFailure(nameof(request.EntryId), "Bu mesaj zaten iletilmiş veya gönderilebilir durumda değil.")
            ]);
        }

        if (entry.DeliveryStatus == ConversationDeliveryStatus.Failed)
        {
            entry.DeliveryStatus = ConversationDeliveryStatus.Pending;
            entry.DeliveryError = null;
        }

        var jobMessageIds = await PendingTerminalOutboundSendGuard.ResolveJobMessageIdsFromMessageAsync(
            _dbContext,
            tenantId,
            message,
            cancellationToken);
        var isTerminalAutomaticPending = PendingTerminalOutboundSendGuard.IsTerminalAutomaticOutbound(entry);

        if (isTerminalAutomaticPending)
        {
            var claimed = await PendingTerminalOutboundSendGuard.TryClaimPendingSendAsync(
                _dbContext,
                request.SocialMessageId,
                request.EntryId,
                utcNow,
                cancellationToken);
            if (claimed == 0)
            {
                var currentStatus = await _dbContext.ConversationEntries
                    .AsNoTracking()
                    .Where(entity => entity.EntryId == request.EntryId && entity.SocialMessageId == request.SocialMessageId)
                    .Select(entity => entity.DeliveryStatus)
                    .FirstOrDefaultAsync(cancellationToken);
                if (currentStatus is ConversationDeliveryStatus.Sent
                    or ConversationDeliveryStatus.Delivered
                    or ConversationDeliveryStatus.Read)
                {
                    return new SendPendingConversationEntryResult(true, true);
                }

                throw new ValidationException([
                    new FluentValidation.Results.ValidationFailure(
                        nameof(request.EntryId),
                        "Bu mesajın gönderimi zaten devam ediyor veya tamamlanmış.")
                ]);
            }

            entry = await _dbContext.ConversationEntries.FirstAsync(
                entity => entity.EntryId == request.EntryId && entity.SocialMessageId == request.SocialMessageId,
                cancellationToken);
        }

        var client = _clientFactory.GetClient(message.Channel, tenantId);

        if (message.Channel == SocialChannel.WhatsApp && client is not null)
        {
            var recipientPhone = await WhatsAppRecipientResolver.ResolveRecipientPhoneAsync(
                _dbContext,
                message,
                cancellationToken);

            if (string.IsNullOrWhiteSpace(recipientPhone))
            {
                entry.DeliveryStatus = ConversationDeliveryStatus.Failed;
                entry.DeliveryError = "WhatsApp alıcı telefonu bulunamadı. Konuşma kaydındaki telefon numarasını kontrol edin.";
                entry.DeliveryStatusUpdatedAtUtc = utcNow;
                await _dbContext.SaveChangesAsync(cancellationToken);
                throw new ValidationException([
                    new FluentValidation.Results.ValidationFailure(
                        nameof(request.EntryId),
                        entry.DeliveryError)
                ]);
            }

            SocialMediaResult sendResult;
            var localPath = ConversationLocalMediaStore.ResolveFullPath(_uploadRootPath, entry.MediaId);
            if (localPath is not null && client is IWhatsAppMediaClient mediaClient)
            {
                if (ConversationEntrySenderLabelHelper.IsSystemAutomaticOutboundSenderLabel(entry.SenderLabel))
                {
                    entry.Content = ConversationEntrySenderLabelHelper.EnsureAutomaticAttachmentCaption(
                        entry.Content,
                        message.CitizenRequestNumber,
                        message.CitizenRequestNumberYear,
                        message.ReceivedAtUtc);
                }
                var fileBytes = await File.ReadAllBytesAsync(localPath, cancellationToken);
                var fileName = TryParseOutboundAttachmentFileName(entry.Content)
                    ?? Path.GetFileName(localPath);
                var caption = StripOutboundAttachmentMarker(entry.Content);
                if (IsPlaceholderAttachmentContent(entry.Content)) caption = null;
                sendResult = await mediaClient.SendUploadedMediaMessageAsync(new SendUploadedMediaMessageRequest
                {
                    RecipientId = recipientPhone,
                    FileName = fileName,
                    ContentType = string.IsNullOrWhiteSpace(entry.MediaMimeType) ? "application/octet-stream" : entry.MediaMimeType,
                    Content = fileBytes,
                    Caption = caption,
                }, cancellationToken);
            }
            else if (!string.IsNullOrWhiteSpace(entry.WhatsAppTemplateName))
            {
                sendResult = await SendWhatsAppTemplateOrFailAsync(
                    tenantId,
                    recipientPhone,
                    entry.WhatsAppTemplateName,
                    entry.WhatsAppTemplateLanguage,
                    entry.Content,
                    client,
                    cancellationToken);
            }
            else
            {
                sendResult = await SafeSendWhatsAppTextAsync(client, recipientPhone, entry.Content, cancellationToken);
            }

            if (sendResult.Success)
            {
                entry.ExternalEntryId = sendResult.MessageId;
                entry.DeliveryStatus = ConversationDeliveryStatus.Sent;
                entry.DeliveryError = null;
                entry.SentAt = utcNow;
            }
            else if (WhatsAppServiceWindow.ShouldRemainPendingAfterSendFailure(sendResult.Error, windowOpen))
            {
                entry.DeliveryStatus = ConversationDeliveryStatus.Pending;
                entry.DeliveryError = WhatsAppDeliveryErrorFormatter.StoreValue(sendResult.Error);
                PendingTerminalOutboundSendGuard.ClearSendClaimIfPresent(entry);
            }
            else
            {
                entry.DeliveryStatus = ConversationDeliveryStatus.Failed;
                entry.DeliveryError = WhatsAppDeliveryErrorFormatter.StoreValue(sendResult.Error);
                PendingTerminalOutboundSendGuard.ClearSendClaimIfPresent(entry);
            }
        }
        else if (client is not null)
        {
            await client.SendMessageAsync(new SendMessageRequest
            {
                RecipientId = message.CitizenHandle,
                Message = entry.Content
            }, cancellationToken);
            entry.DeliveryStatus = ConversationDeliveryStatus.Sent;
            entry.DeliveryError = null;
            entry.SentAt = utcNow;
        }
        else
        {
            entry.DeliveryStatus = ConversationDeliveryStatus.Sent;
            entry.DeliveryError = null;
            entry.SentAt = utcNow;
        }

        entry.DeliveryStatusUpdatedAtUtc = utcNow;

        if (entry.DeliveryStatus is ConversationDeliveryStatus.Sent
            or ConversationDeliveryStatus.Delivered
            or ConversationDeliveryStatus.Read)
        {
            entry.RelayedByDisplayName = actor.DisplayName.Trim();
        }

        if (entry.DeliveryStatus is ConversationDeliveryStatus.Sent
            or ConversationDeliveryStatus.Delivered
            or ConversationDeliveryStatus.Read)
        {
            message.ResponseContent = entry.Content;
            message.RespondedAtUtc = utcNow;
            if (message.Status == SocialMessageStatus.New || message.Status == SocialMessageStatus.Routed)
            {
                message.Status = SocialMessageStatus.Responded;
            }

            if (isTerminalAutomaticPending)
            {
                await PendingTerminalOutboundSendGuard.MarkDuplicatePendingSiblingsAsTransmittedAsync(
                    _dbContext,
                    jobMessageIds,
                    entry.EntryId,
                    entry.Content,
                    utcNow,
                    cancellationToken);
            }
        }
        else if (isTerminalAutomaticPending)
        {
            PendingTerminalOutboundSendGuard.ClearSendClaimIfPresent(entry);
        }

        if (entry.DeliveryStatus is ConversationDeliveryStatus.Sent
                or ConversationDeliveryStatus.Delivered
                or ConversationDeliveryStatus.Read
            && message.CitizenConversationId is Guid sentConversationId)
        {
            var conversation = await _dbContext.CitizenConversations.FirstOrDefaultAsync(
                entity => entity.CitizenConversationId == sentConversationId && entity.TenantId == tenantId,
                cancellationToken);
            if (conversation is not null && utcNow > conversation.LastMessageAt)
            {
                conversation.LastMessageAt = utcNow;
            }
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        if (entry.DeliveryStatus is ConversationDeliveryStatus.Sent
            or ConversationDeliveryStatus.Delivered
            or ConversationDeliveryStatus.Read)
        {
            return new SendPendingConversationEntryResult(true, true);
        }

        throw new ValidationException([
            new FluentValidation.Results.ValidationFailure(
                nameof(request.EntryId),
                entry.DeliveryError
                    ?? WhatsAppDeliveryErrorFormatter.Format(null))
        ]);
    }

    private static bool IsPlaceholderAttachmentContent(string? content) =>
        !string.IsNullOrWhiteSpace(content)
        && content.TrimStart().StartsWith("[Dosya eki:", StringComparison.OrdinalIgnoreCase)
        && !content.Contains('\n');

    private static string? TryParseOutboundAttachmentFileName(string? content)
    {
        if (string.IsNullOrWhiteSpace(content)) return null;
        var match = System.Text.RegularExpressions.Regex.Match(
            content,
            @"\[Dosya eki:\s*(.+?)\]",
            System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        var name = match.Success ? match.Groups[1].Value.Trim() : null;
        return string.IsNullOrWhiteSpace(name) ? null : Path.GetFileName(name);
    }

    private static string? StripOutboundAttachmentMarker(string? content)
    {
        if (string.IsNullOrWhiteSpace(content)) return null;
        var stripped = System.Text.RegularExpressions.Regex
            .Replace(content, @"\n?\[Dosya eki:\s*.+?\]\s*$", string.Empty, System.Text.RegularExpressions.RegexOptions.IgnoreCase)
            .Trim();
        return string.IsNullOrWhiteSpace(stripped) ? null : stripped;
    }

    private async Task<SocialMediaResult> SendWhatsAppTemplateOrFailAsync(
        Guid tenantId,
        string recipientPhone,
        string templateName,
        string? templateLanguage,
        string content,
        ISocialMediaClient fallbackClient,
        CancellationToken cancellationToken)
    {
        WhatsAppMetaTemplateGuard.EnsureNoBodyVariables(content);
        var templateClient = _clientFactory.GetWhatsAppTemplateClient(tenantId)
            ?? fallbackClient as IWhatsAppTemplateClient;
        if (templateClient is null)
        {
            return SocialMediaResult.Fail("WhatsApp şablon istemcisi yapılandırılmadı.");
        }

        return await templateClient.SendTemplateMessageAsync(
            recipientPhone,
            templateName,
            string.IsNullOrWhiteSpace(templateLanguage) ? "tr" : templateLanguage,
            parameters: null,
            cancellationToken);
    }

    private static async Task<SocialMediaResult> SafeSendWhatsAppTextAsync(
        ISocialMediaClient client,
        string recipientPhone,
        string message,
        CancellationToken cancellationToken)
    {
        try
        {
            return await client.SendMessageAsync(new SendMessageRequest
            {
                RecipientId = recipientPhone,
                Message = message
            }, cancellationToken);
        }
        catch (Exception ex)
        {
            return SocialMediaResult.Fail(ex.Message);
        }
    }
}
