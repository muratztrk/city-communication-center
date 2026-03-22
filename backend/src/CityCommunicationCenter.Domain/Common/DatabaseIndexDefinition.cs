namespace CityCommunicationCenter.Domain.Common;

public sealed record DatabaseIndexDefinition(
    IReadOnlyList<string> PropertyNames,
    bool IsUnique = false,
    string? Filter = null,
    string? DatabaseName = null)
{
    public static DatabaseIndexDefinition NonUnique(params string[] propertyNames)
        => new(propertyNames);

    public static DatabaseIndexDefinition Unique(string propertyName, string? filter = null, string? databaseName = null)
        => new([propertyName], true, filter, databaseName);

    public static DatabaseIndexDefinition Unique(IReadOnlyList<string> propertyNames, string? filter = null, string? databaseName = null)
        => new(propertyNames, true, filter, databaseName);
}