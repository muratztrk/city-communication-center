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
        var messages = ParseMessages(request.Payload);
        if (messages.Count == 0)
        {
            return 0;
        }

        var externalIds = messages.Select(message => message.ExternalMessageId).ToArray();
        var existingIds = await _dbContext.SocialMessages
            .IgnoreQueryFilters()
            .Where(message =>
                message.TenantId == request.TenantId &&
                message.Channel == SocialChannel.WhatsApp &&
                externalIds.Contains(message.ExternalMessageId))
            .Select(message => message.ExternalMessageId)
            .ToHashSetAsync(cancellationToken);

        var newMessages = messages
            .Where(message => !existingIds.Contains(message.ExternalMessageId))
            .Select(message => new SocialMessage
            {
                SocialMessageId = Guid.NewGuid(),
                TenantId = request.TenantId,
                Channel = SocialChannel.WhatsApp,
                ExternalMessageId = message.ExternalMessageId,
                CitizenHandle = message.CitizenHandle,
                Content = message.Content,
                Latitude = message.Latitude,
                Longitude = message.Longitude,
                ReceivedAtUtc = message.ReceivedAtUtc,
                Status = SocialMessageStatus.New
            })
            .ToArray();

        if (newMessages.Length == 0)
        {
            return 0;
        }

        _dbContext.SocialMessages.AddRange(newMessages);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return newMessages.Length;
    }

    private static List<WhatsAppIncomingMessage> ParseMessages(JsonElement payload)
    {
        var result = new List<WhatsAppIncomingMessage>();
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
                    !value.TryGetProperty("messages", out var messages) ||
                    messages.ValueKind != JsonValueKind.Array)
                {
                    continue;
                }

                foreach (var message in messages.EnumerateArray())
                {
                    var externalMessageId = GetString(message, "id");
                    var citizenHandle = GetString(message, "from");
                    if (string.IsNullOrWhiteSpace(externalMessageId) ||
                        string.IsNullOrWhiteSpace(citizenHandle))
                    {
                        continue;
                    }

                    var receivedAtUtc = DateTimeOffset.UtcNow;
                    if (long.TryParse(GetString(message, "timestamp"), out var timestamp))
                    {
                        receivedAtUtc = DateTimeOffset.FromUnixTimeSeconds(timestamp);
                    }

                    var (content, latitude, longitude) = ParseContent(message);
                    result.Add(new WhatsAppIncomingMessage(
                        externalMessageId,
                        citizenHandle,
                        content,
                        receivedAtUtc,
                        latitude,
                        longitude));
                }
            }
        }

        return result;
    }

    private static (string Content, double? Latitude, double? Longitude) ParseContent(JsonElement message)
    {
        var type = GetString(message, "type") ?? "unknown";
        if (message.TryGetProperty("text", out var text))
        {
            return (GetString(text, "body") ?? "[Text message]", null, null);
        }

        if (message.TryGetProperty("location", out var location))
        {
            var name = GetString(location, "name");
            var address = GetString(location, "address");
            var content = string.Join(" - ", new[] { name, address }.Where(value => !string.IsNullOrWhiteSpace(value)));
            return (
                string.IsNullOrWhiteSpace(content) ? "[Location message]" : content,
                GetDouble(location, "latitude"),
                GetDouble(location, "longitude"));
        }

        if (message.TryGetProperty("interactive", out var interactive))
        {
            if (interactive.TryGetProperty("button_reply", out var buttonReply))
            {
                return (GetString(buttonReply, "title") ?? GetString(buttonReply, "id") ?? "[Button reply]", null, null);
            }

            if (interactive.TryGetProperty("list_reply", out var listReply))
            {
                return (GetString(listReply, "title") ?? GetString(listReply, "id") ?? "[List reply]", null, null);
            }
        }

        if (message.TryGetProperty(type, out var typedContent))
        {
            var caption = GetString(typedContent, "caption");
            return (string.IsNullOrWhiteSpace(caption) ? $"[{type} message]" : caption, null, null);
        }

        return ($"[{type} message]", null, null);
    }

    private static string? GetString(JsonElement element, string propertyName)
    {
        return element.TryGetProperty(propertyName, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;
    }

    private static double? GetDouble(JsonElement element, string propertyName)
    {
        return element.TryGetProperty(propertyName, out var value) && value.TryGetDouble(out var result)
            ? result
            : null;
    }

    private sealed record WhatsAppIncomingMessage(
        string ExternalMessageId,
        string CitizenHandle,
        string Content,
        DateTimeOffset ReceivedAtUtc,
        double? Latitude,
        double? Longitude);
}
