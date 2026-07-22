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

        if (entry.Direction != ConversationEntryDirection.Outbound
            || entry.DeliveryStatus != ConversationDeliveryStatus.Pending)
        {
            throw new ValidationException([
                new FluentValidation.Results.ValidationFailure(nameof(request.EntryId), "Bu mesaj zaten iletilmiş veya gönderilebilir durumda değil.")
            ]);
        }

        var utcNow = DateTimeOffset.UtcNow;
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
                return new SendPendingConversationEntryResult(true, false);
            }

            SocialMediaResult sendResult;
            var localPath = ConversationLocalMediaStore.ResolveFullPath(_uploadRootPath, entry.MediaId);
            if (localPath is not null && client is IWhatsAppMediaClient mediaClient)
            {
                var fileBytes = await File.ReadAllBytesAsync(localPath, cancellationToken);
                var fileName = Path.GetFileName(localPath);
                var caption = IsPlaceholderAttachmentContent(entry.Content) ? null : entry.Content;
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
                sendResult = await client.SendMessageAsync(new SendMessageRequest
                {
                    RecipientId = recipientPhone,
                    Message = entry.Content
                }, cancellationToken);
            }

            if (sendResult.Success)
            {
                entry.ExternalEntryId = sendResult.MessageId;
                entry.DeliveryStatus = ConversationDeliveryStatus.Sent;
                entry.DeliveryError = null;
            }
            else
            {
                entry.DeliveryStatus = ConversationDeliveryStatus.Failed;
                entry.DeliveryError = sendResult.Error;
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
        }
        else
        {
            entry.DeliveryStatus = ConversationDeliveryStatus.Sent;
            entry.DeliveryError = null;
        }

        entry.DeliveryStatusUpdatedAtUtc = utcNow;

        if (entry.DeliveryStatus != ConversationDeliveryStatus.Failed)
        {
            message.ResponseContent = entry.Content;
            message.RespondedAtUtc = utcNow;
            if (message.Status == SocialMessageStatus.New || message.Status == SocialMessageStatus.Routed)
            {
                message.Status = SocialMessageStatus.Responded;
            }
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return new SendPendingConversationEntryResult(true, entry.DeliveryStatus != ConversationDeliveryStatus.Failed);
    }

    private static bool IsPlaceholderAttachmentContent(string? content) =>
        !string.IsNullOrWhiteSpace(content)
        && content.StartsWith("[Dosya eki:", StringComparison.Ordinal);

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
}
