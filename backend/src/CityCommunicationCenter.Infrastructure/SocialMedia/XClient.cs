using CityCommunicationCenter.Application.Abstractions.SocialMedia;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace CityCommunicationCenter.Infrastructure.SocialMedia;

/// <summary>
/// X (formerly Twitter) API client.
/// Supports both API v1.1 and v2 endpoints.
/// Documentation: https://developer.x.com/en/docs
/// </summary>
public class XClient : ISocialMediaClient
{
    private readonly HttpClient _httpClient;
    private readonly XSettings _settings;
    private const string ApiBaseV2 = "https://api.twitter.com/2";
    private const string ApiBaseV1 = "https://api.twitter.com/1.1";

    public string Platform => "X";

    public XClient(HttpClient httpClient, XSettings settings)
    {
        _httpClient = httpClient;
        _settings = settings;
        
        if (!string.IsNullOrEmpty(settings.BearerToken))
        {
            _httpClient.DefaultRequestHeaders.Authorization = 
                new AuthenticationHeaderValue("Bearer", settings.BearerToken);
        }
    }

    public async Task<SocialMediaResult> SendMessageAsync(SendMessageRequest request, CancellationToken ct = default)
    {
        // X API v2 Direct Messages
        var payload = new
        {
            text = request.Message,
            // Media attachments would require separate upload
        };

        var response = await PostWithOAuth1Async(
            $"{ApiBaseV2}/dm_conversations/with/{request.RecipientId}/messages",
            payload, ct);

        if (response.IsSuccessStatusCode)
        {
            var json = await response.Content.ReadAsStringAsync(ct);
            var result = JsonDocument.Parse(json);
            var messageId = result.RootElement.GetProperty("data").GetProperty("dm_event_id").GetString();
            return SocialMediaResult.Ok(messageId ?? "sent");
        }

        var error = await response.Content.ReadAsStringAsync(ct);
        return SocialMediaResult.Fail(error, response.StatusCode.ToString());
    }

    public async Task<SocialMediaResult> PostAsync(PostRequest request, CancellationToken ct = default)
    {
        // X API v2 Create Tweet
        var payload = new Dictionary<string, object>
        {
            ["text"] = request.Content
        };

        if (!string.IsNullOrEmpty(request.ReplyToPostId))
        {
            payload["reply"] = new { in_reply_to_tweet_id = request.ReplyToPostId };
        }

        var response = await PostWithOAuth1Async($"{ApiBaseV2}/tweets", payload, ct);

        if (response.IsSuccessStatusCode)
        {
            var json = await response.Content.ReadAsStringAsync(ct);
            var result = JsonDocument.Parse(json);
            var tweetId = result.RootElement.GetProperty("data").GetProperty("id").GetString();
            return SocialMediaResult.Ok(tweetId ?? "posted");
        }

        var error = await response.Content.ReadAsStringAsync(ct);
        return SocialMediaResult.Fail(error, response.StatusCode.ToString());
    }

    public async Task<SocialMediaResult> ReplyAsync(ReplyRequest request, CancellationToken ct = default)
    {
        return await PostAsync(new PostRequest
        {
            Content = request.Content,
            ReplyToPostId = request.OriginalMessageId,
            MediaUrls = request.MediaUrls
        }, ct);
    }

    public async Task<IReadOnlyList<IncomingMessage>> FetchMessagesAsync(FetchMessagesRequest request, CancellationToken ct = default)
    {
        // Fetch mentions using X API v2
        var url = $"{ApiBaseV2}/users/me/mentions?max_results={Math.Min(request.MaxResults, 100)}&tweet.fields=created_at,author_id,conversation_id";
        
        if (!string.IsNullOrEmpty(request.Cursor))
            url += $"&pagination_token={request.Cursor}";

        var response = await GetWithBearerAsync(url, ct);
        
        if (!response.IsSuccessStatusCode)
            return Array.Empty<IncomingMessage>();

        var json = await response.Content.ReadAsStringAsync(ct);
        var doc = JsonDocument.Parse(json);
        var messages = new List<IncomingMessage>();

        if (doc.RootElement.TryGetProperty("data", out var data))
        {
            foreach (var tweet in data.EnumerateArray())
            {
                messages.Add(new IncomingMessage
                {
                    MessageId = tweet.GetProperty("id").GetString()!,
                    SenderId = tweet.GetProperty("author_id").GetString()!,
                    Content = tweet.GetProperty("text").GetString()!,
                    ReceivedAt = tweet.TryGetProperty("created_at", out var createdAt)
                        ? DateTimeOffset.Parse(createdAt.GetString()!)
                        : DateTimeOffset.UtcNow,
                    IsDirectMessage = false
                });
            }
        }

        return messages;
    }

