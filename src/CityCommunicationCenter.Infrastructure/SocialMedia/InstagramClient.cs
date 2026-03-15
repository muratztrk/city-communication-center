using System.Text;
using System.Text.Json;

namespace CityCommunicationCenter.Infrastructure.SocialMedia;

/// <summary>
/// Instagram Graph API client.
/// Uses Facebook Graph API for Instagram Business accounts.
/// Documentation: https://developers.facebook.com/docs/instagram-api
/// </summary>
public class InstagramClient : ISocialMediaClient
{
    private readonly HttpClient _httpClient;
    private readonly InstagramSettings _settings;
    private const string GraphApiBase = "https://graph.facebook.com/v18.0";

    public string Platform => "Instagram";

    public InstagramClient(HttpClient httpClient, InstagramSettings settings)
    {
        _httpClient = httpClient;
        _settings = settings;
    }

    public async Task<SocialMediaResult> SendMessageAsync(SendMessageRequest request, CancellationToken ct = default)
    {
        // Instagram DMs via Messenger API
        var payload = new
        {
            recipient = new { id = request.RecipientId },
            message = new { text = request.Message }
        };

        var url = $"{GraphApiBase}/me/messages?access_token={_settings.AccessToken}";
        var response = await PostJsonAsync(url, payload, ct);

        if (response.IsSuccessStatusCode)
        {
            var json = await response.Content.ReadAsStringAsync(ct);
            var result = JsonDocument.Parse(json);
            var messageId = result.RootElement.GetProperty("message_id").GetString();
            return SocialMediaResult.Ok(messageId ?? "sent");
        }

        var error = await response.Content.ReadAsStringAsync(ct);
        return SocialMediaResult.Fail(error, response.StatusCode.ToString());
    }

    public async Task<SocialMediaResult> PostAsync(PostRequest request, CancellationToken ct = default)
    {
        // Instagram requires media for posts
        if (request.MediaUrls == null || request.MediaUrls.Count == 0)
        {
            return SocialMediaResult.Fail("Instagram posts require at least one media item");
        }

        // Step 1: Create media container
        var containerPayload = new Dictionary<string, string>
        {
            ["image_url"] = request.MediaUrls[0],
            ["caption"] = request.Content,
            ["access_token"] = _settings.AccessToken ?? ""
        };

        var containerUrl = $"{GraphApiBase}/{_settings.AccountId}/media";
        var containerResponse = await PostFormAsync(containerUrl, containerPayload, ct);

        if (!containerResponse.IsSuccessStatusCode)
        {
            var error = await containerResponse.Content.ReadAsStringAsync(ct);
            return SocialMediaResult.Fail($"Failed to create media container: {error}");
        }

        var containerJson = await containerResponse.Content.ReadAsStringAsync(ct);
        var containerId = JsonDocument.Parse(containerJson).RootElement.GetProperty("id").GetString();

        // Step 2: Publish media container
        var publishPayload = new Dictionary<string, string>
        {
            ["creation_id"] = containerId!,
            ["access_token"] = _settings.AccessToken ?? ""
        };

        var publishUrl = $"{GraphApiBase}/{_settings.AccountId}/media_publish";
        var publishResponse = await PostFormAsync(publishUrl, publishPayload, ct);

        if (publishResponse.IsSuccessStatusCode)
        {
            var json = await publishResponse.Content.ReadAsStringAsync(ct);
            var result = JsonDocument.Parse(json);
            var mediaId = result.RootElement.GetProperty("id").GetString();
            return SocialMediaResult.Ok(mediaId ?? "posted");
        }

        var publishError = await publishResponse.Content.ReadAsStringAsync(ct);
        return SocialMediaResult.Fail(publishError, publishResponse.StatusCode.ToString());
    }

