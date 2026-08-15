namespace CityCommunicationCenter.Domain.Entities;

/// <summary>
/// İzmir CBS adres kataloğu kalıcı önbelleği (mahalle/cadde/kapı no). Tenant-bağımsız.
/// </summary>
public sealed class IzmirCbsCatalogCache
{
    public string CacheKey { get; set; } = string.Empty;

    public string PayloadJson { get; set; } = string.Empty;

    public DateTimeOffset UpdatedAtUtc { get; set; }
}
