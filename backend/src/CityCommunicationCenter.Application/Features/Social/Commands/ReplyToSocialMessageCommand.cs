namespace CityCommunicationCenter.Application.Features.Social;

public sealed record ReplyToSocialMessageCommand(
    Guid SocialMessageId,
    Guid? ActorUserId,
    string Content,
    bool SendImmediately = false,
    Guid? WhatsAppTemplateId = null,
    string? WhatsAppTemplateName = null,
    string? WhatsAppTemplateLanguage = null) : ICommand<bool>;

public sealed class ReplyToSocialMessageCommandHandler : ICommandHandler<ReplyToSocialMessageCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;
    private readonly ISocialMediaClientFactory _clientFactory;

    public ReplyToSocialMessageCommandHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor,
        ISocialMediaClientFactory clientFactory)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
        _clientFactory = clientFactory;
    }

    public async ValueTask<bool> Handle(ReplyToSocialMessageCommand request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();

        var message = await _dbContext.SocialMessages
            .FirstOrDefaultAsync(m => m.SocialMessageId == request.SocialMessageId && m.TenantId == tenantId, cancellationToken);

        if (message is null) return false;

        var (templateName, templateLanguage, content) = await ResolveWhatsAppTemplateAsync(
            tenantId,
            request.Content,
            request.WhatsAppTemplateId,
            request.WhatsAppTemplateName,
            request.WhatsAppTemplateLanguage,
            cancellationToken);

        var senderLabel = await ResolveStaffSenderLabelAsync(tenantId, request.ActorUserId, cancellationToken);
        var utcNow = DateTimeOffset.UtcNow;

        ConversationDeliveryStatus? deliveryStatus = null;
        string? externalEntryId = null;
        string? deliveryError = null;

        // Varsayılan WhatsApp yanıtları "Beklemede" kuyruğa alınır; /whatsapp direkt operatör
        // yazımı açıkça isterse aynı endpoint üzerinden hemen iletilir.
        var isWhatsApp = message.Channel == SocialChannel.WhatsApp;
        if (isWhatsApp && request.SendImmediately && LooksLikeAttachmentPlaceholder(content))
        {
            throw new ValidationException([
                new FluentValidation.Results.ValidationFailure(
                    nameof(request.Content),
                    "Dosya eki eski mesaj endpoint'iyle gönderilemez. Sayfayı yenileyip Dosya ekle ile tekrar gönderin.")
            ]);
        }

        if (isWhatsApp && !request.SendImmediately)
        {
            deliveryStatus = ConversationDeliveryStatus.Pending;
        }
        else
        {
            var client = _clientFactory.GetClient(message.Channel, tenantId);
            if (client is not null)
            {
                var recipientId = message.CitizenHandle;
                if (isWhatsApp)
                {
                    var recipientPhone = await WhatsAppRecipientResolver.ResolveRecipientPhoneAsync(
                        _dbContext,
                        message,
                        cancellationToken);
                    if (!string.IsNullOrWhiteSpace(recipientPhone))
                    {
                        recipientId = recipientPhone;
                    }
                }

                SocialMediaResult sendResult;
                if (isWhatsApp && !string.IsNullOrWhiteSpace(templateName))
                {
                    var templateClient = _clientFactory.GetWhatsAppTemplateClient(tenantId)
                        ?? client as IWhatsAppTemplateClient;
                    if (templateClient is null)
                    {
                        sendResult = SocialMediaResult.Fail("WhatsApp şablon istemcisi yapılandırılmadı.");
                    }
                    else
                    {
                        sendResult = await templateClient.SendTemplateMessageAsync(
                            recipientId,
                            templateName,
                            templateLanguage ?? "tr",
                            parameters: null,
                            cancellationToken);
                    }
                }
                else
                {
                    sendResult = await client.SendMessageAsync(new SendMessageRequest
                    {
                        RecipientId = recipientId,
                        Message = content
                    }, cancellationToken);
                }

                if (isWhatsApp)
                {
                    if (sendResult.Success)
                    {
                        externalEntryId = sendResult.MessageId;
                        deliveryStatus = ConversationDeliveryStatus.Sent;
                        deliveryError = null;
                    }
                    else
                    {
                        deliveryStatus = ConversationDeliveryStatus.Failed;
                        deliveryError = sendResult.Error;
                    }
                }
            }
            else if (isWhatsApp)
            {
                deliveryStatus = ConversationDeliveryStatus.Failed;
                deliveryError = "WhatsApp istemcisi yapılandırılmadı.";
            }
        }

        _dbContext.ConversationEntries.Add(new SocialConversationEntry
        {
            EntryId = Guid.NewGuid(),
            SocialMessageId = request.SocialMessageId,
            Direction = ConversationEntryDirection.Outbound,
            Content = content,
            SentAt = utcNow,
            SenderLabel = senderLabel,
            ExternalEntryId = externalEntryId,
            DeliveryStatus = deliveryStatus,
            DeliveryStatusUpdatedAtUtc = deliveryStatus.HasValue ? utcNow : null,
            DeliveryError = deliveryError,
            WhatsAppTemplateName = templateName,
            WhatsAppTemplateLanguage = templateLanguage,
        });

        // Kuyruğa alınan WhatsApp mesajı henüz iletilmedi → "Yanıtlandı" gerçek gönderimde işlenir.
        if (!isWhatsApp || request.SendImmediately)
        {
            message.ResponseContent = content;
            message.RespondedAtUtc = utcNow;
            if (message.Status == SocialMessageStatus.New || message.Status == SocialMessageStatus.Routed)
            {
                message.Status = SocialMessageStatus.Responded;
            }
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    private async Task<(string? TemplateName, string? TemplateLanguage, string Content)> ResolveWhatsAppTemplateAsync(
        Guid tenantId,
        string content,
        Guid? templateId,
        string? templateName,
        string? templateLanguage,
        CancellationToken cancellationToken)
    {
        if (!templateId.HasValue
            && string.IsNullOrWhiteSpace(templateName))
        {
            return (null, null, content);
        }

        WhatsAppMessageTemplate? template = null;
        if (templateId.HasValue)
        {
            template = await _dbContext.WhatsAppTemplates
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    t => t.TemplateId == templateId.Value
                         && t.TenantId == tenantId
                         && t.Channel == WhatsAppMetaTemplateConstants.Channel
                         && t.IsActive,
                    cancellationToken);

            if (template is null)
            {
                throw new ValidationException([
                    new FluentValidation.Results.ValidationFailure(
                        nameof(templateId),
                        "Seçilen Meta şablon bulunamadı veya aktif değil.")
                ]);
            }
        }
        else if (!string.IsNullOrWhiteSpace(templateName))
        {
            var name = templateName.Trim();
            var language = string.IsNullOrWhiteSpace(templateLanguage) ? null : templateLanguage.Trim();
            var query = _dbContext.WhatsAppTemplates
                .AsNoTracking()
                .Where(t => t.TenantId == tenantId
                            && t.Channel == WhatsAppMetaTemplateConstants.Channel
                            && t.IsActive
                            && t.Name == name);
            if (!string.IsNullOrWhiteSpace(language))
            {
                query = query.Where(t => t.MetaLanguageCode == language);
            }

            template = await query.FirstOrDefaultAsync(cancellationToken);
            if (template is null)
            {
                // İsim bilinen ama DB'de yoksa Cloud API adına güven — yine de değişken kontrolü content üzerinden.
                WhatsAppMetaTemplateGuard.EnsureNoBodyVariables(content);
                return (name, language ?? "tr", content);
            }
        }

        if (template is null)
        {
            return (null, null, content);
        }

        WhatsAppMetaTemplateGuard.EnsureNoBodyVariables(template.Content);
        var resolvedContent = string.IsNullOrWhiteSpace(content) ? template.Content : content;
        return (
            template.Name,
            string.IsNullOrWhiteSpace(template.MetaLanguageCode) ? "tr" : template.MetaLanguageCode,
            resolvedContent);
    }

    private async Task<string> ResolveStaffSenderLabelAsync(
        Guid tenantId,
        Guid? actorUserId,
        CancellationToken cancellationToken)
    {
        if (!actorUserId.HasValue)
        {
            return await _dbContext.Tenants
                .AsNoTracking()
                .Where(t => t.TenantId == tenantId)
                .Select(t => t.MunicipalityName)
                .FirstOrDefaultAsync(cancellationToken) ?? "Belediye";
        }

        var actor = await _dbContext.Users
            .AsNoTracking()
            .Where(u => u.UserId == actorUserId.Value && u.TenantId == tenantId)
            .Select(u => new { u.DisplayName, DepartmentName = u.Department != null ? u.Department.Name : null })
            .FirstOrDefaultAsync(cancellationToken);

        return actor is null
            ? "Belediye"
            : ConversationEntrySenderLabelHelper.FormatStaffLabel(actor.DepartmentName, actor.DisplayName);
    }

    private static bool LooksLikeAttachmentPlaceholder(string content)
    {
        var trimmed = content.Trim();
        return trimmed.StartsWith("[Dosya eki:", StringComparison.OrdinalIgnoreCase)
            || trimmed.Contains("\n[Dosya eki:", StringComparison.OrdinalIgnoreCase);
    }
}

