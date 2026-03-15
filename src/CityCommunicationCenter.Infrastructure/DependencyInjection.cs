using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Application.Services;
using CityCommunicationCenter.Infrastructure.Options;
using CityCommunicationCenter.Infrastructure.Persistence;
using CityCommunicationCenter.Infrastructure.Services;
using CityCommunicationCenter.Infrastructure.SocialMedia;
using CityCommunicationCenter.Infrastructure.Tenancy;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace CityCommunicationCenter.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructureServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.Configure<TenantResolutionOptions>(
            configuration.GetSection(TenantResolutionOptions.SectionName));

        services.AddHttpContextAccessor();
        services.AddScoped<ITenantContextAccessor, HttpTenantContextAccessor>();
        
        var connectionString = configuration.GetConnectionString("CityCommunicationCenter")
            ?? "Server=(localdb)\\MSSQLLocalDB;Database=CityCommunicationCenter;Trusted_Connection=True;TrustServerCertificate=True";
        
        services.AddScoped(_ => new CityCommunicationCenterDbContext(connectionString));

        // Social Media Services
        services.AddHttpClient();
        services.AddSingleton<ISocialMediaSettingsProvider, InMemorySocialMediaSettingsProvider>();
        services.AddScoped<ISocialMediaClientFactory, SocialMediaClientFactory>();
        services.AddScoped<ISocialMediaService, SocialMediaService>();

        // Routing Service
        services.AddScoped<IRoutingService, RoutingService>();

        return services;
    }
}
