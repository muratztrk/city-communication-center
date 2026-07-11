using System.Net.Http.Headers;

namespace CityCommunicationCenter.Infrastructure.SocialMedia;

/// <summary>
/// WhatsApp Business API client.
/// Uses Meta's Cloud API for WhatsApp Business.
/// Documentation: https://developers.facebook.com/docs/whatsapp/cloud-api
/// </summary>
public class WhatsAppClient : ISocialMediaClient, IWhatsAppMediaClient, IWhatsAppTemplateClient
{
    private readonly HttpClient _httpClient;
    private readonly WhatsAppSettings _settings;
    private const string ApiBase = "https://graph.facebook.com/v25.0";

    public string Platform => "WhatsApp";

    public WhatsAppClient(HttpClient httpClient, WhatsAppSettings settings)
    {
        _httpClient = httpClient;
        _settings = settings;
    }

    public async Task<IReadOnlyList<WhatsAppMetaTemplateInfo>> ListApprovedMessageTemplatesAsync(CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(_settings.BusinessAccountId) || string.IsNullOrWhiteSpace(_settings.AccessToken))
        {
            throw new InvalidOperationException("WhatsApp Business Account ID veya Access Token eksik.");
        }

        var results = new List<WhatsAppMetaTemplateInfo>();
        string? after = null;

        do
        {
            var url = $"{ApiBase}/{_settings.BusinessAccountId}/message_templates"
                + "?status=APPROVED&fields=name,language,status,id,components&limit=100"
                + (after is null ? string.Empty : $"&after={Uri.EscapeDataString(after)}");

            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            request.Headers.TryAddWithoutValidation("Authorization", $"Bearer {_settings.AccessToken}");
            var response = await _httpClient.SendAsync(request, ct);
            var json = await response.Content.ReadAsStringAsync(ct);
            if (!response.IsSuccessStatusCode)
            {
                throw new InvalidOperationException($"Meta şablon listesi alınamadı: {json}");
            }

            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            if (root.TryGetProperty("data", out var data) && data.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in data.EnumerateArray())
                {
                    var name = TryGetString(item, "name");
                    var language = TryGetString(item, "language") ?? "tr";
                    var status = TryGetString(item, "status") ?? "APPROVED";
                    var externalId = TryGetString(item, "id");
                    if (string.IsNullOrWhiteSpace(name))
                    {
                        continue;
                    }

                    results.Add(new WhatsAppMetaTemplateInfo(
                        name,
                        language,
                        externalId,
                        status,
                        ExtractBodyText(item)));
                }
            }