public sealed record ReplyToSocialMessageAttachmentCommand(
    Guid SocialMessageId,
    Guid? ActorUserId,
    string? Content,
    string FileName,
    string ContentType,
    byte[] FileContent,
    bool SendImmediately = true) : ICommand<bool>;

public sealed class ReplyToSocialMessageAttachmentCommandHandler
    : ICommandHandler<ReplyToSocialMessageAttachmentCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;
    private readonly ISocialMediaClientFactory _clientFactory;
    private readonly string _uploadRootPath;

    public ReplyToSocialMessageAttachmentCommandHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor,
        ISocialMediaClientFactory clientFactory,
        Microsoft.Extensions.Options.IOptions<Attachments.AttachmentStorageOptions> attachmentStorageOptions)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
        _clientFactory = clientFactory;
        _uploadRootPath = attachmentStorageOptions.Value.UploadRootPath;
    }

    public async ValueTask<bool> Handle(ReplyToSocialMessageAttachmentCommand request, CancellationToken cancellationToken)
    {
        if (request.FileContent.Length == 0)
        {
            throw new ValidationException([
                new FluentValidation.Results.ValidationFailure(nameof(request.FileContent), "Gönderilecek dosya boş olamaz.")
            ]);
        }

        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();
        var message = await _dbContext.SocialMessages
            .FirstOrDefaultAsync(m => m.SocialMessageId == request.SocialMessageId && m.TenantId == tenantId, cancellationToken);

        if (message is null) return false;

        if (message.Channel != SocialChannel.WhatsApp)
        {
            throw new ValidationException([
                new FluentValidation.Results.ValidationFailure(nameof(message.Channel), "Dosya eki gönderimi yalnızca WhatsApp konuşmalarında desteklenir.")
            ]);
        }

        var senderLabel = await ResolveStaffSenderLabelAsync(tenantId, request.ActorUserId, cancellationToken);
        var utcNow = DateTimeOffset.UtcNow;
        var content = string.IsNullOrWhiteSpace(request.Content)
            ? $"[Dosya eki: {request.FileName}]"
            : request.Content.Trim();

        var deliveryStatus = ConversationDeliveryStatus.Pending;
        string? externalEntryId = null;
        string? mediaId = null;
        string? deliveryError = null;
        var entryId = Guid.NewGuid();
        var localMediaId = ConversationLocalMediaStore.BuildLocalMediaId(tenantId, entryId, request.FileName);
        await ConversationLocalMediaStore.SaveAsync(
            _uploadRootPath,
            localMediaId,
            request.FileContent,
            cancellationToken);
        mediaId = localMediaId;

        if (request.SendImmediately)
        {
            deliveryStatus = ConversationDeliveryStatus.Failed;
            var client = _clientFactory.GetClient(message.Channel, tenantId);
            var recipientPhone = await WhatsAppRecipientResolver.ResolveRecipientPhoneAsync(
                _dbContext,
                message,
                cancellationToken);

            if (string.IsNullOrWhiteSpace(recipientPhone))
            {
                deliveryError = "WhatsApp alıcı telefonu bulunamadı. Konuşma kaydındaki telefon numarasını kontrol edin.";
            }
            else if (client is not IWhatsAppMediaClient mediaClient)
            {
                deliveryError = "WhatsApp medya gönderim istemcisi yapılandırılmadı.";
            }
            else
            {
                var sendResult = await mediaClient.SendUploadedMediaMessageAsync(new SendUploadedMediaMessageRequest
                {
                    RecipientId = recipientPhone,
                    FileName = request.FileName,
                    ContentType = string.IsNullOrWhiteSpace(request.ContentType) ? "application/octet-stream" : request.ContentType,
                    Content = request.FileContent,
                    Caption = string.IsNullOrWhiteSpace(request.Content) ? null : request.Content.Trim()
                }, cancellationToken);

                if (sendResult.Success)
                {
                    externalEntryId = sendResult.MessageId;
                    // Önizleme için yerel kopyayı koru (Graph medya ID süresi dolabilir — R421).
                    deliveryStatus = ConversationDeliveryStatus.Sent;
                }
                else
                {
                    deliveryError = sendResult.Error;
                }
            }
        }

        _dbContext.ConversationEntries.Add(new SocialConversationEntry
        {
            EntryId = entryId,
            SocialMessageId = request.SocialMessageId,
            Direction = ConversationEntryDirection.Outbound,
            Content = content,
            SentAt = utcNow,
            SenderLabel = senderLabel,
            ExternalEntryId = externalEntryId,
            MediaId = mediaId,
            MediaMimeType = string.IsNullOrWhiteSpace(request.ContentType) ? "application/octet-stream" : request.ContentType,
            DeliveryStatus = deliveryStatus,
            DeliveryStatusUpdatedAtUtc = utcNow,
            DeliveryError = deliveryError,
        });

        if (deliveryStatus != ConversationDeliveryStatus.Failed && request.SendImmediately)
        {
            message.ResponseContent = content;
            message.RespondedAtUtc = utcNow;
            if (message.Status == SocialMessageStatus.New || message.Status == SocialMessageStatus.Routed)
            {
                message.Status = SocialMessageStatus.Responded;
            }
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    private async Task<string> ResolveStaffSenderLabelAsync(
        Guid tenantId,
        Guid? actorUserId,
        CancellationToken cancellationToken)
    {
        if (!actorUserId.HasValue)
        {
            return await _dbContext.Tenants
                .AsNoTracking()
                .Where(t => t.TenantId == tenantId)
                .Select(t => t.MunicipalityName)
                .FirstOrDefaultAsync(cancellationToken) ?? "Belediye";
        }

        var actor = await _dbContext.Users
            .AsNoTracking()
            .Where(u => u.UserId == actorUserId.Value && u.TenantId == tenantId)
            .Select(u => new { u.DisplayName, DepartmentName = u.Department != null ? u.Department.Name : null })
            .FirstOrDefaultAsync(cancellationToken);

        return actor is null
            ? "Belediye"
            : ConversationEntrySenderLabelHelper.FormatStaffLabel(actor.DepartmentName, actor.DisplayName);
    }
}
