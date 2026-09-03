using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Domain.Entities;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace CityCommunicationCenter.Infrastructure.Services;

internal sealed class SmsOutboundLogWriter : ISmsOutboundLogWriter
{
    private const int BodyPreviewMaxLength = 500;

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<SmsOutboundLogWriter> _logger;

    public SmsOutboundLogWriter(IServiceScopeFactory scopeFactory, ILogger<SmsOutboundLogWriter> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    public async Task WriteAsync(SmsOutboundLogEntry entry, CancellationToken cancellationToken = default)
    {
        try
        {
            await using var scope = _scopeFactory.CreateAsyncScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();
            dbContext.SmsOutboundLogs.Add(Map(entry));
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "SMS outbound log yazılamadı. TenantId={TenantId}", entry.TenantId);
        }
    }

    internal static SmsOutboundLog Map(SmsOutboundLogEntry entry)
    {
        var preview = entry.Text.Trim();
        if (preview.Length > BodyPreviewMaxLength)
        {
            preview = preview[..BodyPreviewMaxLength];
        }

        return new SmsOutboundLog
        {
            SmsOutboundLogId = Guid.NewGuid(),
            TenantId = entry.TenantId,
            Kind = entry.Context.Kind,
            RecipientPhoneMasked = entry.RecipientPhoneMasked,
            RecipientUserId = entry.Context.RecipientUserId,
            JobId = entry.Context.JobId,
            SocialMessageId = entry.Context.SocialMessageId,
            TaskId = entry.Context.TaskId,
            RequestNumber = entry.Context.RequestNumber,
            Success = entry.Success,
            Provider = entry.Provider,
            ProviderCode = entry.ProviderCode,
            ProviderMessage = entry.ProviderMessage,
            TextLength = entry.Text.Length,
            BodyPreview = preview,
            CreatedAtUtc = DateTimeOffset.UtcNow,
        };
    }
}
