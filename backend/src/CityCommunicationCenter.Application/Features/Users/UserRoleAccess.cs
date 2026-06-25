using System.Text.Json;
using CityCommunicationCenter.Domain.Entities;
using CityCommunicationCenter.Domain.Enums;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace CityCommunicationCenter.Application.Features.Users;

public static class UserRoleAccess
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public static IReadOnlyList<RoleCode> ParseAdditionalRoleCodes(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return [];
        }

        try
        {
            var values = JsonSerializer.Deserialize<string[]>(json, JsonOptions) ?? [];
            return values
                .Where(value => !string.IsNullOrWhiteSpace(value))
                .Select(value => Enum.TryParse<RoleCode>(value, true, out var role) ? role : (RoleCode?)null)
                .Where(role => role.HasValue)
                .Select(role => role!.Value)
                .Distinct()
                .ToArray();
        }
        catch (JsonException)
        {
            return [];
        }
    }

    public static string? SerializeAdditionalRoleCodes(IReadOnlyCollection<string>? roleCodes)
    {
        if (roleCodes is null || roleCodes.Count == 0)
        {
            return null;
        }

        var normalized = roleCodes
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Select(value => value.Trim())
            .Where(value => Enum.TryParse<RoleCode>(value, true, out _))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(value => value, StringComparer.OrdinalIgnoreCase)
            .ToArray();

        return normalized.Length == 0 ? null : JsonSerializer.Serialize(normalized, JsonOptions);
    }

    public static IReadOnlyList<string> GetAdditionalRoleCodeStrings(ApplicationUser user)
        => ParseAdditionalRoleCodes(user.AdditionalRoleCodesJson).Select(role => role.ToString()).ToArray();

    public static IReadOnlyList<string> GetEffectiveRoleCodeStrings(ApplicationUser user)
    {
        var roles = new List<string> { user.RoleCode.ToString() };
        foreach (var role in GetAdditionalRoleCodeStrings(user))
        {
            if (!roles.Contains(role, StringComparer.OrdinalIgnoreCase))
            {
                roles.Add(role);
            }
        }

        return roles;
    }

    public static void ApplyAdditionalRoleCodes(
        ApplicationUser user,
        IReadOnlyCollection<string>? additionalRoleCodes)
    {
        var primaryRole = user.RoleCode.ToString();
        var normalized = (additionalRoleCodes ?? [])
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Select(value => value.Trim())
            .Where(value => !string.Equals(value, primaryRole, StringComparison.OrdinalIgnoreCase))
            .Where(value => Enum.TryParse<RoleCode>(value, true, out var role) && role != user.RoleCode)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        if (normalized.Any(value => string.Equals(value, RoleCode.Manager.ToString(), StringComparison.OrdinalIgnoreCase)))
        {
            throw new ValidationException(
            [
                new FluentValidation.Results.ValidationFailure(
                    nameof(additionalRoleCodes),
                    "Birim yöneticisi rolü yalnızca birincil rol olarak atanabilir.")
            ]);
        }

        user.AdditionalRoleCodesJson = SerializeAdditionalRoleCodes(normalized);
    }
}
