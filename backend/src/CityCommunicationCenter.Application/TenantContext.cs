namespace CityCommunicationCenter.Application;

public sealed record TenantContext(
    Guid? TenantId,
    Guid? UserId,
    string? UserDisplayName,
    string? RoleCode,
    bool IsAuthenticated,
    string? ResolutionSource,
    string? ErrorMessage,
    bool ApplyQueryFilter = true,
    Guid? ActiveDepartmentId = null);

public static class TenantContextExtensions
{
    public static Guid RequireTenantId(this TenantContext context)
    {
        if (!context.TenantId.HasValue || context.TenantId.Value == Guid.Empty)
        {
            throw new InvalidOperationException("Bu islem icin gecerli bir tenant baglami gereklidir.");
        }

        return context.TenantId.Value;
    }
}
