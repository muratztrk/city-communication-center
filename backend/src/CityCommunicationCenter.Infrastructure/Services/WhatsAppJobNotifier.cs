using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Application.Abstractions.SocialMedia;
using CityCommunicationCenter.Application.Features.Social;
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
        => NotifyCitizenRequestStatusChangedAsync(tenantId, jobId, "Yapılmakta", null, ct);

    public Task NotifyJobCompletedAsync(Guid tenantId, Guid jobId, CancellationToken ct = default)
        => NotifyCitizenRequestStatusChangedAsync(tenantId, jobId, "Tamamlanmış", null, ct);

    public Task NotifyJobCancelledAsync(Guid tenantId, Guid jobId, string? reason, CancellationToken ct = default)
        => NotifyCitizenRequestStatusChangedAsync(tenantId, jobId, "İptal Edildi", null, ct);

    public async Task NotifyCitizenRequestStatusChangedAsync(
        Guid tenantId,
        Guid jobId,
        string statusLabel,
        Guid? actorUserId,
        CancellationToken ct = default)
    {
        try
        {
            var waSettings = _settingsProvider.GetSettings(tenantId)?.WhatsApp;
            if (waSettings is not { AutoNotify: true }) return;

            var job = await _dbContext.Jobs
                .AsNoTracking()
                .FirstOrDefaultAsync(j => j.JobId == jobId && j.TenantId == tenantId, ct);
            if (job is null || !IsCitizenJob(job)) return;
            if (string.IsNullOrWhiteSpace(job.CitizenPhone)) return;

            var socialMessage = await ResolveSocialMessageAsync(tenantId, job, ct);
            if (socialMessage is null) return;

            var tenantName = await _dbContext.Tenants
                .AsNoTracking()
                .Where(t => t.TenantId == tenantId)
                .Select(t => t.MunicipalityName)
                .FirstOrDefaultAsync(ct) ?? "Belediye";

            var actorLabel = await ResolveActorLabelAsync(tenantId, actorUserId, tenantName, ct);
            var requestNumber = ConversationEntrySenderLabelHelper.FormatCitizenRequestNumber(
                socialMessage.CitizenRequestNumber,
                socialMessage.CitizenRequestNumberYear,
                socialMessage.ReceivedAtUtc);

            var text = $"{requestNumber} No'lu Talebinizin durumu \"{statusLabel}\" olarak güncellendi.";

            var client = _clientFactory.GetClient(SocialChannel.WhatsApp, tenantId);
            if (client is null) return;

            var sendResult = await client.SendMessageAsync(new SendMessageRequest
            {
                RecipientId = job.CitizenPhone,
                Message = text,
            }, ct);

            var utcNow = DateTimeOffset.UtcNow;
            _dbContext.ConversationEntries.Add(new SocialConversationEntry
            {
                EntryId = Guid.NewGuid(),
                SocialMessageId = socialMessage.SocialMessageId,
                Direction = ConversationEntryDirection.Outbound,
                Content = text,
                SentAt = utcNow,
                ExternalEntryId = sendResult.Success ? sendResult.MessageId : null,
                SenderLabel = actorLabel,
                DeliveryStatus = sendResult.Success
                    ? ConversationDeliveryStatus.Sent
                    : ConversationDeliveryStatus.Failed,
                DeliveryStatusUpdatedAtUtc = utcNow,
                DeliveryError = sendResult.Success ? null : sendResult.Error,
            });

            await _dbContext.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "WhatsApp citizen status notification failed for Job {JobId} ({StatusLabel})", jobId, statusLabel);
        }
    }

    private static bool IsCitizenJob(Job job)
        => job.RequestType == JobRequestType.Citizen
           || job.SourceType is JobSourceType.SocialMessage or JobSourceType.CitizenRequest;

    private async Task<SocialMessage?> ResolveSocialMessageAsync(Guid tenantId, Job job, CancellationToken ct)
    {
        if (job.SourceRefId.HasValue)
        {
            var bySource = await _dbContext.SocialMessages
                .AsNoTracking()
                .FirstOrDefaultAsync(m => m.TenantId == tenantId && m.SocialMessageId == job.SourceRefId.Value, ct);
            if (bySource is not null) return bySource;
        }

        return await _dbContext.SocialMessages
            .AsNoTracking()
            .Where(m => m.TenantId == tenantId && m.JobId == job.JobId)
            .OrderByDescending(m => m.ReceivedAtUtc)
            .FirstOrDefaultAsync(ct);
    }

    private async Task<string> ResolveActorLabelAsync(
        Guid tenantId,
        Guid? actorUserId,
        string tenantName,
        CancellationToken ct)
    {
        if (!actorUserId.HasValue)
            return tenantName;

        var actor = await _dbContext.Users
            .AsNoTracking()
            .Where(u => u.UserId == actorUserId.Value && u.TenantId == tenantId)
            .Select(u => new { u.DisplayName, DepartmentName = u.Department != null ? u.Department.Name : null })
            .FirstOrDefaultAsync(ct);

        if (actor is null)
            return tenantName;

        return ConversationEntrySenderLabelHelper.FormatStaffLabel(actor.DepartmentName, actor.DisplayName);
    }
}
