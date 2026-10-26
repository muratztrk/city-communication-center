using CityCommunicationCenter.Application.Features.Users;

namespace CityCommunicationCenter.Infrastructure.BelediyeSoap;

// Vatandas e-Devlet uzerinden not ekleyince ya da basvuruyu tekrar acinca operatorlere uygulama ici bildirim.
// Bildirim hatasi SOAP yanitini bozmaz: vatandasin islemi zaten kaydedilmistir.
public sealed partial class BelediyeSoapOperations
{
    private const string BasvurularActionUrl = "/edevlet/basvurular";
    private const int NotificationPreviewLength = 160;

    private async Task NotifyCitizenActionAsync(
        EDevletBasvuru basvuru,
        string title,
        string action,
        string text,
        CancellationToken cancellationToken)
    {
        try
        {
            var recipientIds = await ResolveBasvuruRecipientIdsAsync(basvuru, cancellationToken);
            if (recipientIds.Count == 0)
            {
                return;
            }

            var preview = text.Length > NotificationPreviewLength ? text[..NotificationPreviewLength] + "…" : text;
            var message = $"{basvuru.TakipNo} numaralı e-Devlet başvurusu vatandaş tarafından {action}: {preview}";
            var utcNow = DateTimeOffset.UtcNow;
            var notifications = recipientIds
                .Select(userId => new Notification
                {
                    NotificationId = Guid.NewGuid(),
                    TenantId = basvuru.TenantId,
                    UserId = userId,
                    Channel = NotificationChannel.InApp,
                    DeliveryStatus = NotificationDeliveryStatus.Sent,
                    Title = title,
                    Message = message,
                    IsRead = false,
                    ActionUrl = BasvurularActionUrl,
                    SentAtUtc = utcNow,
                    CreatedAtUtc = utcNow,
                })
                .ToList();

            _dbContext.Notifications.AddRange(notifications);
            await _dbContext.SaveChangesAsync(cancellationToken);

            if (_pushService is null)
            {
                return;
            }

            foreach (var notification in notifications)
            {
                await _pushService.SendToUserAsync(
                    basvuru.TenantId,
                    notification.UserId,
                    new NotificationPayload(notification.NotificationId, notification.Title, notification.Message, notification.ActionUrl),
                    cancellationToken);
            }
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            _logger?.LogWarning(exception, "e-Devlet basvuru bildirimi gonderilemedi ({TakipNo}).", basvuru.TakipNo);
        }
    }

    // Basvurulari operatorler isler; tenant'ta aktif operator yoksa sistem yoneticileri. Is akisina alinmissa isi olusturan da bilgilendirilir.
    private async Task<HashSet<Guid>> ResolveBasvuruRecipientIdsAsync(EDevletBasvuru basvuru, CancellationToken cancellationToken)
    {
        var users = await _dbContext.Users
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(user => user.TenantId == basvuru.TenantId && user.IsActive)
            .Select(user => new { user.UserId, user.RoleCode, user.AdditionalRoleCodesJson })
            .ToListAsync(cancellationToken);

        bool HasRole(RoleCode primary, string? additional, RoleCode role)
            => primary == role || UserRoleAccess.ParseAdditionalRoleCodes(additional).Contains(role);

        var recipients = users
            .Where(user => HasRole(user.RoleCode, user.AdditionalRoleCodesJson, RoleCode.Operator))
            .Select(user => user.UserId)
            .ToHashSet();

        if (recipients.Count == 0)
        {
            recipients = users
                .Where(user => HasRole(user.RoleCode, user.AdditionalRoleCodesJson, RoleCode.SystemAdmin))
                .Select(user => user.UserId)
                .ToHashSet();
        }

        if (basvuru.Job?.CreatedByUserId is { } jobCreatorId && users.Any(user => user.UserId == jobCreatorId))
        {
            recipients.Add(jobCreatorId);
        }

        return recipients;
    }
}