    public async Task<UserProfile?> GetUserProfileAsync(string userId, CancellationToken ct = default)
    {
        var url = $"{ApiBaseV2}/users/{userId}?user.fields=name,username,profile_image_url,verified,public_metrics";
        var response = await GetWithBearerAsync(url, ct);

        if (!response.IsSuccessStatusCode)
            return null;

        var json = await response.Content.ReadAsStringAsync(ct);
        var doc = JsonDocument.Parse(json);
        var user = doc.RootElement.GetProperty("data");

        return new UserProfile
        {
            UserId = user.GetProperty("id").GetString()!,
            Handle = user.TryGetProperty("username", out var u) ? u.GetString() : null,
            DisplayName = user.TryGetProperty("name", out var n) ? n.GetString() : null,
            ProfileImageUrl = user.TryGetProperty("profile_image_url", out var p) ? p.GetString() : null,
            FollowersCount = user.TryGetProperty("public_metrics", out var pm) && pm.TryGetProperty("followers_count", out var fc)
                ? fc.GetInt32() : null,
            IsVerified = user.TryGetProperty("verified", out var v) ? v.GetBoolean() : null
        };
    }

    public async Task<bool> ValidateConnectionAsync(CancellationToken ct = default)
    {
        try
        {
            var response = await GetWithBearerAsync($"{ApiBaseV2}/users/me", ct);
            return response.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }

    #region OAuth 1.0a Helpers

    private async Task<HttpResponseMessage> GetWithBearerAsync(string url, CancellationToken ct)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _settings.BearerToken);
        return await _httpClient.SendAsync(request, ct);
    }

    private async Task<HttpResponseMessage> PostWithOAuth1Async(string url, object payload, CancellationToken ct)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json")
        };

        // Add OAuth 1.0a signature
        var oauthHeader = GenerateOAuthHeader("POST", url);
        request.Headers.TryAddWithoutValidation("Authorization", oauthHeader);

        return await _httpClient.SendAsync(request, ct);
    }

    private string GenerateOAuthHeader(string method, string url)
    {
        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString();
        var nonce = Guid.NewGuid().ToString("N");

        var parameters = new SortedDictionary<string, string>
        {
            ["oauth_consumer_key"] = _settings.ApiKey ?? "",
            ["oauth_nonce"] = nonce,
            ["oauth_signature_method"] = "HMAC-SHA1",
            ["oauth_timestamp"] = timestamp,
            ["oauth_token"] = _settings.AccessToken ?? "",
            ["oauth_version"] = "1.0"
        };

        var baseString = $"{method}&{Uri.EscapeDataString(url)}&{Uri.EscapeDataString(string.Join("&", parameters.Select(p => $"{p.Key}={p.Value}")))}";
        var signingKey = $"{Uri.EscapeDataString(_settings.ApiSecret ?? "")}&{Uri.EscapeDataString(_settings.AccessTokenSecret ?? "")}";
        
        using var hasher = new HMACSHA1(Encoding.ASCII.GetBytes(signingKey));
        var signature = Convert.ToBase64String(hasher.ComputeHash(Encoding.ASCII.GetBytes(baseString)));

        parameters["oauth_signature"] = signature;

        return "OAuth " + string.Join(", ", parameters.Select(p => $"{p.Key}=\"{Uri.EscapeDataString(p.Value)}\""));
    }

    #endregion
}
