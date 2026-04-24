namespace CityCommunicationCenter.Domain.Entities;

public sealed class RoutingRule : IHasDatabaseIndexDefinitions
{
    public Guid RuleId { get; set; }

    public Guid TenantId { get; set; }

    public string RuleName { get; set; } = string.Empty;

    /// <summary>
    /// Comma-separated keywords that trigger this rule.
    /// </summary>
    public string Keywords { get; set; } = string.Empty;

    public Guid TargetDepartmentId { get; set; }

    /// <summary>
    /// Higher priority rules are evaluated first.
    /// </summary>
    public int Priority { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;

    /// <summary>
    /// Gets keywords as a list for matching.
    /// </summary>
    public IEnumerable<string> GetKeywordList() =>
        Keywords.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(k => k.ToLowerInvariant());

    public static IReadOnlyList<DatabaseIndexDefinition> GetDatabaseIndexDefinitions() =>
    [
        DatabaseIndexDefinition.NonUnique(nameof(TenantId), nameof(IsActive), nameof(Priority)),
        DatabaseIndexDefinition.NonUnique(nameof(TenantId), nameof(RuleName)),
    ];
}
