namespace CityCommunicationCenter.Application.Features.Social;

public sealed record ReplyToSocialMessageCommand(
    Guid SocialMessageId,
    Guid? ActorUserId,
    string Content,
    bool SendImmediately = false) : ICommand<bool>;

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

        var senderLabel = await ResolveStaffSenderLabelAsync(tenantId, request.ActorUserId, cancellationToken);
        var utcNow = DateTimeOffset.UtcNow;

        ConversationDeliveryStatus? deliveryStatus = null;
        string? externalEntryId = null;
        string? deliveryError = null;

        // Varsayılan WhatsApp yanıtları "Beklemede" kuyruğa alınır; /whatsapp direkt operatör
        // yazımı açıkça isterse aynı endpoint üzerinden hemen iletilir.
        var isWhatsApp = message.Channel == SocialChannel.WhatsApp;
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

                await client.SendMessageAsync(new SendMessageRequest
                {
                    RecipientId = recipientId,
                    Message = request.Content
                }, cancellationToken);
            }

            if (isWhatsApp)
            {
                deliveryStatus = ConversationDeliveryStatus.Sent;
            }
        }

        _dbContext.ConversationEntries.Add(new SocialConversationEntry
        {
            EntryId = Guid.NewGuid(),
            SocialMessageId = request.SocialMessageId,
            Direction = ConversationEntryDirection.Outbound,
            Content = request.Content,
            SentAt = utcNow,
            SenderLabel = senderLabel,
            ExternalEntryId = externalEntryId,
            DeliveryStatus = deliveryStatus,
            DeliveryStatusUpdatedAtUtc = deliveryStatus.HasValue ? utcNow : null,
            DeliveryError = deliveryError,
        });

        // Kuyruğa alınan WhatsApp mesajı henüz iletilmedi → "Yanıtlandı" gerçek gönderimde işlenir.
        if (!isWhatsApp || request.SendImmediately)
        {
            message.ResponseContent = request.Content;
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
