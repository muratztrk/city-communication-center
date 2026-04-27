using System.Text.Json;

namespace CityCommunicationCenter.Application.Features.Departments;

internal static class DepartmentResponseFactory
{
    public static DepartmentResponse Create(Department department)
    {
        return new DepartmentResponse(
            department.DepartmentId,
            department.TenantId,
            department.Name,
            department.DepartmentType,
            department.ParentDepartmentId,
            department.ManagerUserId,
            department.DeputyManagerUserId,
            ParseResponsibleUserIds(department.ResponsibleUserIdsJson));
    }

    public static string SerializeResponsibleUserIds(IEnumerable<Guid>? userIds)
    {
        var distinctUserIds = userIds?
            .Where(id => id != Guid.Empty)
            .Distinct()
            .ToArray() ?? [];

        return JsonSerializer.Serialize(distinctUserIds);
    }

    private static IReadOnlyCollection<Guid> ParseResponsibleUserIds(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return [];
        }

        try
        {
            return JsonSerializer.Deserialize<Guid[]>(json) ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
    }
}