    public async Task<SocialMediaResult> ReplyAsync(ReplyRequest request, CancellationToken ct = default)
    {
        // Reply to a comment on Instagram
        var payload = new Dictionary<string, string>
        {
            ["message"] = request.Content,
            ["access_token"] = _settings.AccessToken ?? ""
        };

        var url = $"{GraphApiBase}/{request.OriginalMessageId}/replies";
        var response = await PostFormAsync(url, payload, ct);

        if (response.IsSuccessStatusCode)
        {
            var json = await response.Content.ReadAsStringAsync(ct);
            var result = JsonDocument.Parse(json);
            var commentId = result.RootElement.GetProperty("id").GetString();
            return SocialMediaResult.Ok(commentId ?? "replied");
        }

        var error = await response.Content.ReadAsStringAsync(ct);
        return SocialMediaResult.Fail(error, response.StatusCode.ToString());
    }

    public async Task<IReadOnlyList<IncomingMessage>> FetchMessagesAsync(FetchMessagesRequest request, CancellationToken ct = default)
    {
        // Fetch Instagram comments on recent media
        var mediaUrl = $"{GraphApiBase}/{_settings.AccountId}/media?fields=id,caption,comments{{id,text,from,timestamp}}&access_token={_settings.AccessToken}";

        var response = await _httpClient.GetAsync(mediaUrl, ct);
        
        if (!response.IsSuccessStatusCode)
            return Array.Empty<IncomingMessage>();

        var json = await response.Content.ReadAsStringAsync(ct);
        var doc = JsonDocument.Parse(json);
        var messages = new List<IncomingMessage>();

        if (doc.RootElement.TryGetProperty("data", out var media))
        {
            foreach (var post in media.EnumerateArray())
            {
                if (post.TryGetProperty("comments", out var comments) && 
                    comments.TryGetProperty("data", out var commentData))
                {
                    foreach (var comment in commentData.EnumerateArray())
                    {
                        messages.Add(new IncomingMessage
                        {
                            MessageId = comment.GetProperty("id").GetString()!,
                            SenderId = comment.TryGetProperty("from", out var from) 
                                ? from.GetProperty("id").GetString()! : "",
                            SenderHandle = from.TryGetProperty("username", out var username) 
                                ? username.GetString() : null,
                            Content = comment.GetProperty("text").GetString()!,
                            ReceivedAt = comment.TryGetProperty("timestamp", out var time)
                                ? DateTimeOffset.Parse(time.GetString()!)
                                : DateTimeOffset.UtcNow,
                            IsDirectMessage = false
                        });
                    }
                }
            }
        }

        return messages;
    }

    public async Task<UserProfile?> GetUserProfileAsync(string userId, CancellationToken ct = default)
    {
        var url = $"{GraphApiBase}/{userId}?fields=id,username,name,profile_picture_url,followers_count&access_token={_settings.AccessToken}";
        var response = await _httpClient.GetAsync(url, ct);

        if (!response.IsSuccessStatusCode)
            return null;

        var json = await response.Content.ReadAsStringAsync(ct);
        var user = JsonDocument.Parse(json).RootElement;

        return new UserProfile
        {
            UserId = user.GetProperty("id").GetString()!,
            Handle = user.TryGetProperty("username", out var u) ? u.GetString() : null,
            DisplayName = user.TryGetProperty("name", out var n) ? n.GetString() : null,
            ProfileImageUrl = user.TryGetProperty("profile_picture_url", out var p) ? p.GetString() : null,
            FollowersCount = user.TryGetProperty("followers_count", out var fc) ? fc.GetInt32() : null
        };
    }

    public async Task<bool> ValidateConnectionAsync(CancellationToken ct = default)
    {
        try
        {
            var url = $"{GraphApiBase}/{_settings.AccountId}?fields=id,username&access_token={_settings.AccessToken}";
            var response = await _httpClient.GetAsync(url, ct);
            return response.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }

    #region Helpers

    private async Task<HttpResponseMessage> PostJsonAsync(string url, object payload, CancellationToken ct)
    {
        var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
        return await _httpClient.PostAsync(url, content, ct);
    }

    private async Task<HttpResponseMessage> PostFormAsync(string url, Dictionary<string, string> payload, CancellationToken ct)
    {
        var content = new FormUrlEncodedContent(payload);
        return await _httpClient.PostAsync(url, content, ct);
    }

    #endregion
}
