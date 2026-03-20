using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace CityCommunicationCenter.Infrastructure.Persistence;

public sealed class CityCommunicationCenterDbContextFactory : IDesignTimeDbContextFactory<CityCommunicationCenterDbContext>
{
    public CityCommunicationCenterDbContext CreateDbContext(string[] args)
    {
        var basePath = ResolveBasePath();
        var configuration = new ConfigurationBuilder()
            .SetBasePath(basePath)
            .AddJsonFile("appsettings.json", optional: true)
            .AddJsonFile("appsettings.Development.json", optional: true)
            .AddEnvironmentVariables()
            .Build();

        var connectionString = configuration.GetConnectionString("CityCommunicationCenter");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            connectionString = "Host=localhost;Database=citycommunicationcenter_design;Username=postgres";
        }

        var optionsBuilder = new DbContextOptionsBuilder<CityCommunicationCenterDbContext>();
        optionsBuilder.UseNpgsql(connectionString);

        return new CityCommunicationCenterDbContext(optionsBuilder.Options);
    }

    private static string ResolveBasePath()
    {
        var currentDirectory = Directory.GetCurrentDirectory();
        var apiDirectory = Path.Combine(currentDirectory, "src", "CityCommunicationCenter.Api");

        if (Directory.Exists(apiDirectory))
        {
            return apiDirectory;
        }

        if (currentDirectory.EndsWith("CityCommunicationCenter.Api", StringComparison.OrdinalIgnoreCase))
        {
            return currentDirectory;
        }

        return currentDirectory;
    }
}