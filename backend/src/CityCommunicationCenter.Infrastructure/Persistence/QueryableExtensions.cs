namespace CityCommunicationCenter.Infrastructure.Persistence;

public static class QueryableExtensions
{
    public static IQueryable<TEntity> WhereTenant<TEntity>(this IQueryable<TEntity> query, Guid tenantId)
        where TEntity : class
    {
        return query.Where(entity => EF.Property<Guid>(entity, "TenantId") == tenantId);
    }

    public static IQueryable<TEntity> WhereId<TEntity>(this IQueryable<TEntity> query, string propertyName, Guid id)
        where TEntity : class
    {
        return query.Where(entity => EF.Property<Guid>(entity, propertyName) == id);
    }
}