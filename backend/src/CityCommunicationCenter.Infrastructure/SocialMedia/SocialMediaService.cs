namespace CityCommunicationCenter.Infrastructure.SocialMedia;

/// <summary>
/// Coordinates social media operations across all platforms.
/// Provides unified interface for sending messages, fetching data, and processing webhooks.
/// </summary>
public interface ISocialMediaService
{
    /// <summary>
    /// Sends a reply to a social media message.
    /// </summary>
    Task<SocialMediaResult> SendReplyAsync(Guid tenantId, SocialMessage originalMessage, string replyContent, CancellationToken ct = default);

    /// <summary>
    /// Posts content to a social media channel.
    /// </summary>
    Task<SocialMediaResult> PostAsync(Guid tenantId, SocialChannel channel, string content, List<string>? mediaUrls = null, CancellationToken ct = default);

    /// <summary>
    /// Fetches new messages from all configured channels.
    /// </summary>
    Task<IReadOnlyList<IncomingMessage>> FetchAllMessagesAsync(Guid tenantId, DateTimeOffset? since = null, CancellationToken ct = default);

    /// <summary>
    /// Processes an incoming webhook and stores the message.
    /// </summary>
    Task<SocialMessage?> ProcessWebhookAsync(Guid tenantId, SocialChannel channel, IncomingMessage message, CancellationToken ct = default);

    /// <summary>
    /// Gets connection status for all channels.
    /// </summary>
    Task<Dictionary<SocialChannel, bool>> GetChannelStatusAsync(Guid tenantId, CancellationToken ct = default);
}

public class SocialMediaService : ISocialMediaService
{
    private readonly ISocialMediaClientFactory _clientFactory;
    private readonly CityCommunicationCenterDbContext _dbContext;
    private readonly ILogger<SocialMediaService> _logger;

    public SocialMediaService(
        ISocialMediaClientFactory clientFactory,
        CityCommunicationCenterDbContext dbContext,
        ILogger<SocialMediaService> logger)
    {
        _clientFactory = clientFactory;
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task<SocialMediaResult> SendReplyAsync(
        Guid tenantId,
        SocialMessage originalMessage,
        string replyContent,
        CancellationToken ct = default)
    {
        var client = _clientFactory.GetClient(originalMessage.Channel, tenantId);
        if (client == null)
        {
            return SocialMediaResult.Fail($"Channel {originalMessage.Channel} is not configured for this tenant");
        }

        var result = await client.ReplyAsync(new ReplyRequest
        {
            OriginalMessageId = originalMessage.ExternalMessageId ?? originalMessage.SocialMessageId.ToString(),
            RecipientId = originalMessage.CitizenHandle,
            Content = replyContent
        }, ct);

        if (result.Success)
        {
            // Mark as responded - update would be done via controller
            // The controller should call the update endpoint after successful send
        }

        return result;
    }

    public async Task<SocialMediaResult> PostAsync(
        Guid tenantId,
        SocialChannel channel,
        string content,
        List<string>? mediaUrls = null,
        CancellationToken ct = default)
    {
        var client = _clientFactory.GetClient(channel, tenantId);
        if (client == null)
        {
            return SocialMediaResult.Fail($"Channel {channel} is not configured for this tenant");
        }

        return await client.PostAsync(new PostRequest
        {
            Content = content,
            MediaUrls = mediaUrls
        }, ct);
    }

    public async Task<IReadOnlyList<IncomingMessage>> FetchAllMessagesAsync(
        Guid tenantId,
        DateTimeOffset? since = null,
        CancellationToken ct = default)
    {
        var allMessages = new List<IncomingMessage>();

        foreach (var client in _clientFactory.GetAllClients(tenantId))
        {
            try
            {
                var messages = await client.FetchMessagesAsync(new FetchMessagesRequest
                {
                    Since = since,
                    MaxResults = 100
                }, ct);

                allMessages.AddRange(messages);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error fetching messages from {Platform}", client.Platform);
            }
        }

        return allMessages.OrderByDescending(m => m.ReceivedAt).ToList();
    }

    public async Task<SocialMessage?> ProcessWebhookAsync(
        Guid tenantId,
        SocialChannel channel,
        IncomingMessage message,
        CancellationToken ct = default)
    {
        // Check if message already exists
        var existing = await _dbContext.SocialMessages
            .WhereTenant(tenantId)
            .Where(entity => entity.ExternalMessageId == message.MessageId)
            .FirstOrDefaultAsync(ct);

        if (existing != null)
            return existing;

        // Create new message
        var socialMessage = new SocialMessage
        {
            SocialMessageId = Guid.NewGuid(),
            TenantId = tenantId,
            Channel = channel,
            ExternalMessageId = message.MessageId,
            CitizenHandle = message.SenderHandle ?? message.SenderId,
            Content = message.Content,
            Latitude = message.Latitude,
            Longitude = message.Longitude,
            ReceivedAtUtc = message.ReceivedAt,
            Status = SocialMessageStatus.New
        };

        _dbContext.SocialMessages.Add(socialMessage);
        await _dbContext.SaveChangesAsync(ct);
        return socialMessage;
    }

    public async Task<Dictionary<SocialChannel, bool>> GetChannelStatusAsync(
        Guid tenantId,
        CancellationToken ct = default)
    {
        var status = new Dictionary<SocialChannel, bool>();
        var channels = new[] { SocialChannel.X, SocialChannel.Facebook, SocialChannel.Instagram, SocialChannel.WhatsApp };

        foreach (var channel in channels)
        {
            var client = _clientFactory.GetClient(channel, tenantId);
            if (client == null)
            {
                status[channel] = false;
                continue;
            }

            try
            {
                status[channel] = await client.ValidateConnectionAsync(ct);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to validate connection for {Channel}", channel);
                status[channel] = false;
            }
        }

        return status;
    }
}
