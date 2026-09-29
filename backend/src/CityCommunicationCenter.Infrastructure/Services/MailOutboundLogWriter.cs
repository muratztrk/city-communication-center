using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Domain.Entities;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace CityCommunicationCenter.Infrastructure.Services;

internal sealed class MailOutboundLogWriter : IMailOutboundLogWriter
{
    private const int BodyPreviewMaxLength = 500;
    private const int SubjectMaxLength = 200;
    private const int ErrorMaxLength = 500;

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<MailOutboundLogWriter> _logger;

    public MailOutboundLogWriter(IServiceScopeFactory scopeFactory, ILogger<MailOutboundLogWriter> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    public async Task WriteAsync(MailOutboundLogEntry entry, CancellationToken cancellationToken = default)
    {
        try
        {
            await using var scope = _scopeFactory.CreateAsyncScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();
            dbContext.MailOutboundLogs.Add(Map(entry));
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Mail outbound log yazılamadı. TenantId={TenantId}", entry.TenantId);
        }
    }

    internal static MailOutboundLog Map(MailOutboundLogEntry entry)
    {
        return new MailOutboundLog
        {
            MailOutboundLogId = Guid.NewGuid(),
            TenantId = entry.TenantId,
            Kind = entry.Context.Kind,
            RecipientEmail = Truncate(entry.RecipientEmail.Trim(), 256) ?? string.Empty,
            RecipientUserId = entry.Context.RecipientUserId,
            JobId = entry.Context.JobId,
            TaskId = entry.Context.TaskId,
            RequestNumber = entry.Context.RequestNumber,
            Subject = Truncate(entry.Subject.Trim(), SubjectMaxLength),
            Success = entry.Success,
            ErrorMessage = Truncate(entry.ErrorMessage?.Trim(), ErrorMaxLength),
            TextLength = entry.Body.Length,
            BodyPreview = Truncate(entry.Body.Trim(), BodyPreviewMaxLength),
            CreatedAtUtc = DateTimeOffset.UtcNow,
        };
    }

    private static string? Truncate(string? value, int maxLength)
    {
        if (string.IsNullOrEmpty(value))
        {
            return null;
        }

        return value.Length <= maxLength ? value : value[..maxLength];
    }
}
