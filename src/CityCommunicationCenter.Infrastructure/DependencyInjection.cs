using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Application.Services;
using CityCommunicationCenter.Infrastructure.Options;
using CityCommunicationCenter.Infrastructure.Persistence;
using CityCommunicationCenter.Infrastructure.Services;
using CityCommunicationCenter.Infrastructure.SocialMedia;
using Microsoft.Extensions.Http.Resilience;
using CityCommunicationCenter.Infrastructure.Tenancy;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using System.Data.SqlClient;

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
        var normalizedConnectionString = EnsureConnectionSettings(connectionString);
        
        services.AddScoped(_ => new CityCommunicationCenterDbContext(normalizedConnectionString, commandTimeoutSeconds: 30));

        // Social Media Services
        services.AddHttpClient();
        services.AddHttpClient("SocialMedia_X").AddStandardResilienceHandler(ConfigureSocialMediaResilience);
        services.AddHttpClient("SocialMedia_Facebook").AddStandardResilienceHandler(ConfigureSocialMediaResilience);
        services.AddHttpClient("SocialMedia_Instagram").AddStandardResilienceHandler(ConfigureSocialMediaResilience);
        services.AddHttpClient("SocialMedia_WhatsApp").AddStandardResilienceHandler(ConfigureSocialMediaResilience);
        services.AddSingleton<ISocialMediaSettingsProvider, InMemorySocialMediaSettingsProvider>();
        services.AddScoped<ISocialMediaClientFactory, SocialMediaClientFactory>();
        services.AddScoped<ISocialMediaService, SocialMediaService>();

        // Routing Service
        services.AddScoped<IRoutingService, RoutingService>();

        return services;
    }

    private static string EnsureConnectionSettings(string connectionString)
    {
        var builder = new SqlConnectionStringBuilder(connectionString);

        if (builder.ConnectTimeout < 30)
        {
            builder.ConnectTimeout = 30;
        }

        if (builder.MinPoolSize < 5)
        {
            builder.MinPoolSize = 5;
        }

        if (builder.MaxPoolSize < 100)
        {
            builder.MaxPoolSize = 100;
        }

        return builder.ConnectionString;
    }

    private static void ConfigureSocialMediaResilience(HttpStandardResilienceOptions options)
    {
        options.TotalRequestTimeout.Timeout = TimeSpan.FromSeconds(30);
        options.AttemptTimeout.Timeout = TimeSpan.FromSeconds(10);
        options.Retry.MaxRetryAttempts = 3;
        options.Retry.Delay = TimeSpan.FromSeconds(1);
        options.CircuitBreaker.FailureRatio = 0.5;
        options.CircuitBreaker.MinimumThroughput = 5;
        options.CircuitBreaker.SamplingDuration = TimeSpan.FromSeconds(30);
        options.CircuitBreaker.BreakDuration = TimeSpan.FromSeconds(15);
    }
}
