using System.Net.Http.Json;
using System.Text.Json.Serialization;
using CityCommunicationCenter.Application.Abstractions.Support;

namespace CityCommunicationCenter.Infrastructure.Support;

public sealed class LumespecSupportClient : ILumespecSupportClient
{
    public const string HttpClientName = nameof(LumespecSupportClient);
    private const string ExternalSource = "city-communication-center";

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly LumespecSupportOptions _options;
    private readonly ILogger<LumespecSupportClient> _logger;

    public LumespecSupportClient(
        IHttpClientFactory httpClientFactory,
        IOptions<LumespecSupportOptions> options,
        ILogger<LumespecSupportClient> logger)
    {
        _httpClientFactory = httpClientFactory;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<CentralSupportTicketResult?> CreateTicketAsync(
        CreateCentralSupportTicketRequest request,
        CancellationToken cancellationToken)
    {
        if (!_options.Enabled || string.IsNullOrWhiteSpace(_options.ServiceToken))
        {
            return null;
        }

        try
        {
            var client = _httpClientFactory.CreateClient(HttpClientName);
            using var message = new HttpRequestMessage(HttpMethod.Post, "/api/external/tickets")
            {
                Content = JsonContent.Create(new
                {
                    externalSource = "city-communication-center",
                    externalId = request.SupportRequestId.ToString(),
                    tenantId = request.TenantId.ToString(),
                    tenantName = request.TenantName,
                    requesterUserId = request.RequesterUserId?.ToString(),
                    requesterName = request.RequesterName,
                    organization = request.TenantName ?? "City Communication Center",
                    email = request.RequesterEmail ?? string.Empty,
                    pageContext = request.PageContext,
                    subject = request.Subject,
                    description = request.Message,
                })
            };
            message.Headers.Authorization = new("Bearer", _options.ServiceToken);

            using var response = await client.SendAsync(message, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync(cancellationToken);
                _logger.LogWarning(
                    "Lumespec support ticket sync failed with status {StatusCode}: {Body}",
                    (int)response.StatusCode,
                    body);
                return null;
            }

            var payload = await response.Content.ReadFromJsonAsync<CentralSupportTicketEnvelope>(
                cancellationToken: cancellationToken);

            return payload?.Ticket is null
                ? null
                : new CentralSupportTicketResult(payload.Ticket.TicketNo, payload.Ticket.Status);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "Lumespec support ticket sync failed.");
            return null;
        }
    }

    public async Task<CentralSupportTicketMessagesResult?> GetTicketMessagesAsync(
        Guid supportRequestId,
        CancellationToken cancellationToken)
    {
        if (!_options.Enabled || string.IsNullOrWhiteSpace(_options.ServiceToken))
        {
            return null;
        }

        try
        {
            var client = _httpClientFactory.CreateClient(HttpClientName);
            using var message = new HttpRequestMessage(
                HttpMethod.Get,
                $"/api/external/tickets/{ExternalSource}/{supportRequestId}/messages");
            message.Headers.Authorization = new("Bearer", _options.ServiceToken);

            using var response = await client.SendAsync(message, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                if (response.StatusCode != System.Net.HttpStatusCode.NotFound)
                {
                    _logger.LogWarning(
                        "Lumespec support messages sync failed with status {StatusCode}.",
                        (int)response.StatusCode);
                }
                return null;
            }

            var payload = await response.Content.ReadFromJsonAsync<CentralSupportMessagesEnvelope>(
                cancellationToken: cancellationToken);

            return payload?.Ticket is null
                ? null
                : new CentralSupportTicketMessagesResult(
                    payload.Ticket.TicketNo,
                    payload.Ticket.Status,
                    payload.Messages
                        .Select(message => new CentralSupportTicketMessage(
                            message.Direction,
                            message.AuthorName,
                            message.Body,
                            message.CreatedAt))
                        .ToList());
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "Lumespec support messages sync failed.");
            return null;
        }
    }

    private sealed record CentralSupportTicketEnvelope(CentralSupportTicketDto Ticket);

    private sealed record CentralSupportTicketDto(
        [property: JsonPropertyName("ticket_no")] string TicketNo,
        string Status);

    private sealed record CentralSupportMessagesEnvelope(
        CentralSupportTicketDto Ticket,
        IReadOnlyList<CentralSupportMessageDto> Messages);

    private sealed record CentralSupportMessageDto(
        string Direction,
        [property: JsonPropertyName("author_name")] string? AuthorName,
        string Body,
        [property: JsonPropertyName("created_at")] DateTimeOffset CreatedAt);
}
