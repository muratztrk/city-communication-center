using System.Globalization;
using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Application.Common;
using CityCommunicationCenter.Domain.Entities;
using CityCommunicationCenter.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CityCommunicationCenter.Api.Services;

/// <summary>
/// Tek seferlik (#2662/#2663): dizin vatandaşları + son 30 gün taleplere CBS mahalle/cadde/no yazar.
/// Marker audit kaydı varsa tekrar çalışmaz.
/// </summary>
internal sealed class OneOffRandomAddressAssignment
{
    public const string MarkerAction = "OneOffRandomAddresses-2662-2663";

    private readonly CityCommunicationCenterDbContext _dbContext;
    private readonly IIzmirCbsAddressCatalog _cbs;
    private readonly ILogger<OneOffRandomAddressAssignment> _logger;

    public OneOffRandomAddressAssignment(
        CityCommunicationCenterDbContext dbContext,
        IIzmirCbsAddressCatalog cbs,
        ILogger<OneOffRandomAddressAssignment> logger)
    {
        _dbContext = dbContext;
        _cbs = cbs;
        _logger = logger;
    }

    public async Task RunAsync(CancellationToken cancellationToken = default)
    {
        var alreadyRan = await _dbContext.AuditLogs
            .IgnoreQueryFilters()
            .AnyAsync(log => log.Action == MarkerAction, cancellationToken);
        if (alreadyRan)
        {
            return;
        }

        var pool = await BuildAddressPoolAsync(cancellationToken);
        if (pool.Count == 0)
        {
            _logger.LogWarning("One-off random addresses: CBS havuzu boş, atama atlandı.");
            return;
        }

        var tenants = await _dbContext.Tenants.IgnoreQueryFilters()
            .Select(tenant => tenant.TenantId)
            .ToListAsync(cancellationToken);

        var cutoff = DateTimeOffset.UtcNow.AddDays(-30);
        var conversationCount = 0;
        var jobCount = 0;

        foreach (var tenantId in tenants)
        {
            var conversations = await _dbContext.CitizenConversations.IgnoreQueryFilters()
                .Where(row => row.TenantId == tenantId)
                .ToListAsync(cancellationToken);
            foreach (var conversation in conversations)
            {
                var pick = pool[Random.Shared.Next(pool.Count)];
                conversation.Neighborhood = pick.Neighborhood;
                conversation.Street = pick.Street;
                conversation.StreetNo = pick.StreetNo;
                conversation.UpdatedAtUtc = DateTimeOffset.UtcNow;
                conversationCount += 1;
            }

            var jobs = await _dbContext.Jobs.IgnoreQueryFilters()
                .Where(job => job.TenantId == tenantId && job.CreatedAtUtc >= cutoff)
                .ToListAsync(cancellationToken);
            foreach (var job in jobs)
            {
                var pick = pool[Random.Shared.Next(pool.Count)];
                job.Neighborhood = pick.Neighborhood;
                job.Street = pick.Street;
                job.StreetNo = pick.StreetNo;
                job.UpdatedAtUtc = DateTimeOffset.UtcNow;
                jobCount += 1;
            }

            _dbContext.AuditLogs.Add(new AuditLog
            {
                AuditLogId = Guid.NewGuid(),
                TenantId = tenantId,
                EntityType = "AddressBackfill",
                EntityId = MarkerAction,
                Action = MarkerAction,
                EventTimeUtc = DateTimeOffset.UtcNow,
                Details = $"Vatandaş {conversations.Count}, talep (30 gün) {jobs.Count}",
            });
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        _logger.LogInformation(
            "One-off random addresses: {Conversations} vatandaş, {Jobs} talep güncellendi.",
            conversationCount,
            jobCount);
    }

    private async Task<IReadOnlyList<(string Neighborhood, string Street, string StreetNo)>> BuildAddressPoolAsync(
        CancellationToken cancellationToken)
    {
        var pool = new List<(string Neighborhood, string Street, string StreetNo)>();
        try
        {
            var neighborhoods = (await _cbs.GetNeighborhoodsAsync("tire", cancellationToken)).ToList();
            Shuffle(neighborhoods);
            foreach (var neighborhood in neighborhoods.Take(10))
            {
                var streets = (await _cbs.GetStreetsAsync(neighborhood.Id, cancellationToken)).ToList();
                if (streets.Count == 0)
                {
                    continue;
                }

                Shuffle(streets);
                foreach (var street in streets.Take(2))
                {
                    var doors = (await _cbs.GetDoorNumbersAsync(street.Id, neighborhood.Id, cancellationToken)).ToList();
                    if (doors.Count == 0)
                    {
                        continue;
                    }

                    Shuffle(doors);
                    foreach (var door in doors.Take(3))
                    {
                        pool.Add((TitleCase(neighborhood.Name), TitleCase(street.Name), door.Name.Trim()));
                    }
                }
            }
        }
        catch (Exception exception)
        {
            _logger.LogWarning(exception, "One-off random addresses: CBS okunamadı, katalog yedeği kullanılacak.");
        }

        if (pool.Count > 0)
        {
            return pool;
        }

        var fallbackStreets = new[] { "Atatürk Caddesi", "İnönü Caddesi", "Cumhuriyet Caddesi", "Gazi Bulvarı" };
        foreach (var neighborhood in TireNeighborhoodCatalog.Names)
        {
            var street = fallbackStreets[Random.Shared.Next(fallbackStreets.Length)];
            var no = (Random.Shared.Next(1, 80)).ToString(CultureInfo.InvariantCulture);
            pool.Add((neighborhood, street, no));
        }

        return pool;
    }

    private static void Shuffle<T>(IList<T> items)
    {
        for (var index = items.Count - 1; index > 0; index -= 1)
        {
            var swap = Random.Shared.Next(index + 1);
            (items[index], items[swap]) = (items[swap], items[index]);
        }
    }

    private static string TitleCase(string value)
    {
        var trimmed = value.Trim();
        if (trimmed.Length == 0)
        {
            return trimmed;
        }

        var culture = CultureInfo.GetCultureInfo("tr-TR");
        return culture.TextInfo.ToTitleCase(trimmed.ToLower(culture));
    }
}
