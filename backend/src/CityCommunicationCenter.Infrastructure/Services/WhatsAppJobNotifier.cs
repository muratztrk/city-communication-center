using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Application.Abstractions.SocialMedia;
using CityCommunicationCenter.Domain.Entities;
using CityCommunicationCenter.Domain.Enums;
using Microsoft.Extensions.Logging;

namespace CityCommunicationCenter.Infrastructure.Services;

public sealed class WhatsAppJobNotifier : IWhatsAppJobNotifier
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ISocialMediaSettingsProvider _settingsProvider;
    private readonly ISocialMediaClientFactory _clientFactory;
    private readonly ILogger<WhatsAppJobNotifier> _logger;

    public WhatsAppJobNotifier(
        IApplicationDbContext dbContext,
        ISocialMediaSettingsProvider settingsProvider,
        ISocialMediaClientFactory clientFactory,
        ILogger<WhatsAppJobNotifier> logger)
    {
        _dbContext = dbContext;
        _settingsProvider = settingsProvider;
        _clientFactory = clientFactory;
        _logger = logger;
    }

    public Task NotifyJobActivatedAsync(Guid tenantId, Guid jobId, CancellationToken ct = default)
        => NotifyAsync(tenantId, jobId, "Active", null, ct);

    public Task NotifyJobCompletedAsync(Guid tenantId, Guid jobId, CancellationToken ct = default)
        => NotifyAsync(tenantId, jobId, "Completed", null, ct);

    public Task NotifyJobCancelledAsync(Guid tenantId, Guid jobId, string? reason, CancellationToken ct = default)
        => NotifyAsync(tenantId, jobId, "Cancelled", reason, ct);

    private async Task NotifyAsync(Guid tenantId, Guid jobId, string eventType, string? reason, CancellationToken ct)
    {
        try
        {
            var waSettings = _settingsProvider.GetSettings(tenantId)?.WhatsApp;
            if (waSettings is not { AutoNotify: true }) return;

            var job = await _dbContext.Jobs
                .AsNoTracking()
                .FirstOrDefaultAsync(j => j.JobId == jobId && j.TenantId == tenantId, ct);
            if (job is null || string.IsNullOrWhiteSpace(job.CitizenPhone)) return;

            var conversation = await _dbContext.CitizenConversations
                .FirstOrDefaultAsync(c => c.TenantId == tenantId && c.CitizenPhone == job.CitizenPhone, ct);
            if (conversation is null) return;

            var latestMessageId = await _dbContext.SocialMessages
                .Where(m => m.TenantId == tenantId && m.CitizenConversationId == conversation.CitizenConversationId)
                .OrderByDescending(m => m.CreatedAtUtc)
                .Select(m => (Guid?)m.SocialMessageId)
                .FirstOrDefaultAsync(ct);
            if (latestMessageId is null) return;

            var text = BuildMessageText(job, eventType, reason);
            if (text is null) return;

            var client = _clientFactory.GetClient(SocialChannel.WhatsApp, tenantId);
            if (client is null) return;

            var sendResult = await client.SendMessageAsync(new SendMessageRequest
            {
                RecipientId = job.CitizenPhone,
                Message = text
            }, ct);

            _dbContext.ConversationEntries.Add(new SocialConversationEntry
            {
                EntryId = Guid.NewGuid(),
                SocialMessageId = latestMessageId.Value,
                Direction = ConversationEntryDirection.Outbound,
                Content = text,
                SentAt = DateTimeOffset.UtcNow,
                ExternalEntryId = sendResult.Success ? sendResult.MessageId : null
            });

            await _dbContext.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "WhatsApp job notification failed for Job {JobId} ({EventType})", jobId, eventType);
        }
    }

    private static string? BuildMessageText(Job job, string eventType, string? reason)
    {
        var name = string.IsNullOrWhiteSpace(job.CitizenName) ? "Sayın vatandaş" : $"Sayın {job.CitizenName}";
        var refPart = job.JobNumber.HasValue
            ? $" (İş No: {job.JobNumberYear}/{job.JobNumber.Value:D4})"
            : string.Empty;

        return eventType switch
        {
            "Active" => $"{name}, başvurunuz{refPart} alındı ve işleme konuldu.",
            "Completed" => $"{name}, başvurunuz{refPart} tamamlandı. İlginiz için teşekkür ederiz.",
            "Cancelled" when !string.IsNullOrWhiteSpace(reason) =>
                $"{name}, başvurunuz{refPart} iptal edildi: {reason}",
            "Cancelled" => $"{name}, başvurunuz{refPart} iptal edildi.",
            _ => null
        };
    }
}
