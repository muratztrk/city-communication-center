using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace CityCommunicationCenter.Infrastructure.SocialMedia;

/// <summary>
/// Facebook Graph API client.
/// Handles both Page posts and Messenger conversations.
/// Documentation: https://developers.facebook.com/docs/graph-api
/// </summary>
public class FacebookClient : ISocialMediaClient
{
    private readonly HttpClient _httpClient;
    private readonly FacebookSettings _settings;
    private const string GraphApiBase = "https://graph.facebook.com/v18.0";

    public string Platform => "Facebook";

    public FacebookClient(HttpClient httpClient, FacebookSettings settings)
    {
        _httpClient = httpClient;
        _settings = settings;
    }

    public async Task<SocialMediaResult> SendMessageAsync(SendMessageRequest request, CancellationToken ct = default)
    {
        // Facebook Messenger - Send API
        var payload = new
        {
            recipient = new { id = request.RecipientId },
            message = new { text = request.Message },
            messaging_type = "RESPONSE"
        };

        var url = $"{GraphApiBase}/me/messages?access_token={_settings.PageAccessToken}";
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
        // Post to Facebook Page
        var payload = new Dictionary<string, string>
        {
            ["message"] = request.Content,
            ["access_token"] = _settings.PageAccessToken ?? ""
        };

        // Add media if provided
        if (request.MediaUrls?.Count > 0)
        {
            payload["link"] = request.MediaUrls[0]; // For link posts
        }

        var url = $"{GraphApiBase}/{_settings.PageId}/feed";
        var response = await PostFormAsync(url, payload, ct);

        if (response.IsSuccessStatusCode)
        {
            var json = await response.Content.ReadAsStringAsync(ct);
            var result = JsonDocument.Parse(json);
            var postId = result.RootElement.GetProperty("id").GetString();
            return SocialMediaResult.Ok(postId ?? "posted");
        }

        var error = await response.Content.ReadAsStringAsync(ct);
        return SocialMediaResult.Fail(error, response.StatusCode.ToString());
    }

    public async Task<SocialMediaResult> ReplyAsync(ReplyRequest request, CancellationToken ct = default)
    {
        // Reply to a comment on Facebook
        var payload = new Dictionary<string, string>
        {
            ["message"] = request.Content,
            ["access_token"] = _settings.PageAccessToken ?? ""
        };

        var url = $"{GraphApiBase}/{request.OriginalMessageId}/comments";
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
        // Fetch Page conversations
        var url = $"{GraphApiBase}/{_settings.PageId}/conversations?fields=participants,messages{{message,from,created_time}}&access_token={_settings.PageAccessToken}";

        var response = await _httpClient.GetAsync(url, ct);
        
        if (!response.IsSuccessStatusCode)
            return Array.Empty<IncomingMessage>();

        var json = await response.Content.ReadAsStringAsync(ct);
        var doc = JsonDocument.Parse(json);
        var messages = new List<IncomingMessage>();

        if (doc.RootElement.TryGetProperty("data", out var conversations))
        {
            foreach (var conv in conversations.EnumerateArray())
            {
                if (conv.TryGetProperty("messages", out var msgs) && 
                    msgs.TryGetProperty("data", out var msgData))
                {
                    foreach (var msg in msgData.EnumerateArray())
                    {
                        messages.Add(new IncomingMessage
                        {
                            MessageId = msg.GetProperty("id").GetString()!,
                            SenderId = msg.TryGetProperty("from", out var from) 
                                ? from.GetProperty("id").GetString()! : "",
                            SenderName = from.TryGetProperty("name", out var name) 
                                ? name.GetString() : null,
                            Content = msg.GetProperty("message").GetString()!,
                            ReceivedAt = msg.TryGetProperty("created_time", out var time)
                                ? DateTimeOffset.Parse(time.GetString()!)
                                : DateTimeOffset.UtcNow,
                            IsDirectMessage = true
                        });
                    }
                }
            }
        }

        return messages;
    }

    public async Task<UserProfile?> GetUserProfileAsync(string userId, CancellationToken ct = default)
    {
        var url = $"{GraphApiBase}/{userId}?fields=id,name,picture&access_token={_settings.PageAccessToken}";
        var response = await _httpClient.GetAsync(url, ct);

        if (!response.IsSuccessStatusCode)
            return null;

        var json = await response.Content.ReadAsStringAsync(ct);
        var user = JsonDocument.Parse(json).RootElement;

        return new UserProfile
        {
            UserId = user.GetProperty("id").GetString()!,
            DisplayName = user.TryGetProperty("name", out var n) ? n.GetString() : null,
            ProfileImageUrl = user.TryGetProperty("picture", out var p) && p.TryGetProperty("data", out var pd)
                ? pd.GetProperty("url").GetString() : null
        };
    }

    public async Task<bool> ValidateConnectionAsync(CancellationToken ct = default)
    {
        try
        {
            var url = $"{GraphApiBase}/me?access_token={_settings.PageAccessToken}";
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