            after = null;
            if (root.TryGetProperty("paging", out var paging)
                && paging.TryGetProperty("next", out _)
                && paging.TryGetProperty("cursors", out var cursors)
                && cursors.TryGetProperty("after", out var afterEl)
                && afterEl.ValueKind == JsonValueKind.String)
            {
                after = afterEl.GetString();
            }
        }
        while (!string.IsNullOrWhiteSpace(after));

        return results;
    }

    private static string ExtractBodyText(JsonElement template)
    {
        if (!template.TryGetProperty("components", out var components) || components.ValueKind != JsonValueKind.Array)
        {
            return string.Empty;
        }

        foreach (var component in components.EnumerateArray())
        {
            var type = TryGetString(component, "type");
            if (!string.Equals(type, "BODY", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            return TryGetString(component, "text")?.Trim() ?? string.Empty;
        }

        return string.Empty;
    }

    public async Task<SocialMediaResult> SendMessageAsync(SendMessageRequest request, CancellationToken ct = default)
    {
        var payload = new
        {
            messaging_product = "whatsapp",
            recipient_type = "individual",
            to = request.RecipientId, // Phone number in international format
            type = "text",
            text = new { body = request.Message }
        };

        var url = $"{ApiBase}/{_settings.PhoneNumberId}/messages";
        var response = await PostJsonAsync(url, payload, ct);

        if (response.IsSuccessStatusCode)
        {
            var json = await response.Content.ReadAsStringAsync(ct);
            var result = JsonDocument.Parse(json);
            var messageId = result.RootElement.GetProperty("messages")[0].GetProperty("id").GetString();
            return SocialMediaResult.Ok(messageId ?? "sent");
        }

        var error = await response.Content.ReadAsStringAsync(ct);
        return SocialMediaResult.Fail(error, response.StatusCode.ToString());
    }

    public async Task<SocialMediaResult> SendUploadedMediaMessageAsync(SendUploadedMediaMessageRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(_settings.PhoneNumberId) || string.IsNullOrWhiteSpace(_settings.AccessToken))
        {
            return SocialMediaResult.Fail("WhatsApp ayarları eksik. PhoneNumberId veya AccessToken bulunamadı.");
        }

        var uploadResult = await UploadMediaAsync(request.FileName, request.ContentType, request.Content, ct);
        if (!uploadResult.Success || string.IsNullOrWhiteSpace(uploadResult.MediaId))
        {
            return uploadResult;
        }

        var mediaType = ResolveWhatsAppMediaType(request.ContentType);
        var mediaPayload = new Dictionary<string, object>
        {
            ["id"] = uploadResult.MediaId
        };

        if (!string.IsNullOrWhiteSpace(request.Caption) && mediaType != "audio")
        {
            mediaPayload["caption"] = request.Caption.Trim();
        }

        if (mediaType == "document")
        {
            mediaPayload["filename"] = request.FileName;
        }

        var payload = new Dictionary<string, object>
        {
            ["messaging_product"] = "whatsapp",
            ["recipient_type"] = "individual",
            ["to"] = request.RecipientId,
            ["type"] = mediaType,
            [mediaType] = mediaPayload
        };

        var url = $"{ApiBase}/{_settings.PhoneNumberId}/messages";
        var response = await PostJsonAsync(url, payload, ct);

        if (response.IsSuccessStatusCode)
        {
            var json = await response.Content.ReadAsStringAsync(ct);
            using var result = JsonDocument.Parse(json);
            var messageId = result.RootElement.GetProperty("messages")[0].GetProperty("id").GetString();
            return SocialMediaResult.Ok(messageId ?? "sent", uploadResult.MediaId);
        }

        var error = await response.Content.ReadAsStringAsync(ct);
        return SocialMediaResult.Fail(error, response.StatusCode.ToString());
    }

    public async Task<SocialMediaResult> PostAsync(PostRequest request, CancellationToken ct = default)
    {
        // WhatsApp doesn't support public posts - it's messaging only
        return SocialMediaResult.Fail("WhatsApp does not support public posts. Use SendMessageAsync for direct messaging.");
    }

    public async Task<SocialMediaResult> ReplyAsync(ReplyRequest request, CancellationToken ct = default)
    {
        // Reply to a message using context
        var payload = new
        {
            messaging_product = "whatsapp",
            recipient_type = "individual",
            to = request.RecipientId,
            type = "text",
            context = new { message_id = request.OriginalMessageId },
            text = new { body = request.Content }
        };

        var url = $"{ApiBase}/{_settings.PhoneNumberId}/messages";
        var response = await PostJsonAsync(url, payload, ct);

        if (response.IsSuccessStatusCode)
        {
            var json = await response.Content.ReadAsStringAsync(ct);
            var result = JsonDocument.Parse(json);
            var messageId = result.RootElement.GetProperty("messages")[0].GetProperty("id").GetString();
            return SocialMediaResult.Ok(messageId ?? "replied");
        }

        var error = await response.Content.ReadAsStringAsync(ct);
        return SocialMediaResult.Fail(error, response.StatusCode.ToString());
    }

    public Task<IReadOnlyList<IncomingMessage>> FetchMessagesAsync(FetchMessagesRequest request, CancellationToken ct = default)
    {
        // WhatsApp messages are received via webhooks, not polling
        // This method would query stored messages from database
        return Task.FromResult<IReadOnlyList<IncomingMessage>>(Array.Empty<IncomingMessage>());
    }

    public Task<UserProfile?> GetUserProfileAsync(string userId, CancellationToken ct = default)
    {
        // WhatsApp doesn't provide public profile API
        // Profile info comes from webhook payloads
        return Task.FromResult<UserProfile?>(new UserProfile
        {
            UserId = userId,
            Handle = userId // Phone number
        });
    }

    public async Task<bool> ValidateConnectionAsync(CancellationToken ct = default)
    {
        try
        {
            var url = $"{ApiBase}/{_settings.PhoneNumberId}";
            var request = new HttpRequestMessage(HttpMethod.Get, url);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _settings.AccessToken);
            var response = await _httpClient.SendAsync(request, ct);
            return response.IsSuccessStatusCode;
        }
        catch (HttpRequestException)
        {
            return false;
        }
    }

    #region Template Messages

    /// <summary>
    /// Send a pre-approved template message (required for initiating conversations).
    /// </summary>
    public async Task<SocialMediaResult> SendTemplateMessageAsync(
        string phoneNumber,
        string templateName,
        string languageCode,
        Dictionary<string, string>? parameters = null,
        CancellationToken ct = default)
    {
        var components = new List<object>();
        
        if (parameters?.Count > 0)
        {
            components.Add(new
            {
                type = "body",
                parameters = parameters.Select(p => new { type = "text", text = p.Value }).ToArray()
            });
        }

        var payload = new
        {
            messaging_product = "whatsapp",
            recipient_type = "individual",
            to = phoneNumber,
            type = "template",
            template = new
            {
                name = templateName,
                language = new { code = languageCode },
                components = components.Count > 0 ? components : null
            }
        };

        var url = $"{ApiBase}/{_settings.PhoneNumberId}/messages";
        var response = await PostJsonAsync(url, payload, ct);

        if (response.IsSuccessStatusCode)
        {
            var json = await response.Content.ReadAsStringAsync(ct);
            var result = JsonDocument.Parse(json);
            var messageId = result.RootElement.GetProperty("messages")[0].GetProperty("id").GetString();
            return SocialMediaResult.Ok(messageId ?? "sent");
        }

        var error = await response.Content.ReadAsStringAsync(ct);
        return SocialMediaResult.Fail(error, response.StatusCode.ToString());
    }

    /// <summary>
    /// Send a message with media attachment.
    /// </summary>
    public async Task<SocialMediaResult> SendMediaMessageAsync(
        string phoneNumber,
        string mediaType, // image, document, audio, video
        string mediaUrl,
        string? caption = null,
        CancellationToken ct = default)
    {
        var mediaPayload = new Dictionary<string, object>
        {
            ["link"] = mediaUrl
        };
        
        if (!string.IsNullOrEmpty(caption))
            mediaPayload["caption"] = caption;

        var payload = new Dictionary<string, object>
        {
            ["messaging_product"] = "whatsapp",
            ["recipient_type"] = "individual",
            ["to"] = phoneNumber,
            ["type"] = mediaType,
            [mediaType] = mediaPayload
        };

        var url = $"{ApiBase}/{_settings.PhoneNumberId}/messages";
        var response = await PostJsonAsync(url, payload, ct);

        if (response.IsSuccessStatusCode)
        {
            var json = await response.Content.ReadAsStringAsync(ct);
            var result = JsonDocument.Parse(json);
            var messageId = result.RootElement.GetProperty("messages")[0].GetProperty("id").GetString();
            return SocialMediaResult.Ok(messageId ?? "sent");
        }

        var error = await response.Content.ReadAsStringAsync(ct);
        return SocialMediaResult.Fail(error, response.StatusCode.ToString());
    }

    /// <summary>
    /// Send interactive message with buttons.
    /// </summary>
    public async Task<SocialMediaResult> SendInteractiveMessageAsync(
        string phoneNumber,
        string bodyText,
        List<(string id, string title)> buttons,
        string? headerText = null,
        string? footerText = null,
        CancellationToken ct = default)
    {
        var interactive = new Dictionary<string, object>
        {
            ["type"] = "button",
            ["body"] = new { text = bodyText },
            ["action"] = new
            {
                buttons = buttons.Select(b => new
                {
                    type = "reply",
                    reply = new { id = b.id, title = b.title }
                }).ToArray()
            }
        };

        if (!string.IsNullOrEmpty(headerText))
            interactive["header"] = new { type = "text", text = headerText };

        if (!string.IsNullOrEmpty(footerText))
            interactive["footer"] = new { text = footerText };

        var payload = new
        {
            messaging_product = "whatsapp",
            recipient_type = "individual",
            to = phoneNumber,
            type = "interactive",
            interactive
        };

        var url = $"{ApiBase}/{_settings.PhoneNumberId}/messages";
        var response = await PostJsonAsync(url, payload, ct);

        if (response.IsSuccessStatusCode)
        {
            var json = await response.Content.ReadAsStringAsync(ct);
            var result = JsonDocument.Parse(json);
            var messageId = result.RootElement.GetProperty("messages")[0].GetProperty("id").GetString();
            return SocialMediaResult.Ok(messageId ?? "sent");
        }

        var error = await response.Content.ReadAsStringAsync(ct);
        return SocialMediaResult.Fail(error, response.StatusCode.ToString());
    }

    #endregion

    #region Webhook Processing

    /// <summary>
    /// Process incoming webhook payload from WhatsApp.
    /// </summary>
    public static IEnumerable<IncomingMessage> ParseWebhookPayload(JsonElement payload)
    {
        var messages = new List<IncomingMessage>();

        if (!payload.TryGetProperty("entry", out var entries))
            return messages;

        foreach (var entry in entries.EnumerateArray())
        {
            if (!entry.TryGetProperty("changes", out var changes))
                continue;

            foreach (var change in changes.EnumerateArray())
            {
                if (!change.TryGetProperty("value", out var value))
                    continue;

                if (!value.TryGetProperty("messages", out var msgs))
                    continue;

                var contacts = value.TryGetProperty("contacts", out var c) ? c : default;

                foreach (var msg in msgs.EnumerateArray())
                {
                    var senderId = msg.GetProperty("from").GetString()!;
                    var senderName = contacts.ValueKind != JsonValueKind.Undefined
                        ? contacts.EnumerateArray()
                            .FirstOrDefault(c => c.GetProperty("wa_id").GetString() == senderId)
                            .GetProperty("profile").GetProperty("name").GetString()
                        : null;

                    double? latitude = null;
                    double? longitude = null;
                    string content;

                    if (msg.TryGetProperty("text", out var text))
                    {
                        content = text.GetProperty("body").GetString()!;
                    }
                    else if (msg.TryGetProperty("location", out var location))
                    {
                        latitude = TryGetDouble(location, "latitude");
                        longitude = TryGetDouble(location, "longitude");
                        var name = TryGetString(location, "name");
                        var address = TryGetString(location, "address");
                        content = string.Join(" - ", new[] { name, address }.Where(value => !string.IsNullOrWhiteSpace(value)));
                        if (string.IsNullOrWhiteSpace(content))
                        {
                            content = "[Location message]";
                        }
                    }
                    else
                    {
                        content = "[Media or interactive message]";
                    }

                    messages.Add(new IncomingMessage
                    {
                        MessageId = msg.GetProperty("id").GetString()!,
                        SenderId = senderId,
                        SenderHandle = senderId,
                        SenderName = senderName,
                        Content = content,
                        Latitude = latitude,
                        Longitude = longitude,
                        ReceivedAt = DateTimeOffset.FromUnixTimeSeconds(
                            long.Parse(msg.GetProperty("timestamp").GetString()!)),
                        IsDirectMessage = true
                    });
                }
            }
        }

        return messages;
    }

    #endregion

    #region Helpers

    private static string? TryGetString(JsonElement element, string propertyName)
    {
        return element.TryGetProperty(propertyName, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;
    }

    private static double? TryGetDouble(JsonElement element, string propertyName)
    {
        if (!element.TryGetProperty(propertyName, out var value))
        {
            return null;
        }

        if (value.ValueKind == JsonValueKind.Number && value.TryGetDouble(out var number))
        {
            return number;
        }

        return value.ValueKind == JsonValueKind.String && double.TryParse(value.GetString(), System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out number)
            ? number
            : null;
    }

    private async Task<HttpResponseMessage> PostJsonAsync(string url, object payload, CancellationToken ct)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json")
        };
        request.Headers.TryAddWithoutValidation("Authorization", $"Bearer {_settings.AccessToken}");
        
        return await _httpClient.SendAsync(request, ct);
    }

    private async Task<SocialMediaResult> UploadMediaAsync(string fileName, string contentType, byte[] content, CancellationToken ct)
    {
        var url = $"{ApiBase}/{_settings.PhoneNumberId}/media";
        using var form = new MultipartFormDataContent();
        form.Add(new StringContent("whatsapp"), "messaging_product");

        var fileContent = new ByteArrayContent(content);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue(string.IsNullOrWhiteSpace(contentType) ? "application/octet-stream" : contentType);
        form.Add(fileContent, "file", fileName);

        using var httpRequest = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = form
        };
        httpRequest.Headers.TryAddWithoutValidation("Authorization", $"Bearer {_settings.AccessToken}");

        var response = await _httpClient.SendAsync(httpRequest, ct);
        var json = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode)
        {
            return SocialMediaResult.Fail(json, response.StatusCode.ToString());
        }

        using var result = JsonDocument.Parse(json);
        var mediaId = result.RootElement.TryGetProperty("id", out var idProperty)
            ? idProperty.GetString()
            : null;

        return string.IsNullOrWhiteSpace(mediaId)
            ? SocialMediaResult.Fail("WhatsApp medya yükleme cevabında medya ID bulunamadı.")
            : SocialMediaResult.Ok("uploaded", mediaId);
    }

    private static string ResolveWhatsAppMediaType(string contentType)
    {
        if (contentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase)) return "image";
        if (contentType.StartsWith("video/", StringComparison.OrdinalIgnoreCase)) return "video";
        if (contentType.StartsWith("audio/", StringComparison.OrdinalIgnoreCase)) return "audio";
        return "document";
    }

    #endregion
}
