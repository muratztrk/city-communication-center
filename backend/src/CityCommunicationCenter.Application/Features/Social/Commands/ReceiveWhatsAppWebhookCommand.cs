using System.Text.Json;

namespace CityCommunicationCenter.Application.Features.Social;

public sealed record ReceiveWhatsAppWebhookCommand(
    Guid TenantId,
    JsonElement Payload) : ICommand<int>;

public sealed class ReceiveWhatsAppWebhookCommandHandler
    : ICommandHandler<ReceiveWhatsAppWebhookCommand, int>
{
    private readonly IApplicationDbContext _dbContext;

    public ReceiveWhatsAppWebhookCommandHandler(IApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async ValueTask<int> Handle(
        ReceiveWhatsAppWebhookCommand request,
        CancellationToken cancellationToken)
    {
        var incoming = ParseMessages(request.Payload);
        if (incoming.Count == 0) return 0;

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

        if (newMessages.Length == 0) return 0;

        // Group by citizen so we can find/create conversation threads
        var byCitizen = newMessages.GroupBy(m => m.CitizenHandle);
        var savedCount = 0;

        foreach (var citizenGroup in byCitizen)
        {
            var citizenHandle = citizenGroup.Key;

            // Find the most recent open conversation thread for this citizen
            var thread = await _dbContext.SocialMessages
                .IgnoreQueryFilters()
                .Where(m => m.TenantId == request.TenantId &&
                            m.Channel == SocialChannel.WhatsApp &&
                            m.CitizenHandle == citizenHandle &&
                            m.Status != SocialMessageStatus.Closed)
                .OrderByDescending(m => m.ReceivedAtUtc)
                .FirstOrDefaultAsync(cancellationToken);

            foreach (var msg in citizenGroup.OrderBy(m => m.ReceivedAtUtc))
            {
                if (thread is null)
                {
                    // Start a new conversation thread
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
                        Status = SocialMessageStatus.New
                    };
                    _dbContext.SocialMessages.Add(thread);
                }
                else
                {
                    // Update thread's ReceivedAtUtc to latest message time so it sorts correctly
                    thread.ReceivedAtUtc = msg.ReceivedAtUtc;
                    // Carry through location if not already set
                    if (thread.Latitude is null && msg.Latitude is not null)
                    {
                        thread.Latitude = msg.Latitude;
                        thread.Longitude = msg.Longitude;
                    }
                }

                _dbContext.ConversationEntries.Add(new SocialConversationEntry
                {
                    EntryId = Guid.NewGuid(),
                    SocialMessageId = thread.SocialMessageId,
                    Direction = ConversationEntryDirection.Inbound,
                    Content = msg.Content,
                    MediaId = msg.MediaId,
                    MediaMimeType = msg.MediaMimeType,
                    ExternalEntryId = msg.ExternalMessageId,
                    SentAt = msg.ReceivedAtUtc
                });

                savedCount++;
            }
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return savedCount;
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

                    var (content, mediaId, mediaMimeType, lat, lon) = ParseContent(message);
                    result.Add(new WhatsAppIncomingMessage(externalMessageId, citizenHandle, content, mediaId, mediaMimeType, receivedAtUtc, lat, lon));
                }
            }
        }

        return result;
    }

    private static (string Content, string? MediaId, string? MediaMimeType, double? Latitude, double? Longitude) ParseContent(JsonElement message)
    {
        var type = GetString(message, "type") ?? "unknown";

        if (type == "text" && message.TryGetProperty("text", out var text))
            return (GetString(text, "body") ?? "[metin mesajı]", null, null, null, null);

        if (type == "location" && message.TryGetProperty("location", out var location))
        {
            var name = GetString(location, "name");
            var address = GetString(location, "address");
            var contentText = string.Join(" - ", new[] { name, address }.Where(v => !string.IsNullOrWhiteSpace(v)));
            return (
                string.IsNullOrWhiteSpace(contentText) ? "[konum mesajı]" : contentText,
                null, null,
                GetDouble(location, "latitude"),
                GetDouble(location, "longitude"));
        }

        if (type == "interactive" && message.TryGetProperty("interactive", out var interactive))
        {
            if (interactive.TryGetProperty("button_reply", out var btn))
                return (GetString(btn, "title") ?? GetString(btn, "id") ?? "[düğme yanıtı]", null, null, null, null);
            if (interactive.TryGetProperty("list_reply", out var lst))
                return (GetString(lst, "title") ?? GetString(lst, "id") ?? "[liste yanıtı]", null, null, null, null);
        }

        // Media types: image, video, audio, document, sticker
        if (message.TryGetProperty(type, out var mediaObj))
        {
            var mediaId = GetString(mediaObj, "id");
            var mimeType = GetString(mediaObj, "mime_type");
            var caption = GetString(mediaObj, "caption");
            var displayContent = string.IsNullOrWhiteSpace(caption) ? $"[{type}]" : caption;
            return (displayContent, mediaId, mimeType, null, null);
        }

        return ($"[{type}]", null, null, null, null);
    }

    private static string? GetString(JsonElement el, string prop) =>
        el.TryGetProperty(prop, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;

    private static double? GetDouble(JsonElement el, string prop)
    {
        if (!el.TryGetProperty(prop, out var v)) return null;
        if (v.ValueKind == JsonValueKind.Number && v.TryGetDouble(out var d)) return d;
        if (v.ValueKind == JsonValueKind.String && double.TryParse(v.GetString(),
            System.Globalization.NumberStyles.Float,
            System.Globalization.CultureInfo.InvariantCulture, out d)) return d;
        return null;
    }

    private sealed record WhatsAppIncomingMessage(
        string ExternalMessageId,
        string CitizenHandle,
        string Content,
        string? MediaId,
        string? MediaMimeType,
        DateTimeOffset ReceivedAtUtc,
        double? Latitude,
        double? Longitude);
}
