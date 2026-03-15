namespace Microsoft.EntityFrameworkCore;

public static class InMemoryAsyncExtensions
{
    public static IEnumerable<TSource> Include<TSource, TProperty>(
        this IEnumerable<TSource> source,
        Func<TSource, TProperty> path)
    {
        return source;
    }

    public static Task<List<TSource>> ToListAsync<TSource>(
        this IEnumerable<TSource> source,
        CancellationToken cancellationToken = default)
    {
        return Task.FromResult(source.ToList());
    }

    public static Task<TSource?> SingleOrDefaultAsync<TSource>(
        this IEnumerable<TSource> source,
        CancellationToken cancellationToken = default)
    {
        return Task.FromResult(source.SingleOrDefault());
    }

    public static Task<TSource?> SingleOrDefaultAsync<TSource>(
        this IEnumerable<TSource> source,
        Func<TSource, bool> predicate,
        CancellationToken cancellationToken = default)
    {
        return Task.FromResult(source.SingleOrDefault(predicate));
    }

    public static Task<int> CountAsync<TSource>(
        this IEnumerable<TSource> source,
        CancellationToken cancellationToken = default)
    {
        return Task.FromResult(source.Count());
    }

    public static Task<int> CountAsync<TSource>(
        this IEnumerable<TSource> source,
        Func<TSource, bool> predicate,
        CancellationToken cancellationToken = default)
    {
        return Task.FromResult(source.Count(predicate));
    }
}
