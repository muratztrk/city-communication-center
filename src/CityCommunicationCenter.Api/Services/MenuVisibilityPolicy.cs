using System.Text.Json;
using CityCommunicationCenter.Domain.Enums;
using CityCommunicationCenter.Shared.Contracts;

namespace CityCommunicationCenter.Api.Services;

public static class MenuVisibilityPolicy
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public static readonly string[] SupportedMenuKeys =
    [
        "dashboard",
        "tasks",
        "social",
        "departments",
        "users",
        "audit",
        "settings"
    ];

    private static readonly HashSet<string> SupportedMenuKeySet = new(SupportedMenuKeys, StringComparer.OrdinalIgnoreCase);
    private static readonly string[] SupportedRoleCodes = Enum.GetNames<RoleCode>();

    public static IReadOnlyList<string> GetSupportedMenuKeys() => SupportedMenuKeys;

    public static IReadOnlyList<string> GetSupportedRoleCodes() => SupportedRoleCodes;

    public static IReadOnlyList<MenuVisibilityRule> Deserialize(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return [];
        }

        try
        {
            var parsed = JsonSerializer.Deserialize<List<MenuVisibilityRule>>(json, JsonOptions);
            return Normalize(parsed);
        }
        catch
        {
            return [];
        }
    }

    public static IReadOnlyList<MenuVisibilityRule> Normalize(IEnumerable<MenuVisibilityRule>? rules)
    {
        if (rules is null)
        {
            return [];
        }

        var ruleMap = new Dictionary<string, MenuVisibilityRule>(StringComparer.OrdinalIgnoreCase);

        foreach (var rule in rules)
        {
            var menuKey = NormalizeMenuKey(rule.MenuKey);
            if (string.IsNullOrWhiteSpace(menuKey) || !SupportedMenuKeySet.Contains(menuKey))
            {
                continue;
            }

            var normalizedRoles = (rule.AllowedRoles ?? [])
                .Select(NormalizeRoleCode)
                .Where(role => !string.IsNullOrWhiteSpace(role))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            var normalizedDepartmentIds = (rule.AllowedDepartmentIds ?? [])
                .Where(departmentId => departmentId != Guid.Empty)
                .Distinct()
                .ToList();

            ruleMap[menuKey] = new MenuVisibilityRule(
                menuKey,
                rule.IsVisible,
                normalizedRoles,
                normalizedDepartmentIds);
        }

        return SupportedMenuKeys
            .Where(menuKey => ruleMap.ContainsKey(menuKey))
            .Select(menuKey => ruleMap[menuKey])
            .ToList();
    }

    public static string? Serialize(IEnumerable<MenuVisibilityRule>? rules)
    {
        var normalizedRules = Normalize(rules);
        if (normalizedRules.Count == 0)
        {
            return null;
        }

        return JsonSerializer.Serialize(normalizedRules, JsonOptions);
    }

    public static IReadOnlyDictionary<string, bool> EvaluateForUser(
        IEnumerable<MenuVisibilityRule>? rules,
        string? roleCode,
        Guid? departmentId)
    {
        var normalizedRules = Normalize(rules)
            .ToDictionary(rule => rule.MenuKey, StringComparer.OrdinalIgnoreCase);
        var normalizedRole = NormalizeRoleCode(roleCode);
        var isSystemAdmin = string.Equals(normalizedRole, "systemadmin", StringComparison.OrdinalIgnoreCase);
        var visibility = new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase);

        foreach (var menuKey in SupportedMenuKeys)
        {
            var isVisible = IsBaseMenuVisible(menuKey, isSystemAdmin);

            if (isVisible && normalizedRules.TryGetValue(menuKey, out var rule))
            {
                if (!rule.IsVisible)
                {
                    isVisible = false;
                }
                else
                {
                    var hasRoleFilter = rule.AllowedRoles is { Count: > 0 };
                    var hasDepartmentFilter = rule.AllowedDepartmentIds is { Count: > 0 };

                    var roleAllowed = !hasRoleFilter ||
                        rule.AllowedRoles!.Any(role => string.Equals(NormalizeRoleCode(role), normalizedRole, StringComparison.OrdinalIgnoreCase));
                    var departmentAllowed = !hasDepartmentFilter ||
                        (departmentId.HasValue && rule.AllowedDepartmentIds!.Contains(departmentId.Value));

                    isVisible = roleAllowed && departmentAllowed;
                }
            }

            visibility[menuKey] = isVisible;
        }

        return visibility;
    }

    private static bool IsBaseMenuVisible(string menuKey, bool isSystemAdmin)
    {
        return menuKey switch
        {
            "audit" or "settings" => isSystemAdmin,
            _ => true
        };
    }

    private static string NormalizeMenuKey(string? menuKey)
    {
        return menuKey?.Trim().ToLowerInvariant() ?? string.Empty;
    }

    private static string NormalizeRoleCode(string? roleCode)
    {
        if (string.IsNullOrWhiteSpace(roleCode))
        {
            return string.Empty;
        }

        return new string(roleCode.Where(char.IsLetter).ToArray()).ToLowerInvariant();
    }
}
