namespace CityCommunicationCenter.Domain.Common;

public interface IHasDatabaseIndexDefinitions
{
    static abstract IReadOnlyList<DatabaseIndexDefinition> GetDatabaseIndexDefinitions();
}