using CityCommunicationCenter.Infrastructure.Persistence;

namespace CityCommunicationCenter.Infrastructure.Services;

public sealed class RoutingService : IRoutingService
{
    private readonly CityCommunicationCenterDbContext _dbContext;

    public RoutingService(CityCommunicationCenterDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<Guid?> GetTargetDepartmentAsync(Guid tenantId, string messageContent, CancellationToken cancellationToken = default)
    {
        // Check if auto-routing is enabled
        if (!await IsAutoRoutingEnabledAsync(tenantId, cancellationToken))
        {
            return null;
        }

        // Get all active routing rules for tenant, ordered by priority (highest first)
        var rules = await _dbContext.RoutingRules
            .WhereTenant(tenantId)
            .Where(rule => rule.IsActive)
            .ToListAsync(cancellationToken);

        if (rules.Count == 0)
        {
            return null;
        }

        // Normalize message content for matching
        var normalizedContent = NormalizeText(messageContent);

        // Find the first matching rule (highest priority)
        var matchingRule = rules
            .OrderByDescending(r => r.Priority)
            .FirstOrDefault(r => MatchesKeywords(normalizedContent, r.GetKeywordList()));

        return matchingRule?.TargetDepartmentId;
    }

    public async Task<bool> IsAutoRoutingEnabledAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        var settings = await _dbContext.TenantSettings
            .WhereTenant(tenantId)
            .FirstOrDefaultAsync(cancellationToken);

        return settings?.AutoRoutingEnabled ?? false;
    }

    public async Task SetAutoRoutingEnabledAsync(Guid tenantId, bool enabled, CancellationToken cancellationToken = default)
    {
        var settings = await _dbContext.TenantSettings
            .WhereTenant(tenantId)
            .FirstOrDefaultAsync(cancellationToken);

        if (settings is null)
        {
            return;
        }

        settings.AutoRoutingEnabled = enabled;
        settings.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private static string NormalizeText(string text)
    {
        if (string.IsNullOrEmpty(text))
            return string.Empty;

        // Convert to lowercase and normalize Turkish characters for matching
        return text.ToLowerInvariant()
            .Replace("İ", "i")
            .Replace("I", "ı")
            .Replace("Ş", "ş")
            .Replace("Ğ", "ğ")
            .Replace("Ü", "ü")
            .Replace("Ö", "ö")
            .Replace("Ç", "ç");
    }

    private static bool MatchesKeywords(string content, IEnumerable<string> keywords)
    {
        return keywords.Any(keyword => content.Contains(keyword, StringComparison.OrdinalIgnoreCase));
    }
}
