using System.Reflection;
using CityCommunicationCenter.Domain.Common;

namespace CityCommunicationCenter.Infrastructure.Persistence;

internal static class ModelBuilderIndexConventionExtensions
{
    public static void ApplyAutomaticIndexes(this ModelBuilder modelBuilder)
    {
        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            var clrType = entityType.ClrType;
            if (!typeof(IHasDatabaseIndexDefinitions).IsAssignableFrom(clrType))
            {
                continue;
            }

            var definitionProvider = clrType.GetMethod(
                nameof(IHasDatabaseIndexDefinitions.GetDatabaseIndexDefinitions),
                BindingFlags.Public | BindingFlags.Static);

            if (definitionProvider?.Invoke(null, null) is not IReadOnlyList<DatabaseIndexDefinition> definitions)
            {
                continue;
            }

            var builder = modelBuilder.Entity(clrType);
            foreach (var definition in definitions.Where(definition => definition.PropertyNames.Count > 0))
            {
                var hasExistingIndex = entityType.GetIndexes().Any(index =>
                    index.Properties.Select(property => property.Name).SequenceEqual(definition.PropertyNames));

                if (hasExistingIndex)
                {
                    continue;
                }

                var indexBuilder = builder.HasIndex(definition.PropertyNames.ToArray());
                if (definition.IsUnique)
                {
                    indexBuilder.IsUnique();
                }

                if (!string.IsNullOrWhiteSpace(definition.Filter))
                {
                    indexBuilder.HasFilter(definition.Filter);
                }

                if (!string.IsNullOrWhiteSpace(definition.DatabaseName))
                {
                    indexBuilder.HasDatabaseName(definition.DatabaseName);
                }
            }
        }
    }
}