using System.Text.Json;
using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Application.Features;
using CityCommunicationCenter.Domain;
using Microsoft.Extensions.Logging;

namespace CityCommunicationCenter.Application.Features.Social;

public sealed record ReceiveWhatsAppWebhookCommand(
    Guid TenantId,
    JsonElement Payload) : ICommand<int>;

public sealed class ReceiveWhatsAppWebhookCommandHandler
    : ICommandHandler<ReceiveWhatsAppWebhookCommand, int>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly IWhatsAppTemplateAutoReplyService _autoReplyService;
    private readonly INotificationPushService _notificationPushService;
    private readonly ISocialMediaClientFactory _clientFactory;
    private readonly ILogger<ReceiveWhatsAppWebhookCommandHandler> _logger;
    private readonly string _uploadRootPath;

    public ReceiveWhatsAppWebhookCommandHandler(
        IApplicationDbContext dbContext,
        IWhatsAppTemplateAutoReplyService autoReplyService,
        INotificationPushService notificationPushService,
        ISocialMediaClientFactory clientFactory,
        ILogger<ReceiveWhatsAppWebhookCommandHandler> logger,
        Microsoft.Extensions.Options.IOptions<Attachments.AttachmentStorageOptions> attachmentStorageOptions)
    {
        _dbContext = dbContext;
        _autoReplyService = autoReplyService;
        _notificationPushService = notificationPushService;
        _clientFactory = clientFactory;
        _logger = logger;
        _uploadRootPath = attachmentStorageOptions.Value.UploadRootPath;
    }

    public async ValueTask<int> Handle(
        ReceiveWhatsAppWebhookCommand request,
        CancellationToken cancellationToken)
    {
        // Echoes must be persisted before status updates when both arrive in one payload.
        var echoCount = await ProcessMessageEchoesAsync(request.TenantId, request.Payload, cancellationToken);
        var statusCount = await ProcessStatusUpdatesAsync(request.TenantId, request.Payload, cancellationToken);

        var incoming = ParseMessages(request.Payload);
        if (incoming.Count == 0)
        {
            return echoCount + statusCount;
        }

        // Deduplicate against already-stored external entry IDs
        var externalIds = incoming.Select(m => m.ExternalMessageId).ToArray();
        var existingExternalIds = await _dbContext.ConversationEntries
            .Where(e => externalIds.Contains(e.ExternalEntryId))
            .Select(e => e.ExternalEntryId)
            .ToHashSetAsync(cancellationToken);

        // Also check legacy deduplication on SocialMessage.ExternalMessageId
        var existingLegacyIds = await _dbContext.SocialMessages
            .IgnoreQueryFilters()
            .Where(m => m.TenantId == request.TenantId &&
                        m.Channel == SocialChannel.WhatsApp &&
                        externalIds.Contains(m.ExternalMessageId))
            .Select(m => m.ExternalMessageId)
            .ToHashSetAsync(cancellationToken);

        var newMessages = incoming
            .Where(m => !existingExternalIds.Contains(m.ExternalMessageId) &&
                        !existingLegacyIds.Contains(m.ExternalMessageId))
            .ToArray();

        if (newMessages.Length == 0)
        {
            // Meta aynı mesajı tekrar gönderdiğinde ilk turda düşen arşiv indirmesi burada telafi edilir;
            // yerel kopyası olan entry'ler ArchiveMediaAsync içinde atlanır (#6aac5ca5).
            await RetryMissingMediaArchivesAsync(request.TenantId, incoming, cancellationToken);
            return echoCount + statusCount;
        }

        // Group by citizen phone so we can find/create conversation threads
        var byCitizen = newMessages.GroupBy(m => m.CitizenHandle);
        var savedCount = 0;
        var pendingAutoReplies = new List<PendingWhatsAppAutoReply>();
        var pendingConversationPushes = new List<WhatsAppMessagePayload>();
        var pendingMediaArchives = new List<PendingConversationMediaArchive>();

        // Load existing CitizenConversations for all phones in this batch
        var allPhones = byCitizen.Select(g => g.Key).ToArray();
        var existingConversations = await _dbContext.CitizenConversations
            .IgnoreQueryFilters()
            .Where(c => c.TenantId == request.TenantId && allPhones.Contains(c.CitizenPhone))
            .ToDictionaryAsync(c => c.CitizenPhone, cancellationToken);

        foreach (var citizenGroup in byCitizen)
        {
            var citizenHandle = citizenGroup.Key;
            var orderedMsgs = citizenGroup.OrderBy(m => m.ReceivedAtUtc).ToArray();
            var persistableMsgs = orderedMsgs
                .Where(m => !WhatsAppInboundContentParser.IsIgnorableInboundNoise(m.Content, m.MediaId))
                .ToArray();
            if (persistableMsgs.Length == 0)
            {
                continue;
            }

            var latestAt = persistableMsgs[^1].ReceivedAtUtc;

            // Find or create CitizenConversation for this phone
            if (!existingConversations.TryGetValue(citizenHandle, out var conversation))
            {
                conversation = new CitizenConversation
                {
                    CitizenConversationId = Guid.NewGuid(),
                    TenantId = request.TenantId,
                    CitizenPhone = citizenHandle,
                    LastMessageAt = latestAt,
                    UnreadCount = 0,
                };
                _dbContext.CitizenConversations.Add(conversation);
                existingConversations[citizenHandle] = conversation;
            }
            else if (conversation.IsBlocked)
            {
                // Engellenen numara inbound yazamaz; liste sırasını da oynatma (#3537).
                continue;
            }
            else if (latestAt > conversation.LastMessageAt)
            {
                conversation.LastMessageAt = latestAt;
            }

            conversation.UnreadCount += persistableMsgs.Length;
            // Yeni inbound → manuel "Yanıt Verildi İşaretle" sıfırlanır (#6a6bab12).
            conversation.WaitingReplyClearedAtUtc = null;

            // Find the most recent open SocialMessage thread for this citizen
            var thread = await _dbContext.SocialMessages
                .IgnoreQueryFilters()
                .Where(m => m.TenantId == request.TenantId &&
                            m.Channel == SocialChannel.WhatsApp &&
                            m.CitizenHandle == citizenHandle &&
                            m.Status != SocialMessageStatus.Closed)
                .OrderByDescending(m => m.ReceivedAtUtc)
                .FirstOrDefaultAsync(cancellationToken);

            foreach (var msg in persistableMsgs)
            {
                if (thread is null)
                {
                    // Start a new SocialMessage thread linked to the CitizenConversation
                    thread = new SocialMessage
                    {
                        SocialMessageId = Guid.NewGuid(),
                        TenantId = request.TenantId,
                        Channel = SocialChannel.WhatsApp,
                        ExternalMessageId = msg.ExternalMessageId,
                        CitizenHandle = citizenHandle,
                        Content = msg.Content,
                        Latitude = msg.Latitude,
                        Longitude = msg.Longitude,
                        ReceivedAtUtc = msg.ReceivedAtUtc,
                        Status = SocialMessageStatus.New,
                        CitizenConversationId = conversation.CitizenConversationId,
                    };
                    _dbContext.SocialMessages.Add(thread);
                }
                else
                {
                    // Update thread to latest message time so it sorts correctly
                    thread.ReceivedAtUtc = msg.ReceivedAtUtc;
                    // Carry through location if not already set
                    if (thread.Latitude is null && msg.Latitude is not null)
                    {
                        thread.Latitude = msg.Latitude;
                        thread.Longitude = msg.Longitude;
                    }
                    // Link to conversation if not yet set (backfill for existing threads)
                    if (thread.CitizenConversationId is null)
                        thread.CitizenConversationId = conversation.CitizenConversationId;
                }

                var entryId = Guid.NewGuid();
                _dbContext.ConversationEntries.Add(new SocialConversationEntry
                {
                    EntryId = entryId,
                    SocialMessageId = thread.SocialMessageId,
                    Direction = ConversationEntryDirection.Inbound,
                    Content = msg.Content,
                    MediaId = msg.MediaId,
                    MediaMimeType = msg.MediaMimeType,
                    ExternalEntryId = msg.ExternalMessageId,
                    SentAt = msg.ReceivedAtUtc,
                    SenderLabel = ConversationEntrySenderLabelHelper.FormatCitizenPhone(
                        citizenHandle,
                        conversation.CitizenPhone),
                });

                if (!string.IsNullOrWhiteSpace(msg.MediaId))
                {
                    pendingMediaArchives.Add(new PendingConversationMediaArchive(entryId, msg.MediaId, msg.MediaMimeType));
                }

                savedCount++;
            }

            // Aynı webhook batch'inde görsel+metin gibi çoklu inbound yalnız bir auto-reply tetikler (#3361).
            var autoReplyInbound = WhatsAppInboundAutoReplyContent.PickFromBatch(
                persistableMsgs.Select(msg => msg.Content));
            pendingAutoReplies.Add(new PendingWhatsAppAutoReply(
                request.TenantId,
                thread!.SocialMessageId,
                citizenHandle,
                autoReplyInbound,
                latestAt));

            var latestMessage = persistableMsgs[^1];
            pendingConversationPushes.Add(new WhatsAppMessagePayload(
                conversation.CitizenConversationId,
                conversation.CitizenPhone,
                conversation.CitizenName,
                latestMessage.Content,
                conversation.UnreadCount,
                conversation.LastMessageAt));
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        await ArchiveMediaAsync(request.TenantId, pendingMediaArchives, cancellationToken);

        foreach (var push in pendingConversationPushes)
        {
            await _notificationPushService.SendWhatsAppMessageToTenantAsync(
                request.TenantId,
                push,
                cancellationToken);
        }

        foreach (var pending in pendingAutoReplies)
        {
            await _autoReplyService.ScheduleForInboundMessageAsync(
                pending.TenantId,
                pending.SocialMessageId,
                pending.CitizenHandle,
                pending.InboundContent,
                pending.ReceivedAtUtc,
                cancellationToken);
        }

        return savedCount + echoCount + statusCount;
    }

    private async Task<int> ProcessMessageEchoesAsync(
        Guid tenantId,
        JsonElement payload,
        CancellationToken cancellationToken)
    {
        var echoes = ParseMessageEchoes(payload);
        if (echoes.Count == 0)
        {
            return 0;
        }

        var externalIds = echoes.Select(echo => echo.ExternalMessageId).ToArray();
        var existingExternalIds = await _dbContext.ConversationEntries
            .Where(entry => entry.ExternalEntryId != null && externalIds.Contains(entry.ExternalEntryId))
            .Select(entry => entry.ExternalEntryId)
            .ToHashSetAsync(cancellationToken);

        var newEchoes = echoes
            .Where(echo => !existingExternalIds.Contains(echo.ExternalMessageId))
            .ToArray();
        if (newEchoes.Length == 0)
        {
            return 0;
        }

        var tenantName = await _dbContext.Tenants
            .AsNoTracking()
            .Where(tenant => tenant.TenantId == tenantId)
            .Select(tenant => tenant.MunicipalityName)
            .FirstOrDefaultAsync(cancellationToken) ?? "Belediye";
        var phoneSenderLabel = ConversationEntrySenderLabelHelper.FormatPhoneOutboundLabel(tenantName);

        var byCitizen = newEchoes.GroupBy(echo => echo.CitizenHandle);
        var savedCount = 0;
        var pendingMediaArchives = new List<PendingConversationMediaArchive>();
        var allPhones = byCitizen.Select(group => group.Key).ToArray();
        var existingConversations = await _dbContext.CitizenConversations
            .IgnoreQueryFilters()
            .Where(conversation => conversation.TenantId == tenantId && allPhones.Contains(conversation.CitizenPhone))
            .ToDictionaryAsync(conversation => conversation.CitizenPhone, cancellationToken);

        foreach (var citizenGroup in byCitizen)
        {
            var citizenHandle = citizenGroup.Key;
            var orderedEchoes = citizenGroup.OrderBy(echo => echo.SentAtUtc).ToArray();
            var latestAt = orderedEchoes[^1].SentAtUtc;

            if (!existingConversations.TryGetValue(citizenHandle, out var conversation))
            {
                conversation = new CitizenConversation
                {
                    CitizenConversationId = Guid.NewGuid(),
                    TenantId = tenantId,
                    CitizenPhone = citizenHandle,
                    LastMessageAt = latestAt,
                    UnreadCount = 0,
                };
                _dbContext.CitizenConversations.Add(conversation);
                existingConversations[citizenHandle] = conversation;
            }
            else if (latestAt > conversation.LastMessageAt)
            {
                conversation.LastMessageAt = latestAt;
            }

            var thread = await _dbContext.SocialMessages
                .IgnoreQueryFilters()
                .Where(message => message.TenantId == tenantId
                    && message.Channel == SocialChannel.WhatsApp
                    && message.CitizenHandle == citizenHandle
                    && message.Status != SocialMessageStatus.Closed)
                .OrderByDescending(message => message.ReceivedAtUtc)
                .FirstOrDefaultAsync(cancellationToken);

            foreach (var echo in orderedEchoes)
            {
                if (thread is null)
                {
                    thread = new SocialMessage
                    {
                        SocialMessageId = Guid.NewGuid(),
                        TenantId = tenantId,
                        Channel = SocialChannel.WhatsApp,
                        ExternalMessageId = echo.ExternalMessageId,
                        CitizenHandle = citizenHandle,
                        Content = echo.Content,
                        ReceivedAtUtc = echo.SentAtUtc,
                        Status = SocialMessageStatus.Responded,
                        CitizenConversationId = conversation.CitizenConversationId,
                        ResponseContent = echo.Content,
                        RespondedAtUtc = echo.SentAtUtc,
                    };
                    _dbContext.SocialMessages.Add(thread);
                }
                else
                {
                    thread.ResponseContent = echo.Content;
                    thread.RespondedAtUtc = echo.SentAtUtc;
                    if (thread.CitizenConversationId is null)
                    {
                        thread.CitizenConversationId = conversation.CitizenConversationId;
                    }
                }

                var entryId = Guid.NewGuid();
                _dbContext.ConversationEntries.Add(new SocialConversationEntry
                {
                    EntryId = entryId,
                    SocialMessageId = thread.SocialMessageId,
                    Direction = ConversationEntryDirection.Outbound,
                    Content = echo.Content,
                    MediaId = echo.MediaId,
                    MediaMimeType = echo.MediaMimeType,
                    ExternalEntryId = echo.ExternalMessageId,
                    SentAt = echo.SentAtUtc,
                    SenderLabel = phoneSenderLabel,
                    DeliveryStatus = ConversationDeliveryStatus.Sent,
                    DeliveryStatusUpdatedAtUtc = echo.SentAtUtc,
                });

                if (!string.IsNullOrWhiteSpace(echo.MediaId))
                {
                    pendingMediaArchives.Add(new PendingConversationMediaArchive(entryId, echo.MediaId, echo.MediaMimeType));
                }

                savedCount++;
            }
        }

        if (savedCount > 0)
        {
            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        await ArchiveMediaAsync(tenantId, pendingMediaArchives, cancellationToken);

        return savedCount;
    }

    /// <summary>
    /// Meta media ID'leri yaklaşık bir hafta sonra 404 döndüğü için içerik webhook anında yerel diske
    /// kopyalanır; `MediaId` korunur, yerel dosya entry kimliğiyle bulunur (#6aac5ca5). İndirme
    /// başarısızsa webhook akışı bozulmaz — yalnızca uyarı loglanır.
    /// </summary>
    private async Task ArchiveMediaAsync(
        Guid tenantId,
        List<PendingConversationMediaArchive> archives,
        CancellationToken cancellationToken)
    {
        if (archives.Count == 0)
        {
            return;
        }

        if (_clientFactory.GetClient(SocialChannel.WhatsApp, tenantId) is not IWhatsAppMediaClient mediaClient)
        {
            return;
        }

        foreach (var archive in archives)
        {
            try
            {
                if (ConversationLocalMediaStore.ResolveEntryFullPath(_uploadRootPath, tenantId, archive.EntryId) is not null)
                {
                    continue;
                }

                var download = await mediaClient.DownloadMediaAsync(archive.MediaId, cancellationToken);
                if (download is null)
                {
                    _logger.LogWarning(
                        "WhatsApp gelen medyası indirilemedi. EntryId: {EntryId}, MediaId: {MediaId}",
                        archive.EntryId,
                        archive.MediaId);
                    continue;
                }

                var localMediaId = ConversationLocalMediaStore.BuildLocalMediaIdFromMimeType(
                    tenantId,
                    archive.EntryId,
                    archive.MimeType ?? download.ContentType);

                await ConversationLocalMediaStore.SaveAsync(
                    _uploadRootPath,
                    localMediaId,
                    download.Content,
                    cancellationToken);
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                _logger.LogWarning(
                    exception,
                    "WhatsApp medya yerel kopyası oluşturulamadı. EntryId: {EntryId}, MediaId: {MediaId}",
                    archive.EntryId,
                    archive.MediaId);
            }
        }
    }

    /// <summary>
    /// Yinelenen webhook teslimlerinde medyası olup yerel kopyası bulunmayan entry'ler için arşivi
    /// yeniden dener; Meta 404'e dönmeden önceki her tekrar bir şans daha demektir (#6aac5ca5).
    /// </summary>
    private async Task RetryMissingMediaArchivesAsync(
        Guid tenantId,
        IReadOnlyList<WhatsAppIncomingMessage> incoming,
        CancellationToken cancellationToken)
    {
        var mediaExternalIds = incoming
            .Where(message => !string.IsNullOrWhiteSpace(message.MediaId))
            .Select(message => message.ExternalMessageId)
            .Distinct()
            .ToArray();

        if (mediaExternalIds.Length == 0)
        {
            return;
        }

        var entries = await _dbContext.ConversationEntries
            .IgnoreQueryFilters()
            .Join(
                _dbContext.SocialMessages.IgnoreQueryFilters().Where(message => message.TenantId == tenantId),
                entry => entry.SocialMessageId,
                message => message.SocialMessageId,
                (entry, _) => entry)
            .Where(entry => entry.ExternalEntryId != null &&
                            entry.MediaId != null &&
                            mediaExternalIds.Contains(entry.ExternalEntryId))
            .Select(entry => new { entry.EntryId, entry.MediaId, entry.MediaMimeType })
            .ToListAsync(cancellationToken);

        if (entries.Count == 0)
        {
            return;
        }

        var archives = entries
            .Select(entry => new PendingConversationMediaArchive(entry.EntryId, entry.MediaId!, entry.MediaMimeType))
            .ToList();

        await ArchiveMediaAsync(tenantId, archives, cancellationToken);
    }

    private sealed record PendingConversationMediaArchive(Guid EntryId, string MediaId, string? MimeType);

    private async Task<int> ProcessStatusUpdatesAsync(Guid tenantId, JsonElement payload, CancellationToken cancellationToken)
    {
        var statuses = ParseStatuses(payload);
        if (statuses.Count == 0)
        {
            return 0;
        }

        var externalIds = statuses.Select(status => status.ExternalMessageId).Distinct().ToArray();
        var entries = await _dbContext.ConversationEntries
            .IgnoreQueryFilters()
            .Join(
                _dbContext.SocialMessages.IgnoreQueryFilters().Where(message => message.TenantId == tenantId),
                entry => entry.SocialMessageId,
                message => message.SocialMessageId,
                (entry, message) => new
                {
                    Entry = entry,
                    message.CitizenConversationId,
                })
            .Where(row => row.Entry.ExternalEntryId != null && externalIds.Contains(row.Entry.ExternalEntryId))
            .ToListAsync(cancellationToken);

        if (entries.Count == 0)
        {
            return 0;
        }

        var entriesByExternalId = entries
            .Where(row => !string.IsNullOrWhiteSpace(row.Entry.ExternalEntryId))
            .ToDictionary(row => row.Entry.ExternalEntryId!, StringComparer.Ordinal);

        var updatedCount = 0;
        var changedConversationIds = new HashSet<Guid>();
        foreach (var status in statuses)
        {
            if (!entriesByExternalId.TryGetValue(status.ExternalMessageId, out var row))
            {
                continue;
            }

            if (!ConversationDeliveryStatusHelper.TryParseWhatsAppStatus(status.Status, out var parsedStatus))
            {
                continue;
            }

            if (ConversationDeliveryStatusHelper.TryApply(row.Entry, parsedStatus, status.StatusAtUtc, status.ErrorMessage))
            {
                updatedCount++;
                if (row.CitizenConversationId.HasValue)
                {
                    changedConversationIds.Add(row.CitizenConversationId.Value);
                }
            }
        }

        if (updatedCount > 0)
        {
            await _dbContext.SaveChangesAsync(cancellationToken);

            if (changedConversationIds.Count > 0)
            {
                var conversations = await _dbContext.CitizenConversations
                    .IgnoreQueryFilters()
                    .Where(conversation => conversation.TenantId == tenantId
                        && changedConversationIds.Contains(conversation.CitizenConversationId))
                    .Select(conversation => new
                    {
                        conversation.CitizenConversationId,
                        conversation.CitizenPhone,
                        conversation.CitizenName,
                        conversation.UnreadCount,
                        conversation.LastMessageAt,
                    })
                    .ToListAsync(cancellationToken);

                foreach (var conversation in conversations)
                {
                    await _notificationPushService.SendWhatsAppMessageToTenantAsync(
                        tenantId,
                        new WhatsAppMessagePayload(
                            conversation.CitizenConversationId,
                            conversation.CitizenPhone,
                            conversation.CitizenName,
                            null,
                            conversation.UnreadCount,
                            conversation.LastMessageAt,
                            IsInternal: false,
                            IsStatusUpdate: true),
                        cancellationToken);
                }
            }
        }

        return updatedCount;
    }

    private static List<WhatsAppIncomingMessage> ParseMessages(JsonElement payload)
    {
        var result = new List<WhatsAppIncomingMessage>();
        if (!payload.TryGetProperty("entry", out var entries) || entries.ValueKind != JsonValueKind.Array)
            return result;

        foreach (var entry in entries.EnumerateArray())
        {
            if (!entry.TryGetProperty("changes", out var changes) || changes.ValueKind != JsonValueKind.Array)
                continue;

            foreach (var change in changes.EnumerateArray())
            {
                if (!change.TryGetProperty("value", out var value) ||
                    !value.TryGetProperty("messages", out var messages) ||
                    messages.ValueKind != JsonValueKind.Array)
                    continue;

                foreach (var message in messages.EnumerateArray())
                {
                    var externalMessageId = GetString(message, "id");
                    var citizenHandle = GetString(message, "from");
                    if (string.IsNullOrWhiteSpace(externalMessageId) || string.IsNullOrWhiteSpace(citizenHandle))
                        continue;

                    var receivedAtUtc = DateTimeOffset.UtcNow;
                    if (long.TryParse(GetString(message, "timestamp"), out var ts))
                        receivedAtUtc = DateTimeOffset.FromUnixTimeSeconds(ts);

                    var (content, mediaId, mediaMimeType, lat, lon) = WhatsAppInboundContentParser.Parse(message);
                    result.Add(new WhatsAppIncomingMessage(externalMessageId, citizenHandle, content, mediaId, mediaMimeType, receivedAtUtc, lat, lon));
                }
            }
        }

        return result;
    }

    private static List<WhatsAppEchoMessage> ParseMessageEchoes(JsonElement payload)
    {
        var result = new List<WhatsAppEchoMessage>();
        if (!payload.TryGetProperty("entry", out var entries) || entries.ValueKind != JsonValueKind.Array)
        {
            return result;
        }

        foreach (var entry in entries.EnumerateArray())
        {
            if (!entry.TryGetProperty("changes", out var changes) || changes.ValueKind != JsonValueKind.Array)
            {
                continue;
            }

            foreach (var change in changes.EnumerateArray())
            {
                if (!change.TryGetProperty("value", out var value) ||
                    !value.TryGetProperty("message_echoes", out var messageEchoes) ||
                    messageEchoes.ValueKind != JsonValueKind.Array)
                {
                    continue;
                }

                foreach (var message in messageEchoes.EnumerateArray())
                {
                    var externalMessageId = GetString(message, "id");
                    var citizenHandle = GetString(message, "to");
                    if (string.IsNullOrWhiteSpace(externalMessageId) || string.IsNullOrWhiteSpace(citizenHandle))
                    {
                        continue;
                    }

                    var sentAtUtc = DateTimeOffset.UtcNow;
                    if (long.TryParse(GetString(message, "timestamp"), out var ts))
                    {
                        sentAtUtc = DateTimeOffset.FromUnixTimeSeconds(ts);
                    }

                    var (content, mediaId, mediaMimeType, _, _) = WhatsAppInboundContentParser.Parse(message);
                    result.Add(new WhatsAppEchoMessage(
                        externalMessageId,
                        citizenHandle,
                        content,
                        mediaId,
                        mediaMimeType,
                        sentAtUtc));
                }
            }
        }

        return result;
    }

    private static List<WhatsAppStatusUpdate> ParseStatuses(JsonElement payload)
    {
        var result = new List<WhatsAppStatusUpdate>();
        if (!payload.TryGetProperty("entry", out var entries) || entries.ValueKind != JsonValueKind.Array)
        {
            return result;
        }

        foreach (var entry in entries.EnumerateArray())
        {
            if (!entry.TryGetProperty("changes", out var changes) || changes.ValueKind != JsonValueKind.Array)
            {
                continue;
            }

            foreach (var change in changes.EnumerateArray())
            {
                if (!change.TryGetProperty("value", out var value) ||
                    !value.TryGetProperty("statuses", out var statuses) ||
                    statuses.ValueKind != JsonValueKind.Array)
                {
                    continue;
                }

                foreach (var status in statuses.EnumerateArray())
                {
                    var externalMessageId = GetString(status, "id");
                    var statusValue = GetString(status, "status");
                    if (string.IsNullOrWhiteSpace(externalMessageId) || string.IsNullOrWhiteSpace(statusValue))
                    {
                        continue;
                    }

                    var statusAtUtc = DateTimeOffset.UtcNow;
                    if (long.TryParse(GetString(status, "timestamp"), out var ts))
                    {
                        statusAtUtc = DateTimeOffset.FromUnixTimeSeconds(ts);
                    }

                    result.Add(new WhatsAppStatusUpdate(
                        externalMessageId,
                        statusValue,
                        statusAtUtc,
                        ParseStatusError(status)));
                }
            }
        }

        return result;
    }

    private static string? ParseStatusError(JsonElement status)
    {
        if (!status.TryGetProperty("errors", out var errors) || errors.ValueKind != JsonValueKind.Array)
        {
            return null;
        }

        foreach (var error in errors.EnumerateArray())
        {
            var message = GetString(error, "message");
            if (!string.IsNullOrWhiteSpace(message))
            {
                return message;
            }

            var title = GetString(error, "title");
            if (!string.IsNullOrWhiteSpace(title))
            {
                return title;
            }
        }

        return null;
    }

    private static string? GetString(JsonElement el, string prop) =>
        el.TryGetProperty(prop, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;

    private sealed record WhatsAppEchoMessage(
        string ExternalMessageId,
        string CitizenHandle,
        string Content,
        string? MediaId,
        string? MediaMimeType,
        DateTimeOffset SentAtUtc);

    private sealed record WhatsAppStatusUpdate(
        string ExternalMessageId,
        string Status,
        DateTimeOffset StatusAtUtc,
        string? ErrorMessage);

    private sealed record WhatsAppIncomingMessage(
        string ExternalMessageId,
        string CitizenHandle,
        string Content,
        string? MediaId,
        string? MediaMimeType,
        DateTimeOffset ReceivedAtUtc,
        double? Latitude,
        double? Longitude);

    private sealed record PendingWhatsAppAutoReply(
        Guid TenantId,
        Guid SocialMessageId,
        string CitizenHandle,
        string InboundContent,
        DateTimeOffset ReceivedAtUtc);
}
